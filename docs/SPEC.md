# MindFlow Product Specification

## Overview
MindFlow converts live speech into a dynamically restructuring knowledge graph. It runs as a React SPA with an optional Python backend for knowledge graph capabilities. Users provide their own API keys for Deepgram (speech-to-text) and an LLM provider (Claude or OpenAI).

## Architecture

### System Overview
```
[Browser - React SPA on Netlify]
  ├─ Deepgram WebSocket (STT, client-side)
  ├─ POST /api/ingest   → send transcript to backend
  ├─ GET  /api/graph     → get knowledge graph for rendering
  └─ POST /api/search    → query the knowledge graph
          │
          ▼
[Backend - Python FastAPI on Google Cloud Run]
  ├─ graphiti-core (entity extraction, resolution, graph management)
  ├─ LLM calls (using user's API key, passed from frontend)
  └─ FalkorDB driver
          │
          ▼
[FalkorDB (Redis-based graph database)]
  └─ Knowledge graph storage (entities, relationships, episodes)
```

### Dual-Mode Operation
The app operates in two modes depending on whether a backend URL is configured:

**Backend mode (preferred):** Frontend sends transcript chunks to the Graphiti backend. Graphiti extracts entities, deduplicates them, builds relationships, and returns a knowledge graph. Frontend renders with force-directed layout.

**Client-side fallback:** When no backend URL is configured, the app uses direct LLM calls to structure transcripts into a JSON tree (the original behavior). This ensures the app works without any backend.

### Speech-to-Text Layer (`src/services/deepgram.ts`)
- Connect to Deepgram Nova-3 via WebSocket (`wss://api.deepgram.com/v1/listen`)
- Parameters: `model=nova-3`, `diarize=true`, `interim_results=true`, `utterance_end_ms=1000`, `smart_format=true`
- Use `navigator.mediaDevices.getUserMedia()` for mic access
- Send audio chunks via MediaRecorder
- Emit events: `onTranscript(text, speaker, isFinal)`, `onUtteranceEnd()`, `onError(err)`
- Handle reconnection on WebSocket drop (exponential backoff, max 3 retries)
- API key passed via Sec-WebSocket-Protocol header

### LLM Structuring Layer — Client-Side Fallback (`src/services/llm.ts`)
- Thin abstraction supporting both Anthropic and OpenAI APIs
- All calls use structured output (JSON schema) — never free-text parsing
- Two modes of operation:

**Incremental update** (every ~5 seconds or on utterance end):
- Input: current mind map JSON + new transcript chunk
- Output: updated complete mind map JSON
- Uses faster/cheaper model (Haiku 4.5 or GPT-4.1 mini)

**Full regeneration** (every ~50 seconds, or on user trigger):
- Input: full transcript so far
- Output: complete restructured mind map JSON

**Interpretation dial** (user-adjustable):
- Level 1 "Faithful": organize what was literally said, minimal inference
- Level 2 "Synthesizer" (default): identify themes, merge related points, suggest connections
- Level 3 "Analyst": highlight contradictions, flag assumptions, suggest missing perspectives

### Knowledge Graph Backend (`mindflow-api/`)

**Technology:**
- **Graphiti** (by Zep): Python framework for building temporal knowledge graphs from conversation
- **FalkorDB**: Redis-based graph database, Graphiti's default backend
- Entity deduplication via 3-stage process: string matching → fuzzy/LSH → LLM-based resolution
- Retrieval uses zero LLM calls (semantic embeddings + BM25 + graph traversal), P95 ~300ms

**API Endpoints:**

`POST /api/ingest`
```json
Request: {
  "session_id": "s_1234",
  "text": "[Speaker 0]: I think we should use React for the frontend.",
  "llm_provider": "anthropic",
  "llm_api_key": "sk-...",
  "timestamp": "2026-02-14T12:00:00Z"
}
Response: {
  "entities_added": 2,
  "relationships_added": 1,
  "graph": { "entities": [...], "relationships": [...] }
}
```

