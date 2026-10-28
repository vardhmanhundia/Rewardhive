/**
 * Recommendation chat — the RAG showcase.
 *
 * Multi-turn: each question streams back staged progress (retrieving →
 * generating) and the answer token-by-token, then shows the cards it drew on.
 * Backend runs vector retrieval (pgvector) + Muse Spark generation; mock mode
 * fakes the stream locally so the flow is demoable offline.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Search, FileText } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CardTile } from '@/components/CardTile';
import cardService, {
  type CardProduct,
  type RecStage,
} from '@/services/cardService';

interface ChatTurn {
  id: string;
  query: string;
  stage: RecStage | null;
  answer: string;
  cards: CardProduct[];
}

const EXAMPLES = [
  'Best travel card with no foreign transaction fees',
  'Cash back on groceries, no annual fee',
  'Which card helps me build credit from scratch?',
  'Lots of dining rewards, fee is fine',
];

export const RecommendPage = () => {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const patch = (id: string, update: Partial<ChatTurn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));

  const ask = async (raw: string) => {
    const query = raw.trim();
    if (!query || busy) return;

    const id = crypto.randomUUID();
    setTurns((prev) => [...prev, { id, query, stage: null, answer: '', cards: [] }]);
    setInput('');
    setBusy(true);

    try {
      await cardService.recommendStream(query, {
        onStage: (stage) => patch(id, { stage }),
        onCards: (cards) => patch(id, { cards }),
        onToken: (chunk) =>
          setTurns((prev) =>
            prev.map((t) => (t.id === id ? { ...t, answer: t.answer + chunk } : t)),
          ),
      });
    } catch {
      patch(id, { stage: 'done', answer: 'Something went wrong — please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-glow text-foreground">
      <Navbar />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
        {empty ? (
          <EmptyState onPick={ask} />
        ) : (
          <div className="flex-1 space-y-8 py-8">
            {turns.map((turn) => (
              <Turn key={turn.id} turn={turn} />
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

const Turn = ({ turn }: { turn: ChatTurn }) => (
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
          <p className="leading-relaxed">
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
          text: `Found ${turn.cards.length} matching ${turn.cards.length === 1 ? 'card' : 'cards'}`,
          spin: false,
        };
      case 'generating':
        return { icon: FileText, text: 'Drafting a recommendation…', spin: true };
      default:
        return null;
    }
  }, [turn.stage, turn.cards.length]);

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
