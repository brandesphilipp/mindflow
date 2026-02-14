import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  MindMap,
  MindMapNode,
  KnowledgeGraph,
  TranscriptChunk,
  InterpretationLevel,
  LLMProvider,
} from '../types/mindmap';
import { incrementalUpdate, fullRegeneration } from '../services/llm';
import { ingest as graphApiIngest } from '../services/graphApi';

function collectNodeSignatures(node: MindMapNode, map: Map<string, string>): void {
  map.set(node.id, node.label);
  for (const child of node.children) collectNodeSignatures(child, map);
}

function diffNodes(prev: MindMap | null, next: MindMap): Set<string> {
  const prevSigs = new Map<string, string>();
  if (prev) collectNodeSignatures(prev.root, prevSigs);
  const nextSigs = new Map<string, string>();
  collectNodeSignatures(next.root, nextSigs);

  const changed = new Set<string>();
  for (const [id, label] of nextSigs) {
    if (!prevSigs.has(id) || prevSigs.get(id) !== label) {
      changed.add(id);
    }
  }
  return changed;
}

function diffGraph(prev: KnowledgeGraph | null, next: KnowledgeGraph): Set<string> {
  const prevIds = new Set(prev?.entities.map((e) => e.id) || []);
  const changed = new Set<string>();
  for (const entity of next.entities) {
    if (!prevIds.has(entity.id)) {
      changed.add(entity.id);
    }
  }
  return changed;
}

const INCREMENTAL_INTERVAL_MS = 5000;
const FULL_REGEN_INTERVAL = 10;
const AUTOSAVE_INTERVAL_MS = 30000;
const MAX_TRANSCRIPT_CHARS = 50000; // ~12,500 tokens, safe for most models

interface UseMindMapOptions {
  llmProvider: LLMProvider;
  llmApiKey: string;
  openaiApiKey: string;
  interpretationLevel: InterpretationLevel;
  backendUrl: string;
  sessionId: string | null;
  onAutoSave: (mindMap: MindMap | null, transcript: string, knowledgeGraph?: KnowledgeGraph | null) => void;
  onProcessed?: (transcript: string, mindMap: MindMap) => void;
}

export function useMindMap({
  llmProvider,
  llmApiKey,
  openaiApiKey,
  interpretationLevel,
  backendUrl,
  sessionId,
  onAutoSave,
  onProcessed,
}: UseMindMapOptions) {
  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set());

  const fullTranscriptRef = useRef<string>('');
  const pendingChunksRef = useRef<string>('');
  const updateCountRef = useRef(0);
  const forceFullRegenRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);
  const mindMapRef = useRef<MindMap | null>(null);
  const knowledgeGraphRef = useRef<KnowledgeGraph | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store dependencies in refs to avoid stale closures in setInterval
  const llmProviderRef = useRef(llmProvider);
  llmProviderRef.current = llmProvider;
  const llmApiKeyRef = useRef(llmApiKey);
  llmApiKeyRef.current = llmApiKey;
  const openaiApiKeyRef = useRef(openaiApiKey);
  openaiApiKeyRef.current = openaiApiKey;
  const interpretationLevelRef = useRef(interpretationLevel);
  interpretationLevelRef.current = interpretationLevel;
  const backendUrlRef = useRef(backendUrl);
  backendUrlRef.current = backendUrl;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const onAutoSaveRef = useRef(onAutoSave);
  onAutoSaveRef.current = onAutoSave;
  const onProcessedRef = useRef(onProcessed);
  onProcessedRef.current = onProcessed;

  useEffect(() => {
    mindMapRef.current = mindMap;
  }, [mindMap]);

  useEffect(() => {
    knowledgeGraphRef.current = knowledgeGraph;
  }, [knowledgeGraph]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, []);

  // --- Backend mode: ingest via Graphiti API ---
  const processBackendIngest = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (!pendingChunksRef.current.trim()) return;
    if (!llmApiKeyRef.current) return;
    if (!backendUrlRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    setLlmError(null);

    const newText = pendingChunksRef.current;
    pendingChunksRef.current = '';

    try {
      const sid = sessionIdRef.current || `s_${Date.now()}`;
      const result = await graphApiIngest(
        backendUrlRef.current,
        sid,
        newText,
        llmProviderRef.current,
        llmApiKeyRef.current,
        openaiApiKeyRef.current,
        new Date().toISOString()
      );

      // Track new entities
      const changed = diffGraph(knowledgeGraphRef.current, result);
      setActiveNodeIds(changed);
      if (changed.size > 0) {
        setTimeout(() => setActiveNodeIds(new Set()), 3000);
      }

      setKnowledgeGraph(result);
      knowledgeGraphRef.current = result;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('401') || msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('unauthorized')) {
        setLlmError('Invalid API key. Please check your key in Settings.');
      } else if (msg.includes('Failed to fetch') || msg.includes('abort')) {
        setLlmError('Backend unreachable. Check your backend URL in Settings.');
      } else {
        setLlmError(msg.length > 200 ? msg.slice(0, 200) + '...' : msg);
      }
      // Re-queue the text so it's not lost
      pendingChunksRef.current = newText + ' ' + pendingChunksRef.current;
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  // --- Client-side mode: process via LLM ---
  const processClientUpdate = useCallback(async () => {
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

      // Track which nodes are new or changed
      const changed = diffNodes(mindMapRef.current, result);
      setActiveNodeIds(changed);
      // Clear active state after 3s
      if (changed.size > 0) {
        setTimeout(() => setActiveNodeIds(new Set()), 3000);
      }

      setMindMap(result);
      mindMapRef.current = result;

      // Fire insights generation (non-blocking)
      onProcessedRef.current?.(fullTranscriptRef.current, result);
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

  // Dispatch to the right processor based on mode
  const processUpdate = useCallback(async () => {
    if (backendUrlRef.current) {
      return processBackendIngest();
    }
    return processClientUpdate();
  }, [processBackendIngest, processClientUpdate]);

  const lastTranscriptLineRef = useRef('');

  const addTranscriptChunk = useCallback(
    (chunk: TranscriptChunk) => {
      if (!chunk.isFinal) return;

      const speakerLabel = chunk.speaker !== null ? `[Speaker ${chunk.speaker}]: ` : '';
      const confidenceMarker = chunk.confidence < 0.7 ? ' [LOW CONFIDENCE]' : '';
      const line = `${speakerLabel}${chunk.text}${confidenceMarker}`;

      // Dedup: skip if identical to the last line added
      if (line === lastTranscriptLineRef.current) return;
      lastTranscriptLineRef.current = line;

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

    // In backend mode, we rely on utterance-end events, but also process periodically
    timerRef.current = setInterval(() => {
      processUpdate();
    }, INCREMENTAL_INTERVAL_MS);

    autoSaveTimerRef.current = setInterval(() => {
      onAutoSaveRef.current(mindMapRef.current, fullTranscriptRef.current, knowledgeGraphRef.current);
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

    onAutoSaveRef.current(mindMapRef.current, fullTranscriptRef.current, knowledgeGraphRef.current);
  }, [processUpdate]);

  const resetMindMap = useCallback(() => {
    setMindMap(null);
    setKnowledgeGraph(null);
    mindMapRef.current = null;
    knowledgeGraphRef.current = null;
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
    knowledgeGraph,
    setKnowledgeGraph,
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
    activeNodeIds,
  };
}
