/**
 * "Which card should I use?" — the everyday rewards question.
 *
 * The user asks about a purchase ("which card for an Airbnb booking?", or "I have
 * the Amex Gold and Chase Freedom — which for dining?") and the rewards agent
 * resolves the purchase, ranks the cards they hold (or the two they named) by what
 * each earns, and streams a grounded explanation. A specific merchant deal (United
 * 9x flights, IHG hotels) is surfaced over the generic category.
 *
 * When the user has no saved cards, the engine ranks the whole catalog instead and
 * the answer is framed as suggestions — grounded in the same channel-aware numbers
 * rather than handed off to the generic recommender.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Send, Sparkles, Wallet } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import Markdown from '@/components/Markdown';
import cardService, { type CardRewardPick } from '@/services/cardService';
import profileService from '@/services/profileService';

interface Turn {
  id: string;
  query: string;
  note: string;
  merchant: string | null;
  owned: boolean;
  picks: CardRewardPick[];
  answer: string;
  busy: boolean;
}

const EXAMPLES = [
  'Which card for an Airbnb booking?',
  'Best card for groceries?',
  'Which card should I use for a United flight?',
  'I have the Amex Gold and Chase Freedom — which for dining?',
];

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export const WhichCardPage = () => {
  const { data: profile } = useQuery({
    queryKey: ['profileDetails'],
    queryFn: () => profileService.getDetails(),
  });
  const savedCount = profile?.cards.filter((c) => c.card_id).length ?? 0;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const patch = (id: string, update: Partial<Turn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));

  const ask = async (raw: string) => {
    const query = raw.trim();
    if (!query || busy) return;
    const id = crypto.randomUUID();
    const monthly = Number(amount);
    setTurns((prev) => [
      ...prev,
      { id, query, note: '', merchant: null, owned: true, picks: [], answer: '', busy: true },
    ]);
    setInput('');
    setBusy(true);

    try {
      await cardService.bestCardStream(
        { question: query, monthly_amount: monthly > 0 ? monthly : undefined },
        {
          onPlan: (note, _category, merchant, owned) => patch(id, { note, merchant, owned }),
          onResult: (picks, owned) => patch(id, { picks, owned }),
          onToken: (t) =>
            setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, answer: x.answer + t } : x))),
        },
      );
    } catch {
      patch(id, { answer: 'Something went wrong — is the backend running?' });
    } finally {
      patch(id, { busy: false });
      setBusy(false);
    }
  };

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-glow text-foreground">
      <Navbar />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
        {empty ? (
          <EmptyState onPick={ask} savedCount={savedCount} />
        ) : (
          <div className="flex-1 space-y-8 py-8">
            {turns.map((turn) => (
              <TurnView key={turn.id} turn={turn} />
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
          className="glass sticky bottom-4 mt-auto mb-4 sm:mb-4 mb-[4.5rem] rounded-xl p-3"
        >
          <div className="flex items-center gap-2 px-1 pb-2">
            <label className="text-xs text-muted-foreground">Monthly spend here (optional)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="200"
                className="h-8 w-24 rounded-lg border border-input bg-background/60 pl-5 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder="Which card should I use for…?"
            className="w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
            style={{ overflow: 'hidden' }}
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs text-muted-foreground hidden sm:inline">Enter to send · Shift+Enter for newline</span>
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 ml-auto"
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

const EmptyState = ({ onPick, savedCount }: { onPick: (q: string) => void; savedCount: number }) => (
  <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
      <Wallet className="h-3.5 w-3.5 text-primary" />
      Rewards advisor
    </div>
    <h1 className="font-display text-4xl font-bold tracking-tight">
      Which card should I <span className="text-gradient">use?</span>
    </h1>
    <p className="mt-3 max-w-md text-muted-foreground">
      Name a purchase and I'll tell you which of your cards earns the most — including
      merchant-specific deals like flights or hotels.
    </p>
    {savedCount === 0 && (
      <div className="mt-6 max-w-md rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
        You don't have any cards saved yet, so I'll suggest the best card for each purchase
        from the catalog.{' '}
        <Link to="/profile" className="font-medium text-primary underline-offset-2 hover:underline">
          Add the cards you hold
        </Link>{' '}
        — or just name them in your question — for a personalized answer.
      </div>
    )}
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

const TurnView = ({ turn }: { turn: Turn }) => (
  <div className="space-y-4">
    {/* User bubble */}
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {turn.query}
      </div>
    </div>

    {/* Assistant response */}
    <div className="space-y-4">
      {turn.note && (
        <p className="inline-block rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-foreground">
          {turn.note}
        </p>
      )}

      {!turn.owned && turn.picks.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
          You don't own any of these yet — these are the catalog cards that would earn the
          most on this purchase.{' '}
          <Link to="/profile" className="font-medium text-primary underline-offset-2 hover:underline">
            Add your cards
          </Link>{' '}
          for a personalized answer, or{' '}
          <Link to="/recommend" className="font-medium text-primary underline-offset-2 hover:underline">
            see full recommendations
          </Link>
          .
        </div>
      )}

      {turn.picks.length > 0 && <Picks picks={turn.picks} />}

      {(turn.answer || turn.busy) && (
        <div className="glass rounded-2xl rounded-tl-sm p-4">
          {!turn.answer && turn.busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              Thinking…
            </div>
          )}
          <div className="leading-relaxed">
            <Markdown>{turn.answer}</Markdown>
            {turn.busy && turn.answer && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  </div>
);

/** The ranked cards: winner first, with the exact reward line and rate. */
const Picks = ({ picks }: { picks: CardRewardPick[] }) => (
  <div className="space-y-2">
    {picks.map((p, i) => (
      <div
        key={p.card_id}
        className={`rounded-xl border p-3 ${
          i === 0 ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{p.card_name}</span>
              {i === 0 && (
                <span className="shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-300">
                  Best
                </span>
              )}
              {p.specific && (
                <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                  Special deal
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {p.rate} · {p.reward_label}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-bold tabular-nums">{p.effective_pct}%</p>
            {p.est_annual_value != null && (
              <p className="text-xs text-muted-foreground">{money(p.est_annual_value)}/yr</p>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
);
