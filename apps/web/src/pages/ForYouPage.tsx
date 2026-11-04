import React, {useMemo, useState, useCallback} from "react";
import {useNavigate, Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {useAuth} from "@/context/AuthContext";
import cardService, {type CardProduct, type Conversation} from "@/services/cardService";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Navbar} from "@/components/Navbar";
import {Sparkles, CreditCard, Wallet, Send, Shield, AlertTriangle, ChevronRight} from "lucide-react";
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

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */


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


function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const _ISSUER_BADGE: Record<string, {short: string; color: string}> = {
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

  const {data: profile, isLoading: profileLoading} = useQuery({
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

      <div className="max-w-[1400px] mx-auto px-4 pb-16 sm:pb-12">
        {/* ---- GREETING + ASK ---- */}
        <section className="mt-6 mb-5">
          <h1 className="font-display font-bold text-[clamp(26px,4vw,38px)] leading-[1.04] tracking-tight">
            {greetingFor()}, {firstName}
          </h1>
          <p className="text-muted-foreground text-[15px] mt-1.5 max-w-[52ch]">
            Your card strategy at a glance — ask anything, or explore below.
          </p>
        </section>

        {/* Profile nudge when no cards saved */}
        {profile && savedCardCount === 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
            <CreditCard className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Add your cards for personalized picks</p>
              <p className="text-xs text-muted-foreground">
                Tell us what's in your wallet so the assistant can tailor its advice.
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

        {/* ---- Ask input ---- */}
        <AskHero onAsk={ask} />

        {/* ---- Feature cards row ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <FeatureCard
            icon={<Sparkles className="h-5 w-5" />}
            iconBg="bg-amber-500/15 text-amber-400 border-amber-500/30"
            title="Shared Plans"
            description="Plan with a partner, roommate, or friend — RewardHive advises across both your card sets."
            linkLabel="Start a plan"
            onNavigate={() => navigate("/recommend")}
          />
          <FeatureCard
            icon={<Wallet className="h-5 w-5" />}
            iconBg="bg-accent/15 text-accent border-accent/30"
            title="Card Evaluator"
            description="See if a new card is worth it — compare your current wallet against adding a card, with real numbers."
            linkLabel="Evaluate a card"
            onNavigate={() => navigate("/evaluate")}
          />
          <FeatureCard
            icon={<CreditCard className="h-5 w-5" />}
            iconBg="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            title="Browse Cards"
            description="Explore the full catalog of credit cards — filter by issuer, rewards, fees, and card type."
            linkLabel="Browse catalog"
            onNavigate={() => navigate("/cards")}
          />
        </div>

        {/* ---- ROW 2: Dashboard widgets ---- */}
        <WalletDashboard profile={profile} loading={profileLoading} onAsk={ask} onNavigate={navigate} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Ask Hero — the main interaction on the home page                   */
/* ------------------------------------------------------------------ */

const ASK_STARTERS = [
  "Best travel card with no foreign transaction fees",
  "Cash back on groceries, no annual fee",
  "Which card for an Airbnb booking?",
  "Premium dining rewards, fee is fine",
];

const AskHero = ({onAsk}: {onAsk: (q: string) => void}) => {
  const [value, setValue] = useState("");

  return (
    <div className="mb-4">
      <div className="flex gap-2.5 max-sm:flex-col">
        <div className="flex items-center gap-2.5 bg-secondary border border-border rounded-[14px] px-[18px] py-1 flex-1 min-w-[240px] max-sm:min-w-0 focus-within:border-primary/40">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAsk(value);
            }}
            placeholder="Ask anything — which card to get, which to use, whether one is worth it…"
            aria-label="Ask RewardHive"
            className="border-none bg-transparent outline-none text-foreground text-[14px] w-full min-w-0 py-3 placeholder:text-muted-foreground"
          />
        </div>
        <Button
          onClick={() => onAsk(value)}
          className="gap-2 rounded-xl px-5 py-3 h-auto max-sm:w-full"
        >
          <Send className="h-4 w-4" />
          Ask
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mt-2.5 max-sm:gap-1.5">
        {ASK_STARTERS.map((s) => (
          <button
            key={s}
            onClick={() => onAsk(s)}
            className="bg-secondary border border-border text-muted-foreground rounded-full px-3.5 py-[7px] text-[12.5px] font-medium hover:border-primary/40 hover:text-foreground transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Feature Card — describes a feature with a redirect link            */
/* ------------------------------------------------------------------ */

const FeatureCard = ({
  icon,
  iconBg,
  title,
  description,
  linkLabel,
  onNavigate,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  linkLabel: string;
  onNavigate: () => void;
}) => (
  <Card
    className="p-[20px] flex flex-col cursor-pointer transition-all hover:border-primary/30 hover:-translate-y-0.5 group"
    onClick={onNavigate}
  >
    <div className="flex items-center gap-2.5 mb-2">
      <span className={`w-10 h-10 rounded-xl grid place-items-center border shrink-0 ${iconBg}`}>
        {icon}
      </span>
      <h3 className="font-display font-semibold text-[15px] tracking-tight">
        {title}
      </h3>
    </div>
    <p className="text-muted-foreground text-[13px] mt-1 leading-relaxed flex-1">
      {description}
    </p>
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary mt-3 group-hover:underline">
      {linkLabel}
      <ChevronRight className="h-3.5 w-3.5" />
    </span>
  </Card>
);

/* ------------------------------------------------------------------ */
/*  Wallet Dashboard — multi-widget Row 2                              */
/* ------------------------------------------------------------------ */

type ProfileData = ReturnType<typeof profileService.getDetails> extends Promise<infer T> ? T | undefined : never;

const WalletDashboard = ({
  profile,
  loading,
  onAsk,
  onNavigate,
}: {
  profile: ProfileData;
  loading: boolean;
  onAsk: (q: string) => void;
  onNavigate: (path: string) => void;
}) => {
  const cardIds = useMemo(() => {
    if (!profile) return [];
    return profile.cards.filter((h) => h.card_id).map((h) => h.card_id!);
  }, [profile]);

  const hasCards = cardIds.length > 0;

  const {data: heldCards = [], isLoading: cardsLoading} = useQuery({
    queryKey: ["heldCards", cardIds],
    queryFn: async () => {
      const all = await cardService.getAllCards();
      const idSet = new Set(cardIds);
      return all.filter((c) => idSet.has(c.id));
    },
    enabled: hasCards,
    staleTime: 5 * 60 * 1000,
  });

  if (loading || (hasCards && cardsLoading)) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({length: 4}).map((_, i) => (
          <Card key={i} className="p-[22px]">
            <div className="h-6 w-36 animate-pulse rounded-lg bg-white/10 mb-3" />
            <div className="space-y-2.5">
              {Array.from({length: 3}).map((_, j) => (
                <div key={j} className="h-10 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasCards) {
    return (
      <Card className="p-[22px]">
        <div className="flex items-center gap-3 mb-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display font-semibold text-lg tracking-tight">
              Your wallet at a glance
            </h2>
            <p className="text-sm text-muted-foreground">
              Add your cards to unlock personalized insights.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
          <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground mb-3">
            See annual rewards, benefits, and optimization gaps.
          </p>
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <CreditCard className="h-4 w-4" />
            Add your cards
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4">
      <CardFeesWidget cards={heldCards} />
      <GapsWidget cards={heldCards} onAsk={onAsk} onNavigate={onNavigate} />
      <div className="lg:col-span-2">
        <BenefitsWidget cards={heldCards} />
      </div>
    </div>
  );
};

/* ---- Widget 1: Card Fees ---- */

const CardFeesWidget = ({cards}: {cards: CardProduct[]}) => {
  const totalFees = useMemo(() => cards.reduce((s, c) => s + c.annual_fee, 0), [cards]);
  const sorted = useMemo(() => [...cards].sort((a, b) => b.annual_fee - a.annual_fee), [cards]);

  return (
    <Card className="p-[22px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl grid place-items-center bg-primary/15 text-primary">
            <CreditCard className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h3 className="font-display font-semibold text-[15px]">Card fees</h3>
            <p className="text-xs text-muted-foreground">{cards.length} card{cards.length > 1 ? "s" : ""} in your wallet</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {sorted.map((card) => (
          <div
            key={card.id}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate">{card.name}</p>
              <p className="text-[11px] text-muted-foreground">{card.issuer}</p>
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 ml-3 ${
              card.annual_fee > 0 ? "text-foreground" : "text-emerald-400"
            }`}>
              {card.annual_fee > 0 ? `$${card.annual_fee}/yr` : "No fee"}
            </span>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border p-3.5 text-center ${
        totalFees > 0
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-400/20 bg-emerald-400/5"
      }`}>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total annual fees</p>
        <p className="mt-1">
          <span className={`font-display text-2xl font-bold ${
            totalFees > 0 ? "text-foreground" : "text-emerald-300"
          }`}>
            {totalFees > 0 ? `$${totalFees.toLocaleString()}` : "$0"}
          </span>
          <span className="text-sm text-muted-foreground ml-1">/yr</span>
        </p>
      </div>
    </Card>
  );
};

/* ---- Widget 2: Benefits You Have ---- */

const BENEFIT_ICONS: Record<string, {icon: React.ReactNode; color: string}> = {
  lounge: {icon: <Shield className="h-3.5 w-3.5" />, color: "text-amber-400"},
  insurance: {icon: <Shield className="h-3.5 w-3.5" />, color: "text-blue-400"},
  credit: {icon: <CreditCard className="h-3.5 w-3.5" />, color: "text-emerald-400"},
  protection: {icon: <Shield className="h-3.5 w-3.5" />, color: "text-purple-400"},
};

function classifyBenefit(text: string): string {
  const low = text.toLowerCase();
  if (low.includes("lounge") || low.includes("priority pass")) return "lounge";
  if (low.includes("insurance") || low.includes("protection") || low.includes("warranty")) return "protection";
  if (low.includes("credit") || low.includes("statement")) return "credit";
  return "insurance";
}

const BenefitsWidget = ({cards}: {cards: CardProduct[]}) => {
  const [showAll, setShowAll] = useState(false);
  const benefits = useMemo(() => {
    const seen = new Set<string>();
    const items: {text: string; cardName: string; type: string}[] = [];
    for (const card of cards) {
      for (const b of card.benefits) {
        const key = b.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({text: b, cardName: card.name, type: classifyBenefit(b)});
      }
    }
    return items;
  }, [cards]);

  return (
    <Card className="p-[22px]">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl grid place-items-center bg-emerald-500/15 text-emerald-400">
          <Shield className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h3 className="font-display font-semibold text-[15px]">Your benefits</h3>
          <p className="text-xs text-muted-foreground">{benefits.length} benefits across your cards</p>
        </div>
      </div>

      {benefits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No benefits data available for your cards yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(showAll ? benefits : benefits.slice(0, 6)).map((b, i) => {
              const style = BENEFIT_ICONS[b.type] ?? BENEFIT_ICONS.insurance;
              return (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
                >
                  <span className={`shrink-0 mt-0.5 ${style.color}`}>{style.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug">{b.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {b.cardName.split(" ").slice(0, 3).join(" ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {benefits.length > 6 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2.5 text-[13px] font-medium text-primary hover:underline"
            >
              {showAll ? "Show less" : `Show all ${benefits.length} benefits`}
            </button>
          )}
        </>
      )}
    </Card>
  );
};

/* ---- Widget 4: Gaps & Opportunities ---- */

const GapsWidget = ({
  cards,
  onAsk,
  onNavigate,
}: {
  cards: CardProduct[];
  onAsk: (q: string) => void;
  onNavigate: (path: string) => void;
}) => {
  const insights = useMemo(() => {
    const items: {type: "gap" | "intro" | "fee"; text: string; detail: string; action?: string}[] = [];

    for (const card of cards) {
      if (card.intro_offer) {
        const short = card.intro_offer.length > 90 ? card.intro_offer.slice(0, 87) + "…" : card.intro_offer;
        items.push({
          type: "intro",
          text: `${card.name.split(" ").slice(0, 3).join(" ")} intro offer`,
          detail: short,
        });
      }
    }

    const hasTravel = cards.some((c) => c.rewards.some((r) => /travel|flight|hotel|airline/i.test(r.category)));
    const hasDining = cards.some((c) => c.rewards.some((r) => /dining|restaurant/i.test(r.category)));
    const hasGroceries = cards.some((c) => c.rewards.some((r) => /grocer|supermarket/i.test(r.category)));

    if (!hasTravel) {
      items.push({
        type: "gap",
        text: "No travel card",
        detail: "None of your cards have elevated travel rewards. A travel card could earn 3–5× more on flights and hotels.",
        action: "What's the best travel rewards card for me?",
      });
    }
    if (!hasDining) {
      items.push({
        type: "gap",
        text: "No dining card",
        detail: "You're missing elevated dining rewards. A dining card could earn 3–4× more at restaurants.",
        action: "What's the best dining rewards card?",
      });
    }
    if (!hasGroceries) {
      items.push({
        type: "gap",
        text: "No grocery card",
        detail: "No elevated grocery rewards in your wallet. Groceries are a big spend category worth optimizing.",
        action: "What's the best card for groceries?",
      });
    }

    const totalFees = cards.reduce((s, c) => s + c.annual_fee, 0);
    if (totalFees > 500) {
      items.push({
        type: "fee",
        text: `$${totalFees.toLocaleString()}/yr in fees`,
        detail: "That's a lot of annual fees. Make sure each card's benefits justify the cost.",
        action: "Are my annual fees worth it?",
      });
    }

    return items.slice(0, 5);
  }, [cards]);

  return (
    <Card className="p-[22px]">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl grid place-items-center bg-amber-500/15 text-amber-400">
          <AlertTriangle className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h3 className="font-display font-semibold text-[15px]">Gaps & opportunities</h3>
          <p className="text-xs text-muted-foreground">Where your wallet could do better</p>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-center">
          <p className="text-sm font-medium text-emerald-300">Looking good!</p>
          <p className="text-xs text-muted-foreground mt-1">No obvious gaps in your current setup.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <button
              key={i}
              className="w-full text-left flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-primary/20"
              onClick={() => {
                if (ins.action) onAsk(ins.action);
                else onNavigate("/cards");
              }}
            >
              <span className={`shrink-0 mt-0.5 ${
                ins.type === "gap" ? "text-amber-400" : ins.type === "intro" ? "text-primary" : "text-destructive"
              }`}>
                {ins.type === "gap" && <AlertTriangle className="h-3.5 w-3.5" />}
                {ins.type === "intro" && <Sparkles className="h-3.5 w-3.5" />}
                {ins.type === "fee" && <CreditCard className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{ins.text}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{ins.detail}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
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

const _SessionsSection = ({
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

const _NewsSection = () => (
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

const _PlansSection = ({onNavigate}: {onNavigate: (path: string) => void}) => {
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
        Plan with a partner, roommate or friend — RewardHive advises across both
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
