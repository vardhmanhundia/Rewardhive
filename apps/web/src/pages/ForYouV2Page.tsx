import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import cardService, { type CardProduct } from '@/services/cardService';
import './ForYouV2Page.css';

/* ------------------------------------------------------------------ */
/*  SVG icons (inline, matching the artifact exactly)                  */
/* ------------------------------------------------------------------ */

const TandemLogo = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="16" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
    <path d="m20 20-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 12l16-8-6 16-3-6-7-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const EvalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M9 11l2 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const ChatBubbleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 5h16v11H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 14l-5 2.6 1.2-5.6L4 7.2l5.6-.6L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/* ---- Category icons ---- */

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  dining: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 3v8M9 3v8M6 11h3M7.5 11v10M17 3c-1.5 0-3 2-3 5s1.5 4 3 4v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  travel: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 16l7-1 4-9 2 1-2 8 5-1 2 2-6 3-1 3-2-1v-3l-9 2-1-2 3-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  groceries: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 10h18M3 10l2-5h14l2 5M3 10v9h18v-9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  gas: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M4 20h11M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a2 2 0 0 0 4 0V9l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  online: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  everyday: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  travel: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 16l7-1 4-9 2 1-2 8 5-1 2 2-6 3-1 3-2-1v-3l-9 2-1-2 3-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
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
  { key: 'dining', label: 'Dining', iconKey: 'dining', keywords: ['dining', 'restaurant'] },
  { key: 'travel', label: 'Travel', iconKey: 'travel', keywords: ['travel', 'flight', 'hotel', 'airline'] },
  { key: 'groceries', label: 'Groceries', iconKey: 'groceries', keywords: ['grocer', 'supermarket', 'wholesale'] },
  { key: 'gas', label: 'Gas & EV', iconKey: 'gas', keywords: ['gas', 'ev', 'fuel'] },
  {
    key: 'online', label: 'Online', iconKey: 'online',
    keywords: ['online'],
    exclude: ['online grocery', 'online groceries'],
  },
  {
    key: 'everyday', label: 'Everyday', iconKey: 'everyday',
    keywords: ['all purchases', 'all other purchases', 'every business purchase', 'everyday', 'everywhere'],
  },
];

const STARTERS = [
  { label: 'Best travel card, no forex fees', query: 'Best travel card with no foreign transaction fees' },
  { label: 'Cash back on groceries, no fee', query: 'Cash back on groceries, no annual fee' },
  { label: 'Which card for dining?', query: 'Which card should I use for dining out?' },
  { label: 'Compare two cards', query: 'Compare Chase Sapphire Preferred vs Amex Gold' },
];

const MOCK_SESSIONS = [
  { id: 's1', title: 'Best travel card with no forex fees', snip: 'Compared the Sapphire Preferred vs Venture X for international trips…', time: '2 days ago', plan: false, planName: '' },
  { id: 's2', title: 'Planning Cancún with Sarah', snip: 'We looked at both your card sets for the trip — dining, flights and hotels…', time: 'Yesterday', plan: true, planName: 'Cancún Trip' },
  { id: 's3', title: 'Is the Amex Platinum worth it?', snip: 'Weighed the $695 fee against your actual travel and lounge use…', time: '4 days ago', plan: false, planName: '' },
];

const MOCK_NEWS = [
  { type: 'reward', title: '5% back at Target through December', body: 'Your Discover it® card has activated its Q4 rotating category — Target, Walmart and digital wallets.', card: 'Discover it', time: '2h ago' },
  { type: 'alert', title: 'Annual fee posts in 14 days', body: 'Your Amex Gold $250 annual fee renews Nov 14. Use the $120 dining credit and $120 Uber credit before deciding.', card: 'Amex Gold', time: '1d ago' },
  { type: 'info', title: 'Chase added Instacart to 3x groceries', body: 'Sapphire Preferred now earns 3x on Instacart orders — up from 1x. Effective immediately.', card: 'Sapphire Preferred', time: '2d ago' },
  { type: 'amber', title: 'Holiday strategy: stack your rotating categories', body: 'Black Friday is coming. Your Discover 5% at Target + Amex 4x at restaurants covers most gift + meal spending.', card: 'Multiple cards', time: '3d ago' },
];

