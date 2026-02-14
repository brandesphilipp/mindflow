import type { InsightMode, InsightItem, LLMProvider, MindMap } from '../types/mindmap';

interface InsightsConfig {
  provider: LLMProvider;
  apiKey: string;
}

const INSIGHT_PROMPTS: Record<InsightMode, string> = {
  fact_check: `You are a fact-checking assistant listening to a live conversation. The speakers are likely in Germany/Europe.

Given a recent segment of transcript and a brief summary of the discussion so far, identify:
- Claims that may be factually inaccurate or misleading
- Statistics or dates that seem wrong
- Common misconceptions being stated as fact
- Notable omissions when important context is missing

Be helpful but not pedantic. Only flag things that matter. If everything seems fine, return an empty array.`,

  socratic: `You are a Socratic questioning assistant listening to a live conversation.

Given a recent segment of transcript and a brief summary of the discussion so far, generate thought-provoking questions that:
- Expose unstated assumptions in the speakers' reasoning
- Challenge the logical structure of arguments made
- Ask "what would it take to change your mind?" style questions
- Point out potential blind spots or unconsidered perspectives

Be intellectually stimulating, not confrontational. Ask 1-3 questions max.`,

  discussion: `You are a discussion analysis assistant listening to a live conversation with multiple speakers.

Given a recent segment of transcript and a brief summary of the discussion so far, identify:
- Points where speakers agree or disagree (especially implicit disagreements)
- Connections between ideas from different speakers that weren't explicitly made
- Topics where consensus seems to be forming
- Areas where the conversation could go deeper

Focus on the dynamics between speakers. If there's only one speaker, focus on internal tensions in their argument.`,
};

function summarizeMindMap(mindMap: MindMap | null): string {
  if (!mindMap) return 'No mind map yet.';
  const labels: string[] = [];
  function collect(node: { label: string; children: { label: string; children: unknown[] }[] }, depth: number) {
    if (depth > 2) return;
    labels.push('  '.repeat(depth) + node.label);
    for (const child of node.children) {
      collect(child as { label: string; children: { label: string; children: unknown[] }[] }, depth + 1);
    }
  }
  collect(mindMap.root as { label: string; children: { label: string; children: unknown[] }[] }, 0);
  return labels.slice(0, 30).join('\n');
}

async function callForInsights(
  config: InsightsConfig,
  mode: InsightMode,
  recentTranscript: string,
  mindMap: MindMap | null
): Promise<InsightItem[]> {
  const systemPrompt = INSIGHT_PROMPTS[mode];
  const mapSummary = summarizeMindMap(mindMap);
  const userMessage = `Discussion summary so far:\n${mapSummary}\n\nRecent transcript:\n${recentTranscript}\n\nReturn a JSON array of insight strings. Example: ["Insight one", "Insight two"]\nIf nothing notable, return []. Return ONLY the JSON array, no other text.`;

  let text: string;

  if (config.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
    const data = await res.json();
    text = data.content?.[0]?.text || '[]';
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    text = data.choices?.[0]?.message?.content || '[]';
  }

  // Parse the response
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr
      .filter((s: unknown) => typeof s === 'string' && s.trim())
      .slice(0, 5)
      .map((s: string, i: number) => ({
        id: `insight-${now}-${i}`,
        mode,
        text: s.trim(),
        timestamp: now,
        dismissed: false,
      }));
  } catch {
    return [];
  }
}

export async function generateInsights(
  config: InsightsConfig,
  mode: InsightMode,
  recentTranscript: string,
  mindMap: MindMap | null
): Promise<InsightItem[]> {
  if (!recentTranscript.trim() || !config.apiKey) return [];
  try {
    return await callForInsights(config, mode, recentTranscript, mindMap);
  } catch (err) {
    console.warn('MindFlow: Insights generation failed:', (err as Error).message);
    return [];
  }
}
