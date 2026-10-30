/**
 * "Should I get this card?" — the headline decision flow.
 *
 * The user describes their wallet (cards they hold + what they use each for) and
 * approximate monthly spend, then picks a card they're considering. The backend
 * optimizer returns three scenarios — keep / reallocate / add — and a verdict.
 * The payload is privacy-friendly: approximate spend and card names only.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Sparkles, CreditCard } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import cardService, {
  type CardProduct,
  type OwnedCardInput,
  type ScenarioComparison,
  type WalletResult,
} from '@/services/cardService';

const SPEND_CATEGORIES = [
  { key: 'dining', label: 'Dining', fallback: 300 },
  { key: 'travel', label: 'Travel', fallback: 200 },
  { key: 'groceries', label: 'Groceries', fallback: 500 },
  { key: 'gas', label: 'Gas & EV', fallback: 120 },
  { key: 'online', label: 'Online', fallback: 150 },
  { key: 'everyday', label: 'Everyday', fallback: 800 },
] as const;

const USAGE_OPTIONS = SPEND_CATEGORIES.map((c) => ({ key: c.key, label: c.label }));
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export const EvaluatePage = () => {
  const { data: catalog } = useQuery({ queryKey: ['cards'], queryFn: () => cardService.getAllCards() });

  // Monthly spend per category (what people can actually estimate).
  const [spend, setSpend] = useState<Record<string, number>>(
    Object.fromEntries(SPEND_CATEGORIES.map((c) => [c.key, c.fallback])),
  );
  // Owned cards → the category the user mostly puts on each.
  const [ownedUsage, setOwnedUsage] = useState<Record<string, string>>({});
  const [candidateId, setCandidateId] = useState('');

  const ownedIds = Object.keys(ownedUsage);
  const monthlyTotal = Object.values(spend).reduce((a, b) => a + b, 0);

  const annualSpend = useMemo(
    () => Object.fromEntries(Object.entries(spend).map(([k, v]) => [k, v * 12])),
    [spend],
  );
  const ownedPayload = useMemo(
    () => Object.entries(ownedUsage).map(([card_id, category]) => ({ card_id, category })),
    [ownedUsage],
  );

  const evaluate = useMutation({
    mutationFn: () => cardService.evaluateCard(annualSpend, ownedPayload, candidateId),
  });

  const toggleOwned = (id: string) =>
    setOwnedUsage((prev) => {
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = 'everyday';
      }
      if (candidateId === id) setCandidateId('');
      return next;
    });

  const candidates = (catalog ?? []).filter((c) => !(c.id in ownedUsage));

  return (
    <div className="min-h-screen bg-glow text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Wallet optimizer
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Should I get <span className="text-gradient">this card?</span>
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            We compare keeping your wallet, using it smarter, and adding the new card — then tell
            you if it's actually worth the fee. No bank login, just estimates.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. Wallet */}
          <section className="glass rounded-2xl p-5">
            <StepHeading n={1} title="Your wallet" hint="Pick the cards you already have" />
            {!catalog ? (
              <SkeletonRows />
            ) : (
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {catalog.map((card) => {
                  const owned = card.id in ownedUsage;
                  return (
                    <div
                      key={card.id}
                      className={`rounded-lg border p-2.5 transition-colors ${
                        owned ? 'border-primary/40 bg-primary/10' : 'border-white/5 bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => toggleOwned(card.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              owned ? 'border-primary bg-primary text-primary-foreground' : 'border-white/20'
                            }`}
                          >
                            {owned && <span className="text-[0.6rem] leading-none">✓</span>}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{card.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {card.issuer}
                            </span>
                          </span>
                        </button>
                        {owned && (
                          <select
                            value={ownedUsage[card.id]}
                            onChange={(e) =>
                              setOwnedUsage((p) => ({ ...p, [card.id]: e.target.value }))
                            }
                            className="h-8 rounded-md border border-input bg-background/60 px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                            title="What you mostly use it for"
                          >
                            {USAGE_OPTIONS.map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. Spend + 3. Candidate */}
          <div className="space-y-6">
            <section className="glass rounded-2xl p-5">
              <StepHeading
                n={2}
                title="Your monthly spending"
                hint={`About ${money(monthlyTotal)}/mo`}
              />
              <div className="space-y-3">
                {SPEND_CATEGORIES.map((c) => (
                  <div key={c.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-medium">{money(spend[c.key])}/mo</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3000}
                      step={25}
                      value={spend[c.key]}
                      onChange={(e) => setSpend((p) => ({ ...p, [c.key]: Number(e.target.value) }))}
                      className="w-full cursor-pointer"
                      style={{ accentColor: 'hsl(var(--primary))' }}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="glass rounded-2xl p-5">
              <StepHeading n={3} title="Card you're considering" hint="The one you're tempted by" />
              <select
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a card…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.issuer}
                    {c.annual_fee ? ` ($${c.annual_fee}/yr)` : ' (no fee)'}
                  </option>
                ))}
              </select>

              <button
                onClick={() => evaluate.mutate()}
                disabled={!candidateId || evaluate.isPending}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {evaluate.isPending ? 'Crunching the numbers…' : 'Should I get it? →'}
              </button>
              {evaluate.isError && (
                <p className="mt-2 text-sm text-destructive">
                  Couldn't run the numbers — is the backend running?
                </p>
              )}
            </section>
          </div>
        </div>

        {evaluate.data && (
          <Results
            key={`${evaluate.data.candidate_id}:${evaluate.data.add.net_annual_value}`}
            data={evaluate.data}
            catalog={catalog ?? []}
            candidateId={candidateId}
            spend={annualSpend}
            owned={ownedPayload}
          />
        )}
      </main>
    </div>
  );
};

const StepHeading = ({ n, title, hint }: { n: number; title: string; hint: string }) => (
  <div className="mb-4 flex items-center gap-3">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 font-display text-sm font-bold text-primary">
      {n}
    </span>
    <div>
      <h2 className="font-display font-semibold leading-tight">{title}</h2>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  </div>
);

const SkeletonRows = () => (
  <div className="space-y-1.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-11 animate-pulse rounded-lg bg-white/10" />
    ))}
  </div>
);

/** The payoff: verdict + before/after bars + a scenario breakdown table. */
const Results = ({
  data,
  catalog,
  candidateId,
  spend,
  owned,
}: {
  data: ScenarioComparison;
  catalog: CardProduct[];
  candidateId: string;
  spend: Record<string, number>;
  owned: OwnedCardInput[];
}) => {
  const candidate = catalog.find((c) => c.id === candidateId);
  const recommended = data.worth_it
    ? 'add'
    : data.gain_from_reallocating > 0
      ? 'reallocate'
      : 'keep';

  const scenarios: { key: 'keep' | 'reallocate' | 'add'; label: string; result: WalletResult }[] = [
    { key: 'keep', label: 'Keep as-is', result: data.keep },
    { key: 'reallocate', label: 'Use current cards smarter', result: data.reallocate },
    { key: 'add', label: `Add ${data.candidate_name}`, result: data.add },
  ];
  const maxNet = Math.max(...scenarios.map((s) => s.result.net_annual_value), 1);

  const [tab, setTab] = useState<'keep' | 'reallocate' | 'add'>(recommended);
  const active = scenarios.find((s) => s.key === tab)!.result;

  return (
    <section className="mt-8 space-y-6">
      {/* Verdict */}
      <div
        className={`rounded-2xl border p-5 ${
          data.worth_it
            ? 'border-emerald-400/30 bg-emerald-400/10'
            : 'border-primary/30 bg-primary/10'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          The verdict
        </p>
        <p className="mt-1 font-display text-lg font-semibold leading-snug">{data.verdict}</p>
      </div>

      {/* Before / after */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-semibold">Net rewards per year, after fees</h3>
        <p className="mb-5 text-sm text-muted-foreground">
          What each strategy earns you annually.
        </p>
        <div className="space-y-3">
          {scenarios.map((s) => {
            const isRec = s.key === recommended;
            const width = Math.max(2, (Math.max(0, s.result.net_annual_value) / maxNet) * 100);
            return (
              <div key={s.key} className="grid grid-cols-[9rem_1fr] items-center gap-3">
                <span className="truncate text-sm text-muted-foreground" title={s.label}>
                  {s.label}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-7 flex-1 overflow-hidden rounded-r bg-white/[0.04]">
                    <div
                      className="flex h-full items-center justify-end rounded-r pr-2"
                      style={{
                        width: `${width}%`,
                        backgroundColor: isRec
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--primary) / 0.35)',
                      }}
                    >
                      <span className="text-xs font-semibold text-primary-foreground">
                        {money(s.result.net_annual_value)}
                      </span>
                    </div>
                  </div>
                  {isRec && (
                    <span className="shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-300">
                      Best
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Gains */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <GainTile
            label="By using current cards smarter"
            value={data.gain_from_reallocating}
            sub="free — no new account"
          />
          <GainTile
            label={`By adding ${data.candidate_name}`}
            value={data.gain_from_adding}
            sub={candidate ? `after its ${candidate.annual_fee ? money(candidate.annual_fee) : '$0'} fee` : 'after its fee'}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="glass rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold">Where the rewards come from</h3>
          <div className="flex rounded-lg border border-white/10 p-0.5 text-xs">
            {scenarios.map((s) => (
              <button
                key={s.key}
                onClick={() => setTab(s.key)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  tab === s.key ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.key === 'keep' ? 'Keep' : s.key === 'reallocate' ? 'Reallocate' : 'Add'}
              </button>
            ))}
          </div>
        </div>
        <ScenarioSummary result={active} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Best card</th>
                <th className="pb-2 pr-2 text-right font-medium">Rate</th>
                <th className="pb-2 text-right font-medium">Earns/yr</th>
              </tr>
            </thead>
            <tbody>
              {active.breakdown.map((b) => (
                <tr key={b.category} className="border-b border-white/5 last:border-0">
                  <td className="py-2 text-muted-foreground">{b.label}</td>
                  <td className="py-2">{b.card_name ?? '—'}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{b.rate}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{money(b.earned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AdvisorFollowup spend={spend} owned={owned} candidateId={candidateId} />
    </section>
  );
};

const FOLLOWUPS = [
  'What if I travel a lot more?',
  'What if I stop eating out?',
  'Is it still worth it with half the spending?',
];

/** Streams the advisor agent's answer to a what-if question, reusing this
 *  evaluation's wallet + spend context. */
const AdvisorFollowup = ({
  spend,
  owned,
  candidateId,
}: {
  spend: Record<string, number>;
  owned: OwnedCardInput[];
  candidateId: string;
}) => {
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setNote('');
    setAnswer('');
    setQ('');
    try {
      await cardService.advisorStream(
        { question: text, spend, owned, candidate_id: candidateId || undefined },
        { onPlan: (n) => setNote(n), onToken: (t) => setAnswer((a) => a + t) },
      );
    } catch {
      setAnswer('Something went wrong — is the backend running?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display font-semibold">Ask the advisor a what-if</h3>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What if I travel a lot more?"
          className="h-11 flex-1 rounded-xl border border-input bg-background/60 px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!q.trim() || busy}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {FOLLOWUPS.map((f) => (
          <button
            key={f}
            onClick={() => ask(f)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {f}
          </button>
        ))}
      </div>
      {(note || answer) && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {note && (
            <p className="mb-2 inline-block rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-foreground">
              {note}
            </p>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {answer}
            {busy && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
            )}
          </p>
        </div>
      )}
    </div>
  );
};

const ScenarioSummary = ({ result }: { result: WalletResult }) => (
  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
    <span className="text-muted-foreground">
      Net: <span className="font-semibold text-foreground">{money(result.net_annual_value)}/yr</span>
    </span>
    <span className="text-muted-foreground">
      Rewards: <span className="text-foreground">{money(result.total_rewards)}</span>
    </span>
    <span className="text-muted-foreground">
      Fees: <span className="text-foreground">{money(result.total_fees)}</span>
    </span>
    <span className="text-muted-foreground">
      Return: <span className="text-foreground">{result.effective_return_pct}%</span>
    </span>
  </div>
);

const GainTile = ({ label, value, sub }: { label: string; value: number; sub: string }) => {
  const positive = value > 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${positive ? 'text-emerald-300' : 'text-muted-foreground'}`}>
        {positive ? '+' : ''}
        {money(value)}
        <span className="text-sm font-normal text-muted-foreground">/yr</span>
      </p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
};
