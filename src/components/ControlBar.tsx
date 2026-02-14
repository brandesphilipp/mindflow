import type { InterpretationLevel } from '../types/mindmap';
import type { ConnectionState } from '../hooks/useDeepgram';

interface ControlBarProps {
  isRecording: boolean;
  connectionState: ConnectionState;
  interpretationLevel: InterpretationLevel;
  onToggleRecord: () => void;
  onInterpretationChange: (level: InterpretationLevel) => void;
  onOpenSettings: () => void;
  onOpenSessions: () => void;
  onExport: () => void;
  onForceRegen: () => void;
  hasMap: boolean;
}

const INTERPRETATION_LABELS: Record<InterpretationLevel, { label: string; desc: string }> = {
  faithful: { label: 'Faithful', desc: 'Close to what was said' },
  synthesizer: { label: 'Synthesizer', desc: 'Identifies themes & connections' },
  analyst: { label: 'Analyst', desc: 'Highlights gaps & contradictions' },
};

const LEVELS: InterpretationLevel[] = ['faithful', 'synthesizer', 'analyst'];

export function ControlBar({
  isRecording,
  connectionState,
  interpretationLevel,
  onToggleRecord,
  onInterpretationChange,
  onOpenSettings,
  onOpenSessions,
  onExport,
  onForceRegen,
  hasMap,
}: ControlBarProps) {
  return (
    <div className="mindflow-controls fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl">
      {/* Record Button */}
      <button
        onClick={onToggleRecord}
        className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 recording-pulse'
            : 'bg-primary-600 hover:bg-primary-500'
        }`}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <rect x="5" y="5" width="10" height="10" rx="1" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="6" />
          </svg>
        )}

        {connectionState === 'connecting' && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
        )}
        {connectionState === 'reconnecting' && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-orange-400 animate-pulse" />
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-neutral-700" />

      {/* Interpretation Dial */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => onInterpretationChange(level)}
              className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all ${
                level === interpretationLevel
                  ? 'bg-primary-600/30 text-primary-300 border border-primary-500/40'
                  : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
              }`}
              title={INTERPRETATION_LABELS[level].desc}
            >
              {INTERPRETATION_LABELS[level].label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-neutral-700" />

      {/* Regenerate */}
      <button
        onClick={onForceRegen}
        disabled={!hasMap}
        className="p-2 rounded-lg text-neutral-400 hover:text-primary-300 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Regenerate entire map"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
        </svg>
      </button>

      {/* Export */}
      <button
        onClick={onExport}
        disabled={!hasMap}
        className="p-2 rounded-lg text-neutral-400 hover:text-primary-300 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Export mind map"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      </button>

      {/* Sessions */}
      <button
        onClick={onOpenSessions}
        className="p-2 rounded-lg text-neutral-400 hover:text-primary-300 hover:bg-neutral-800 transition-all"
        title="Sessions"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </button>

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className="p-2 rounded-lg text-neutral-400 hover:text-primary-300 hover:bg-neutral-800 transition-all"
        title="Settings"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>
    </div>
  );
}
