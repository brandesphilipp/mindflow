import type { MindMap, LLMProvider, InterpretationLevel } from '../types/mindmap';
import {
  getIncrementalSystemPrompt,
  getFullRegenSystemPrompt,
  buildIncrementalUserMessage,
  buildFullRegenUserMessage,
  MIND_MAP_JSON_SCHEMA,
} from './prompts';

interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
}

async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<MindMap> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt + '\n\nYou MUST respond with ONLY valid JSON. No markdown, no code fences, no explanation.',
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Anthropic');

  return parseMindMapJSON(text);
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<MindMap> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      max_tokens: 4096,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'mind_map',
          strict: false,
          schema: MIND_MAP_JSON_SCHEMA,
        },
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenAI');

  return parseMindMapJSON(text);
}

function parseMindMapJSON(text: string): MindMap {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned);

  // Validate basic structure
  if (!parsed.root || typeof parsed.root.id !== 'string') {
    throw new Error('Invalid mind map structure: missing root node');
  }

  // Ensure crossReferences and metadata exist
  if (!parsed.crossReferences) parsed.crossReferences = [];
  if (!parsed.metadata) {
    parsed.metadata = {
      version: 1,
      totalSpeakers: 0,
      durationSeconds: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  return parsed as MindMap;
}

async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string
): Promise<MindMap> {
  if (config.provider === 'anthropic') {
    return callAnthropic(systemPrompt, userMessage, config.apiKey);
  } else {
    return callOpenAI(systemPrompt, userMessage, config.apiKey);
  }
}

export async function incrementalUpdate(
  config: LLMConfig,
  currentMap: MindMap,
  newTranscript: string,
  level: InterpretationLevel
): Promise<MindMap> {
  const systemPrompt = getIncrementalSystemPrompt(level);
  const userMessage = buildIncrementalUserMessage(
    JSON.stringify(currentMap, null, 2),
    newTranscript
  );
  return callLLM(config, systemPrompt, userMessage);
}

export async function fullRegeneration(
  config: LLMConfig,
  fullTranscript: string,
  level: InterpretationLevel
): Promise<MindMap> {
  const systemPrompt = getFullRegenSystemPrompt(level);
  const userMessage = buildFullRegenUserMessage(fullTranscript);
  return callLLM(config, systemPrompt, userMessage);
}

export async function testLLMKey(provider: LLMProvider, apiKey: string): Promise<boolean> {
  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      return res.ok;
    } else {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    }
  } catch {
    return false;
  }
}

export function createInitialMindMap(topic?: string): MindMap {
  return {
    root: {
      id: 'root',
      label: topic || 'New Conversation',
      type: 'topic',
      speaker: null,
      timestamp: 0,
      children: [],
    },
    crossReferences: [],
    metadata: {
      version: 0,
      totalSpeakers: 0,
      durationSeconds: 0,
      lastUpdated: new Date().toISOString(),
    },
  };
}
