# MindFlow Product Specification

## Overview
MindFlow converts live speech into a dynamically restructuring mind map. It runs entirely in the browser -- users provide their own API keys for Deepgram (speech-to-text) and an LLM provider (Claude or OpenAI) for structuring.

## Architecture

### Data Flow
```
Microphone → Deepgram WebSocket → Transcript chunks (with speaker labels)
    → LLM structuring service → Mind map JSON → React Flow renderer
```

### Speech-to-Text Layer (`src/services/deepgram.ts`)
- Connect to Deepgram Nova-3 via WebSocket (`wss://api.deepgram.com/v1/listen`)
- Parameters: `model=nova-3`, `diarize=true`, `interim_results=true`, `utterance_end_ms=1000`, `smart_format=true`
- Use `navigator.mediaDevices.getUserMedia()` for mic access
- Send audio chunks via MediaRecorder
- Emit events: `onTranscript(text, speaker, isFinal)`, `onUtteranceEnd()`, `onError(err)`
- Handle reconnection on WebSocket drop (exponential backoff, max 3 retries)
- API key passed via Sec-WebSocket-Protocol header

### LLM Structuring Layer (`src/services/llm.ts`)
- Thin abstraction supporting both Anthropic and OpenAI APIs
- User selects provider + enters API key in settings
- All calls use structured output (JSON schema) -- never free-text parsing
- Two modes of operation:

**Incremental update** (every ~5 seconds or on utterance end):
- Input: current mind map JSON + new transcript chunk
- Output: updated complete mind map JSON
- Uses faster/cheaper model (Haiku 4.5 or GPT-4.1 mini)

**Full regeneration** (every ~50 seconds, or on user trigger):
- Input: full transcript so far
- Output: complete restructured mind map JSON
- This is where the map "reorganizes" as themes evolve

**Interpretation dial** (user-adjustable):
- Level 1 "Faithful": organize what was literally said, minimal inference
- Level 2 "Synthesizer" (default): identify themes, merge related points, suggest connections
- Level 3 "Analyst": highlight contradictions, flag assumptions, suggest missing perspectives
- Implemented via system prompt variations, not separate code paths

### Mind Map Data Model (`src/types/mindmap.ts`)
```typescript
interface MindMapNode {
  id: string;
  label: string;
  type: 'topic' | 'point' | 'detail' | 'action' | 'question';
  speaker: string | null;       // "Speaker 0", "Speaker 1", etc.
  timestamp: number | null;     // seconds into recording
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
  metadata: {
    version: number;
    totalSpeakers: number;
    durationSeconds: number;
    lastUpdated: string;
  };
}
```

### Mind Map Renderer (`src/components/MindMapView.tsx`)
- Built on React Flow (@xyflow/react)
- Use dagre layout algorithm for automatic tree positioning
- Animate node additions (fade+scale in) and repositioning (smooth transitions)
- Custom node component with:
  - Color coding by node type
  - Speaker indicator (subtle border color)
  - Expand/collapse for branches
  - Click to see full context (what was said, timestamp, speaker)
- Auto-fit viewport as map grows, but allow manual pan/zoom
- Cross-references rendered as dashed curved edges

### UI Layout
- **Full-screen mind map** as the primary view (95% of screen)
- **Floating control bar** (bottom center): Record/Stop button, interpretation dial slider, settings gear, export button
- **Settings panel** (slide-in drawer): API key inputs (Deepgram, Claude, OpenAI), provider selection, speaker name mapping, theme toggle
- **Live transcript ticker** (optional, collapsible): scrolling text at the bottom showing what's being heard in real-time
- **First-use onboarding**: If no API keys are set, show a friendly setup screen explaining what keys are needed and where to get them (with links to Deepgram signup, Anthropic console, OpenAI platform)

### Speaker Management
- Deepgram provides numeric labels (Speaker 0, Speaker 1, ...)
- UI allows mapping numbers to names (editable labels)
- Speaker colors auto-assigned from a palette
- In the mind map, speaker is shown as a subtle colored border on nodes

### Export (`src/services/export.ts`)
- **JSON**: Raw mind map data (for re-import or programmatic use)
- **Markdown**: Hierarchical bullet list with headers
- **PNG**: Screenshot of the current React Flow viewport (use react-flow's `toObject()` + html-to-image)
- **OPML**: For import into traditional mind mapping tools (XMind, FreeMind, MindManager)

### Persistence
- Auto-save current session to localStorage every 30 seconds
- On page load, offer to resume previous session or start fresh
- Session history: keep last 10 sessions in localStorage with title (auto-generated from root node label) and timestamp
- "Sessions" panel accessible from settings

### Error Handling
- No mic permission → clear message explaining how to enable, with browser-specific instructions
- Invalid API key → test the key on entry, show success/failure immediately
- Network dropout → pause gracefully, show "reconnecting..." state, auto-retry, resume when connected
- LLM rate limit → queue requests, slow update frequency, show "processing..." state
- Empty transcript (silence) → don't send to LLM, show subtle "listening..." state

## Non-Functional Requirements
- First meaningful paint < 2 seconds
- Mind map update latency < 3 seconds from speech
- Works offline for the UI (map viewing, export) -- only needs network for recording
- Mobile responsive: on small screens, mind map is full-screen with floating controls
- No tracking, no analytics, no cookies beyond localStorage for settings/sessions
- MIT license

## Repository Structure
```
mindflow/
├── README.md              # Compelling, well-structured, with demo GIF placeholder
├── CONTRIBUTING.md         # How to contribute, code style, PR process
├── LICENSE                 # MIT
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css           # Tailwind imports + custom properties
│   ├── components/
│   │   ├── MindMapView.tsx  # React Flow mind map
│   │   ├── CustomNode.tsx   # Mind map node component
│   │   ├── ControlBar.tsx   # Record, dial, export, settings buttons
│   │   ├── SettingsPanel.tsx # API keys, provider selection, speaker names
│   │   ├── TranscriptTicker.tsx
│   │   ├── OnboardingScreen.tsx
│   │   └── SessionManager.tsx
│   ├── hooks/
│   │   ├── useDeepgram.ts   # Deepgram WebSocket connection
│   │   ├── useMindMap.ts    # Mind map state + LLM update orchestration
│   │   ├── useSettings.ts   # Settings persistence
│   │   └── useSessions.ts   # Session save/load
│   ├── services/
│   │   ├── deepgram.ts      # Deepgram streaming client
│   │   ├── llm.ts           # LLM abstraction (Claude + OpenAI)
│   │   ├── prompts.ts       # System prompts for each interpretation level
│   │   └── export.ts        # Export to JSON/MD/PNG/OPML
│   ├── types/
│   │   └── mindmap.ts       # MindMapNode, CrossReference, MindMap types
│   └── utils/
│       ├── layout.ts        # dagre layout computation
│       └── colors.ts        # Node type + speaker color palettes
└── docs/
    └── SPEC.md              # This file
```
