/**
 * Card catalog service.
 *
 * Talks to the backend when VITE_USE_MOCK_CARDS=false; otherwise serves the
 * local placeholder catalog so the UI runs before the API exists. When the
 * backend is live, set VITE_USE_MOCK_CARDS=false and regenerate shared/api.d.ts
 * (`npm run gen:api`) — then prefer those generated types over the ones below.
 */
import { cards } from '@/data/cards';
import authService from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Auth header for the recommendation endpoints, which read the user's profile. */
function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
const USE_MOCK = import.meta.env.VITE_USE_MOCK_CARDS !== 'false';

if (USE_MOCK && import.meta.env.DEV) {
  console.warn(
    '[cardService] Using local mock catalog. Set VITE_USE_MOCK_CARDS=false to call the API.',
  );
}

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
  picks?: CardRewardPick[];
  intent?: string;
  spend_baseline?: Record<string, number>;
}

/** A past recommend-chat conversation (session) — one tab under "pick up where
 *  you left off". The title is auto-set from the conversation's first question. */
export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  is_shared?: boolean;
  shared_by_me?: boolean;
  owner_email?: string | null;
}

export interface ShareInfo {
  conversation_id: string;
  title: string | null;
  owner_name: string;
  is_mine: boolean;
  already_added: boolean;
}

/** One fact the assistant has learned about the user (long-term profile). */
export interface UserMemory {
  id: string;
  content: string;
  created_at: string;
}

/** Wallet-optimizer types — mirror the backend engine's result shapes. */
export interface CategoryBreakdown {
  category: string;
  label: string;
  spend: number;
  card_id: string | null;
  card_name: string | null;
  rate: string;
  earned: number;
  effective_pct: number;
}

export interface WalletResult {
  net_annual_value: number;
  total_rewards: number;
  total_fees: number;
  effective_return_pct: number;
  breakdown: CategoryBreakdown[];
}

export interface ScenarioComparison {
  keep: WalletResult;
  reallocate: WalletResult;
  add: WalletResult;
  candidate_id: string;
  candidate_name: string;
  candidate_fee: number;
  gain_from_reallocating: number;
  gain_from_adding: number;
  worth_it: boolean;
  verdict: string;
}

/** A card the user holds, with the category they currently use it for. */
export interface OwnedCardInput {
  card_id: string;
  category?: string;
}

/** One card's best earn on a purchase — the "which card should I use?" ranking. */
export interface CardRewardPick {
  card_id: string;
  card_name: string;
  issuer: string;
  reward_label: string;
  rate: string;
  effective_pct: number;
  est_annual_value: number | null;
  specific: boolean;
  category_group?: string;
  category_total?: number;
}

/** The resolved purchase plus the cards ranked best-first. */
export interface RewardResult {
  category: string | null;
  merchant: string | null;
  note: string;
  picks: CardRewardPick[];
}

/** A follow-up prompt the agent emits for the UI to render as a button/confirm. */
export interface FollowUpPrompt {
  action: 'offer_evaluate' | 'offer_add';
  card_ids: string[];
}

/** Receipt line item extracted from an uploaded image. */
export interface ReceiptLineItem {
  merchant: string;
  amount: number;
  category: string;
  date: string | null;
}

/** Result of parsing a receipt or statement image. */
export interface ReceiptParseResult {
  items: ReceiptLineItem[];
  total_amount: number;
  currency: string;
  statement_date: string | null;
}

/** Purchase context extracted from a screenshot. */
export interface ScreenshotAnalysis {
  merchant: string | null;
  amount: number | null;
  category: string | null;
  description: string;
}

/** What the RAG endpoint returns: Muse prose, the cards it drew on, the memories
 *  captured this turn, and three follow-up suggestions. */
export interface RecommendationResult {
  answer: string;
  cards: CardProduct[];
  newMemories: string[];
  suggestions: string[];
  intent?: string;
  prompts?: FollowUpPrompt[];
  spendBaseline?: Record<string, number>;
}

/** Stages surfaced to the UI as the RAG pipeline runs. */
export type RecStage = 'retrieving' | 'retrieved' | 'generating' | 'done';

export interface RecStreamHandlers {
  onStage?: (stage: RecStage, meta?: { count?: number }) => void;
  onToken?: (chunk: string) => void;
  onCards?: (cards: CardProduct[]) => void;
  onMemories?: (items: string[]) => void;
  onSuggestions?: (items: string[]) => void;
  /** The conversation this turn was persisted under — a fresh session adopts the
   *  server-assigned id so follow-ups continue the same thread. */
  onConversation?: (id: string) => void;
  onRoute?: (intent: string) => void;
  onPrompt?: (prompt: FollowUpPrompt) => void;
  onPlan?: (plan: Record<string, unknown>) => void;
  onResult?: (result: Record<string, unknown>) => void;
  signal?: AbortSignal;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

class CardService {
  /** List every card in the catalog (feeds the browse grid). */
  async getAllCards(): Promise<CardProduct[]> {
    if (USE_MOCK) {
      await delay(300);
      return cards;
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
      const card = cards.find((c) => c.id === id);
      if (!card) throw new Error('Card not found');
      return card;
    }
    const res = await fetch(`${API_URL}/cards/${id}`);
    if (!res.ok) throw new Error('Card not found');
    return res.json();
  }

