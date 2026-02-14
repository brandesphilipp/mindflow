# MindFlow

**Live speech to knowledge graph. Talk, and watch your ideas connect.**

MindFlow listens to your conversations and builds a living knowledge graph in real time. As you speak, entities are extracted, deduplicated, and linked — revealing structure and connections you didn't know were there.

**[Try it live](https://mindflow-live.netlify.app)** — no install, just bring your API keys.

---

## Why

Most note-taking tools force you to stop thinking in order to start writing. Mind mapping tools require you to manually drag and connect boxes. MindFlow does neither — you just talk, and it builds the map for you.

But traditional mind maps are trees. Real ideas form graphs. MindFlow's knowledge graph backend (powered by [Graphiti](https://github.com/getzep/graphiti) + [FalkorDB](https://www.falkordb.com/)) goes further: it extracts entities, resolves duplicates across your entire conversation, and discovers relationships that a simple tree can't represent.

## What

- **Live knowledge graph** — entities and relationships appear as you speak, powered by Graphiti's temporal knowledge graph engine
- **Entity deduplication** — say "React" ten times, get one node with rich context
- **Relationship extraction** — the LLM identifies how concepts connect (IS_A, USES, BUILT_WITH, CONTRADICTS...)
- **Speaker diarization** — each speaker gets their own color
- **Interpretation dial** — slide from faithful transcription to opinionated analysis:
  - *Faithful*: organizes what was literally said
  - *Synthesizer*: identifies themes, merges related points
  - *Analyst*: highlights contradictions, flags assumptions
- **Client-side fallback** — works without the backend as a tree-structured mind map (direct LLM calls)
- **Export** — Markdown, JSON, PNG, OPML (XMind/FreeMind compatible)
- **Session management** — auto-saves to localStorage, resume anytime
- **Keyboard shortcut** — `Space` to toggle recording
- **BYOK** — bring your own API keys. They never leave your browser (or go only to the APIs you chose).

## How it works

```
Microphone
  → Deepgram Nova-3 (real-time speech-to-text with speaker labels)
  → POST /api/ingest (knowledge graph backend)
  → Graphiti: entity extraction, deduplication, relationship resolution
  → FalkorDB (graph database)
  → GET /api/graph → d3-force layout → React Flow renderer
```

Without the backend, MindFlow falls back to direct LLM calls that produce a tree-structured mind map using dagre layout.

## Quick start

### Use the hosted version

Visit **[mindflow-live.netlify.app](https://mindflow-live.netlify.app)**, enter your API keys, and start talking.

### Run locally (frontend only)

```bash
git clone https://github.com/philippbrandes/mindflow.git
cd mindflow
npm install
npm run dev
```

Open `http://localhost:5173` — enter your API keys and start talking. This runs in client-side fallback mode (tree mind map, no knowledge graph backend).

### Run with knowledge graph backend

```bash
# Start FalkorDB + API server
cd api
docker compose up --build

# In another terminal — start the frontend
cd ..
npm run dev
```

The frontend auto-detects the backend at `localhost:8080`. You'll get the full knowledge graph experience: entity deduplication, relationship extraction, and force-directed graph layout.

### API keys

| Service | Required | What it does | Get it |
|---------|----------|-------------|--------|
| **Deepgram** | Yes | Real-time speech-to-text | [console.deepgram.com](https://console.deepgram.com/signup) (free $200 credit) |
| **OpenAI** | Yes | Embeddings, reranking, and optionally LLM structuring | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** | Optional | LLM structuring (Claude Haiku 4.5 — often better for analysis) | [console.anthropic.com](https://console.anthropic.com/) |

OpenAI is always required because the knowledge graph backend uses OpenAI embeddings for entity resolution. If you also provide an Anthropic key, you can choose Claude as the LLM for entity extraction.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                    │
│                                                         │
│  Microphone → Deepgram WebSocket → Transcript chunks    │
│       │                                                 │
│       ├── Backend mode: POST /api/ingest ───────────┐   │
│       │   GET /api/graph → d3-force → React Flow    │   │
│       │                                             │   │
│       └── Fallback: Direct LLM → dagre → React Flow │   │
└─────────────────────────────────────────────┬───────────┘
                                              │
┌─────────────────────────────────────────────▼───────────┐
│  Backend (FastAPI on Cloud Run)                         │
│                                                         │
│  /api/ingest → Graphiti (entity extraction,             │
│                 deduplication, relationship resolution)  │
│             → FalkorDB (graph storage)                  │
│                                                         │
│  /api/graph  → Direct FalkorDB query → JSON response    │
│  /api/search → Semantic search over knowledge graph     │
└─────────────────────────────────────────────────────────┘
```

### Key design decisions

- **BYOK (Bring Your Own Keys)**: API keys are passed per-request to the backend — the server stores nothing
- **Dual mode**: The frontend works standalone (tree mind map) or with the backend (knowledge graph). No backend? No problem.
- **Ephemeral backend**: FalkorDB runs as a Cloud Run sidecar — data is lost on scale-to-zero, but the frontend caches the full graph in state and localStorage
- **Structured output**: All LLM calls enforce JSON schema — no free-text parsing
- **Hybrid updates**: Incremental updates every ~5s for responsiveness, full regeneration every ~50s for structural quality

## Project structure

```
mindflow/
├── src/
│   ├── components/          # React components
│   │   ├── MindMapView.tsx  # React Flow canvas + force layout
│   │   ├── CustomNode.tsx   # Knowledge graph node rendering
│   │   ├── ControlBar.tsx   # Record, interpretation dial, export
│   │   └── SettingsPanel.tsx # API key management
│   ├── hooks/               # React hooks
│   │   ├── useDeepgram.ts   # Deepgram WebSocket connection
│   │   ├── useMindMap.ts    # LLM orchestration + backend integration
│   │   └── useSessions.ts   # Session persistence
│   ├── services/            # External API integrations
│   │   ├── deepgram.ts      # Deepgram streaming client
│   │   ├── llm.ts           # Claude + OpenAI abstraction
│   │   ├── graphApi.ts      # Knowledge graph backend client
│   │   └── export.ts        # Markdown, JSON, PNG, OPML export
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Layout algorithms + color utilities
├── api/                     # Python backend
│   ├── main.py              # FastAPI app (ingest, graph, search)
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Backend container
│   ├── docker-compose.yml   # Local dev: FalkorDB + API
│   └── service.yaml         # Cloud Run deployment config
├── public/                  # Static assets + fonts
└── docs/                    # Specification + design docs
```

## Tech stack

### Frontend
- **React 19** + TypeScript + Vite
- **React Flow** (@xyflow/react) for graph visualization
- **d3-force** for organic force-directed layout (knowledge graph mode)
- **dagre** for tree layout (fallback mode)
- **Deepgram Nova-3** for real-time speech-to-text
- **Tailwind CSS 4** for styling

### Backend
- **Python 3.11+** + FastAPI + uvicorn
- **Graphiti** (by Zep) for entity extraction, deduplication, and temporal knowledge graphs
- **FalkorDB** (Redis-based graph database)
- **Claude Haiku 4.5** / **GPT-4.1 mini** for entity extraction (user's key)

## Security

- **API keys stay in your browser.** They're stored in localStorage and sent only to the services you chose (Deepgram, OpenAI, Anthropic) or to the MindFlow backend for graph processing.
- **The backend doesn't store keys.** They're passed per-request and used only for that request's LLM/embedding calls.
- **No analytics, tracking, or cookies.**
- **CORS restricted** to the production domain and localhost.
- **Deepgram key** is passed via WebSocket subprotocol (standard browser auth pattern — never in URL).

> **Note:** localStorage is accessible to browser extensions and XSS. For sensitive environments, don't save keys (use session-only mode) and rotate keys regularly.

## Deployment

The hosted version runs on:
- **Frontend**: Netlify (static SPA) — [mindflow-live.netlify.app](https://mindflow-live.netlify.app)
- **Backend**: Google Cloud Run (free tier, scale-to-zero) with FalkorDB as a sidecar container

To deploy your own backend, see [`api/service.yaml`](api/service.yaml) for the Cloud Run multi-container config.

## Contributing

We'd love your help. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for how to get started.

## License

MIT — see [LICENSE](LICENSE)
