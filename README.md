# MindFlow

**Turn your conversations into live, restructuring mind maps.**

MindFlow listens to you talk -- alone or with others -- and builds a beautiful, intelligent mind map in real time. As the conversation evolves, the map reorganizes itself, identifying themes, connections, and insights you might have missed.

**[Try it live](https://mindflow-live.netlify.app)** -- no install needed, just bring your API keys.

![MindFlow Screenshot](docs/screenshot-placeholder.png)

## How it works

1. **You talk** -- solo brainstorming, group discussions, lectures, anything
2. **Deepgram** transcribes your speech in real time with speaker identification
3. **An LLM** (Claude or GPT) structures the transcript into a hierarchical mind map
4. **React Flow** renders the map live, with smooth animations as nodes appear and reorganize

## Features

- **Live mind mapping** -- nodes appear and restructure as you speak
- **Speaker diarization** -- each speaker gets their own color in the map
- **Interpretation dial** -- adjust from faithful transcription to opinionated analysis:
  - **Faithful**: organizes what was literally said
  - **Synthesizer** (default): identifies themes, merges related points
  - **Analyst**: highlights contradictions, flags assumptions, suggests missing perspectives
- **Export** -- save as Markdown, JSON, PNG, or OPML (for XMind/FreeMind)
- **Session management** -- auto-saves your conversations, resume anytime
- **Keyboard shortcut** -- press `Space` to toggle recording
- **Dark theme** -- designed as a focused thinking workspace
- **Bring your own keys** -- your API keys never touch our servers

## Quick start

**Option 1: Use the hosted version**

Visit [mindflow-live.netlify.app](https://mindflow-live.netlify.app) -- enter your API keys and start talking.

**Option 2: Run locally**

```bash
git clone https://github.com/YOUR_USERNAME/mindflow.git
cd mindflow
npm install
npm run dev
```

Open http://localhost:5173 in Chrome, enter your API keys, and start talking.

### API keys you need

| Service | What it does | Where to get it | Cost |
|---------|-------------|-----------------|------|
| **Deepgram** | Speech-to-text | [console.deepgram.com](https://console.deepgram.com/signup) | Free $200 credits |
| **OpenAI** or **Anthropic** | Mind map structuring | [platform.openai.com](https://platform.openai.com/api-keys) or [console.anthropic.com](https://console.anthropic.com/) | ~$0.50-2 per 30min session |

## Tech stack

- **React 18** + TypeScript + Vite
- **React Flow** (@xyflow/react) for mind map visualization
- **Deepgram Nova-3** for real-time speech transcription
- **Claude Haiku 4.5** / **GPT-4.1 mini** for mind map structuring
- **Tailwind CSS 4** for styling
- **dagre** for automatic graph layout

## Architecture

```
Microphone → Deepgram WebSocket → Transcript chunks (with speaker labels)
    → LLM structuring (incremental + periodic full regeneration)
    → Mind map JSON → React Flow renderer
```

The app runs entirely in the browser. No backend server. API keys are stored in localStorage and sent directly to the respective API providers.

### Key design decisions

- **Hybrid update strategy**: incremental updates every ~5 seconds for responsiveness, full regeneration every ~50 seconds for quality restructuring
- **Structured output**: all LLM calls enforce JSON schema -- no free-text parsing
- **Error boundaries**: React error boundaries prevent crashes from propagating
- **Stale closure prevention**: all interval callbacks use refs to avoid capturing stale state

## Project structure

```
src/
├── components/     # React components
│   ├── MindMapView.tsx     # React Flow canvas
│   ├── CustomNode.tsx      # Mind map node component
│   ├── ControlBar.tsx      # Record, dial, export controls
│   ├── SettingsPanel.tsx   # API key management
│   └── ...
├── hooks/          # React hooks
│   ├── useDeepgram.ts      # Deepgram WebSocket
│   ├── useMindMap.ts       # LLM orchestration
│   └── ...
├── services/       # API integrations
│   ├── deepgram.ts         # Deepgram streaming
│   ├── llm.ts              # Claude + OpenAI abstraction
│   ├── prompts.ts          # System prompts per interpretation level
│   └── export.ts           # Export formats
├── types/          # TypeScript interfaces
└── utils/          # Layout + color utilities
```

## Security

- API keys are stored in browser localStorage only
- Keys are sent directly to Deepgram/OpenAI/Anthropic -- never to any other server
- No analytics, tracking, or cookies
- The Deepgram key is passed via WebSocket subprotocol header (standard browser auth pattern)

**Note:** Any browser extension or XSS vulnerability could access localStorage. For high-security environments, use session-only mode (don't save keys) and rotate keys regularly.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT -- see [LICENSE](LICENSE)
