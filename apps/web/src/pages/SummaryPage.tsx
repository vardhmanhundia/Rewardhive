/**
 * "My Space" — the signed-in personalized landing page (route: /for-you).
 *
 * A curated personal page, not a dashboard: a warm greeting, a prominent
 * "ask for a recommendation" entry that hands the query to the recommend chat,
 * a colorful strip of real catalog cards to explore, the profile the assistant
 * has learned, and a way to resume recent questions. Built on the existing
 * dark design system.
 */
import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Sparkles, Send, Search, User, Wallet } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CardTile } from '@/components/CardTile';
import { useAuth } from '@/context/AuthContext';
import type { UserProfile } from '@/services/authService';
import cardService, { type CardProduct, type Conversation } from '@/services/cardService';

/** A few starter prompts, shown when the user hasn't asked anything yet. */
const STARTERS = [
  'Best travel card with no foreign transaction fees',
  'Cash back on groceries, no annual fee',
  'A card to help me build credit',
  'Premium dining rewards, fee is fine',
];

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

interface Category {
  key: string;
  label: string;
  emoji: string;
  /** Keywords that identify this spending category in a reward's text. */
  keywords: string[];
  /** Phrases stripped before matching, so a keyword inside another category's
   *  compound doesn't leak in — e.g. "online grocery" must not count as Online. */
  exclude?: string[];
}

/** Spending categories for the "which card should I use?" explorer. Kept strict:
 *  a reward only counts for the category it genuinely represents. */
const CATEGORIES: Category[] = [
  { key: 'dining', label: 'Dining', emoji: '🍽️', keywords: ['dining', 'restaurant'] },
  { key: 'travel', label: 'Travel', emoji: '✈️', keywords: ['travel', 'flight', 'hotel', 'airline'] },
  { key: 'groceries', label: 'Groceries', emoji: '🛒', keywords: ['grocer', 'supermarket', 'wholesale'] },
  { key: 'gas', label: 'Gas & EV', emoji: '⛽', keywords: ['gas', 'ev', 'fuel'] },
  {
    key: 'online',
    label: 'Online',
    emoji: '🛍️',
    keywords: ['online'],
    // "online grocery" is groceries, not online shopping.
    exclude: ['online grocery', 'online groceries'],
  },
  {
    key: 'everyday',
    label: 'Everyday',
    emoji: '💳',
    // Catch-all "everything" rewards only — not scoped ones like "all other
    // United purchases" or "all other travel".
    keywords: ['all purchases', 'all other purchases', 'every business purchase', 'everyday', 'everywhere'],
  },
];

/** Does a reward-category string genuinely refer to this spending category?
 *  Excluded compounds are stripped first; then keywords match on word boundaries
 *  so "EV" doesn't match "every"/"everyday", while stems like "grocer" still
 *  match "grocery"/"groceries". */
function matchesCategory(text: string, cat: Category): boolean {
  let hay = text.toLowerCase();
  for (const phrase of cat.exclude ?? []) {
    hay = hay.split(phrase).join(' ');
  }
  return cat.keywords.some((kw) => {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Short/ambiguous tokens (e.g. "ev") need a trailing boundary too.
    const re = new RegExp('\\b' + esc + (kw.length <= 2 ? '\\b' : ''), 'i');
    return re.test(hay);
  });
}

