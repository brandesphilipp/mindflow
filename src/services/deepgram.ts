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
          const speaker = words.length > 0 ? (words[0].speaker ?? null) : null;
          const isFinal = data.is_final === true;
          const timestamp = (Date.now() - this.recordingStartTime) / 1000;

          this.callbacks.onTranscript({
            text: transcript,
            speaker,
            isFinal,
            timestamp,
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
      this.callbacks.onError(new Error('Deepgram WebSocket error'));
    };

    this.ws.onclose = () => {
      this.callbacks.onClose();
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.stream) {
        this.reconnectAttempts++;
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        setTimeout(() => this.connectWebSocket(), delay);
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

export async function testDeepgramKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
