export type NodeType = 'topic' | 'point' | 'detail' | 'action' | 'question';

export type RelationshipType = 'supports' | 'contradicts' | 'elaborates' | 'related_to';

export type InterpretationLevel = 'faithful' | 'synthesizer' | 'analyst';

export type InsightMode = 'fact_check' | 'socratic' | 'discussion';

export interface InsightItem {
  id: string;
  mode: InsightMode;
  text: string;
  timestamp: number;
  dismissed: boolean;
}

export type LLMProvider = 'anthropic' | 'openai';

export interface MindMapNode {
  id: string;
  label: string;
  type: NodeType;
  speaker: string | null;
  timestamp: number | null;
  confidence?: 'high' | 'low';
  children: MindMapNode[];
}

export interface CrossReference {
  sourceId: string;
  targetId: string;
  relationship: RelationshipType;
}

export interface MindMapMetadata {
  version: number;
  totalSpeakers: number;
  durationSeconds: number;
  lastUpdated: string;
}

export interface MindMap {
  root: MindMapNode;
  crossReferences: CrossReference[];
  metadata: MindMapMetadata;
}

export interface TranscriptChunk {
  text: string;
  speaker: number | null;
  isFinal: boolean;
  timestamp: number;
  confidence: number;
}

export interface AppSettings {
  deepgramApiKey: string;
  llmProvider: LLMProvider;
  anthropicApiKey: string;
  openaiApiKey: string;
  interpretationLevel: InterpretationLevel;
  insightMode: InsightMode;
  theme: 'dark' | 'light';
  speakerNames: Record<number, string>;
  showTranscript: boolean;
  backendUrl: string;
}

// --- Knowledge Graph types (backend mode) ---

export interface GraphEntity {
  id: string;
  name: string;
  summary: string;
  type: string;
  created_at: string;
  degree: number;
  community?: number;
}

export interface GraphRelationship {
  id: string;
  source_id: string;
  target_id: string;
  fact: string;
  type: string;
  valid_at?: string;
  invalid_at?: string;
}

export interface KnowledgeGraphMetadata {
  session_id: string;
  entity_count: number;
  relationship_count: number;
  last_updated: string;
}

export interface KnowledgeGraph {
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  metadata: KnowledgeGraphMetadata;
}

export interface Session {
  id: string;
  title: string;
  mindMap: MindMap | null;
  knowledgeGraph: KnowledgeGraph | null;
  transcript: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  deepgramApiKey: '',
  llmProvider: 'openai',
  anthropicApiKey: '',
  openaiApiKey: '',
  interpretationLevel: 'synthesizer',
  insightMode: 'fact_check',
  theme: 'dark',
  speakerNames: {},
  showTranscript: true,
  backendUrl: '',
};