/** The leading number in a rate (e.g. "3%" → 3, "1.5x" → 1.5, "up to 24x" → 24). */
function parseRate(rate: string): number {
  const m = rate.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

/** Rough cents-per-point by rewards currency, so points ("x") and cash ("%") are
 *  comparable. Estimates only — hotel/airline points are worth far less than
 *  flexible bank points, which is exactly why IHG shouldn't win a cash category. */
function pointCents(card: CardProduct): number {
  const name = card.name.toLowerCase();
  if (name.includes('ihg')) return 0.5; // hotel points
  if (name.includes('united')) return 1.2; // airline miles
  if (card.issuer === 'Chase') return 1.5; // Ultimate Rewards
  if (card.issuer === 'American Express') return 1.5; // Membership Rewards
  if (card.issuer === 'Capital One') return 1.3; // miles
  return 1.0; // Bank of America points / default
}

/** A rate as an estimated cash-back percentage, used only for ranking. */
function estValue(card: CardProduct, rate: string): number {
  const num = parseRate(rate);
  return rate.includes('%') ? num : num * pointCents(card);
}

interface RankedCard {
  card: CardProduct;
  rate: string;
  category: string;
  value: number;
}

/** Rank catalog cards by their best estimated value in the given category. */
function rankByCategory(list: CardProduct[], cat: Category): RankedCard[] {
  const ranked: RankedCard[] = [];
  for (const card of list) {
    let best: RankedCard | null = null;
    for (const r of card.rewards) {
      if (!matchesCategory(r.category, cat)) continue;
      const value = estValue(card, r.rate);
      if (!best || value > best.value) {
        best = { card, rate: r.rate, category: r.category, value };
      }
    }
    if (best) ranked.push(best);
  }
  return ranked.sort((a, b) => b.value - a.value).slice(0, 3);
}

export const SummaryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: memories, isLoading: memLoading } = useQuery({
    queryKey: ['profileSummary'],
    queryFn: () => cardService.getProfileSummary(),
  });

  const { data: conversations, isLoading: convLoading } = useQuery({
    queryKey: ['recConversations'],
    queryFn: () => cardService.listConversations(),
  });

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: () => cardService.getAllCards(),
  });

  const conversationCount = conversations?.length ?? 0;
  const prefCount = memories?.length ?? 0;
  const hasProfile = prefCount > 0;

  // Quick-ask starts a fresh session (no ?c) and hands the query over.
  const ask = (q: string) => {
    const query = q.trim();
    if (!query) return;
    navigate('/recommend', { state: { initialQuery: query } });
  };

  // A "pick up where you left off" tab reopens that saved conversation.
  const openConversation = (id: string) => navigate(`/recommend?c=${id}`);

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-glow text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-12">
        {/* Greeting */}
        <header className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {greetingFor()},{' '}
            <span className="text-gradient">{user?.first_name ?? 'there'}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {hasProfile
              ? 'Here’s your space, tuned to what you’ve told the assistant. Ask anything to refine it.'
              : 'Let’s find the card that fits how you actually spend. Ask a question to get started.'}
          </p>
        </header>

        {/* Two-pane: action + results on the left, your profile on the right. */}
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <div className="space-y-6 lg:col-span-2">
            <QuickAsk onAsk={ask} />
            <Link
              to="/evaluate"
              className="glass flex items-center justify-between gap-3 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display font-semibold">Thinking about a new card?</h3>
                  <p className="text-sm text-muted-foreground">
                    See if it beats your current wallet — fee and all.
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium text-primary">Should I get it? →</span>
            </Link>
            <BestCardFinder cards={cards ?? []} loading={cardsLoading} onAsk={ask} />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-20">
            <ProfileCard
              user={user}
              prefCount={prefCount}
              conversationCount={conversationCount}
              memberSince={memberSince}
            />
            <KnowsAboutYou loading={memLoading} memories={memories?.map((m) => m.content) ?? []} />
            <Conversations
              loading={convLoading}
              conversations={conversations ?? []}
              onOpen={openConversation}
            />
          </aside>
        </div>
      </main>
    </div>
  );
};

const MetaPill = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
    {children}
  </span>
);