  /** What the assistant has learned about the user — long-term profile memories.
   *  Empty in mock mode, when not logged in, or when nothing is stored yet. */
  async getProfileSummary(): Promise<UserMemory[]> {
    if (USE_MOCK) return [];
    const res = await fetch(`${API_URL}/recommendations/profile`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.memories ?? []) as UserMemory[];
  }

  /** The user's persisted recommend conversation (empty if none / not logged in). */
  async getHistory(): Promise<RecMessage[]> {
    if (USE_MOCK) return [];
    const res = await fetch(`${API_URL}/recommendations/history`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.messages ?? []).map((m: RecMessage) => ({
      role: m.role,
      content: m.content,
      cards: m.cards ?? [],
      picks: m.picks ?? [],
      intent: m.intent,
      spend_baseline: m.spend_baseline,
    })) as RecMessage[];
  }

  /** The user's recommend-chat conversations, most recent first (empty in mock /
   *  logged out) — the tabs under "pick up where you left off". */
  async listConversations(): Promise<Conversation[]> {
    if (USE_MOCK) return [];
    const res = await fetch(`${API_URL}/recommendations/conversations`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.conversations ?? []) as Conversation[];
  }

  /** One conversation's persisted transcript (empty in mock / if not found). */
  async getConversationHistory(id: string): Promise<RecMessage[]> {
    if (USE_MOCK) return [];
    const res = await fetch(`${API_URL}/recommendations/conversations/${id}/history`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.messages ?? []).map((m: RecMessage) => ({
      role: m.role,
      content: m.content,
      cards: m.cards ?? [],
      picks: m.picks ?? [],
      intent: m.intent,
      spend_baseline: m.spend_baseline,
    })) as RecMessage[];
  }

  async shareConversation(conversationId: string, emails: string[]): Promise<{ shared_with: string[]; invited_new: string[]; not_found: string[] }> {
    const res = await fetch(`${API_URL}/recommendations/conversations/${conversationId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ emails }),
    });
    if (!res.ok) throw new Error('Could not share conversation');
    return res.json();
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    const res = await fetch(`${API_URL}/recommendations/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.ok;
  }

  async getShareInfo(conversationId: string): Promise<ShareInfo | null> {
    const res = await fetch(`${API_URL}/recommendations/conversations/${conversationId}/share-info`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return null;
    return res.json();
  }

  async addConversationToMine(conversationId: string): Promise<boolean> {
    const res = await fetch(`${API_URL}/recommendations/conversations/${conversationId}/add-to-mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    return res.ok;
  }

  /** Optimize a wallet for a spend profile (annual $ per category). Hits the
   *  backend engine directly — the optimizer is never mocked. */
  async optimizeWallet(
    spend: Record<string, number>,
    cardIds: string[],
  ): Promise<WalletResult> {
    const res = await fetch(`${API_URL}/optimizer/wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ spend, card_ids: cardIds }),
    });
    if (!res.ok) throw new Error('Could not optimize wallet');
    return res.json();
  }

