import { useState, useRef, useCallback } from 'react';
import { DeepgramService } from '../services/deepgram';
import type { TranscriptChunk } from '../types/mindmap';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface UseDeepgramOptions {
  apiKey: string;
  onTranscript: (chunk: TranscriptChunk) => void;
  onUtteranceEnd: () => void;
}

export function useDeepgram({ apiKey, onTranscript, onUtteranceEnd }: UseDeepgramOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<DeepgramService | null>(null);
  // Store latest callbacks in refs to avoid stale closures
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onUtteranceEndRef = useRef(onUtteranceEnd);
  onUtteranceEndRef.current = onUtteranceEnd;

  const startRecording = useCallback(async () => {
    if (!apiKey) {
      const msg = 'Deepgram API key is required. Add it in Settings.';
      setError(msg);
      throw new Error(msg);
    }

    setError(null);
    setConnectionState('connecting');

    const service = new DeepgramService(apiKey, {
      onTranscript: (chunk) => onTranscriptRef.current(chunk),
      onUtteranceEnd: () => onUtteranceEndRef.current(),
      onError: (err) => {
        setError(err.message);
        setConnectionState('error');
      },
      onOpen: () => setConnectionState('connected'),
      onClose: () => {
        if (serviceRef.current) {
          setConnectionState('reconnecting');
        }
      },
    });

    serviceRef.current = service;

    try {
      await service.start();
    } catch (err) {
      setError((err as Error).message);
      setConnectionState('error');
      serviceRef.current = null;
    }
  }, [apiKey]);

  const stopRecording = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.stop();
      serviceRef.current = null;
    }
    setConnectionState('idle');
  }, []);

  const isRecording = connectionState === 'connected' || connectionState === 'connecting' || connectionState === 'reconnecting';

  return {
    connectionState,
    error,
    isRecording,
    startRecording,
    stopRecording,
  };
}