/** Sidebar identity card — avatar, name, and at-a-glance profile stats. */
const ProfileCard = ({
  user,
  prefCount,
  conversationCount,
  memberSince,
}: {
  user: UserProfile | null;
  prefCount: number;
  conversationCount: number;
  memberSince: string | null;
}) => {
  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase();
  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
          {initials || <User className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display font-semibold">
            {user ? `${user.first_name} ${user.last_name}` : 'Your profile'}
          </p>
          {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {memberSince && (
          <MetaPill>
            Since <span className="text-foreground">{memberSince}</span>
          </MetaPill>
        )}
        <MetaPill>
          <span className="text-foreground">{prefCount}</span>{' '}
          {prefCount === 1 ? 'preference' : 'preferences'}
        </MetaPill>
        <MetaPill>
          <span className="text-foreground">{conversationCount}</span>{' '}
          {conversationCount === 1 ? 'conversation' : 'conversations'}
        </MetaPill>
      </div>
    </section>
  );
};

/** The primary action: a focused composer that opens the recommend chat. */
const QuickAsk = ({ onAsk }: { onAsk: (q: string) => void }) => {
  const [value, setValue] = useState('');

  return (
    <div className="relative">
      {/* Gradient glow to make the primary action feel alive. */}
      <div
        aria-hidden
        className="absolute -inset-0.5 rounded-[1.75rem] bg-gradient-to-r from-primary/40 via-primary/10 to-cyan-400/25 opacity-70 blur-xl"
      />
      <section className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Personalized recommendation
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          What should your next card be?
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Describe how you spend. The assistant reads your profile, searches the catalog, and
          explains its pick.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAsk(value);
          }}
          className="mt-5 flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. I travel a few times a year and eat out a lot"
            className="h-12 flex-1 rounded-xl border border-input bg-background/60 px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Ask
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => onAsk(s)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

/** Interactive "which card should I use?" — pick a category, see the top earners.
 *  The signature move of card-optimizer apps, computed from the catalog. */
const BestCardFinder = ({
  cards,
  loading,
  onAsk,
}: {
  cards: CardProduct[];
  loading: boolean;
  onAsk: (q: string) => void;
}) => {
  const [active, setActive] = useState<Category>(CATEGORIES[0]);
  const ranked = useMemo(() => rankByCategory(cards, active), [cards, active]);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Which card should you use?
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick a category — see the cards that earn the most on it.
          </p>
        </div>
        <Link to="/cards" className="shrink-0 text-sm font-medium text-primary hover:underline">
          See all →
        </Link>
      </div>

      {/* Category selector */}
      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const isActive = c.key === active.key;
          return (
            <button
              key={c.key}
              onClick={() => setActive(c)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'border-primary/50 bg-primary/15 text-foreground'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass h-72 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : ranked.length > 0 ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {ranked.map((r, i) => (
              <CardTile key={r.card.id} card={r.card} badge={r.rate} highlight={i === 0} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => onAsk(`Which card is best for ${active.label.toLowerCase()} spending?`)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Sparkles className="h-4 w-4" />
              Ask the assistant why →
            </button>
            <p className="text-xs text-muted-foreground">
              Ranked by estimated value — points valued per program.
            </p>
          </div>
        </>
      ) : (
        <EmptyHint>
          No cards in the catalog call out {active.label.toLowerCase()} rewards specifically. Try
          another category, or ask the assistant directly.
        </EmptyHint>
      )}
    </section>
  );
};

/** The profile the assistant has learned — memory facts as pills. */
const KnowsAboutYou = ({ loading, memories }: { loading: boolean; memories: string[] }) => (
  <section className="glass rounded-2xl p-5">
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-4 w-4" />
      </span>
      <h3 className="font-display font-semibold">What we know about you</h3>
    </div>

    {loading ? (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-32 animate-pulse rounded-full bg-white/10" />
        ))}
      </div>
    ) : memories.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {memories.map((m) => (
          <span
            key={m}
            className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-foreground"
          >
            {m}
          </span>
        ))}
      </div>
    ) : (
      <EmptyHint>
        Nothing yet. As you chat, the assistant remembers your preferences — travel habits, fee
        tolerance, the categories you spend on — and they’ll show up here to personalize every
        recommendation.
      </EmptyHint>
    )}
  </section>
);

/** Short relative label for when a conversation was last active. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Past conversations as tabs — each reopens its saved chat in the recommend view. */
const Conversations = ({
  loading,
  conversations,
  onOpen,
}: {
  loading: boolean;
  conversations: Conversation[];
  onOpen: (id: string) => void;
}) => (
  <section className="glass rounded-2xl p-5">
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Search className="h-4 w-4" />
      </span>
      <h3 className="font-display font-semibold">Pick up where you left off</h3>
    </div>

    {loading ? (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-white/10" />
        ))}
      </div>
    ) : conversations.length > 0 ? (
      <ul className="space-y-1.5">
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onOpen(c.id)}
              className="group flex w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-white/5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                <span className="line-clamp-1 text-muted-foreground group-hover:text-foreground">
                  {c.title || 'Untitled chat'}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground/70">
                {relativeTime(c.updated_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyHint>
        Your conversations will appear here so you can pick up any of them right where you left
        off.
      </EmptyHint>
    )}
  </section>
);

const EmptyHint = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  </div>
);
