/**
 * Card catalog service.
 *
 * Talks to the backend when VITE_USE_MOCK_CARDS=false; otherwise serves the
 * local placeholder catalog so the UI runs before the API exists. When the
 * backend is live, set VITE_USE_MOCK_CARDS=false and regenerate shared/api.d.ts
 * (`npm run gen:api`) — then prefer those generated types over the ones below.
 */
import { mockCards } from '@/data/mockCards';
import authService from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Auth header for the recommendation endpoints, which read the user's profile. */
function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
const USE_MOCK = import.meta.env.VITE_USE_MOCK_CARDS !== 'false';

export interface CardReward {
  category: string;
  rate: string;
}

export interface CardProduct {
  id: string;
  name: string;
  issuer: string;
  network?: string;
  card_type?: string;
  annual_fee: number;
  apr?: string;
  foreign_transaction_fee?: number;
  credit_score_required?: string;
  intro_offer?: string;
  rewards: CardReward[];
  benefits: string[];
  summary?: string;
  image_url?: string;
}

/** A prior chat turn, sent back as context for follow-ups. Assistant turns from
 *  history also carry the cards that were recommended so the UI can rebuild them. */
export interface RecMessage {
  role: 'user' | 'assistant';
  content: string;
  cards?: CardProduct[];
}

/** What the RAG endpoint returns: Muse prose, the cards it drew on, the memories
 *  captured this turn, and three follow-up suggestions. */
export interface RecommendationResult {
  answer: string;
  cards: CardProduct[];
  newMemories: string[];
  suggestions: string[];
}

/** Stages surfaced to the UI as the RAG pipeline runs. */
export type RecStage = 'retrieving' | 'retrieved' | 'generating' | 'done';

export interface RecStreamHandlers {
  onStage?: (stage: RecStage, meta?: { count?: number }) => void;
  onToken?: (chunk: string) => void;
  onCards?: (cards: CardProduct[]) => void;
  onMemories?: (items: string[]) => void;
  onSuggestions?: (items: string[]) => void;
  signal?: AbortSignal;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

class CardService {
  /** List every card in the catalog (feeds the browse grid). */
  async getAllCards(): Promise<CardProduct[]> {
    if (USE_MOCK) {
      await delay(300);
      return mockCards;
    }
    const res = await fetch(`${API_URL}/cards`);
    if (!res.ok) throw new Error('Failed to load cards');
    const data = await res.json();
    return data.cards ?? data;
  }

  /** Fetch a single card for the detail view. */
  async getCard(id: string): Promise<CardProduct> {
    if (USE_MOCK) {
      await delay(200);
      const card = mockCards.find((c) => c.id === id);
      if (!card) throw new Error('Card not found');
      return card;
    }
    const res = await fetch(`${API_URL}/cards/${id}`);
    if (!res.ok) throw new Error('Card not found');
    return res.json();
  }

  /** The user's persisted recommend conversation (empty if none / not logged in). */
  async getHistory(): Promise<RecMessage[]> {
    if (USE_MOCK) return [];
    const res = await fetch(`${API_URL}/recommendations/history`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.messages ?? []).map((m: RecMessage & { cards?: CardProduct[] }) => ({
      role: m.role,
      content: m.content,
      cards: m.cards ?? [],
    })) as RecMessage[];
  }

