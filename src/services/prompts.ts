import type { InterpretationLevel } from '../types/mindmap';

const INTERPRETATION_INSTRUCTIONS: Record<InterpretationLevel, string> = {
  faithful: `INTERPRETATION MODE: FAITHFUL
Organize what was literally said with minimal inference. Closely mirror the actual words and phrases used.
Do NOT add your own analysis or connections that weren't explicitly stated.
Group related statements together but preserve the speaker's original framing.`,

  synthesizer: `INTERPRETATION MODE: SYNTHESIZER (Active)
Identify themes and patterns across what was said. Merge related points even if stated at different times.
Suggest connections between ideas that may not have been explicitly stated.
Use concise labels that capture the essence of what was discussed.
Group by semantic relevance, not chronological order.`,

  analyst: `INTERPRETATION MODE: ANALYST (Opinionated)
Go beyond synthesis: highlight contradictions between speakers or statements.
Flag unstated assumptions underlying the discussion.
Suggest missing perspectives or topics that should be considered.
Mark nodes as "question" type when you identify unresolved tensions.
Be a provocative thinking partner, not just an organizer.`,
};

const MIND_MAP_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    root: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const },
        label: { type: 'string' as const },
        type: { type: 'string' as const, enum: ['topic', 'point', 'detail', 'action', 'question'] },
        speaker: { type: ['string', 'null'] as const },
        timestamp: { type: ['number', 'null'] as const },
        children: {
          type: 'array' as const,
          items: { $ref: '#/properties/root' },
        },
      },
      required: ['id', 'label', 'type', 'speaker', 'timestamp', 'children'],
    },
    crossReferences: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          sourceId: { type: 'string' as const },
          targetId: { type: 'string' as const },
          relationship: { type: 'string' as const, enum: ['supports', 'contradicts', 'elaborates', 'related_to'] },
        },
        required: ['sourceId', 'targetId', 'relationship'],
      },
    },
    metadata: {
      type: 'object' as const,
      properties: {
        version: { type: 'number' as const },
        totalSpeakers: { type: 'number' as const },
        durationSeconds: { type: 'number' as const },
        lastUpdated: { type: 'string' as const },
      },
      required: ['version', 'totalSpeakers', 'durationSeconds', 'lastUpdated'],
    },
  },
  required: ['root', 'crossReferences', 'metadata'],
};

export function getIncrementalSystemPrompt(level: InterpretationLevel): string {
  return `You are a real-time mind map updater. You receive the current mind map state and a new segment of transcript. Integrate the new information into the existing map structure.

${INTERPRETATION_INSTRUCTIONS[level]}

RULES:
1. Add new nodes where they semantically belong, not just appended at the end.
2. If the new text elaborates on an existing node, add children to that node.
3. If the new text introduces a genuinely new topic, add a new first-level child under root.
4. If the new text contradicts or refines an existing node, update that node's label.
5. Merge redundant information — do NOT create duplicate nodes.
6. Keep node labels concise (3-8 words). Use noun phrases, not full sentences.
7. Return the COMPLETE updated mind map (not just changes).
8. Preserve all existing node IDs. Generate new IDs using format: n{number}
9. Maximum depth: 4 levels. Prefer breadth over depth.
10. Mark nodes with appropriate types: topic, point, detail, action, question.
11. Preserve speaker labels exactly as provided (e.g., "Speaker 0").

You MUST return valid JSON matching the mind map schema. No additional text.`;
}

export function getFullRegenSystemPrompt(level: InterpretationLevel): string {
  return `You are a mind map generator that converts spoken conversation into a structured hierarchical mind map.

${INTERPRETATION_INSTRUCTIONS[level]}

RULES:
1. The root node should capture the overall topic/theme of the conversation.
2. First-level children are major themes or topics discussed.
3. Second-level children are subtopics, specific points, or evidence.
4. Third-level children are details, examples, or action items.
5. Maximum depth: 4 levels. Prefer breadth over depth.
6. Each node label should be concise (3-8 words). Use noun phrases.
7. Preserve speaker attribution when relevant.
8. Identify and merge redundant or closely related points.
9. Mark nodes with types: topic, point, detail, action, question.
10. When speakers disagree, create sibling nodes showing both perspectives.
11. Order children by importance/relevance, not chronological order.
12. Focus on semantic structure, not temporal order.

You MUST return valid JSON matching the mind map schema. No additional text.`;
}

export function buildIncrementalUserMessage(
  currentMap: string,
  newTranscript: string
): string {
  return `Current mind map:
${currentMap}

New transcript segment:
${newTranscript}

Return the updated complete mind map as JSON.`;
}

export function buildFullRegenUserMessage(fullTranscript: string): string {
  return `Generate a mind map from this transcript:

${fullTranscript}

Return the mind map as JSON.`;
}

export { MIND_MAP_JSON_SCHEMA };
