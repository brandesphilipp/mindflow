import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  MindMap,
  TranscriptChunk,
  InterpretationLevel,
  LLMProvider,
} from '../types/mindmap';
import { incrementalUpdate, fullRegeneration } from '../services/llm';

const INCREMENTAL_INTERVAL_MS = 5000;
const FULL_REGEN_INTERVAL = 10;
const AUTOSAVE_INTERVAL_MS = 30000;
const MAX_TRANSCRIPT_CHARS = 50000; // ~12,500 tokens, safe for most models

interface UseMindMapOptions {
  llmProvider: LLMProvider;
  llmApiKey: string;
  interpretationLevel: InterpretationLevel;
  onAutoSave: (mindMap: MindMap | null, transcript: string) => void;
}

export function useMindMap({
  llmProvider,
  llmApiKey,
  interpretationLevel,
  onAutoSave,
}: UseMindMapOptions) {
  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const fullTranscriptRef = useRef<string>('');
  const pendingChunksRef = useRef<string>('');
  const updateCountRef = useRef(0);
  const forceFullRegenRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);
  const mindMapRef = useRef<MindMap | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store dependencies in refs to avoid stale closures in setInterval
  const llmProviderRef = useRef(llmProvider);
  llmProviderRef.current = llmProvider;
  const llmApiKeyRef = useRef(llmApiKey);
  llmApiKeyRef.current = llmApiKey;
  const interpretationLevelRef = useRef(interpretationLevel);
  interpretationLevelRef.current = interpretationLevel;
  const onAutoSaveRef = useRef(onAutoSave);
  onAutoSaveRef.current = onAutoSave;

  useEffect(() => {
    mindMapRef.current = mindMap;
  }, [mindMap]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, []);

  const processUpdate = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (!pendingChunksRef.current.trim()) return;
    if (!llmApiKeyRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    setLlmError(null);

    const newText = pendingChunksRef.current;
    pendingChunksRef.current = '';
    updateCountRef.current++;

    const shouldFullRegen =
      forceFullRegenRef.current ||
      !mindMapRef.current ||
      updateCountRef.current % FULL_REGEN_INTERVAL === 0;

    forceFullRegenRef.current = false;

    const config = {
      provider: llmProviderRef.current,
      apiKey: llmApiKeyRef.current,
    };
    const level = interpretationLevelRef.current;

    try {
      let result: MindMap;

      // Truncate transcript if it exceeds the max to avoid token limit errors
      const transcript = fullTranscriptRef.current.length > MAX_TRANSCRIPT_CHARS
        ? fullTranscriptRef.current.slice(-MAX_TRANSCRIPT_CHARS)
        : fullTranscriptRef.current;

      if (shouldFullRegen) {
        result = await fullRegeneration(config, transcript, level);
      } else {
        result = await incrementalUpdate(
          config,
          mindMapRef.current!,
          newText,
          level
        );
      }

      result.metadata.version = updateCountRef.current;
      result.metadata.lastUpdated = new Date().toISOString();

      setMindMap(result);
      mindMapRef.current = result;
    } catch (err) {
      const msg = (err as Error).message;
      // Parse common API error formats into friendly messages
      if (msg.includes('401') || msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('unauthorized')) {
        setLlmError('Invalid API key. Please check your key in Settings.');
      } else if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        setLlmError('Rate limit hit. Slowing down requests...');
      } else {
        setLlmError(msg.length > 200 ? msg.slice(0, 200) + '...' : msg);
      }
      // Re-queue the text so it's not lost
      pendingChunksRef.current = newText + ' ' + pendingChunksRef.current;
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, []); // No dependencies -- uses refs for everything

  const addTranscriptChunk = useCallback(
    (chunk: TranscriptChunk) => {
      if (!chunk.isFinal) return;

      const speakerLabel = chunk.speaker !== null ? `[Speaker ${chunk.speaker}]: ` : '';
      const line = `${speakerLabel}${chunk.text}`;

      fullTranscriptRef.current += (fullTranscriptRef.current ? '\n' : '') + line;
      pendingChunksRef.current += (pendingChunksRef.current ? '\n' : '') + line;
    },
    []
  );

  const handleUtteranceEnd = useCallback(() => {
    if (pendingChunksRef.current.trim()) {
      processUpdate();
    }
  }, [processUpdate]);

  const startProcessingLoop = useCallback(() => {
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      processUpdate();
    }, INCREMENTAL_INTERVAL_MS);

    autoSaveTimerRef.current = setInterval(() => {
      onAutoSaveRef.current(mindMapRef.current, fullTranscriptRef.current);
    }, AUTOSAVE_INTERVAL_MS);
  }, [processUpdate]);

  const stopProcessingLoop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (pendingChunksRef.current.trim()) {
      processUpdate();
    }

    onAutoSaveRef.current(mindMapRef.current, fullTranscriptRef.current);
  }, [processUpdate]);

  const resetMindMap = useCallback(() => {
    setMindMap(null);
    mindMapRef.current = null;
    fullTranscriptRef.current = '';
    pendingChunksRef.current = '';
    updateCountRef.current = 0;
    forceFullRegenRef.current = false;
    setLlmError(null);
  }, []);

  const forceFullRegen = useCallback(() => {
    if (!llmApiKeyRef.current || !fullTranscriptRef.current.trim()) return;
    forceFullRegenRef.current = true;
    processUpdate();
  }, [processUpdate]);

  const getFullTranscript = useCallback(() => fullTranscriptRef.current, []);

  const clearError = useCallback(() => setLlmError(null), []);

  return {
    mindMap,
    setMindMap,
    isProcessing,
    llmError,
    clearError,
    addTranscriptChunk,
    handleUtteranceEnd,
    startProcessingLoop,
    stopProcessingLoop,
    resetMindMap,
    forceFullRegen,
    getFullTranscript,
  };
}
