import { useState, useCallback } from 'react';
import type { Session, MindMap } from '../types/mindmap';

const SESSIONS_KEY = 'mindflow_sessions';
const MAX_SESSIONS = 10;

function loadSessions(): Session[] {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore
  }
  return [];
}

function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage might be full -- evict oldest
    try {
      const trimmed = sessions.slice(0, Math.max(1, sessions.length - 2));
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
    } catch {
      // Give up
    }
  }
}

export function useSessions() {
  const [sessions, setSessionsState] = useState<Session[]>(loadSessions);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const createSession = useCallback((): Session => {
    const session: Session = {
      id: `s_${Date.now()}`,
      title: 'New Conversation',
      mindMap: null,
      transcript: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSessionsState((prev) => {
      const updated = [session, ...prev].slice(0, MAX_SESSIONS);
      saveSessions(updated);
      return updated;
    });

    setCurrentSessionId(session.id);
    return session;
  }, []);

  const updateSession = useCallback(
    (id: string, updates: Partial<Pick<Session, 'title' | 'mindMap' | 'transcript'>>) => {
      setSessionsState((prev) => {
        const updated = prev.map((s) =>
          s.id === id
            ? { ...s, ...updates, updatedAt: new Date().toISOString() }
            : s
        );
        saveSessions(updated);
        return updated;
      });
    },
    []
  );

  const deleteSession = useCallback((id: string) => {
    setSessionsState((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSessions(updated);
      return updated;
    });
    setCurrentSessionId((prev) => (prev === id ? null : prev));
  }, []);

  const loadSession = useCallback(
    (id: string): Session | null => {
      return sessions.find((s) => s.id === id) || null;
    },
    [sessions]
  );

  const autoSave = useCallback(
    (mindMap: MindMap | null, transcript: string) => {
      if (!currentSessionId) return;
      const title = mindMap?.root.label || 'New Conversation';
      updateSession(currentSessionId, { mindMap, transcript, title });
    },
    [currentSessionId, updateSession]
  );

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    createSession,
    updateSession,
    deleteSession,
    loadSession,
    autoSave,
  };
}
