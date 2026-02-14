import { useRef, useEffect } from 'react';
import type { TranscriptChunk } from '../types/mindmap';
import { getSpeakerColor } from '../utils/colors';

interface TranscriptTickerProps {
  chunks: TranscriptChunk[];
  isVisible: boolean;
  speakerNames: Record<number, string>;
}

interface SpeakerGroup {
  speaker: number | null;
  chunks: TranscriptChunk[];
}

function groupBySpeaker(chunks: TranscriptChunk[]): SpeakerGroup[] {
  const groups: SpeakerGroup[] = [];
  for (const chunk of chunks) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === chunk.speaker) {
      last.chunks.push(chunk);
    } else {
      groups.push({ speaker: chunk.speaker, chunks: [chunk] });
    }
  }
  return groups;
}

export function TranscriptTicker({ chunks, isVisible, speakerNames }: TranscriptTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chunks]);

  if (!isVisible || chunks.length === 0) return null;

  const displayChunks = chunks.slice(-20);
  const groups = groupBySpeaker(displayChunks);

  return (
    <div className="mindflow-controls fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4">
      <div
        ref={scrollRef}
        className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-xl p-3 max-h-24 overflow-y-auto"
      >
        <div className="space-y-1">
          {groups.map((group, gi) => {
            const speakerNum = group.speaker ?? 0;
            const color = getSpeakerColor(speakerNum);
            const name = group.speaker !== null
              ? speakerNames[speakerNum] || `Speaker ${speakerNum}`
              : null;

            return (
              <div key={gi} className="fade-in">
                {name && (
                  <span className="font-mono text-xs mr-1.5" style={{ color }}>
                    {name}:
                  </span>
                )}
                {group.chunks.map((chunk, ci) => (
                  <span
                    key={ci}
                    className={`text-xs leading-relaxed ${chunk.isFinal ? 'text-neutral-300' : 'text-neutral-500 italic'}`}
                  >
                    {ci > 0 ? ' ' : ''}{chunk.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
