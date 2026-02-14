# Contributing to MindFlow

Thanks for your interest in MindFlow! Whether you're fixing a bug, improving the UI, or building a new feature — contributions are welcome.

## Getting started

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.11+** (only if working on the backend)
- **Docker** (only if running the knowledge graph backend locally)

### Setup

```bash
# Clone the repo
git clone https://github.com/philippbrandes/mindflow.git
cd mindflow

# Install frontend dependencies
npm install

# Start the frontend dev server
npm run dev
```

To work with the knowledge graph backend:

```bash
# Start FalkorDB + API (requires Docker)
cd api
docker compose up --build

# The frontend will auto-detect the backend at localhost:8080
```

### API keys for development

You'll need at minimum:
- A **Deepgram** key ([free $200 credit](https://console.deepgram.com/signup))
- An **OpenAI** key ([platform.openai.com](https://platform.openai.com/api-keys))

Enter them in the settings panel when you open the app.

## How to contribute

### Found a bug?

1. Check [existing issues](https://github.com/philippbrandes/mindflow/issues) first
2. Open a new issue with steps to reproduce
3. If you can fix it, submit a PR referencing the issue

### Want to add a feature?

1. Open an issue describing what you'd like to build and why
2. Wait for a thumbs-up before investing time — we want to make sure it fits the project direction
3. Submit a PR when ready

### Want to improve the docs?

Just open a PR. No issue needed for doc fixes.

## Project structure

```
src/
├── components/    # React components (UI)
├── hooks/         # React hooks (state + logic)
├── services/      # External API integrations (Deepgram, LLM, graph backend)
├── types/         # TypeScript type definitions
└── utils/         # Layout algorithms, color utilities

api/
├── main.py        # FastAPI backend (knowledge graph engine)
├── Dockerfile     # Backend container
└── ...
```

**Key conventions:**
- All LLM and API integration lives in `src/services/` — keep it separate from UI
- Types live in `src/types/mindmap.ts` — single source of truth
- Functional components with hooks only — no class components
- All LLM calls use structured output (JSON schema) — no free-text parsing
- Backend code is fully async (Graphiti is async)

## Code style

- **TypeScript** for all frontend code
- **Tailwind CSS 4** for styling — no component libraries
- **Python** with type hints for backend code
- Run `npm run lint` before submitting

## Pull requests

- Keep PRs focused — one feature or fix per PR
- Write a clear description of what changed and why
- Add screenshots for UI changes
- Make sure `npm run build` passes (TypeScript + Vite build)
- Test with at least one LLM provider (OpenAI or Anthropic)

## Areas where help is needed

Here are some things we'd love contributions on:

- **Persistent storage** — the knowledge graph is currently ephemeral (lost on Cloud Run scale-to-zero). Adding persistent FalkorDB or an alternative storage backend would be valuable.
- **Multi-language support** — Deepgram supports many languages, but the LLM prompts are English-only
- **Accessibility** — screen reader support, keyboard navigation improvements
- **Mobile experience** — the app works on desktop but the touch experience needs love
- **Graph visualization** — better clustering, minimap, zoom-to-fit improvements
- **Export formats** — additional export targets (Notion, Obsidian, Logseq)
- **Testing** — unit tests for hooks and services, integration tests for the backend
- **Additional LLM providers** — Gemini, local models via Ollama
- **Voice commands** — "zoom in on the marketing section"
- **Audio file import** — not just live mic

## Code of conduct

Be kind, be constructive, be welcoming. We're all here to build something useful.
