import { useState, useCallback, useRef } from 'react';
import type { InsightItem, InsightMode, LLMProvider, MindMap } from '../types/mindmap';
import { generateInsights } from '../services/insights';

interface UseInsightsOptions {
  llmProvider: LLMProvider;
  llmApiKey: string;
  insightMode: InsightMode;
}

export function useInsights({ llmProvider, llmApiKey, insightMode }: UseInsightsOptions) {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const callCountRef = useRef(0);
  const isGeneratingRef = useRef(false);

  // Keep refs current to avoid stale closures
  const llmProviderRef = useRef(llmProvider);
  llmProviderRef.current = llmProvider;
  const llmApiKeyRef = useRef(llmApiKey);
  llmApiKeyRef.current = llmApiKey;
  const insightModeRef = useRef(insightMode);
  insightModeRef.current = insightMode;

  const maybeGenerateInsights = useCallback(
    (recentTranscript: string, mindMap: MindMap | null) => {
      callCountRef.current++;
      // Run every other call (~every 10s since processUpdate runs every 5s)
      if (callCountRef.current % 2 !== 0) return;
      if (isGeneratingRef.current) return;
      if (!llmApiKeyRef.current || !recentTranscript.trim()) return;

      // Take last ~2000 chars of transcript for context
      const recent = recentTranscript.length > 2000
        ? recentTranscript.slice(-2000)
        : recentTranscript;

      isGeneratingRef.current = true;
      setIsGenerating(true);

      // Fire-and-forget: don't block mind map updates
      generateInsights(
        { provider: llmProviderRef.current, apiKey: llmApiKeyRef.current },
        insightModeRef.current,
        recent,
        mindMap
      )
        .then((newInsights) => {
          if (newInsights.length > 0) {
            setInsights((prev) => [...prev, ...newInsights].slice(-20));
          }
        })
        .finally(() => {
          isGeneratingRef.current = false;
          setIsGenerating(false);
        });
    },
    []
  );

  const dismissInsight = useCallback((id: string) => {
    setInsights((prev) =>
      prev.map((item) => (item.id === id ? { ...item, dismissed: true } : item))
    );
  }, []);

  const dismissAll = useCallback(() => {
    setInsights((prev) => prev.map((item) => ({ ...item, dismissed: true })));
  }, []);

  const clearInsights = useCallback(() => {
    setInsights([]);
    callCountRef.current = 0;
  }, []);

  const undismissedCount = insights.filter((i) => !i.dismissed).length;

  return {
    insights,
    undismissedCount,
    isGenerating,
    maybeGenerateInsights,
    dismissInsight,
    dismissAll,
    clearInsights,
  };
}
