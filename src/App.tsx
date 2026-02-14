import { useState, useCallback, useEffect, useRef } from 'react';
import { MindMapView } from './components/MindMapView';
import { ControlBar } from './components/ControlBar';
import { SettingsPanel } from './components/SettingsPanel';
import { TranscriptTicker } from './components/TranscriptTicker';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ExportMenu } from './components/ExportMenu';
import { SessionManager } from './components/SessionManager';
import { InsightsPanel } from './components/InsightsPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSettings } from './hooks/useSettings';
import { useDeepgram } from './hooks/useDeepgram';
import { useMindMap } from './hooks/useMindMap';
import { useInsights } from './hooks/useInsights';
import { useSessions } from './hooks/useSessions';
import type { TranscriptChunk, MindMap, KnowledgeGraph } from './types/mindmap';

export default function App() {
  const { settings, updateSettings, isConfigured, getLLMApiKey } = useSettings();
  const {
    sessions,
    currentSessionId,
    createSession,
    deleteSession,
    loadSession,
    autoSave,
    setCurrentSessionId,
  } = useSessions();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [autoFocusEnabled, setAutoFocusEnabled] = useState(true);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    insights,
    undismissedCount,
    isGenerating: isGeneratingInsights,
    maybeGenerateInsights,
    dismissInsight,
    dismissAll: dismissAllInsights,
    clearInsights,
  } = useInsights({
    llmProvider: settings.llmProvider,
    llmApiKey: getLLMApiKey(),
    insightMode: settings.insightMode,
  });

  // Wrap autoSave to accept optional knowledgeGraph
  const handleAutoSave = useCallback(
    (mindMap: MindMap | null, transcript: string, knowledgeGraph?: KnowledgeGraph | null) => {
      autoSave(mindMap, transcript, knowledgeGraph ?? null);
    },
    [autoSave]
  );

  const {
    mindMap,
    setMindMap,
    knowledgeGraph,
    setKnowledgeGraph,
    isProcessing,
    llmError,
    clearError: clearLlmError,
    addTranscriptChunk,
    handleUtteranceEnd,
    startProcessingLoop,
    stopProcessingLoop,
    resetMindMap,
    forceFullRegen,
    activeNodeIds,
  } = useMindMap({
    llmProvider: settings.llmProvider,
    llmApiKey: getLLMApiKey(),
    openaiApiKey: settings.openaiApiKey,
    interpretationLevel: settings.interpretationLevel,
    backendUrl: settings.backendUrl,
    sessionId: currentSessionId,
    onAutoSave: handleAutoSave,
    onProcessed: maybeGenerateInsights,
  });

  const onTranscript = useCallback(
    (chunk: TranscriptChunk) => {
      setTranscriptChunks((prev) => {
        const updated = [...prev];

        // Remove previous interim from same speaker (both interim→final and interim→interim)
        for (let i = updated.length - 1; i >= 0; i--) {
          if (!updated[i].isFinal && updated[i].speaker === chunk.speaker) {
            updated.splice(i, 1);
            break;
          }
        }

        // Dedup: skip if the last final from same speaker has identical text
        if (chunk.isFinal) {
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].isFinal && updated[i].speaker === chunk.speaker) {
              if (updated[i].text === chunk.text) return prev; // skip duplicate
              // Also skip if new text is a substring of the last (overlapping progressive finals)
              if (updated[i].text.includes(chunk.text)) return prev;
              break;
            }
          }
        }

        return [...updated.slice(-50), chunk];
      });
      addTranscriptChunk(chunk);
    },
    [addTranscriptChunk]
  );

  const {
    connectionState,
    error: deepgramError,
    isRecording,
    startRecording,
    stopRecording,
  } = useDeepgram({
    apiKey: settings.deepgramApiKey,
    onTranscript,
    onUtteranceEnd: handleUtteranceEnd,
  });

  const handleToggleRecord = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      stopProcessingLoop();
    } else {
      if (!isConfigured) {
        setSettingsOpen(true);
        return;
      }

      setError(null);
      setTranscriptChunks([]);

      if (!currentSessionId) {
        createSession();
      }

      try {
        await startRecording();
        startProcessingLoop();
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }, [
    isRecording, isConfigured, currentSessionId,
    stopRecording, stopProcessingLoop, startRecording, startProcessingLoop,
    createSession,
  ]);

  // Use ref so keyboard handler always calls latest version (no stale closure)
  const toggleRecordRef = useRef(handleToggleRecord);
  toggleRecordRef.current = handleToggleRecord;

  // Keyboard shortcut: Space to toggle recording (when not in an input)
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        toggleRecordRef.current();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  // Save session state before browser tab closes
  const autoSaveRef = useRef(handleAutoSave);
  autoSaveRef.current = handleAutoSave;
  const mindMapRef = useRef(mindMap);
  mindMapRef.current = mindMap;
  const knowledgeGraphRef = useRef(knowledgeGraph);
  knowledgeGraphRef.current = knowledgeGraph;

  useEffect(() => {
    const handleBeforeUnload = () => {
      autoSaveRef.current(mindMapRef.current, '', knowledgeGraphRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Auto-restore last session on mount
  useEffect(() => {
    if (currentSessionId) {
      const session = loadSession(currentSessionId);
      if (session?.mindMap) {
        setMindMap(session.mindMap);
      }
      if (session?.knowledgeGraph) {
        setKnowledgeGraph(session.knowledgeGraph);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const handleDismissError = useCallback(() => {
    setError(null);
    clearLlmError();
  }, [clearLlmError]);

  const handleLoadSession = useCallback(
    (id: string) => {
      const session = loadSession(id);
      if (session) {
        setCurrentSessionId(id);
        if (session.mindMap) {
          setMindMap(session.mindMap);
        }
        if (session.knowledgeGraph) {
          setKnowledgeGraph(session.knowledgeGraph);
        }
      }
    },
    [loadSession, setCurrentSessionId, setMindMap, setKnowledgeGraph]
  );

  const handleNewSession = useCallback(() => {
    resetMindMap();
    setTranscriptChunks([]);
    clearInsights();
    createSession();
  }, [resetMindMap, createSession, clearInsights]);

  const displayError = error || deepgramError || llmError;

  const hasContent = mindMap !== null || (knowledgeGraph !== null && knowledgeGraph.entities.length > 0);

  // Show onboarding if not configured
  if (!isConfigured && !settingsOpen) {
    return (
      <>
        <OnboardingScreen onOpenSettings={() => setSettingsOpen(true)} />
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
        />
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-surface-950 flex flex-col">
      {/* Error Banner */}
      {displayError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4">
          <div className="bg-red-900/40 border border-red-800/50 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-red-400 mt-0.5 font-bold">!</span>
            <div className="flex-1">
              <p className="text-sm text-red-200">{displayError}</p>
            </div>
            <button
              onClick={handleDismissError}
              className="text-red-400 hover:text-red-300 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Mind Map */}
      <div className="flex-1 relative">
        <ErrorBoundary>
          <MindMapView
            mindMap={mindMap}
            knowledgeGraph={knowledgeGraph}
            isProcessing={isProcessing}
            speakerNames={settings.speakerNames}
            activeNodeIds={activeNodeIds}
            autoFocusEnabled={autoFocusEnabled}
          />
        </ErrorBoundary>
      </div>

      {/* Transcript Ticker */}
      <TranscriptTicker
        chunks={transcriptChunks}
        isVisible={settings.showTranscript && isRecording}
        speakerNames={settings.speakerNames}
      />

      {/* Control Bar */}
      <ControlBar
        isRecording={isRecording}
        connectionState={connectionState}
        interpretationLevel={settings.interpretationLevel}
        onToggleRecord={handleToggleRecord}
        onInterpretationChange={(level) => updateSettings({ interpretationLevel: level })}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSessions={() => setSessionsOpen(true)}
        onExport={() => setExportOpen(true)}
        onForceRegen={forceFullRegen}
        onOpenInsights={() => setInsightsOpen(true)}
        insightsBadge={undismissedCount}
        autoFocusEnabled={autoFocusEnabled}
        onToggleAutoFocus={() => setAutoFocusEnabled((p) => !p)}
        hasMap={hasContent}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
      />

      {/* Export Menu */}
      {hasContent && (
        <ExportMenu
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          mindMap={mindMap}
          knowledgeGraph={knowledgeGraph}
        />
      )}

      {/* Session Manager */}
      <SessionManager
        isOpen={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onLoadSession={handleLoadSession}
        onDeleteSession={deleteSession}
        onNewSession={handleNewSession}
      />

      {/* Insights Panel */}
      <InsightsPanel
        isOpen={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        insights={insights}
        insightMode={settings.insightMode}
        onModeChange={(mode) => updateSettings({ insightMode: mode })}
        onDismiss={dismissInsight}
        onDismissAll={dismissAllInsights}
        isGenerating={isGeneratingInsights}
      />
    </div>
  );
}