const MOCK_PLANS = [
  {
    name: 'Cancún Trip',
    people: [
      { init: 'VH', color: 'hsl(30 88% 48%)' },
      { init: 'SL', color: 'hsl(280 50% 54%)' },
    ],
    note: 'Sarah added 3 cards · last active yesterday',
    icon: 'travel',
  },
  {
    name: 'New Apartment',
    people: [
      { init: 'VH', color: 'hsl(30 88% 48%)' },
      { init: 'AK', color: 'hsl(200 60% 46%)' },
    ],
    note: 'Alex invited · furniture + moving costs',
    icon: 'home',
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function matchesCategory(text: string, cat: Category): boolean {
  let hay = text.toLowerCase();
  for (const phrase of cat.exclude ?? []) {
    hay = hay.split(phrase).join(' ');
  }
  return cat.keywords.some((kw) => {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + esc + (kw.length <= 2 ? '\\b' : ''), 'i');
    return re.test(hay);
  });
}

function parseRate(rate: string): number {
  const m = rate.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function pointCents(card: CardProduct): number {
  const name = card.name.toLowerCase();
  if (name.includes('ihg')) return 0.5;
  if (name.includes('united')) return 1.2;
  if (card.issuer === 'Chase') return 1.5;
  if (card.issuer === 'American Express') return 1.5;
  if (card.issuer === 'Capital One') return 1.3;
  return 1.0;
}

function estValue(card: CardProduct, rate: string): number {
  const num = parseRate(rate);
  return rate.includes('%') ? num : num * pointCents(card);
}

interface RankedCard {
  card: CardProduct;
  rate: string;
  value: number;
}

function bestForCategory(list: CardProduct[], cat: Category): RankedCard | null {
  let best: RankedCard | null = null;
  for (const card of list) {
    for (const r of card.rewards) {
      if (!matchesCategory(r.category, cat)) continue;
      const value = estValue(card, r.rate);
      if (!best || value > best.value) best = { card, rate: r.rate, value };
    }
  }
  return best;
}

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const ISSUER_BADGE: Record<string, { short: string; color: string }> = {
  'American Express': { short: 'AMEX', color: '#1a6b50' },
  'Chase': { short: 'CHASE', color: '#14467a' },
  'Citi': { short: 'CITI', color: '#00508a' },
  'Capital One': { short: 'CAP1', color: '#004977' },
  'Wells Fargo': { short: 'WELLS', color: '#c4342d' },
  'Discover': { short: 'DISC', color: '#f47216' },
  'Bank of America': { short: 'BOA', color: '#c41230' },
  'U.S. Bank': { short: 'USB', color: '#0e3388' },
};

const NEWS_ICON: Record<string, React.ReactNode> = {
  reward: <StarIcon />,
  alert: <AlertIcon />,
  info: <ClockIcon />,
  amber: <SparkleIcon />,
};

const NEWS_CLASS: Record<string, string> = {
  reward: 'th-ni-reward',
  alert: 'th-ni-alert',
  info: 'th-ni-info',
  amber: 'th-ni-amber',
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export const ForYouV2Page = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState<boolean | null>(null);

  const isDark = darkMode ?? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme:dark)').matches);

  const { data: cards = [] } = useQuery({
    queryKey: ['cards'],
    queryFn: () => cardService.getAllCards(),
  });

  const portfolio = useMemo(
    () =>
      CATEGORIES.map((cat) => ({ cat, best: bestForCategory(cards, cat) })).filter(
        (p): p is { cat: Category; best: RankedCard } => p.best !== null,
      ),
    [cards],
  );

  const ask = useCallback(
    (q: string) => {
      const query = q.trim();
      if (query) navigate('/recommend', { state: { initialQuery: query } });
    },
    [navigate],
  );

  const firstName = user?.first_name ?? 'there';
  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '';

  return (
    <div
      className="tandem-home"
      data-theme={darkMode === true ? 'dark' : darkMode === false ? 'light' : undefined}
    >
      <div className="th-page">
        {/* ---- STICKY TOP BAR (full-width) ---- */}
        <header className="th-top">
          <div className="th-top-inner">
            <Link to="/for-you-2" className="th-brand" style={{ textDecoration: 'none' }}>
              <span className="th-logo" aria-hidden="true"><TandemLogo /></span>
              Tandem
            </Link>
            <nav className="th-nav">
              <button className="active">Home</button>
              <button onClick={() => navigate('/recommend')}>Chat</button>
              <button onClick={() => navigate('/cards')}>Cards</button>
              <button onClick={() => navigate('/recommend')}>Plans</button>
            </nav>
            <div className="th-spacer" />
            <label className="th-search">
              <SearchIcon />
              <input placeholder="Search a card or topic…" aria-label="Search" />
            </label>
            <button
              className="th-iconbtn"
              aria-label="Toggle theme"
              title="Toggle theme"
              onClick={() => setDarkMode((prev) => (prev === null ? !isDark : !prev))}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="th-iconbtn" aria-label="Notifications"><BellIcon /></button>
            <span className="th-ava" title={user ? `${user.first_name} ${user.last_name}` : ''}>
              {initials || '?'}
            </span>
          </div>
        </header>

        <div className="th-app">
          {/* ---- GREETING ---- */}
          <section className="th-hello">
            <h1>{greetingFor()}, {firstName}</h1>
            <p>Your money companion — the right card for every purchase, and a sharper strategy when you plan together.</p>
          </section>

          {/* ---- ROW 1 ---- */}
          <div className="th-row1">
            <AdvisorHero onAsk={ask} onNavigate={navigate} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <PortfolioSection portfolio={portfolio} onAsk={ask} />
              <SessionsSection onAsk={ask} onNavigate={navigate} />
            </div>
          </div>

          {/* ---- ROW 2 ---- */}
          <div className="th-row2">
            <NewsSection />
            <PlansSection onNavigate={navigate} />
          </div>
        </div>{/* /th-app */}
      </div>{/* /th-page */}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Advisor Hero                                                       */
/* ------------------------------------------------------------------ */

const AdvisorHero = ({
  onAsk,
  onNavigate,
}: {
  onAsk: (q: string) => void;
  onNavigate: (path: string) => void;
}) => {
  const [value, setValue] = useState('');
  const [evalValue, setEvalValue] = useState('');

  return (
    <section className="th-card th-pad th-advisor">
      <span className="th-eyebrow"><span className="th-dot" />Ask Tandem</span>
      <h2 className="th-big">What can I help you with?</h2>
      <p className="th-lede">
        Recommend a new card, figure out which one to use, optimize your rewards, or plan with your partner — all in one conversation.
      </p>
      <div className="th-askrow">
        <label className="th-askfield">
          <SparkleIcon />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onAsk(value); }}
            placeholder="e.g. Best travel card with no foreign transaction fees"
            aria-label="Ask Tandem"
          />
        </label>
        <button className="th-btn th-btn-primary" onClick={() => onAsk(value)}>
          <SendIcon />Ask
        </button>
      </div>
      <div className="th-chips">
        {STARTERS.map((s) => (
          <button key={s.label} className="th-chip" onClick={() => onAsk(s.query)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="th-eval-strip">
        <span className="th-ev-ic" aria-hidden="true"><EvalIcon /></span>
        <div className="th-ev-txt">
          <strong>Evaluate a specific card</strong>
          <span>Already eyeing one? I'll break down if it fits you.</span>
        </div>
        <label className="th-askfield" style={{ flex: 1.3, minWidth: 200 }}>
          <input
            value={evalValue}
            onChange={(e) => setEvalValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onNavigate('/evaluate'); }}
            placeholder="e.g. Chase Sapphire Preferred"
            aria-label="Card to evaluate"
          />
        </label>
        <button className="th-btn th-btn-ghost" onClick={() => onNavigate('/evaluate')}>
          Evaluate
        </button>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  Portfolio                                                          */
/* ------------------------------------------------------------------ */

const PortfolioSection = ({
  portfolio,
  onAsk,
}: {
  portfolio: { cat: Category; best: RankedCard }[];
  onAsk: (q: string) => void;
}) => (
  <section className="th-card th-pad">
    <div className="th-shead">
      <div><h2>Which card to use</h2></div>
      <button className="th-see" onClick={() => onAsk('Help me set up which card to use for each category')}>
        Edit →
      </button>
    </div>
    <div className="th-quick-grid">
      {portfolio.map(({ cat, best }) => {
        const badge = ISSUER_BADGE[best.card.issuer] ?? { short: best.card.issuer.slice(0, 4).toUpperCase(), color: '#555' };
        return (
          <button
            key={cat.key}
            className="th-qcard"
            onClick={() => onAsk(`Tell me about my ${best.card.name} — where does it earn the most?`)}
          >
            <span className="th-qc-cat">
              {CATEGORY_ICONS[cat.iconKey]}
              {cat.label}
            </span>
            <div className="th-qc-body">
              <span className="th-qc-badge" style={{ background: badge.color }}>{badge.short}</span>
              <div style={{ minWidth: 0 }}>
                <div className="th-qc-name">{best.card.name}</div>
                <div className="th-qc-rate">{best.rate}</div>
              </div>
            </div>
            <span className="th-qc-open">
              Ask about this card <ChevronRightIcon />
            </span>
          </button>
        );
      })}
    </div>
  </section>
);

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
  <section className="th-card th-pad">
    <div className="th-shead">
      <div><h2>Recent conversations</h2></div>
      <button className="th-see" onClick={() => onNavigate('/recommend')}>All chats →</button>
    </div>
    <div className="th-sessions">
      {MOCK_SESSIONS.map((s) => (
        <button
          key={s.id}
          className="th-ses"
          onClick={() => (s.plan ? onNavigate('/recommend') : onAsk(s.title))}
        >
          <span className="th-ses-ic"><ChatBubbleIcon /></span>
          <span className="th-ses-body">
            <span className="th-ses-title">{s.title}</span>
            <span className="th-ses-snip">{s.snip}</span>
            <span className="th-ses-meta">
              <span className="th-ses-time">{s.time}</span>
              {s.plan && (
                <span className="th-plan-badge"><UsersIcon />{s.planName}</span>
              )}
            </span>
          </span>
          <span className="th-ses-go"><ChevronRightIcon /></span>
        </button>
      ))}
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/*  News                                                               */
/* ------------------------------------------------------------------ */

const NewsSection = () => (
  <section className="th-card th-pad">
    <div className="th-shead">
      <div><h2>Today for your cards</h2></div>
      <button className="th-see">See all →</button>
    </div>
    <div className="th-news-list">
      {MOCK_NEWS.map((n, i) => (
        <article key={i} className="th-news-item">
          <span className={`th-ni-ic ${NEWS_CLASS[n.type] ?? ''}`} aria-hidden="true">
            {NEWS_ICON[n.type] ?? <StarIcon />}
          </span>
          <div className="th-news-body">
            <h3>{n.title}</h3>
            <p>{n.body}</p>
            <div className="th-news-foot">
              <span className="th-chip-card">{n.card}</span>
              <span className="th-news-time">{n.time}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/*  Plans                                                              */
/* ------------------------------------------------------------------ */

const PlansSection = ({ onNavigate }: { onNavigate: (path: string) => void }) => (
  <section className="th-card th-pad">
    <div className="th-shead">
      <div><h2>Shared plans</h2></div>
      <button className="th-see" onClick={() => onNavigate('/recommend')}>New plan →</button>
    </div>
    <p style={{ color: 'var(--ink-2)', fontSize: '13.5px', marginBottom: 14, marginTop: 0 }}>
      Plan with a partner, roommate or friend — Tandem advises across both your cards.
    </p>
    <div className="th-plans-list">
      {MOCK_PLANS.map((p) => (
        <button
          key={p.name}
          className="th-plan-card"
          onClick={() => onNavigate('/recommend')}
        >
          <div className="th-pc-head">
            <span className="th-pc-ic">{PLAN_ICONS[p.icon]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="th-pc-name">{p.name}</div>
              <div className="th-pc-sub">{p.note}</div>
            </div>
            <div className="th-pc-people">
              {p.people.map((a) => (
                <span key={a.init} className="th-pc-ava" style={{ background: a.color }}>
                  {a.init}
                </span>
              ))}
            </div>
          </div>
        </button>
      ))}
    </div>
  </section>
);
