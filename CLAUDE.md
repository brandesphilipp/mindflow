# MindFlow

## Project
MindFlow is an open-source web app that converts live speech into a dynamically restructuring mind map. Users bring their own API keys (Deepgram for speech-to-text, Claude or OpenAI for LLM structuring).

## Tech Stack
- **Framework**: React 18+ with TypeScript, scaffolded with Vite
- **Mind map rendering**: React Flow (@xyflow/react) with dagre for auto-layout
- **Speech-to-text**: Deepgram Nova-3 streaming via WebSocket (browser-side)
- **LLM structuring**: Support both Claude (Anthropic) and OpenAI APIs via a thin abstraction layer
- **Styling**: Tailwind CSS 4. No component libraries -- custom components for a distinctive look.
- **Hosting**: Static SPA deployable to Netlify/Vercel/Cloudflare Pages
- **No backend server**: Everything runs client-side. API keys stored in browser localStorage.

## Code Conventions
- Functional React components with hooks only
- State management: React Context + useReducer for mind map state (no Redux)
- File structure: `src/components/`, `src/hooks/`, `src/services/`, `src/types/`, `src/utils/`
- All LLM/Deepgram integration in `src/services/` -- clean separation from UI
- Types in `src/types/mindmap.ts` -- single source of truth for the mind map data model
- Use structured output (JSON schema) for all LLM calls -- never parse free-text
- Error boundaries around audio and API components -- a failed API call should never crash the map

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
- The mind map should be the hero -- full viewport, minimal chrome
- Subtle animations: nodes should appear with a gentle fade+scale, connections should draw in
- Color-code node types: topics (warm), points (cool), actions (accent), questions (distinct)
- Speaker identification shown via subtle node border colors, not loud labels
- The recording state should be unmistakable -- a clear pulsing indicator
