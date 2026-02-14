import { useRef, useEffect } from 'react';
import type { TranscriptChunk } from '../types/mindmap';
import { getSpeakerColor } from '../utils/colors';

interface TranscriptTickerProps {
  chunks: TranscriptChunk[];
  isVisible: boolean;
  speakerNames: Record<number, string>;
}

export function TranscriptTicker({ chunks, isVisible, speakerNames }: TranscriptTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chunks]);

  if (!isVisible || chunks.length === 0) return null;

  const displayChunks = chunks.slice(-20); // Show last 20 chunks

  return (
    <div className="mindflow-controls fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4">
      <div
        ref={scrollRef}
        className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-xl p-3 max-h-24 overflow-y-auto"
      >
        <div className="space-y-0.5">
          {displayChunks.map((chunk, i) => {
            const speakerNum = chunk.speaker ?? 0;
            const color = getSpeakerColor(speakerNum);
            const name = chunk.speaker !== null
              ? speakerNames[speakerNum] || `Speaker ${speakerNum}`
              : null;

            return (
              <div key={i} className="text-xs leading-relaxed fade-in">
                {name && (
                  <span className="font-mono mr-1.5" style={{ color }}>
                    {name}:
                  </span>
                )}
                <span className={`${chunk.isFinal ? 'text-neutral-300' : 'text-neutral-500 italic'}`}>
                  {chunk.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
