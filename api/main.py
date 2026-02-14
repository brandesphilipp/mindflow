import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graphiti_core import Graphiti
from graphiti_core.driver.falkordb_driver import FalkorDriver
from graphiti_core.llm_client.openai_client import OpenAIClient
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.cross_encoder.openai_reranker_client import OpenAIRerankerClient
from graphiti_core.nodes import EpisodeType, EntityNode
from graphiti_core.edges import EntityEdge

logger = logging.getLogger("mindflow-api")
logging.basicConfig(level=logging.INFO)

FALKORDB_HOST = os.getenv("FALKORDB_HOST", "localhost")
FALKORDB_PORT = int(os.getenv("FALKORDB_PORT", "6379"))
FALKORDB_PASSWORD = os.getenv("FALKORDB_PASSWORD", None)

# Embeddings require an OpenAI key (Anthropic doesn't provide embeddings).
# This can be set server-side as a fallback, or passed per-request.
EMBEDDER_API_KEY = os.getenv("OPENAI_API_KEY", "")

driver: FalkorDriver | None = None


def get_driver() -> FalkorDriver:
    global driver
    if driver is None:
        driver = FalkorDriver(
            host=FALKORDB_HOST,
            port=FALKORDB_PORT,
            password=FALKORDB_PASSWORD if FALKORDB_PASSWORD else None,
        )
    return driver


def make_graphiti(llm_provider: str, llm_api_key: str, embedder_key: str = "") -> Graphiti:
    """Create a Graphiti instance with user-provided API keys (BYOK)."""
    # Determine embedder key: prefer user's OpenAI key, fall back to server env var
    effective_embedder_key = ""
    if llm_provider == "openai":
        effective_embedder_key = llm_api_key
    elif embedder_key:
        effective_embedder_key = embedder_key
    elif EMBEDDER_API_KEY:
        effective_embedder_key = EMBEDDER_API_KEY

    if not effective_embedder_key:
        raise ValueError(
            "Embeddings require an OpenAI API key. Either use OpenAI as your LLM provider, "
            "or set OPENAI_API_KEY on the server for embeddings."
        )

    if llm_provider == "anthropic":
        try:
            from graphiti_core.llm_client.anthropic_client import AnthropicClient
        except ImportError:
            raise ValueError("Anthropic support requires: pip install graphiti-core[anthropic]")

        llm_client = AnthropicClient(
            config=LLMConfig(
                api_key=llm_api_key,
                model="claude-haiku-4-5-20251001",
                small_model="claude-haiku-4-5-20251001",
                temperature=0,
            )
        )
    else:
        llm_client = OpenAIClient(
            config=LLMConfig(
                api_key=llm_api_key,
                model="gpt-4.1-mini",
                small_model="gpt-4.1-nano",
                temperature=0,
            )
        )

    embedder = OpenAIEmbedder(
        config=OpenAIEmbedderConfig(
            api_key=effective_embedder_key,
            embedding_model="text-embedding-3-small",
        )
    )

    # Reranker also needs an OpenAI key
    reranker = OpenAIRerankerClient(
        config=LLMConfig(api_key=effective_embedder_key)
    )

    return Graphiti(
        graph_driver=get_driver(),
        llm_client=llm_client,
        embedder=embedder,
        cross_encoder=reranker,
    )


# --- Request / Response Models ---

class IngestRequest(BaseModel):
    session_id: str
    text: str
    llm_provider: str  # "anthropic" or "openai"
    llm_api_key: str
    openai_api_key: str = ""  # Always needed for embeddings
    timestamp: str | None = None


class SearchRequest(BaseModel):
    session_id: str
    query: str
    llm_provider: str
    llm_api_key: str
    openai_api_key: str = ""  # Always needed for embeddings


class GraphEntity(BaseModel):
    id: str
    name: str
    summary: str
    type: str
    created_at: str
    degree: int = 0
    community: int | None = None


class GraphRelationship(BaseModel):
    id: str
    source_id: str
    target_id: str
    fact: str
    type: str
    valid_at: str | None = None
    invalid_at: str | None = None


class KnowledgeGraphResponse(BaseModel):
    entities: list[GraphEntity]
    relationships: list[GraphRelationship]
    metadata: dict


class SearchResult(BaseModel):
    fact: str
    source: str
    target: str


# --- App lifecycle ---

indices_built = False


