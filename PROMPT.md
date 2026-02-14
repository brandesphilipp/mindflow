Build MindFlow -- a live speech-to-mind-map web app. Read docs/SPEC.md for the full requirements, then build the complete working application. Follow CLAUDE.md for all conventions and the quality gate.

The app should do one thing brilliantly: I press a button, start talking (alone or with others), and a beautiful mind map grows and restructures itself live on screen as I speak.

Success criteria:
- I can open it in a browser, enter my Deepgram + LLM API keys, press record, and see a mind map appear within seconds of speaking
- The map restructures intelligently as the conversation evolves (not just append-only)
- It works on desktop Chrome and mobile Chrome (responsive)
- Speaker diarization labels are visible when multiple people talk
- I can adjust the "interpretation dial" from faithful transcription to opinionated analysis
- After stopping, I can export the mind map as JSON, Markdown, or PNG
- The GitHub repo has a clear README that makes someone want to star it and contribute
- `npm run dev` works. `npm run build` produces a deployable static site.

Deploy to Netlify when the build passes your expert panel review. Don't ask me questions -- make good decisions and document them in the README.