`GET /api/graph?session_id=s_1234`
```json
Response: {
  "entities": [
    { "id": "uuid", "name": "React", "summary": "Frontend framework", "type": "topic", "created_at": "..." }
  ],
  "relationships": [
    { "id": "uuid", "source_id": "...", "target_id": "...", "fact": "Speaker suggested using React for frontend", "type": "supports" }
  ]
}
```

`POST /api/search`
```json
Request: { "session_id": "s_1234", "query": "What technology choices were discussed?" }
Response: { "results": [{ "fact": "...", "source": "...", "target": "..." }] }
```

`GET /api/health`
```json
Response: { "status": "ok", "graphiti": true, "falkordb": true }
```

**Design decisions:**
- Backend holds FalkorDB credentials (env vars, not exposed to frontend)
- User's LLM API key passed per-request in request body (preserves BYOK model)
- Sessions isolated via Graphiti's `group_id` (multi-tenant on single FalkorDB instance)
- Backend is stateless — all state lives in FalkorDB
- CORS configured to allow requests from the Netlify frontend domain

### Data Model (`src/types/mindmap.ts`)

**Tree model (client-side fallback):**
```typescript
interface MindMapNode {
  id: string;
  label: string;
  type: 'topic' | 'point' | 'detail' | 'action' | 'question';
  speaker: string | null;
  timestamp: number | null;
  confidence?: 'high' | 'low';
  children: MindMapNode[];
}

interface CrossReference {
  sourceId: string;
  targetId: string;
  relationship: 'supports' | 'contradicts' | 'elaborates' | 'related_to';
}

interface MindMap {
  root: MindMapNode;
  crossReferences: CrossReference[];
  metadata: { version: number; totalSpeakers: number; durationSeconds: number; lastUpdated: string; };
}
```

**Knowledge graph model (backend mode):**
```typescript
interface GraphEntity {
  id: string;
  name: string;
  summary: string;
  type: string;          // e.g. "topic", "person", "decision", "action"
  created_at: string;
  degree: number;        // number of connections (for sizing)
  community?: number;    // cluster ID (for coloring)
}

interface GraphRelationship {
  id: string;
  source_id: string;
  target_id: string;
  fact: string;          // human-readable description
  type: string;          // "supports", "contradicts", "elaborates", "causes", "questions", "related_to"
  valid_at?: string;
  invalid_at?: string;
}

interface KnowledgeGraph {
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  metadata: { session_id: string; entity_count: number; relationship_count: number; last_updated: string; };
}
```

**Session model:**
```typescript
interface Session {
  id: string;
  title: string;
  mindMap: MindMap | null;              // client-side fallback data
  knowledgeGraph: KnowledgeGraph | null; // backend mode data
  transcript: string;
  createdAt: string;
  updatedAt: string;
}
```

### Mind Map Renderer (`src/components/MindMapView.tsx`)
- Built on React Flow (@xyflow/react)
- **Tree mode (dagre):** Automatic tree positioning for client-side fallback data
- **Graph mode (d3-force):** Force-directed layout for knowledge graph data
  - `forceLink()` — attract connected nodes
  - `forceManyBody()` — repel unconnected nodes
  - `forceCenter()` — pull toward canvas center
  - `forceCollide()` — prevent node overlap
- Custom node component with:
  - Color coding by node/entity type
  - Speaker indicator (subtle border color)
  - Node sizing by degree centrality (graph mode) or depth (tree mode)
  - Click to see full context
- Auto-fit viewport as map grows, but allow manual pan/zoom
- Edge styling by relationship type:
  - `supports` → solid green, thin
  - `contradicts` → dashed red
  - `elaborates` → solid white (default)
  - `causes` → solid orange
  - `questions` → dotted purple
  - `related_to` → thin gray, low opacity

### UI Layout
- **Full-screen mind map** as the primary view (95% of screen)
- **Floating control bar** (bottom center): Record/Stop, interpretation dial, settings, export, insights
- **Settings panel** (slide-in drawer): API keys, provider selection, backend URL, speaker name mapping, theme toggle
- **Live transcript ticker** (optional, collapsible): scrolling text at the bottom
- **First-use onboarding**: If no API keys are set, show setup screen
- **Insights panel**: AI-generated observations (fact-check, socratic, discussion modes)

