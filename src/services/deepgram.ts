import type { TranscriptChunk } from '../types/mindmap';

export interface DeepgramCallbacks {
  onTranscript: (chunk: TranscriptChunk) => void;
  onUtteranceEnd: () => void;
  onError: (error: Error) => void;
  onOpen: () => void;
  onClose: () => void;
}

export class DeepgramService {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private callbacks: DeepgramCallbacks;
  private apiKey: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private recordingStartTime = 0;
  private errorEmitted = false;

  constructor(apiKey: string, callbacks: DeepgramCallbacks) {
    this.apiKey = apiKey;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw new Error(
          'Microphone access denied. Please allow microphone access in your browser settings and try again.'
        );
      }
      throw new Error(`Could not access microphone: ${(err as Error).message}`);
    }

    this.recordingStartTime = Date.now();
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-3');
    url.searchParams.set('diarize', 'true');
    url.searchParams.set('interim_results', 'true');
    url.searchParams.set('utterance_end_ms', '1000');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('punctuate', 'true');

    this.errorEmitted = false;
    this.ws = new WebSocket(url.toString(), ['token', this.apiKey]);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.callbacks.onOpen();
      this.startMediaRecorder();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'Results') {
          const alternative = data.channel?.alternatives?.[0];
          if (!alternative || !alternative.transcript) return;

          const transcript = alternative.transcript.trim();
          if (!transcript) return;

          const words = alternative.words || [];
          const isFinal = data.is_final === true;
          const timestamp = (Date.now() - this.recordingStartTime) / 1000;

          // Majority-vote speaker across all words (handles delayed diarization)
          let speaker: number | null = null;
          if (words.length > 0) {
            const counts = new Map<number, number>();
            for (const w of words) {
              if (w.speaker != null) {
                counts.set(w.speaker, (counts.get(w.speaker) || 0) + 1);
              }
            }
            let maxCount = 0;
            for (const [spk, count] of counts) {
              if (count > maxCount) {
                maxCount = count;
                speaker = spk;
              }
            }
          }

          // Average word confidence
          let confidence = 1;
          if (words.length > 0) {
            const total = words.reduce((sum: number, w: { confidence?: number }) => sum + (w.confidence ?? 1), 0);
            confidence = total / words.length;
          }

          this.callbacks.onTranscript({
            text: transcript,
            speaker,
            isFinal,
            timestamp,
            confidence,
          });
        }

        if (data.type === 'UtteranceEnd') {
          this.callbacks.onUtteranceEnd();
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      // Only emit if onclose hasn't already handled it (onerror fires before onclose)
      if (!this.errorEmitted) {
        if (!navigator.onLine) {
          this.errorEmitted = true;
          this.callbacks.onError(new Error('No internet connection. Please check your network.'));
        }
        // Otherwise let onclose provide the specific message via close code
      }
    };

    this.ws.onclose = (event) => {
      console.warn('Deepgram WebSocket closed:', event.code, event.reason);
      this.callbacks.onClose();

      // Map close codes to actionable messages
      if (event.code === 1000) {
        // Normal close — no error
        return;
      }

      if (event.code === 1008) {
        // Auth failure — fail fast, don't reconnect
        if (!this.errorEmitted) {
          this.errorEmitted = true;
          this.callbacks.onError(new Error('Invalid Deepgram API key. Please check Settings.'));
        }
        this.reconnectAttempts = this.maxReconnectAttempts; // skip retries
        return;
      }

      // Attempt reconnection for recoverable errors
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.stream) {
        this.reconnectAttempts++;
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;

        if (!this.errorEmitted) {
          this.errorEmitted = true;
          if (event.code === 1006) {
            this.callbacks.onError(new Error(`Connection lost. Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`));
          } else if (event.code === 1011) {
            this.callbacks.onError(new Error('Deepgram service error. Retrying...'));
          } else {
            this.callbacks.onError(new Error(`Connection closed unexpectedly (code: ${event.code}). Reconnecting...`));
          }
        }

        setTimeout(() => this.connectWebSocket(), delay);
      } else if (!this.errorEmitted) {
        this.errorEmitted = true;
        this.callbacks.onError(new Error(
          event.code === 1006
            ? 'Connection lost. Please check your network and try again.'
            : `Deepgram connection failed (code: ${event.code}). Please try again.`
        ));
      }
    };
  }

  private startMediaRecorder(): void {
    if (!this.stream || !this.ws) return;

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(event.data);
      }
    };

    this.mediaRecorder.start(250); // Send chunks every 250ms
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;

    if (this.ws) {
      // Send close message per Deepgram protocol
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      }
      this.ws.close();
      this.ws = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function testDeepgramKey(apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 5000);

    const ws = new WebSocket(
      'wss://api.deepgram.com/v1/listen?model=nova-3',
      ['token', apiKey]
    );

    ws.onopen = () => {
      clearTimeout(timeout);
      ws.close();
      resolve(true);
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      ws.close();
      resolve(false);
    };

    ws.onclose = (event) => {
      clearTimeout(timeout);
      // Code 1008 = policy violation (bad auth)
      if (event.code === 1008 || event.code === 1002) {
        resolve(false);
      }
    };
  });
}