  /**
   * Ask for a recommendation. In mock mode this does naive keyword scoring so
   * the workflow is demoable; the real version POSTs to the RAG endpoint, which
   * runs SONAR retrieval + Muse generation on the backend.
   */
  async recommend(query: string, history: RecMessage[] = []): Promise<RecommendationResult> {
    if (USE_MOCK) {
      await delay(900);
      return mockRecommend(query);
    }
    const res = await fetch(`${API_URL}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ query, history }),
    });
    if (!res.ok) throw new Error('Recommendation failed');
    const data = await res.json();
    return {
      answer: data.answer,
      cards: data.cards,
      newMemories: data.new_memories ?? [],
      suggestions: data.suggestions ?? [],
    };
  }

  /**
   * Streaming recommendation. The UI gets staged progress (retrieving →
   * generating) and the answer token-by-token, then the final result resolves.
   *
   * Mock mode fakes the stream locally. The live path consumes Server-Sent
   * Events from the backend; expected events: `stage` ({stage,count}),
   * `cards` (CardProduct[]), `token` ({text}), `done`.
   */
  async recommendStream(
    query: string,
    handlers: RecStreamHandlers = {},
    history: RecMessage[] = [],
  ): Promise<RecommendationResult> {
    if (USE_MOCK) return mockRecommendStream(query, handlers);

    const res = await fetch(`${API_URL}/recommendations/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ query, history }),
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) throw new Error('Recommendation failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    let cards: CardProduct[] = [];
    let newMemories: string[] = [];
    let suggestions: string[] = [];

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const event = /event:\s*(.*)/.exec(frame)?.[1]?.trim();
        const dataLine = /data:\s*([\s\S]*)/.exec(frame)?.[1];
        if (!event || !dataLine) continue;
        const payload = JSON.parse(dataLine);
        if (event === 'stage') handlers.onStage?.(payload.stage, { count: payload.count });
        else if (event === 'cards') {
          cards = payload;
          handlers.onCards?.(cards);
        } else if (event === 'token') {
          answer += payload.text;
          handlers.onToken?.(payload.text);
        } else if (event === 'memories') {
          newMemories = payload.items ?? [];
          handlers.onMemories?.(newMemories);
        } else if (event === 'suggestions') {
          suggestions = payload.items ?? [];
          handlers.onSuggestions?.(suggestions);
        }
      }
    }
    handlers.onStage?.('done');
    return { answer, cards, newMemories, suggestions };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Local fake of the streaming RAG pipeline so the chat UI is demoable offline. */
async function mockRecommendStream(
  query: string,
  { onStage, onToken, onCards }: RecStreamHandlers,
): Promise<RecommendationResult> {
  onStage?.('retrieving');
  await sleep(600);

  const { answer, cards } = mockRecommend(query);
  onStage?.('retrieved', { count: cards.length });
  onCards?.(cards);
  await sleep(400);

  onStage?.('generating');
  const words = answer.split(' ');
  for (const word of words) {
    onToken?.(word + ' ');
    await sleep(35);
  }
  onStage?.('done');
  return { answer, cards, newMemories: [], suggestions: [] };
}

/** Local stand-in for the backend RAG pipeline — keyword match, not real retrieval. */
function mockRecommend(query: string): RecommendationResult {
  const q = query.toLowerCase();
  const scored = mockCards
    .map((card) => {
      const haystack = [
        card.name,
        card.card_type,
        card.summary,
        ...card.benefits,
        ...card.rewards.map((r) => r.category),
      ]
        .join(' ')
        .toLowerCase();
      let score = 0;
      for (const term of q.split(/\s+/).filter((t) => t.length > 2)) {
        if (haystack.includes(term)) score += 1;
      }
      if (q.includes('no annual fee') && card.annual_fee === 0) score += 3;
      if (q.includes('travel') && card.card_type === 'travel') score += 2;
      if ((q.includes('build') || q.includes('credit score')) && card.card_type === 'secured')
        score += 3;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((s) => s.score > 0).slice(0, 3);
  const picks = (top.length ? top : scored.slice(0, 2)).map((s) => s.card);

  const answer = top.length
    ? `Based on your request, ${picks[0].name} from ${picks[0].issuer} looks like the strongest fit${
        picks[1] ? `, with ${picks[1].name} as a solid alternative` : ''
      }. (This is placeholder reasoning — the live version is generated by Muse Spark over cards retrieved with SONAR + pgvector.)`
    : `I couldn't match that closely, so here are a couple of popular options to start from. (Placeholder reasoning — the live version is generated by Muse Spark.)`;

  return { answer, cards: picks, newMemories: [], suggestions: [] };
}

export default new CardService();
