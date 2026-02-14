# MindFlow

## Project
MindFlow is an open-source web app that converts live speech into a dynamically restructuring knowledge graph (mind map). Users bring their own API keys (Deepgram for speech-to-text, Claude or OpenAI for LLM structuring). An optional Python backend powered by Graphiti + FalkorDB provides entity deduplication, relationship extraction, and temporal knowledge graph capabilities.

## Architecture

### Frontend (React SPA on Netlify)
- **Framework**: React 19 with TypeScript, scaffolded with Vite
- **Graph rendering**: React Flow (@xyflow/react) with dual layout modes:
  - **Tree mode** (dagre): For client-side LLM fallback
  - **Graph mode** (d3-force): For knowledge graph backend — organic, force-directed layout with natural clustering
- **Speech-to-text**: Deepgram Nova-3 streaming via WebSocket (browser-side)
- **LLM structuring**: Dual mode:
  - **Backend mode** (preferred): Sends transcript to Graphiti backend, receives knowledge graph
  - **Client-side fallback**: Direct Claude/OpenAI calls for tree-structured mind map (works without backend)
- **Styling**: Tailwind CSS 4. No component libraries — custom components for a distinctive look.
- **Hosting**: Static SPA on Netlify (mindflow-live.netlify.app)

### Backend (Python FastAPI on Google Cloud Run)
- **Knowledge graph engine**: Graphiti (by Zep) — entity extraction, deduplication, resolution
- **Graph database**: FalkorDB (Redis-based, Graphiti's default)
- **LLM**: Uses the user's API key (passed per-request) for entity extraction — BYOK model preserved
- **Hosting**: Google Cloud Run free tier (2M req/month, scale-to-zero)
- **Multi-tenancy**: Sessions isolated via Graphiti's group_id

### Data Flow
```
Microphone → Deepgram WebSocket → Transcript chunks
  → POST /api/ingest (backend) → Graphiti entity extraction → FalkorDB
  → GET /api/graph → Knowledge graph JSON → d3-force layout → React Flow
```

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, @xyflow/react, d3-force, dagre, Tailwind CSS 4
- **Backend**: Python 3.11+, FastAPI, graphiti-core, FalkorDB, uvicorn
- **APIs**: Deepgram Nova-3 (STT), Claude Haiku 4.5 / GPT-4.1 mini (LLM)
- **Deployment**: Netlify (frontend), Google Cloud Run (backend), FalkorDB Cloud or self-hosted

## Code Conventions
- Functional React components with hooks only
- State management: React Context + useReducer for mind map state (no Redux)
- File structure: `src/components/`, `src/hooks/`, `src/services/`, `src/types/`, `src/utils/`
- All LLM/Deepgram integration in `src/services/` — clean separation from UI
- Types in `src/types/mindmap.ts` — single source of truth for data model
- Use structured output (JSON schema) for all LLM calls — never parse free-text
- Error boundaries around audio and API components — a failed API call should never crash the map
- Backend Python code uses async/await throughout (Graphiti is async)

## Quality Gate (Expert Panel)
Before returning any version to the user, conduct a self-review with these 5 simulated experts. Each rates 0-100 with specific improvement recommendations. If average < 85, implement fixes and re-review.

1. **Senior Frontend Engineer**: Component architecture, state management, rendering performance, React Flow integration quality, TypeScript correctness
2. **UX Designer**: First-use experience (can a non-technical person figure it out in 30 seconds?), visual hierarchy, responsive behavior, accessibility, loading states, error states
3. **Security Engineer**: API key handling (never logged, never sent to wrong endpoint), XSS prevention, Content Security Policy headers, no secrets in built artifacts
4. **QA Engineer**: Edge cases (no mic permission, invalid API key, network dropout mid-stream, empty transcript, very long sessions), error messages that help users fix problems
5. **Open Source Maintainer**: README quality, setup instructions, contribution guide, code readability, would a contributor understand the codebase in 15 minutes?

## Frontend Aesthetics
Do NOT create generic "AI slop" design. MindFlow should feel like a premium thinking tool:
- Dark theme by default (like a focused workspace), with light theme toggle
- Typography: Use a distinctive, readable font (not Inter/Arial/Roboto). Consider Space Mono for code-like elements, paired with a clean sans-serif like Outfit or Satoshi for UI text.
- The mind map/knowledge graph should be the hero — full viewport, minimal chrome
- Subtle animations: nodes should appear with a gentle fade+scale, connections should draw in
- In graph mode: organic force-directed layout with natural clustering, edge types color-coded
- Speaker identification shown via subtle node border colors, not loud labels
- The recording state should be unmistakable — a clear pulsing indicator
