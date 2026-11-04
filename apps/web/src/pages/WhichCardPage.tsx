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
import { Send, Sparkles, Wallet, Paperclip, Mic, MicOff, Volume2, VolumeX, X, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import Markdown from '@/components/Markdown';
import { useImageAttachment } from '@/hooks/useImageAttachment';
import { useSpeechToText, useTextToSpeech } from '@/hooks/useVoice';
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
  imagePreviewUrl?: string;
}

const EXAMPLES = [
  'Which card for an Airbnb booking?',
  'Best card for groceries?',
  'Which card should I use for a United flight?',
  'I have the Amex Gold and Chase Freedom — which for dining?',
];


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

  const img = useImageAttachment();
  const stt = useSpeechToText((text) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const patch = (id: string, update: Partial<Turn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));

  const ask = async (raw: string) => {
    const query = raw.trim();
    if (!query || busy) return;

    const currentImage = img.attachment;
    const imageB64 = currentImage?.b64;
    const imageMime = currentImage?.mime;
    const imagePreview = currentImage?.previewUrl;
    img.clear();

    const id = crypto.randomUUID();
    const monthly = Number(amount);
    setTurns((prev) => [
      ...prev,
      { id, query, note: '', merchant: null, owned: true, picks: [], answer: '', busy: true, imagePreviewUrl: imagePreview },
    ]);
    setInput('');
    setBusy(true);

    try {
      await cardService.bestCardStream(
        {
          question: query,
          monthly_amount: monthly > 0 ? monthly : undefined,
          image_b64: imageB64,
          image_mime: imageMime,
        },
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
      <main className="flex w-full flex-1 flex-col px-8">
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
          onDrop={img.onDrop}
          onDragOver={(e) => e.preventDefault()}
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

          {/* Image preview */}
          {img.attachment && (
            <div className="relative mb-2 inline-block">
              <img
                src={img.attachment.previewUrl}
                alt="Attached"
                className="h-20 rounded-lg border border-white/10 object-cover"
              />
              <button
                type="button"
                onClick={img.clear}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-xs hover:bg-destructive/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {img.error && <p className="mb-1 text-xs text-destructive">{img.error}</p>}

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
            onPaste={img.onPaste}
            rows={1}
            placeholder="Which card should I use for…? (attach a screenshot or use voice)"
            className="w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
            style={{ overflow: 'hidden' }}
          />
          {/* Hidden file input */}
          <input
            ref={img.inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={img.onChange}
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={img.open}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                title="Attach screenshot"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {stt.supported && (
                <button
                  type="button"
                  onClick={stt.toggle}
                  className={`rounded-lg p-1.5 transition-colors ${
                    stt.listening
                      ? 'bg-red-500/20 text-red-400 animate-pulse'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  }`}
                  title={stt.listening ? 'Stop listening' : 'Voice input'}
                >
                  {stt.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <span className="text-xs text-muted-foreground hidden sm:inline ml-1">
                {stt.listening ? 'Listening…' : 'Enter to send'}
              </span>
            </div>
            <button
              type="submit"
              disabled={(!input.trim() && !img.attachment) || busy}
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
      <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {turn.imagePreviewUrl && (
          <img
            src={turn.imagePreviewUrl}
            alt="Attached"
            className="max-h-40 rounded-lg border border-white/20 object-cover"
          />
        )}
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
        <div>
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
          {turn.answer && !turn.busy && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 pl-1">
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" fill="none" /><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Muse Spark
            </span>
          )}
        </div>
      )}

      {!turn.busy && turn.answer && <TtsButton text={turn.answer} />}
    </div>
  </div>
);

const TtsButton = ({ text }: { text: string }) => {
  const { speaking, loading, supported, toggle } = useTextToSpeech();
  if (!supported) return null;
  const active = speaking || loading;
  return (
    <button
      onClick={() => toggle(text)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors ${
        active
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
      }`}
      title={loading ? 'Preparing speech…' : speaking ? 'Stop reading' : 'Read aloud'}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : speaking ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {loading ? 'Preparing…' : speaking ? 'Stop' : 'Listen'}
    </button>
  );
};

/** A single card pick row. */
const PickCard = ({ pick, isBest }: { pick: CardRewardPick; isBest: boolean }) => (
  <div
    className={`rounded-xl border p-3 ${
      isBest ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03]'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{pick.card_name}</span>
          {isBest && (
            <span className="shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-300">
              Best
            </span>
          )}
          {pick.specific && (
            <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
              Special deal
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {pick.rate} · {pick.reward_label}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-lg font-bold tabular-nums">{pick.effective_pct}%</p>
        <p className="text-xs text-muted-foreground">{pick.issuer}</p>
      </div>
    </div>
  </div>
);

/** The ranked cards: winner first, with the exact reward line and rate.
 *  When picks carry `category_group`, they're rendered in grouped sections. */
const Picks = ({ picks }: { picks: CardRewardPick[] }) => {
  const hasGroups = picks.some((p) => p.category_group);

  if (!hasGroups) {
    return (
      <div className="space-y-2">
        {picks.map((p, i) => (
          <PickCard key={`${p.card_id}-${i}`} pick={p} isBest={i === 0} />
        ))}
      </div>
    );
  }

  // Group picks by category, preserving order from the backend (highest spend first).
  const groups: { category: string; total: number; picks: CardRewardPick[] }[] = [];
  const seen = new Set<string>();
  for (const p of picks) {
    const cat = p.category_group ?? 'other';
    if (!seen.has(cat)) {
      seen.add(cat);
      groups.push({ category: cat, total: p.category_total ?? 0, picks: [] });
    }
    groups.find((g) => g.category === cat)!.picks.push(p);
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.category}>
          <div className="mb-2 flex items-center gap-2">
            <h4 className="text-sm font-semibold capitalize">{group.category}</h4>
            {group.total > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                ${group.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {group.picks.map((p, i) => (
              <PickCard key={`${p.card_id}-${group.category}-${i}`} pick={p} isBest={i === 0} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
