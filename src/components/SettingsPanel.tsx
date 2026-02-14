import { useState } from 'react';
import type { AppSettings, LLMProvider } from '../types/mindmap';
import { testDeepgramKey } from '../services/deepgram';
import { testLLMKey } from '../services/llm';
import { healthCheck } from '../services/graphApi';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
}

type KeyStatus = 'idle' | 'testing' | 'valid' | 'invalid';

export function SettingsPanel({ isOpen, onClose, settings, onUpdateSettings }: SettingsPanelProps) {
  const [deepgramStatus, setDeepgramStatus] = useState<KeyStatus>('idle');
  const [openaiStatus, setOpenaiStatus] = useState<KeyStatus>('idle');
  const [anthropicStatus, setAnthropicStatus] = useState<KeyStatus>('idle');
  const [backendStatus, setBackendStatus] = useState<KeyStatus>('idle');
  const [speakerInput, setSpeakerInput] = useState<Record<number, string>>(settings.speakerNames);

  if (!isOpen) return null;

  const handleTestDeepgram = async () => {
    if (!settings.deepgramApiKey) return;
    setDeepgramStatus('testing');
    const ok = await testDeepgramKey(settings.deepgramApiKey);
    setDeepgramStatus(ok ? 'valid' : 'invalid');
  };

  const handleTestOpenAI = async () => {
    if (!settings.openaiApiKey) return;
    setOpenaiStatus('testing');
    const ok = await testLLMKey('openai', settings.openaiApiKey);
    setOpenaiStatus(ok ? 'valid' : 'invalid');
  };

  const handleTestAnthropic = async () => {
    if (!settings.anthropicApiKey) return;
    setAnthropicStatus('testing');
    const ok = await testLLMKey('anthropic', settings.anthropicApiKey);
    setAnthropicStatus(ok ? 'valid' : 'invalid');
  };

  const statusIcon = (status: KeyStatus) => {
    switch (status) {
      case 'testing': return <span className="text-yellow-400 animate-pulse">●</span>;
      case 'valid': return <span className="text-green-400">✓</span>;
      case 'invalid': return <span className="text-red-400">✗</span>;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-neutral-900 border-l border-neutral-800 overflow-y-auto fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-100">Settings</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Deepgram API Key */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-neutral-300 mb-2">Speech-to-Text (Deepgram)</h3>
            <div className="flex gap-2">
              <input
                type="password"
                value={settings.deepgramApiKey}
                onChange={(e) => {
                  onUpdateSettings({ deepgramApiKey: e.target.value });
                  setDeepgramStatus('idle');
                }}
                placeholder="Deepgram API key"
                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
              <button
                onClick={handleTestDeepgram}
                disabled={!settings.deepgramApiKey}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                Test {statusIcon(deepgramStatus)}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              Get a free API key at{' '}
              <a href="https://console.deepgram.com/signup" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                console.deepgram.com
              </a>
              {' '}($200 free credits)
            </p>
          </section>

          {/* OpenAI API Key (Required) */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-neutral-300 mb-2">
              OpenAI API Key
              <span className="ml-2 text-[10px] text-red-400 font-mono uppercase">Required</span>
            </h3>
            <div className="flex gap-2">
              <input
                type="password"
                value={settings.openaiApiKey}
                onChange={(e) => {
                  onUpdateSettings({ openaiApiKey: e.target.value });
                  setOpenaiStatus('idle');
                }}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
              <button
                onClick={handleTestOpenAI}
                disabled={!settings.openaiApiKey}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                Test {statusIcon(openaiStatus)}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              Powers mind map structuring and knowledge graph embeddings.{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                platform.openai.com
              </a>
            </p>
          </section>

          {/* LLM Provider Selection + Optional Anthropic Key */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-neutral-300 mb-2">LLM Provider for Mind Mapping</h3>
            <div className="flex gap-2 mb-3">
              {(['openai', 'anthropic'] as LLMProvider[]).map((provider) => (
                <button
                  key={provider}
                  onClick={() => onUpdateSettings({ llmProvider: provider })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.llmProvider === provider
                      ? 'bg-primary-600/20 text-primary-300 border border-primary-500/40'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-neutral-300'
                  }`}
                >
                  {provider === 'openai' ? 'OpenAI' : 'Anthropic'}
                </button>
              ))}
            </div>

            {settings.llmProvider === 'anthropic' && (
              <>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={settings.anthropicApiKey}
                    onChange={(e) => {
                      onUpdateSettings({ anthropicApiKey: e.target.value });
                      setAnthropicStatus('idle');
                    }}
                    placeholder="Anthropic API key"
                    className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  <button
                    onClick={handleTestAnthropic}
                    disabled={!settings.anthropicApiKey}
                    className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    Test {statusIcon(anthropicStatus)}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Uses Claude for mind map structuring. OpenAI key is still used for embeddings.{' '}
                  <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                    console.anthropic.com
                  </a>
                </p>
              </>
            )}
            {settings.llmProvider === 'openai' && (
              <p className="text-xs text-neutral-500">
                Uses your OpenAI key above for both mind map structuring and embeddings.
              </p>
            )}
          </section>

          {/* Knowledge Graph Backend */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-neutral-300 mb-2">
              Knowledge Graph Backend
              <span className="ml-2 text-[10px] text-neutral-500 font-mono uppercase">Optional</span>
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.backendUrl}
                onChange={(e) => {
                  onUpdateSettings({ backendUrl: e.target.value.trim() });
                  setBackendStatus('idle');
                }}
                placeholder="https://your-backend.run.app"
                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
              <button
                onClick={async () => {
                  if (!settings.backendUrl) return;
                  setBackendStatus('testing');
                  const ok = await healthCheck(settings.backendUrl);
                  setBackendStatus(ok ? 'valid' : 'invalid');
                }}
                disabled={!settings.backendUrl}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                Test {statusIcon(backendStatus)}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              Connect to a Graphiti backend for entity deduplication and knowledge graph features.
              Leave empty to use client-side LLM processing.
            </p>
          </section>

          {/* Speaker Names */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-neutral-300 mb-2">Speaker Names</h3>
            <p className="text-xs text-neutral-500 mb-3">Map speaker numbers to names (optional)</p>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500 w-20 font-mono">Speaker {i}</span>
                  <input
                    type="text"
                    value={speakerInput[i] || ''}
                    onChange={(e) => {
                      const updated = { ...speakerInput, [i]: e.target.value };
                      setSpeakerInput(updated);
                      onUpdateSettings({ speakerNames: updated });
                    }}
                    placeholder="Name"
                    className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Transcript Toggle */}
          <section className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-neutral-300">Show Transcript</h3>
                <p className="text-xs text-neutral-500">Display live transcript at the bottom</p>
              </div>
              <button
                onClick={() => onUpdateSettings({ showTranscript: !settings.showTranscript })}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  settings.showTranscript ? 'bg-primary-600' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.showTranscript ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Info */}
          <section className="pt-4 border-t border-neutral-800">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Your API keys are stored locally in your browser and never sent to any server other than the respective API providers. MindFlow is open source.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