  /** "Should I get this card?" — keep vs. reallocate vs. add, with a verdict. */
  async evaluateCard(
    spend: Record<string, number>,
    owned: OwnedCardInput[],
    candidateId: string,
  ): Promise<ScenarioComparison> {
    const res = await fetch(`${API_URL}/optimizer/evaluate-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ spend, owned, candidate_id: candidateId }),
    });
    if (!res.ok) throw new Error('Could not evaluate card');
    return res.json();
  }

  /**
   * Stream the advisor agent: it interprets a what-if question, re-runs the
   * optimizer on the adjusted spend, and streams a grounded explanation.
   * Consumes the same named-SSE format as the recommend stream.
   */
  async advisorStream(
    body: {
      question: string;
      spend: Record<string, number>;
      owned: OwnedCardInput[];
      candidate_id?: string;
    },
    handlers: {
      onPlan?: (note: string, spend: Record<string, number>) => void;
      onResult?: (mode: string, result: ScenarioComparison | WalletResult) => void;
      onToken?: (text: string) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<void> {
    const res = await fetch(`${API_URL}/advisor/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) throw new Error('Advisor request failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
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
        if (event === 'plan') handlers.onPlan?.(payload.note, payload.spend);
        else if (event === 'result') handlers.onResult?.(payload.mode, payload.result);
        else if (event === 'token') handlers.onToken?.(payload.text);
        else if (event === 'error') throw new Error(payload.detail ?? 'Advisor error');
      }
    }
  }

  /**
   * Stream the rewards agent: "which of my cards should I use for this purchase?".
   * It resolves the purchase, ranks the candidate cards with the deterministic
   * engine, and streams a grounded explanation. Consumes the same named-SSE
   * format as the advisor stream. When the user has no cards to rank, the backend
   * emits a single `need_cards` event instead of a result.
   */
  async bestCardStream(
    body: {
      question: string;
      card_ids?: string[];
      monthly_amount?: number;
      image_b64?: string;
      image_mime?: string;
    },
    handlers: {
      onPlan?: (note: string, category: string | null, merchant: string | null, owned: boolean) => void;
      onResult?: (picks: CardRewardPick[], owned: boolean) => void;
      onToken?: (text: string) => void;
      onNeedCards?: () => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<void> {
    const res = await fetch(`${API_URL}/rewards/best-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) throw new Error('Rewards request failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
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
        if (event === 'plan') handlers.onPlan?.(payload.note, payload.category, payload.merchant, payload.owned);
        else if (event === 'result') handlers.onResult?.(payload.picks, payload.owned);
        else if (event === 'token') handlers.onToken?.(payload.text);
        else if (event === 'need_cards') handlers.onNeedCards?.();
        else if (event === 'error') throw new Error(payload.detail ?? 'Rewards error');
      }
    }
  }

  /** Upload a receipt or statement image and extract spend data. */
  async parseReceipt(file: File): Promise<ReceiptParseResult> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/multimodal/parse-receipt`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error('Receipt parsing failed');
    return res.json();
  }

  /** Upload a screenshot and get purchase context for the card advisor. */
  async analyzeScreenshot(file: File, question?: string): Promise<ScreenshotAnalysis> {
    const form = new FormData();
    form.append('file', file);
    if (question) form.append('question', question);
    const res = await fetch(`${API_URL}/multimodal/analyze-screenshot`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error('Screenshot analysis failed');
    return res.json();
  }

  /** Have Muse Spark rewrite an answer into casual spoken-word style. */
  async rewriteForSpeech(text: string): Promise<string> {
    const res = await fetch(`${API_URL}/multimodal/rewrite-for-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.spoken ?? text;
  }

  async speak(text: string): Promise<Blob> {
    const res = await fetch(`${API_URL}/multimodal/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('Speech synthesis failed');
    return res.blob();
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
    conversationId?: string,
    imageB64?: string,
    imageMime?: string,
  ): Promise<RecommendationResult> {
    if (USE_MOCK) return mockRecommendStream(query, handlers);

    console.log('[RECOMMEND] starting stream fetch');
    const body: Record<string, unknown> = {
      query,
      history,
      conversation_id: conversationId ?? null,
    };
    if (imageB64) {
      body.image_b64 = imageB64;
      body.image_mime = imageMime ?? 'image/png';
    }
    const res = await fetch(`${API_URL}/recommendations/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
    console.log('[RECOMMEND] fetch status:', res.status, 'body:', !!res.body);
    if (!res.ok || !res.body) throw new Error('Recommendation failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    let resultCards: CardProduct[] = [];
    let newMemories: string[] = [];
    let suggestions: string[] = [];
    let intent: string | undefined;
    const prompts: FollowUpPrompt[] = [];
    let spendBaseline: Record<string, number> | undefined;

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
        console.log('[SSE]', event, payload);
        if (event === 'conversation') handlers.onConversation?.(payload.id);
        else if (event === 'stage') handlers.onStage?.(payload.stage, { count: payload.count });
        else if (event === 'cards') {
          resultCards = payload;
          handlers.onCards?.(resultCards);
        } else if (event === 'token') {
          answer += payload.text;
          handlers.onToken?.(payload.text);
        } else if (event === 'memories') {
          newMemories = payload.items ?? [];
          handlers.onMemories?.(newMemories);
        } else if (event === 'suggestions') {
          suggestions = payload.items ?? [];
          handlers.onSuggestions?.(suggestions);
        } else if (event === 'route') {
          intent = payload.intent;
          handlers.onRoute?.(payload.intent);
        } else if (event === 'prompt') {
          const p: FollowUpPrompt = { action: payload.action, card_ids: payload.card_ids ?? [] };
          prompts.push(p);
          handlers.onPrompt?.(p);
        } else if (event === 'plan') {
          if (payload.spend) spendBaseline = payload.spend;
          handlers.onPlan?.(payload);
        } else if (event === 'result') {
          handlers.onResult?.(payload);
        } else if (event === 'error') {
          throw new Error(payload.detail ?? 'Recommendation error');
        }
      }
    }
    handlers.onStage?.('done');
    return { answer, cards: resultCards, newMemories, suggestions, intent, prompts, spendBaseline };
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

  const { answer, cards: resultCards } = mockRecommend(query);
  onStage?.('retrieved', { count: resultCards.length });
  onCards?.(resultCards);
  await sleep(400);

  onStage?.('generating');
  const words = answer.split(' ');
  for (const word of words) {
    onToken?.(word + ' ');
    await sleep(35);
  }
  onStage?.('done');
  return { answer, cards: resultCards, newMemories: [], suggestions: [] };
}

/** Local stand-in for the backend RAG pipeline — keyword match, not real retrieval. */
function mockRecommend(query: string): RecommendationResult {
  const q = query.toLowerCase();
  const scored = cards
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
