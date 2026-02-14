import type { InsightItem, InsightMode } from '../types/mindmap';

interface InsightsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  insights: InsightItem[];
  insightMode: InsightMode;
  onModeChange: (mode: InsightMode) => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  isGenerating: boolean;
}

const MODE_CONFIG: Record<InsightMode, { label: string; icon: string; color: string }> = {
  fact_check: { label: 'Fact Check', icon: '?', color: 'text-amber-400' },
  socratic: { label: 'Socratic', icon: '?', color: 'text-cyan-400' },
  discussion: { label: 'Discussion', icon: '?', color: 'text-violet-400' },
};

const MODES: InsightMode[] = ['fact_check', 'socratic', 'discussion'];

function getModeAccent(mode: InsightMode): string {
  switch (mode) {
    case 'fact_check': return 'border-amber-500/30 bg-amber-500/5';
    case 'socratic': return 'border-cyan-500/30 bg-cyan-500/5';
    case 'discussion': return 'border-violet-500/30 bg-violet-500/5';
  }
}

function getModeIconColor(mode: InsightMode): string {
  switch (mode) {
    case 'fact_check': return 'text-amber-400';
    case 'socratic': return 'text-cyan-400';
    case 'discussion': return 'text-violet-400';
  }
}

export function InsightsPanel({
  isOpen,
  onClose,
  insights,
  insightMode,
  onModeChange,
  onDismiss,
  onDismissAll,
  isGenerating,
}: InsightsPanelProps) {
  const visibleInsights = insights.filter((i) => !i.dismissed);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-50 bg-surface-900/95 backdrop-blur-xl border-l border-neutral-800 shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            <h2 className="text-sm font-semibold text-neutral-200">AI Insights</h2>
            {isGenerating && (
              <span className="w-2 h-2 rounded-full bg-primary-400 recording-pulse" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-neutral-800/50">
          {MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all ${
                mode === insightMode
                  ? `${getModeAccent(mode)} ${getModeIconColor(mode)} border`
                  : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
              }`}
            >
              {MODE_CONFIG[mode].label}
            </button>
          ))}
        </div>

        {/* Insights list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {visibleInsights.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-3 opacity-20">
                {insightMode === 'fact_check' ? '\u2714' : insightMode === 'socratic' ? '?' : '\u2194'}
              </div>
              <p className="text-xs text-neutral-500">
                {isGenerating
                  ? 'Generating insights...'
                  : 'Insights will appear here as you speak. Start recording to begin.'}
              </p>
            </div>
          ) : (
            visibleInsights.map((insight) => (
              <div
                key={insight.id}
                className={`group relative p-3 rounded-xl border transition-all ${getModeAccent(insight.mode)}`}
              >
                <button
                  onClick={() => onDismiss(insight.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-500 hover:text-neutral-300 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
                <p className="text-xs text-neutral-300 leading-relaxed pr-5">{insight.text}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`text-[9px] font-mono uppercase ${getModeIconColor(insight.mode)}`}>
                    {MODE_CONFIG[insight.mode].label}
                  </span>
                  <span className="text-[9px] text-neutral-600">
                    {new Date(insight.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {visibleInsights.length > 0 && (
          <div className="px-4 py-2 border-t border-neutral-800/50">
            <button
              onClick={onDismissAll}
              className="w-full text-[10px] font-mono uppercase tracking-wider text-neutral-500 hover:text-neutral-300 py-1.5 transition-all"
            >
              Dismiss all
            </button>
          </div>
        )}
      </div>
    </>
  );
}
