/**
 * Profiling chat service - talks to the backend user-profiling agent.
 */
import authService from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ProfilingTurnMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProfilingTurnResponse {
  reply: string;
  suggestions: string[];
  new_memories: string[];
}

/** An SSE event emitted by the streaming chat endpoint. */
export type ProfilingStreamEvent =
  | {type: 'token'; text: string}
  | {type: 'memories'; items: string[]}
  | {type: 'suggestions'; items: string[]}
  | {type: 'done'}
  | {type: 'error'; detail: string};

export interface ProfilingStreamHandlers {
  onToken: (text: string) => void;
  onMemories: (items: string[]) => void;
  onSuggestions: (items: string[]) => void;
  onError?: (detail: string) => void;
}

class ProfilingService {
  /**
   * Send one chat turn. `history` is the conversation so far (prior turns);
   * the frontend owns conversation state and the backend answers the latest
   * `message` personalized with what it remembers about the user.
   */
  async chat(message: string, history: ProfilingTurnMessage[]): Promise<ProfilingTurnResponse> {
    const token = authService.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/profiling/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Chat request failed');
    }

    return response.json();
  }

  /**
   * Load the user's persisted conversation (empty if none / persistence off).
   */
  async getHistory(): Promise<ProfilingTurnMessage[]> {
    const token = authService.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/profiling/history`, {
      headers: {Authorization: `Bearer ${token}`},
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to load history');
    }

    const data = await response.json();
    return (data.messages ?? []) as ProfilingTurnMessage[];
  }

  /**
   * Stream one chat turn as Server-Sent Events. Reply text arrives via
   * `onToken` as it's generated; `onMemories` and `onSuggestions` fire once at
   * the end. Routed through the Vite `/api` proxy so chunks aren't buffered.
   */
  async chatStream(
    message: string,
    history: ProfilingTurnMessage[],
    handlers: ProfilingStreamHandlers,
  ): Promise<void> {
    const token = authService.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/profiling/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({message, history}),
    });

    if (!response.ok || !response.body) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Chat stream failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    // Read until the stream ends, dispatching each complete SSE frame.
    for (;;) {
      const {value, done} = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, {stream: true});

      // Frames are separated by a blank line; keep the trailing partial frame.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data:')) {
          continue;
        }
        const event = JSON.parse(line.slice(5).trim()) as ProfilingStreamEvent;
        this.dispatch(event, handlers);
      }
    }
  }

  private dispatch(event: ProfilingStreamEvent, handlers: ProfilingStreamHandlers): void {
    switch (event.type) {
      case 'token':
        handlers.onToken(event.text);
        break;
      case 'memories':
        handlers.onMemories(event.items);
        break;
      case 'suggestions':
        handlers.onSuggestions(event.items);
        break;
      case 'error':
        handlers.onError?.(event.detail);
        break;
      case 'done':
        break;
    }
  }
}

export default new ProfilingService();
