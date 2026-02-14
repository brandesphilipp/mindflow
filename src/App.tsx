import { useState, useCallback, useEffect } from 'react';
import { MindMapView } from './components/MindMapView';
import { ControlBar } from './components/ControlBar';
import { SettingsPanel } from './components/SettingsPanel';
import { TranscriptTicker } from './components/TranscriptTicker';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ExportMenu } from './components/ExportMenu';
import { SessionManager } from './components/SessionManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSettings } from './hooks/useSettings';
import { useDeepgram } from './hooks/useDeepgram';
import { useMindMap } from './hooks/useMindMap';
import { useSessions } from './hooks/useSessions';
import type { TranscriptChunk } from './types/mindmap';

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
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    mindMap,
    setMindMap,
    isProcessing,
    llmError,
    clearError: clearLlmError,
    addTranscriptChunk,
    handleUtteranceEnd,
    startProcessingLoop,
    stopProcessingLoop,
    resetMindMap,
    forceFullRegen,
  } = useMindMap({
    llmProvider: settings.llmProvider,
    llmApiKey: getLLMApiKey(),
    interpretationLevel: settings.interpretationLevel,
    onAutoSave: autoSave,
  });

  const onTranscript = useCallback(
    (chunk: TranscriptChunk) => {
      setTranscriptChunks((prev) => [...prev.slice(-50), chunk]);
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

  // Keyboard shortcut: Space to toggle recording (when not in an input)
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        handleToggleRecord();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

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
      }
    },
    [loadSession, setCurrentSessionId, setMindMap]
  );

  const handleNewSession = useCallback(() => {
    resetMindMap();
    setTranscriptChunks([]);
    createSession();
  }, [resetMindMap, createSession]);

  const displayError = error || deepgramError || llmError;

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
          <MindMapView mindMap={mindMap} isProcessing={isProcessing} />
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
        hasMap={mindMap !== null}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
      />

      {/* Export Menu */}
      {mindMap && (
        <ExportMenu
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          mindMap={mindMap}
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
    </div>
  );
}
