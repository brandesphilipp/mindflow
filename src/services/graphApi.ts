import type { KnowledgeGraph, LLMProvider } from '../types/mindmap';

const REQUEST_TIMEOUT_MS = 30000;

interface SearchResult {
  fact: string;
  source: string;
  target: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function ingest(
  baseUrl: string,
  sessionId: string,
  text: string,
  provider: LLMProvider,
  apiKey: string,
  openaiApiKey: string,
  timestamp?: string
): Promise<KnowledgeGraph> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/ingest`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      text,
      llm_provider: provider,
      llm_api_key: apiKey,
      openai_api_key: openaiApiKey,
      timestamp: timestamp || new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Backend ingest failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const graph = data.graph || data;

  return {
    entities: (graph.entities || []).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      name: e.name as string,
      summary: (e.summary || '') as string,
      type: (e.type || 'topic') as string,
      created_at: (e.created_at || '') as string,
      degree: (e.degree || 0) as number,
      community: e.community as number | undefined,
    })),
    relationships: (graph.relationships || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      source_id: r.source_id as string,
      target_id: r.target_id as string,
      fact: (r.fact || '') as string,
      type: (r.type || 'related_to') as string,
      valid_at: r.valid_at as string | undefined,
      invalid_at: r.invalid_at as string | undefined,
    })),
    metadata: {
      session_id: sessionId,
      entity_count: (graph.metadata?.entity_count || graph.entities?.length || 0) as number,
      relationship_count: (graph.metadata?.relationship_count || graph.relationships?.length || 0) as number,
      last_updated: (graph.metadata?.last_updated || new Date().toISOString()) as string,
    },
  };
}

export async function getGraph(
  baseUrl: string,
  sessionId: string
): Promise<KnowledgeGraph> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/graph?session_id=${encodeURIComponent(sessionId)}`;

  const response = await fetchWithTimeout(url, { method: 'GET' });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Backend get graph failed (${response.status}): ${body}`);
  }

  const graph = await response.json();

  return {
    entities: (graph.entities || []).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      name: e.name as string,
      summary: (e.summary || '') as string,
      type: (e.type || 'topic') as string,
      created_at: (e.created_at || '') as string,
      degree: (e.degree || 0) as number,
      community: e.community as number | undefined,
    })),
    relationships: (graph.relationships || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      source_id: r.source_id as string,
      target_id: r.target_id as string,
      fact: (r.fact || '') as string,
      type: (r.type || 'related_to') as string,
      valid_at: r.valid_at as string | undefined,
      invalid_at: r.invalid_at as string | undefined,
    })),
    metadata: {
      session_id: sessionId,
      entity_count: (graph.metadata?.entity_count || graph.entities?.length || 0) as number,
      relationship_count: (graph.metadata?.relationship_count || graph.relationships?.length || 0) as number,
      last_updated: (graph.metadata?.last_updated || new Date().toISOString()) as string,
    },
  };
}

export async function search(
  baseUrl: string,
  sessionId: string,
  query: string,
  provider: LLMProvider,
  apiKey: string,
  openaiApiKey: string
): Promise<SearchResult[]> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/search`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      query,
      llm_provider: provider,
      llm_api_key: apiKey,
      openai_api_key: openaiApiKey,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Backend search failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return (data.results || []) as SearchResult[];
}

export async function healthCheck(baseUrl: string): Promise<boolean> {
  try {
    const url = `${normalizeBaseUrl(baseUrl)}/api/health`;
    const response = await fetchWithTimeout(url, { method: 'GET' }, 5000);

    if (!response.ok) return false;

    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