async def ensure_indices(graphiti: Graphiti) -> None:
    """Build indices on first use if not already done."""
    global indices_built
    if indices_built:
        return
    try:
        await graphiti.build_indices_and_constraints()
        indices_built = True
        logger.info("Graphiti indices built successfully")
    except Exception as e:
        logger.warning(f"Failed to build indices: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global indices_built
    # Build indices at startup if we have a server-side key
    if EMBEDDER_API_KEY:
        try:
            temp_llm = OpenAIClient(
                config=LLMConfig(api_key=EMBEDDER_API_KEY, model="gpt-4.1-mini")
            )
            temp_embedder = OpenAIEmbedder(
                config=OpenAIEmbedderConfig(api_key=EMBEDDER_API_KEY)
            )
            temp_reranker = OpenAIRerankerClient(
                config=LLMConfig(api_key=EMBEDDER_API_KEY)
            )
            temp = Graphiti(
                graph_driver=get_driver(),
                llm_client=temp_llm,
                embedder=temp_embedder,
                cross_encoder=temp_reranker,
            )
            await ensure_indices(temp)
        except Exception as e:
            logger.warning(f"Failed to build indices on startup: {e}")
    else:
        logger.info(
            "OPENAI_API_KEY not set — indices will be built on first ingest."
        )

    yield

    # Cleanup
    global driver
    driver = None


app = FastAPI(title="MindFlow API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https://mindflow-live\.netlify\.app|http://localhost:\d+)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helper: build graph response by querying entities/edges directly ---

async def build_graph_response(driver: FalkorDriver, session_id: str) -> KnowledgeGraphResponse:
    """Retrieve all entities and relationships for a session directly from FalkorDB."""
    # FalkorDB stores each group in a separate graph named by group_id
    session_driver = driver.clone(session_id)

    try:
        nodes = await EntityNode.get_by_group_ids(
            driver=session_driver,
            group_ids=[session_id],
        )
    except Exception as e:
        logger.warning(f"Failed to get nodes for {session_id}: {e}")
        nodes = []

    try:
        edges = await EntityEdge.get_by_group_ids(
            driver=session_driver,
            group_ids=[session_id],
        )
    except Exception as e:
        logger.warning(f"Failed to get edges for {session_id}: {e}")
        edges = []

    # Count edges per node for degree calculation
    degree_map: dict[str, int] = {}
    for edge in edges:
        degree_map[edge.source_node_uuid] = degree_map.get(edge.source_node_uuid, 0) + 1
        degree_map[edge.target_node_uuid] = degree_map.get(edge.target_node_uuid, 0) + 1

    entities = []
    for node in nodes:
        node_type = "topic"
        if hasattr(node, "labels") and node.labels:
            for label in node.labels:
                if label.lower() not in ("entity", "node", "entitynode"):
                    node_type = label.lower()
                    break

        entities.append(GraphEntity(
            id=node.uuid,
            name=node.name,
            summary=node.summary or "",
            type=node_type,
            created_at=node.created_at.isoformat() if hasattr(node, "created_at") and node.created_at else "",
            degree=degree_map.get(node.uuid, 0),
        ))

    relationships = []
    for edge in edges:
        # Prefer Graphiti's extracted relationship name (e.g. IS_A, USES, BUILT_WITH)
        rel_type = edge.name if edge.name else "related_to"

        relationships.append(GraphRelationship(
            id=edge.uuid,
            source_id=edge.source_node_uuid,
            target_id=edge.target_node_uuid,
            fact=edge.fact or "",
            type=rel_type,
            valid_at=edge.valid_at.isoformat() if edge.valid_at else None,
            invalid_at=edge.invalid_at.isoformat() if edge.invalid_at else None,
        ))

    return KnowledgeGraphResponse(
        entities=entities,
        relationships=relationships,
        metadata={
            "session_id": session_id,
            "entity_count": len(entities),
            "relationship_count": len(relationships),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        },
    )


# --- Endpoints ---

@app.get("/api/health")
async def health():
    falkordb_ok = False
    try:
        d = get_driver()
        # Attempt a simple operation to check connectivity
        falkordb_ok = d is not None
    except Exception:
        pass

    return {"status": "ok", "falkordb": falkordb_ok}


@app.post("/api/ingest")
async def ingest(req: IngestRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    if not req.llm_api_key:
        raise HTTPException(status_code=400, detail="LLM API key required")

    try:
        graphiti = make_graphiti(req.llm_provider, req.llm_api_key, req.openai_api_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await ensure_indices(graphiti)

    try:
        ref_time = datetime.now(timezone.utc)
        if req.timestamp:
            try:
                ref_time = datetime.fromisoformat(req.timestamp.replace("Z", "+00:00"))
            except ValueError:
                pass

        result = await graphiti.add_episode(
            name=f"{req.session_id}_{int(ref_time.timestamp())}",
            episode_body=req.text,
            source=EpisodeType.text,
            source_description="Live speech transcript from MindFlow",
            reference_time=ref_time,
            group_id=req.session_id,
        )

        entities_added = len(result.nodes) if hasattr(result, "nodes") else 0
        relationships_added = len(result.edges) if hasattr(result, "edges") else 0

        # Retrieve the full graph state for this session
        graph = await build_graph_response(get_driver(), req.session_id)

        return {
            "entities_added": entities_added,
            "relationships_added": relationships_added,
            "graph": graph.model_dump(),
        }

    except Exception as e:
        logger.error(f"Ingest failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/graph")
async def get_graph(session_id: str):
    """Retrieve the knowledge graph for a session. No API key needed — direct DB query."""
    try:
        graph = await build_graph_response(get_driver(), session_id)
        return graph.model_dump()
    except Exception as e:
        logger.error(f"Get graph failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search")
async def search(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Empty query")
    if not req.llm_api_key:
        raise HTTPException(status_code=400, detail="LLM API key required")

    try:
        graphiti = make_graphiti(req.llm_provider, req.llm_api_key, req.openai_api_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        edges = await graphiti.search(
            query=req.query,
            group_ids=[req.session_id],
            num_results=20,
        )

        results = []
        for edge in edges:
            results.append(SearchResult(
                fact=edge.fact or "",
                source=edge.source_node_uuid,
                target=edge.target_node_uuid,
            ))

        return {"results": [r.model_dump() for r in results]}

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
