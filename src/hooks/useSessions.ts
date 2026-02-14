import { useState, useCallback, useRef } from 'react';
import type { Session, MindMap, KnowledgeGraph } from '../types/mindmap';

const SESSIONS_KEY = 'mindflow_sessions';
const CURRENT_SESSION_KEY = 'mindflow_current_session';
const MAX_SESSIONS = 25;

function loadSessions(): Session[] {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (stored) {
      const sessions: Session[] = JSON.parse(stored);
      // Ensure backwards compatibility: add knowledgeGraph field if missing
      for (const s of sessions) {
        if (!('knowledgeGraph' in s)) {
          (s as Session).knowledgeGraph = null;
        }
      }
      // Clean up empty sessions (no mindMap, no knowledgeGraph, and no transcript) except the most recent
      if (sessions.length > 1) {
        const [first, ...rest] = sessions;
        const cleaned = [first, ...rest.filter((s) => s.mindMap || s.knowledgeGraph || s.transcript)];
        if (cleaned.length !== sessions.length) {
          saveSessions(cleaned);
          return cleaned;
        }
      }
      return sessions;
    }
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

function loadCurrentSessionId(): string | null {
  try {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  } catch {
    return null;
  }
}

function saveCurrentSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(CURRENT_SESSION_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  } catch {
    // Ignore
  }
}

export function useSessions() {
  const [sessions, setSessionsState] = useState<Session[]>(loadSessions);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(loadCurrentSessionId);
  const creatingRef = useRef(false);

  // Wrap setCurrentSessionId to also persist to localStorage
  const setCurrentSessionId = useCallback((id: string | null) => {
    setCurrentSessionIdState(id);
    saveCurrentSessionId(id);
  }, []);

  const createSession = useCallback((): Session => {
    // Guard: prevent concurrent creation during React batched updates
    if (creatingRef.current) {
      // Return a dummy — the real session is being created
      return { id: '', title: '', mindMap: null, knowledgeGraph: null, transcript: '', createdAt: '', updatedAt: '' };
    }
    creatingRef.current = true;

    const session: Session = {
      id: `s_${Date.now()}`,
      title: 'New Conversation',
      mindMap: null,
      knowledgeGraph: null,
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

    // Release guard after a tick (state update batching window)
    setTimeout(() => { creatingRef.current = false; }, 100);

    return session;
  }, [setCurrentSessionId]);

  const updateSession = useCallback(
    (id: string, updates: Partial<Pick<Session, 'title' | 'mindMap' | 'knowledgeGraph' | 'transcript'>>) => {
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
    setCurrentSessionIdState((prev) => {
      const next = prev === id ? null : prev;
      saveCurrentSessionId(next);
      return next;
    });
  }, []);

  const loadSession = useCallback(
    (id: string): Session | null => {
      return sessions.find((s) => s.id === id) || null;
    },
    [sessions]
  );

  const autoSave = useCallback(
    (mindMap: MindMap | null, transcript: string, knowledgeGraph?: KnowledgeGraph | null) => {
      if (!currentSessionId) return;
      const title = mindMap?.root.label || 'New Conversation';
      updateSession(currentSessionId, { mindMap, transcript, title, knowledgeGraph: knowledgeGraph ?? null });
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
