/**
 * Recommendation chat — the RAG showcase.
 *
 * Multi-turn: each question streams back staged progress (retrieving →
 * generating) and the answer token-by-token, then shows the cards it drew on.
 * Backend runs vector retrieval (pgvector) + Muse Spark generation; mock mode
 * fakes the stream locally so the flow is demoable offline.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Sparkles, Send, Search, FileText } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CardTile } from '@/components/CardTile';
import cardService, {
  type CardProduct,
  type RecMessage,
  type RecStage,
} from '@/services/cardService';

interface ChatTurn {
  id: string;
  query: string;
  stage: RecStage | null;
  answer: string;
  cards: CardProduct[];
  // How many candidates retrieval found this turn (for the progress line; the
  // rendered `cards` are only the subset the answer recommends).
  found: number;
  memories: string[];
  suggestions: string[];
}

const EXAMPLES = [
  'Best travel card with no foreign transaction fees',
  'Cash back on groceries, no annual fee',
  'Which card helps me build credit from scratch?',
  'Lots of dining rewards, fee is fine',
];

/** Rebuild chat turns from a persisted transcript (pairs each user message with
 *  the assistant reply that follows, carrying the cards recommended then). */
function restoreTurns(msgs: RecMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role !== 'user') continue;
    const next = msgs[i + 1];
    const isReply = next?.role === 'assistant';
    const answer = isReply ? next.content : '';
    const cards = isReply ? next.cards ?? [] : [];
    turns.push({
      id: crypto.randomUUID(),
      query: msgs[i].content,
      stage: 'done',
      answer,
      cards,
      found: cards.length,
      memories: [],
      suggestions: [],
    });
    if (answer) i++;
  }
  return turns;
}

