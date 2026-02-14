# Contributing to MindFlow

Thanks for wanting to contribute! MindFlow is a young project and contributions of all kinds are welcome.

## Getting started

```bash
git clone https://github.com/YOUR_USERNAME/mindflow.git
cd mindflow
npm install
npm run dev
```

## Project structure

- `src/types/` -- data model (start here to understand the app)
- `src/services/` -- API integrations (Deepgram, LLM, export)
- `src/hooks/` -- React hooks that orchestrate the services
- `src/components/` -- UI components
- `src/utils/` -- layout algorithms and color utilities

## Code conventions

- Functional React components with hooks only
- TypeScript strict mode
- Tailwind CSS for styling -- no external component libraries
- State management via React Context + useReducer (no Redux)
- All LLM calls must use structured output (JSON schema)

## How to contribute

1. Check existing issues or open a new one to discuss your idea
2. Fork the repo and create a feature branch
3. Make your changes with clear, descriptive commits
4. Run `npm run build` to verify everything compiles
5. Open a pull request with a description of what you changed and why

## Ideas for contributions

- Additional LLM providers (Gemini, local models via Ollama)
- Collaborative mode (multiple users contributing to the same map)
- Voice commands ("zoom in on the marketing section")
- Better mobile UI
- Accessibility improvements
- Import from audio files (not just live mic)
- Light theme
- i18n / internationalization

## Code of conduct

Be kind, be constructive, be welcoming. We're all here to build something useful.
