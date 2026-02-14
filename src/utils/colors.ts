import type { NodeType } from '../types/mindmap';

export const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  topic:    { bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', text: '#fbbf24' },
  point:    { bg: 'rgba(6, 182, 212, 0.25)',   border: '#06b6d4', text: '#22d3ee' },
  detail:   { bg: 'rgba(139, 92, 246, 0.25)',  border: '#8b5cf6', text: '#a78bfa' },
  action:   { bg: 'rgba(16, 185, 129, 0.25)',  border: '#10b981', text: '#34d399' },
  question: { bg: 'rgba(244, 63, 94, 0.25)',   border: '#f43f5e', text: '#fb7185' },
};

export const SPEAKER_COLORS = [
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
];

export function getSpeakerColor(speakerIndex: number): string {
  return SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
}

export const NODE_TYPE_ICONS: Record<NodeType, string> = {
  topic: '◉',
  point: '▸',
  detail: '·',
  action: '✓',
  question: '?',
};
