import type { Session } from '../types/mindmap';

interface SessionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  currentSessionId: string | null;
  onLoadSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
}

export function SessionManager({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  onNewSession,
}: SessionManagerProps) {
  if (!isOpen) return null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-neutral-900 border-l border-neutral-800 overflow-y-auto fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-100">Sessions</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => { onNewSession(); onClose(); }}
            className="w-full mb-4 px-4 py-2.5 bg-primary-600/20 border border-primary-600/30 rounded-lg text-sm text-primary-300 hover:bg-primary-600/30 transition-colors"
          >
            + New Session
          </button>

          {sessions.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No saved sessions yet</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group p-3 rounded-lg border transition-colors cursor-pointer ${
                    session.id === currentSessionId
                      ? 'bg-primary-600/10 border-primary-600/30'
                      : 'bg-neutral-800/50 border-neutral-800 hover:border-neutral-700'
                  }`}
                  onClick={() => { onLoadSession(session.id); onClose(); }}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-neutral-200 truncate">{session.title}</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">{formatDate(session.updatedAt)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-500 hover:text-red-400 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
