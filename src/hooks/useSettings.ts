import { useState, useCallback } from 'react';
import type { AppSettings } from '../types/mindmap';
import { DEFAULT_SETTINGS } from '../types/mindmap';

const SETTINGS_KEY = 'mindflow_settings';

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  // OpenAI key is always required (for LLM or embeddings).
  // Anthropic key is only required when Anthropic is the selected LLM provider.
  const isConfigured = Boolean(
    settings.deepgramApiKey &&
      settings.openaiApiKey &&
      (settings.llmProvider === 'openai' || settings.anthropicApiKey)
  );

  const getLLMApiKey = useCallback((): string => {
    return settings.llmProvider === 'anthropic'
      ? settings.anthropicApiKey
      : settings.openaiApiKey;
  }, [settings.llmProvider, settings.anthropicApiKey, settings.openaiApiKey]);

  return { settings, updateSettings, isConfigured, getLLMApiKey };
}
