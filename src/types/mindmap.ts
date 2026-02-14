export type NodeType = 'topic' | 'point' | 'detail' | 'action' | 'question';

export type RelationshipType = 'supports' | 'contradicts' | 'elaborates' | 'related_to';

export type InterpretationLevel = 'faithful' | 'synthesizer' | 'analyst';

export type LLMProvider = 'anthropic' | 'openai';

export interface MindMapNode {
  id: string;
  label: string;
  type: NodeType;
  speaker: string | null;
  timestamp: number | null;
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
}

export interface AppSettings {
  deepgramApiKey: string;
  llmProvider: LLMProvider;
  anthropicApiKey: string;
  openaiApiKey: string;
  interpretationLevel: InterpretationLevel;
  theme: 'dark' | 'light';
  speakerNames: Record<number, string>;
  showTranscript: boolean;
}

export interface Session {
  id: string;
  title: string;
  mindMap: MindMap | null;
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
  theme: 'dark',
  speakerNames: {},
  showTranscript: true,
};
