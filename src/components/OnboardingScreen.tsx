interface OnboardingScreenProps {
  onOpenSettings: () => void;
}

export function OnboardingScreen({ onOpenSettings }: OnboardingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950">
      <div className="max-w-lg w-full mx-4 text-center fade-in">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-600 to-purple-600 mb-4">
            <svg className="w-10 h-10 text-white" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="6" fill="currentColor" />
              <circle cx="16" cy="18" r="4" fill="currentColor" opacity="0.7" />
              <circle cx="48" cy="18" r="4" fill="currentColor" opacity="0.7" />
              <circle cx="16" cy="46" r="4" fill="currentColor" opacity="0.7" />
              <circle cx="48" cy="46" r="4" fill="currentColor" opacity="0.7" />
              <line x1="32" y1="32" x2="16" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <line x1="32" y1="32" x2="48" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <line x1="32" y1="32" x2="16" y2="46" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <line x1="32" y1="32" x2="48" y2="46" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-neutral-100 tracking-tight">MindFlow</h1>
          <p className="mt-2 text-neutral-400">Turn your conversations into live mind maps</p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8 text-left">
          <div className="flex items-start gap-4 p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 text-sm font-bold shrink-0">1</span>
            <div>
              <h3 className="text-sm font-medium text-neutral-200">Add your API keys</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                You need a{' '}
                <a href="https://console.deepgram.com/signup" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                  Deepgram key
                </a>
                {' '}(free $200 credits) for speech recognition, and an{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                  OpenAI
                </a>
                {' '}or{' '}
                <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                  Anthropic
                </a>
                {' '}key for the AI.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 text-sm font-bold shrink-0">2</span>
            <div>
              <h3 className="text-sm font-medium text-neutral-200">Press record and talk</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Talk alone or with others. MindFlow builds a mind map live as you speak.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 text-sm font-bold shrink-0">3</span>
            <div>
              <h3 className="text-sm font-medium text-neutral-200">Explore, adjust, export</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Adjust the interpretation dial from faithful to analytical. Export as Markdown, JSON, or PNG.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onOpenSettings}
          className="px-8 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium transition-colors"
        >
          Set up API keys
        </button>

        <p className="mt-4 text-xs text-neutral-600">
          Keys are stored locally in your browser. Nothing is sent to our servers.
        </p>
      </div>
    </div>
  );
}
