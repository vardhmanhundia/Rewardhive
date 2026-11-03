import React, {useMemo, useState, useCallback} from "react";
import {useNavigate, Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {useAuth} from "@/context/AuthContext";
import cardService, {type CardProduct, type Conversation} from "@/services/cardService";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Card} from "@/components/ui/card";
import {CardTile} from "@/components/CardTile";
import {Navbar} from "@/components/Navbar";
import {Sparkles, CreditCard} from "lucide-react";
import profileService from "@/services/profileService";

/* ------------------------------------------------------------------ */
/*  SVG icons                                                          */
/* ------------------------------------------------------------------ */

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
    <path
      d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path
      d="M4 12l16-8-6 16-3-6-7-2Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

const ChatBubbleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px]">
    <path
      d="M4 5h16v11H9l-5 4V5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path
      d="M9 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-[11px] h-[11px]">
    <path
      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M22 21v-2a4 4 0 0 0-3-3.87"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M16 3.13a4 4 0 0 1 0 7.75"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]">
    <path
      d="M12 2l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 14l-5 2.6 1.2-5.6L4 7.2l5.6-.6L12 2Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]">
    <path
      d="M12 9v4M12 17h.01"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]">
    <path
      d="M12 8v4l3 2"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/* ---- Category icons ---- */

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  dining: (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-primary">
      <path
        d="M6 3v8M9 3v8M6 11h3M7.5 11v10M17 3c-1.5 0-3 2-3 5s1.5 4 3 4v9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  travel: (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-primary">
      <path
        d="M3 16l7-1 4-9 2 1-2 8 5-1 2 2-6 3-1 3-2-1v-3l-9 2-1-2 3-2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ),
  groceries: (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-primary">
      <path
        d="M3 10h18M3 10l2-5h14l2 5M3 10v9h18v-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  gas: (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-primary">
      <path
        d="M5 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M4 20h11M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a2 2 0 0 0 4 0V9l-2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  online: (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-primary">
      <rect
        x="3"
        y="4"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 21h8M12 17v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  everyday: (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-primary">
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface Category {
  key: string;
  label: string;
  iconKey: string;
  keywords: string[];
  exclude?: string[];
}

const CATEGORIES: Category[] = [
  {
    key: "dining",
    label: "Dining",
    iconKey: "dining",
    keywords: ["dining", "restaurant"],
  },
  {
    key: "travel",
    label: "Travel",
    iconKey: "travel",
    keywords: ["travel", "flight", "hotel", "airline"],
  },
  {
    key: "groceries",
    label: "Groceries",
    iconKey: "groceries",
    keywords: ["grocer", "supermarket", "wholesale"],
  },
  {
    key: "gas",
    label: "Gas & EV",
    iconKey: "gas",
    keywords: ["gas", "ev", "fuel"],
  },
  {
    key: "online",
    label: "Online",
    iconKey: "online",
    keywords: ["online"],
    exclude: ["online grocery", "online groceries"],
  },
  {
    key: "everyday",
    label: "Everyday",
    iconKey: "everyday",
    keywords: [
      "all purchases",
      "all other purchases",
      "every business purchase",
      "everyday",
      "everywhere",
    ],
  },
];

const STARTERS = [
  {
    label: "Best travel card with no foreign transaction fees",
    query: "Best travel card with no foreign transaction fees",
  },
  {
    label: "Cash back on groceries, no annual fee",
    query: "Cash back on groceries, no annual fee",
  },
  {
    label: "A card to help me build credit",
    query: "A card to help me build credit",
  },
  {
    label: "Premium dining rewards, fee is fine",
    query: "Premium dining rewards, fee is fine",
  },
];

const MOCK_SESSIONS = [
  {
    id: "s1",
    title: "Best travel card with no forex fees",
    snip: "Compared the Sapphire Preferred vs Venture X for international trips…",
    time: "2 days ago",
    plan: false,
    planName: "",
  },
  {
    id: "s2",
    title: "Planning Cancún with Sarah",
    snip: "We looked at both your card sets for the trip — dining, flights and hotels…",
    time: "Yesterday",
    plan: true,
    planName: "Cancún Trip",
  },
  {
    id: "s3",
    title: "Is the Amex Platinum worth it?",
    snip: "Weighed the $695 fee against your actual travel and lounge use…",
    time: "4 days ago",
    plan: false,
    planName: "",
  },
];

const MOCK_NEWS = [
  {
    type: "reward",
    title: "5% back at Target through December",
    body: "Your Discover it® card has activated its Q4 rotating category — Target, Walmart and digital wallets.",
    card: "Discover it",
    time: "2h ago",
  },
  {
    type: "alert",
    title: "Annual fee posts in 14 days",
    body: "Your Amex Gold $250 annual fee renews Nov 14. Use the $120 dining credit and $120 Uber credit before deciding.",
    card: "Amex Gold",
    time: "1d ago",
  },
  {
    type: "info",
    title: "Chase added Instacart to 3x groceries",
    body: "Sapphire Preferred now earns 3x on Instacart orders — up from 1x. Effective immediately.",
    card: "Sapphire Preferred",
    time: "2d ago",
  },
  {
    type: "amber",
    title: "Holiday strategy: stack your rotating categories",
    body: "Black Friday is coming. Your Discover 5% at Target + Amex 4x at restaurants covers most gift + meal spending.",
    card: "Multiple cards",
    time: "3d ago",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function matchesCategory(text: string, cat: Category): boolean {
  let hay = text.toLowerCase();
  for (const phrase of cat.exclude ?? []) {
    hay = hay.split(phrase).join(" ");
  }
  return cat.keywords.some((kw) => {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("\\b" + esc + (kw.length <= 2 ? "\\b" : ""), "i");
    return re.test(hay);
  });
}

function parseRate(rate: string): number {
  const m = rate.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function pointCents(card: CardProduct): number {
  const name = card.name.toLowerCase();
  if (name.includes("ihg")) return 0.5;
  if (name.includes("united")) return 1.2;
  if (card.issuer === "Chase") return 1.5;
  if (card.issuer === "American Express") return 1.5;
  if (card.issuer === "Capital One") return 1.3;
  return 1.0;
}

function estValue(card: CardProduct, rate: string): number {
  const num = parseRate(rate);
  return rate.includes("%") ? num : num * pointCents(card);
}

interface RankedCard {
  card: CardProduct;
  rate: string;
  category: string;
  value: number;
}

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const ISSUER_BADGE: Record<string, {short: string; color: string}> = {
  "American Express": {short: "AMEX", color: "#1a6b50"},
  Chase: {short: "CHASE", color: "#14467a"},
  Citi: {short: "CITI", color: "#00508a"},
  "Capital One": {short: "CAP1", color: "#004977"},
  "Wells Fargo": {short: "WELLS", color: "#c4342d"},
  Discover: {short: "DISC", color: "#f47216"},
  "Bank of America": {short: "BOA", color: "#c41230"},
  "U.S. Bank": {short: "USB", color: "#0e3388"},
};

const NEWS_ICON: Record<string, React.ReactNode> = {
  reward: <StarIcon />,
  alert: <AlertIcon />,
  info: <ClockIcon />,
  amber: <SparkleIcon />,
};

const NEWS_BG: Record<string, string> = {
  reward: "bg-primary/15 text-primary",
  alert: "bg-destructive/15 text-destructive",
  info: "bg-primary/15 text-primary",
  amber: "bg-amber-500/12 text-amber-400",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export const ForYouPage = () => {
  const {user} = useAuth();
  const navigate = useNavigate();

  const {data: cards = [], isLoading: cardsLoading} = useQuery({
    queryKey: ["cards"],
    queryFn: () => cardService.getAllCards(),
  });

  const {data: profile} = useQuery({
    queryKey: ["profileDetails"],
    queryFn: () => profileService.getDetails(),
  });
  const savedCardCount = profile?.cards.filter((c: { card_id: string | null }) => c.card_id).length ?? 0;

  const ask = useCallback(
    (q: string) => {
      const query = q.trim();
      if (query) navigate("/recommend", {state: {initialQuery: query}});
    },
    [navigate],
  );

  const firstName = user?.first_name ?? "there";

  return (
    <div className="bg-glow min-h-screen text-foreground">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-[0.8rem] pb-16 sm:pb-12">
        {/* ---- GREETING ---- */}
        <section className="mt-6 mb-5 mx-0.5">
          <h1 className="font-display font-bold text-[clamp(26px,4vw,38px)] leading-[1.04] tracking-tight">
            {greetingFor()}, {firstName}
          </h1>
          <p className="text-muted-foreground text-[15px] mt-2">
            Your money companion — the right card for every purchase, and a sharper strategy when you plan together.
          </p>
        </section>

        {/* Profile nudge when no cards saved */}
        {profile && savedCardCount === 0 && (
          <div className="mb-4 mx-0.5 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
            <CreditCard className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Add your cards for personalized picks</p>
              <p className="text-xs text-muted-foreground">
                Tell us what's in your wallet so recommendations and the "which card?" tool work for you.
              </p>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
            >
              Add cards
            </Link>
          </div>
        )}

        {/* ---- ROW 1 ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 items-stretch">
          <AdvisorHero onAsk={ask} onNavigate={navigate} />
          <div className="flex flex-col gap-4 min-w-0">
            <PlansSection onNavigate={navigate} />
          </div>
        </div>

        {/* ---- ROW 2 ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 mt-4 items-start">
          <BestCardFinder cards={cards} loading={cardsLoading} onAsk={ask} />
          {/* <NewsSection /> */}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Advisor Hero                                                       */
/* ------------------------------------------------------------------ */

const EvalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <path
      d="M9 11l2 2 4-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="3"
      y="4"
      width="18"
      height="16"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

const AdvisorHero = ({
  onAsk,
  onNavigate,
}: {
  onAsk: (q: string) => void;
  onNavigate: (path: string) => void;
}) => {
  const [value, setValue] = useState("");
  const [evalValue, setEvalValue] = useState("");

  return (
    <Card className="p-[22px] flex flex-col">
      <span className="inline-flex items-center gap-[7px] text-[11px] font-bold tracking-[0.08em] uppercase text-primary bg-primary/15 border border-primary/30 rounded-full px-3.5 py-1.5 w-fit">
        <SparkleIcon />
        Personalized recommendation
      </span>
      <h2 className="font-display font-bold text-[clamp(24px,3.2vw,34px)] tracking-tight mt-4 max-sm:text-[22px]">
        What should your next card be?
      </h2>
      <p className="text-muted-foreground text-[15px] mt-2 max-w-[52ch]">
        Describe how you spend. The assistant reads your profile, searches the
        catalog, and explains its pick.
      </p>
      <div className="flex gap-2.5 mt-5 flex-wrap max-sm:flex-col">
        <div className="flex items-center gap-2.5 bg-secondary border border-border rounded-[14px] px-[18px] py-1 flex-1 min-w-[240px] max-sm:min-w-0 focus-within:border-primary/40">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAsk(value);
            }}
            placeholder="e.g. I travel a few times a year and eat out a lot"
            aria-label="Ask CardPilot"
            className="border-none bg-transparent outline-none text-foreground text-[14.5px] w-full min-w-0 py-3 placeholder:text-muted-foreground"
          />
        </div>
        <Button
          onClick={() => onAsk(value)}
          className="gap-2 rounded-xl px-5 py-3 h-auto max-sm:w-full"
        >
          <SendIcon />
          Ask
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-4 max-sm:gap-1.5">
        {STARTERS.map((s) => (
          <button
            key={s.label}
            onClick={() => onAsk(s.query)}
            className="bg-secondary border border-border text-muted-foreground rounded-full px-4 py-2 text-[13px] font-medium hover:border-primary/40 hover:text-foreground transition-colors max-sm:text-[11.5px] max-sm:px-[11px] max-sm:py-[7px]"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Evaluate strip */}
      <div className="flex items-center gap-3.5 mt-[18px] pt-[18px] border-t border-border flex-wrap max-md:flex-col max-md:items-stretch">
        <span className="w-10 h-10 rounded-[11px] shrink-0 grid place-items-center bg-accent/15 border border-accent/30 text-accent">
          <EvalIcon />
        </span>
        <div className="min-w-[140px] flex-1 max-md:min-w-0">
          <strong className="font-display font-semibold text-[14.5px] block">
            Evaluate a specific card
          </strong>
          <span className="text-muted-foreground text-[13px]">
            Already eyeing one? See if it fits you.
          </span>
        </div>
        <div className="flex items-center gap-2.5 bg-secondary border border-border rounded-[14px] px-[18px] py-1 flex-[1.3] min-w-[200px] max-md:min-w-0 focus-within:border-primary/40">
          <input
            value={evalValue}
            onChange={(e) => setEvalValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && evalValue.trim())
                onNavigate("/evaluate");
            }}
            placeholder="e.g. Amex Platinum Travel"
            aria-label="Card to evaluate"
            className="border-none bg-transparent outline-none text-foreground text-[14.5px] w-full min-w-0 py-3 placeholder:text-muted-foreground"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => onNavigate("/evaluate")}
          className="rounded-xl px-5 py-3 h-auto"
        >
          Evaluate
        </Button>
      </div>
    </Card>
  );
};

/** Rank catalog cards by their best estimated value in the given category. */
function rankByCategory(list: CardProduct[], cat: Category): RankedCard[] {
  const ranked: RankedCard[] = [];
  for (const card of list) {
    let best: RankedCard | null = null;
    for (const r of card.rewards) {
      if (!matchesCategory(r.category, cat)) continue;
      const value = estValue(card, r.rate);
      if (!best || value > best.value) {
        best = {card, rate: r.rate, category: r.category, value};
      }
    }
    if (best) ranked.push(best);
  }
  return ranked.sort((a, b) => b.value - a.value).slice(0, 3);
}

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
    <Card className="p-[22px]">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-lg tracking-tight">
            Which card should you use?
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick a category — see the cards that earn the most on it.
          </p>
        </div>
        <Link
          to="/cards"
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
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
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <span aria-hidden>{CATEGORY_ICONS[c.iconKey]}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({length: 3}).map((_, i) => (
            <div key={i} className="glass h-72 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : ranked.length > 0 ? (
        <>
          <div className="max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {ranked.map((r, i) => (
                <CardTile
                  key={r.card.id}
                  card={r.card}
                  badge={r.rate}
                  highlight={i === 0}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() =>
                onAsk(
                  `Which card is best for ${active.label.toLowerCase()} spending?`,
                )
              }
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
          No cards in the catalog call out {active.label.toLowerCase()} rewards
          specifically. Try another category, or ask the assistant directly.
        </EmptyHint>
      )}
    </Card>
  );
};

const EmptyHint = ({children}: {children: React.ReactNode}) => (
  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Portfolio                                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Sessions                                                           */
/* ------------------------------------------------------------------ */

const SessionsSection = ({
  onAsk,
  onNavigate,
}: {
  onAsk: (q: string) => void;
  onNavigate: (path: string) => void;
}) => (
  <Card className="p-[22px]">
    <div className="flex items-end justify-between gap-3 mb-3.5">
      <h2 className="font-display font-semibold text-lg tracking-tight">
        Recent conversations
      </h2>
      <button
        className="text-primary font-semibold text-[13px] hover:underline whitespace-nowrap bg-transparent border-none"
        onClick={() => onNavigate("/recommend")}
      >
        All chats →
      </button>
    </div>
    <div className="flex flex-col">
      {MOCK_SESSIONS.map((s, i) => (
        <button
          key={s.id}
          className={`group flex gap-3 items-start text-left w-full bg-transparent border-none py-[13px] text-foreground ${i > 0 ? "border-t border-border" : "pt-0.5"}`}
          onClick={() => (s.plan ? onNavigate("/recommend") : onAsk(s.title))}
        >
          <span className="w-8 h-8 rounded-[9px] shrink-0 grid place-items-center bg-secondary border border-border text-muted-foreground">
            <ChatBubbleIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display font-semibold text-[13.5px] leading-[1.25] group-hover:text-primary transition-colors">
              {s.title}
            </span>
            <span className="text-muted-foreground text-xs mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis block">
              {s.snip}
            </span>
            <span className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground/60 text-[11px]">
                {s.time}
              </span>
              {s.plan && (
                <span
                  className="text-[10px] font-bold tracking-[0.03em] rounded-full px-2 py-0.5 inline-flex items-center gap-1"
                  style={{
                    background: "hsl(34 60% 50%/.12)",
                    color: "hsl(32 84% 50%)",
                    border: "1px solid hsl(34 50% 30%)",
                  }}
                >
                  <UsersIcon />
                  {s.planName}
                </span>
              )}
            </span>
          </span>
          <span className="text-muted-foreground/60 self-center shrink-0 group-hover:text-primary transition-colors">
            <ChevronRightIcon />
          </span>
        </button>
      ))}
    </div>
  </Card>
);

/* ------------------------------------------------------------------ */
/*  News                                                               */
/* ------------------------------------------------------------------ */

const NewsSection = () => (
  <Card className="p-[22px]">
    <div className="flex items-end justify-between gap-3 mb-3.5">
      <h2 className="font-display font-semibold text-lg tracking-tight">
        Today for your cards
      </h2>
      <button className="text-primary font-semibold text-[13px] hover:underline whitespace-nowrap bg-transparent border-none">
        See all →
      </button>
    </div>
    <div className="flex flex-col">
      {MOCK_NEWS.map((n, i) => (
        <article
          key={i}
          className={`flex gap-3 py-3.5 ${i > 0 ? "border-t border-border" : "pt-0.5"}`}
        >
          <span
            className={`w-[38px] h-[38px] rounded-[10px] shrink-0 grid place-items-center ${NEWS_BG[n.type] ?? ""}`}
          >
            {NEWS_ICON[n.type] ?? <StarIcon />}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-[-0.01em]">{n.title}</h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{n.body}</p>
            <div className="flex items-center gap-2 mt-[7px] flex-wrap">
              <span className="text-[11px] font-semibold text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full">
                {n.card}
              </span>
              <span className="text-[11.5px] text-muted-foreground/60">
                {n.time}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  </Card>
);

/* ------------------------------------------------------------------ */
/*  Plans                                                              */
/* ------------------------------------------------------------------ */

/** Initials from an email local-part, e.g. "sarah.lee@x.com" → "SL". */
function initialsFromEmail(email?: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  const parts = local.split(/[._+-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

/** Initials from a user's name, falling back to "ME". */
function initialsFromName(first?: string, last?: string): string {
  const s = ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase();
  return s || "ME";
}

/** Deterministic avatar color so the same person keeps the same hue. */
function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 48%)`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** A conversation either shared with me or shared by me — one shared plan row. */
const PlanRow = ({
  conversation,
  currentEmail,
  currentInitials,
  onOpen,
}: {
  conversation: Conversation;
  currentEmail: string;
  currentInitials: string;
  onOpen: () => void;
}) => {
  const sharedWithMe = !!conversation.is_shared;
  const avatarSeed = sharedWithMe ? conversation.owner_email ?? "shared" : currentEmail;
  const initials = sharedWithMe
    ? initialsFromEmail(conversation.owner_email)
    : currentInitials;
  const note = sharedWithMe
    ? `Shared by ${conversation.owner_email ?? "someone"}`
    : "Shared with others";

  return (
    <button
      className="bg-secondary border border-border rounded-xl p-[15px] flex flex-col gap-2.5 text-left transition-colors hover:border-amber-500/30 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2"
      onClick={onOpen}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-[38px] h-[38px] rounded-[10px] shrink-0 grid place-items-center"
          style={{
            background: "hsl(34 60% 50%/.12)",
            border: "1px solid hsl(34 50% 30%)",
            color: "hsl(32 84% 50%)",
          }}
        >
          <UsersIcon />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-[15px] truncate">
            {conversation.title || "Untitled conversation"}
          </div>
          <div className="text-muted-foreground text-[12.5px] mt-px truncate">
            {note} · {relativeTime(conversation.updated_at)}
          </div>
        </div>
        <span
          className="w-[26px] h-[26px] rounded-full grid place-items-center text-[10px] font-bold text-white border-2 border-secondary shrink-0"
          style={{background: colorFromString(avatarSeed)}}
        >
          {initials}
        </span>
      </div>
    </button>
  );
};

const PlansSection = ({onNavigate}: {onNavigate: (path: string) => void}) => {
  const {user} = useAuth();
  const {data: conversations = [], isLoading} = useQuery({
    queryKey: ["conversations"],
    queryFn: () => cardService.listConversations(),
  });

  const shared = useMemo(
    () => conversations.filter((c) => c.is_shared || c.shared_by_me),
    [conversations],
  );

  const currentEmail = user?.email ?? "me";
  const currentInitials = initialsFromName(user?.first_name, user?.last_name);

  return (
    <Card className="p-[22px] flex flex-col flex-1">
      <div className="flex items-end justify-between gap-3 mb-3.5 shrink-0">
        <h2 className="font-display font-semibold text-lg tracking-tight">
          Shared plans
        </h2>
        <button
          className="text-primary font-semibold text-[13px] hover:underline whitespace-nowrap bg-transparent border-none"
          onClick={() => onNavigate("/recommend")}
        >
          New plan →
        </button>
      </div>
      <p className="text-muted-foreground text-[13.5px] mb-3.5 mt-0 shrink-0">
        Plan with a partner, roommate or friend — CardPilot advises across both
        your cards.
      </p>
      {isLoading ? (
        <div className="flex flex-col gap-2.5 flex-1">
          {Array.from({length: 2}).map((_, i) => (
            <div
              key={i}
              className="h-[70px] rounded-xl bg-secondary border border-border animate-pulse"
            />
          ))}
        </div>
      ) : shared.length === 0 ? (
        <div className="flex-1 flex items-start">
          <EmptyHint>
            No shared plans yet. Open a conversation and use Share to plan with
            someone — it’ll show up here.
          </EmptyHint>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto scrollbar-thin pr-1">
          {shared.map((c) => (
            <PlanRow
              key={c.id}
              conversation={c}
              currentEmail={currentEmail}
              currentInitials={currentInitials}
              onOpen={() => onNavigate(`/recommend?c=${c.id}`)}
            />
          ))}
        </div>
      )}
    </Card>
  );
};