### Speaker Management
- Deepgram provides numeric labels (Speaker 0, Speaker 1, ...)
- UI allows mapping numbers to names
- Speaker colors auto-assigned from a palette
- Speaker shown as subtle colored border on nodes

### Export (`src/services/export.ts`)
- **JSON**: Raw data (mind map or knowledge graph)
- **Markdown**: Hierarchical bullet list (tree mode) or entity/relationship listing (graph mode)
- **PNG**: Screenshot of the current viewport
- **OPML**: For import into traditional mind mapping tools (tree mode only)

### Persistence
- Auto-save current session to localStorage every 30 seconds
- On page load, offer to resume previous session or start fresh
- Session history: keep last 10 sessions with title and timestamp
- Both `mindMap` and `knowledgeGraph` fields saved per session
- Backwards compatible: old sessions with only `mindMap` still render in tree mode

### Error Handling
- No mic permission → clear message explaining how to enable
- Invalid API key → test the key on entry, show success/failure
- Network dropout → pause gracefully, show "reconnecting...", auto-retry
- LLM rate limit → queue requests, slow update frequency
- Backend unreachable → show warning, automatically fall back to client-side mode
- Empty transcript (silence) → don't send to LLM, show "listening..." state

## Backend Deployment

### FalkorDB
- Use FalkorDB Cloud free tier, or self-host via Docker
- Single container: `docker run -p 6379:6379 falkordb/falkordb`
- Persistent volume for data retention

### Graphiti + FastAPI Backend
- Dockerized Python app with graphiti-core, FastAPI, uvicorn
- Deploy to Google Cloud Run (always-free tier: 2M requests/month, scale-to-zero)
- Environment variables: `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_PASSWORD`
- CORS: Allow frontend origin (mindflow-live.netlify.app)
- Health check endpoint for Cloud Run container health probes

### Google Cloud Run Setup
1. Build Docker image: `docker build -t mindflow-api .`
2. Push to Artifact Registry or use Cloud Build
3. Deploy: `gcloud run deploy mindflow-api --image=... --allow-unauthenticated`
4. Set env vars for FalkorDB connection
5. Get the assigned URL (e.g., `https://mindflow-api-xxxxx.run.app`)

## Non-Functional Requirements
- First meaningful paint < 2 seconds
- Mind map update latency < 3 seconds from speech (client-side), < 5 seconds (backend mode)
- Works offline for the UI (map viewing, export) — only needs network for recording
- Mobile responsive: on small screens, mind map is full-screen with floating controls
- No tracking, no analytics, no cookies beyond localStorage for settings/sessions
- MIT license

## Repository Structure
```
mindflow/
├── README.md
├── CONTRIBUTING.md
├── LICENSE                 # MIT
├── CLAUDE.md               # AI coding assistant instructions
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── public/
│   ├── favicon.svg
│   └── fonts/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── MindMapView.tsx
│   │   ├── CustomNode.tsx
│   │   ├── ControlBar.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── TranscriptTicker.tsx
│   │   ├── OnboardingScreen.tsx
│   │   ├── SessionManager.tsx
│   │   ├── InsightsPanel.tsx
│   │   ├── ExportMenu.tsx
│   │   └── ErrorBoundary.tsx
│   ├── hooks/
│   │   ├── useDeepgram.ts
│   │   ├── useMindMap.ts
│   │   ├── useSettings.ts
│   │   ├── useSessions.ts
│   │   └── useInsights.ts
│   ├── services/
│   │   ├── deepgram.ts
│   │   ├── llm.ts
│   │   ├── prompts.ts
│   │   ├── graphApi.ts      # NEW — backend API client
│   │   ├── insights.ts
│   │   └── export.ts
│   ├── types/
│   │   └── mindmap.ts
│   └── utils/
│       ├── layout.ts
│       └── colors.ts
├── docs/
│   └── SPEC.md              # This file
└── mindflow-api/            # NEW — Python backend
    ├── main.py              # FastAPI app
    ├── requirements.txt
    ├── Dockerfile
    ├── docker-compose.yml   # FalkorDB + API for local dev
    ├── .env.example
    └── README.md
```