export const RecommendPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // The conversation (session) this chat reads/writes, from the URL (?c=<id>).
  // Absent = a fresh session; the server assigns an id on the first turn.
  const urlConversationId = searchParams.get('c');

  // A query handed over from My Space's quick-ask via router state. Asked once in
  // a fresh session. React Router keeps location.state across a refresh, so we
  // clear it after consuming so a refresh doesn't replay it.
  const handoffQuery = useRef<string | null>(
    (location.state as { initialQuery?: string } | null)?.initialQuery ?? null,
  );

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);
  // The conversation currently being written to (URL id, or the one the server
  // assigns for a fresh session). `syncedConv` marks ids this component itself
  // put in the URL, so that URL change doesn't reload and clobber the live turns.
  const convId = useRef<string | null>(urlConversationId);
  const syncedConv = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const patch = (id: string, update: Partial<ChatTurn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));

  const ask = async (raw: string) => {
    const query = raw.trim();
    if (!query || busy) return;

    // Prior turns become conversation context for follow-ups.
    const history = turns
      .flatMap((t) => [
        { role: 'user' as const, content: t.query },
        { role: 'assistant' as const, content: t.answer },
      ])
      .filter((m) => m.content.trim());

    const id = crypto.randomUUID();
    setTurns((prev) => [
      ...prev,
      { id, query, stage: null, answer: '', cards: [], found: 0, memories: [], suggestions: [] },
    ]);
    setInput('');
    setBusy(true);

    try {
      await cardService.recommendStream(
        query,
        {
          onConversation: (cid) => {
            convId.current = cid;
            syncedConv.current = cid; // our own URL sync below shouldn't reload
            if (cid !== urlConversationId) setSearchParams({ c: cid }, { replace: true });
          },
          onStage: (stage, meta) =>
            patch(id, meta?.count != null ? { stage, found: meta.count } : { stage }),
          onCards: (cards) => patch(id, { cards }),
          onToken: (chunk) =>
            setTurns((prev) =>
              prev.map((t) => (t.id === id ? { ...t, answer: t.answer + chunk } : t)),
            ),
          onMemories: (items) => patch(id, { memories: items }),
          onSuggestions: (items) => patch(id, { suggestions: items }),
        },
        history,
        convId.current ?? undefined,
      );
    } catch {
      patch(id, { stage: 'done', answer: 'Something went wrong — please try again.' });
    } finally {
      setBusy(false);
    }
  };

  // Load a conversation's saved transcript when opened via ?c=<id> (e.g. a
  // "pick up where you left off" tab). Skipped for an id this session just
  // created, so syncing that id into the URL doesn't clobber the live turns.
  useEffect(() => {
    if (!urlConversationId || urlConversationId === syncedConv.current) return;
    let cancelled = false;
    convId.current = urlConversationId;
    cardService
      .getConversationHistory(urlConversationId)
      .then((msgs) => {
        if (!cancelled) setTurns(restoreTurns(msgs));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [urlConversationId]);

  // Fresh session: fire the handed-over query once (no restore). Clearing the
  // router state keeps a refresh from replaying it.
  useEffect(() => {
    if (urlConversationId || !handoffQuery.current || didInit.current) return;
    didInit.current = true;
    const query = handoffQuery.current;
    handoffQuery.current = null;
    navigate(location.pathname, { replace: true, state: null });
    ask(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start a brand-new conversation: clear the view and drop ?c from the URL.
  const startNewChat = () => {
    if (busy) return;
    setTurns([]);
    convId.current = null;
    syncedConv.current = null;
    didInit.current = true; // don't re-fire any handoff
    setSearchParams({}, { replace: false });
  };

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-glow text-foreground">
      <Navbar />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
        {!empty && (
          <div className="flex justify-end pt-6">
            <button
              onClick={startNewChat}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              New chat
            </button>
          </div>
        )}
        {empty ? (
          <EmptyState onPick={ask} />
        ) : (
          <div className="flex-1 space-y-8 py-4">
            {turns.map((turn) => (
              <Turn key={turn.id} turn={turn} onPick={ask} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="glass sticky bottom-4 mt-auto mb-4 rounded-2xl p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={2}
            placeholder={
              empty
                ? 'Describe how you spend — e.g. I travel a few times a year and eat out a lot'
                : 'Ask a follow-up…'
            }
            className="w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs text-muted-foreground">Enter to send · Shift+Enter for newline</span>
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {busy ? 'Thinking…' : 'Ask'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

const EmptyState = ({ onPick }: { onPick: (q: string) => void }) => (
  <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      Retrieval-augmented · Muse Spark
    </div>
    <h1 className="font-display text-4xl font-bold tracking-tight">
      Which card should I <span className="text-gradient">get?</span>
    </h1>
    <p className="mt-3 max-w-md text-muted-foreground">
      Describe how you spend. The assistant searches the catalog and explains its pick — ask
      follow-ups to narrow it down.
    </p>
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {EXAMPLES.map((ex) => (
        <button
          key={ex}
          onClick={() => onPick(ex)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {ex}
        </button>
      ))}
    </div>
  </div>
);

const Turn = ({ turn, onPick }: { turn: ChatTurn; onPick: (q: string) => void }) => (
  <div className="space-y-4">
    {/* User bubble */}
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {turn.query}
      </div>
    </div>

    {/* Assistant response */}
    <div className="space-y-4">
      <StageLine turn={turn} />

      {turn.answer && (
        <div className="glass rounded-2xl rounded-tl-sm p-4">
          <p className="whitespace-pre-wrap leading-relaxed">
            {turn.answer}
            {turn.stage === 'generating' && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
            )}
          </p>
        </div>
      )}

      {turn.cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {turn.cards.map((card) => (
            <CardTile key={card.id} card={card} />
          ))}
        </div>
      )}

      {turn.memories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Noted about you:</span>
          {turn.memories.map((m) => (
            <span
              key={m}
              className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-foreground"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      {turn.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {turn.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

/** The visible RAG pipeline: searching → found → drafting. */
const StageLine = ({ turn }: { turn: ChatTurn }) => {
  const label = useMemo(() => {
    switch (turn.stage) {
      case 'retrieving':
        return { icon: Search, text: 'Searching the catalog…', spin: true };
      case 'retrieved':
        return {
          icon: Search,
          text: `Found ${turn.found} matching ${turn.found === 1 ? 'card' : 'cards'}`,
          spin: false,
        };
      case 'generating':
        return { icon: FileText, text: 'Drafting a recommendation…', spin: true };
      default:
        return null;
    }
  }, [turn.stage, turn.found]);

  // Once the answer is flowing, the "drafting" line is redundant.
  if (!label || (turn.stage === 'generating' && turn.answer)) return null;

  const Icon = label.icon;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className={`h-4 w-4 text-primary ${label.spin ? 'animate-pulse' : ''}`} />
      {label.text}
    </div>
  );
};
