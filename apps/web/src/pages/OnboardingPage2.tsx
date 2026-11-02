import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import profileService, { type ProfileDetails } from '@/services/profileService';
import authService from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Markdown from '@/components/Markdown';
import {
  HOUSEHOLD_OPTIONS,
  TRAVEL_OPTIONS,
  HOTEL_STAY_OPTIONS,
  GOAL_OPTIONS,
  AIRLINES,
  ONLINE_SHOPPING,
  OFFLINE_SHOPPING,
  KNOWN_BANKS,
  US_STATES,
  DEFAULT_COUNTRY,
  HOTELS,
  type Option,
} from '@/data/profileOptions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ------------------------------------------------------------------ */
/*  SVG helpers                                                        */
/* ------------------------------------------------------------------ */

const TandemLogo = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="16" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const SendSvg = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 12l16-8-6 16-3-6-7-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const ChatSvg = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 5h16v11H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const SunSvg = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MoonSvg = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Brand colors for logos                                             */
/* ------------------------------------------------------------------ */

const AIRLINE_BRANDS: Record<string, { bg: string; label: string }> = {
  'Delta': { bg: '#C8102E', label: 'DL' },
  'American Airlines': { bg: '#0078D2', label: 'AA' },
  'United': { bg: '#002244', label: 'UA' },
  'Southwest': { bg: '#304CB2', label: 'WN' },
  'JetBlue': { bg: '#003876', label: 'B6' },
  'Alaska Airlines': { bg: '#01426A', label: 'AS' },
  'Frontier': { bg: '#00752F', label: 'F9' },
  'Spirit': { bg: '#FFD200', label: 'NK' },
  'Hawaiian Airlines': { bg: '#800080', label: 'HA' },
};

const HOTEL_BRANDS: Record<string, { bg: string; label: string }> = {
  'Marriott': { bg: '#8C1515', label: 'MR' },
  'Hilton': { bg: '#003B71', label: 'HI' },
  'Hyatt': { bg: '#C9A961', label: 'HY' },
  'IHG': { bg: '#008752', label: 'IHG' },
  'Wyndham': { bg: '#0057A0', label: 'WH' },
  'Best Western': { bg: '#D4A749', label: 'BW' },
  'Choice Hotels': { bg: '#003B71', label: 'CH' },
  'Accor': { bg: '#1B1B4B', label: 'AC' },
  'Radisson': { bg: '#003366', label: 'RD' },
  'Four Seasons': { bg: '#2E2E2E', label: 'FS' },
  'Airbnb': { bg: '#FF5A5F', label: 'AB' },
};

const BANK_BRANDS: Record<string, { bg: string; label: string }> = {
  'Bank of America': { bg: '#012169', label: 'BofA' },
  'Chase': { bg: '#117ACA', label: 'JPM' },
  'Wells Fargo': { bg: '#CC0000', label: 'WF' },
  'Citibank': { bg: '#003B70', label: 'CITI' },
  'Capital One': { bg: '#004977', label: 'C1' },
  'U.S. Bank': { bg: '#0C2074', label: 'USB' },
  'American Express': { bg: '#006FCF', label: 'AMEX' },
  'Discover': { bg: '#FF6600', label: 'DFS' },
  'PNC Bank': { bg: '#F37321', label: 'PNC' },
  'TD Bank': { bg: '#34A532', label: 'TD' },
  'Truist': { bg: '#8B2346', label: 'TFC' },
  'HSBC': { bg: '#DB0011', label: 'HSBC' },
  'Goldman Sachs (Marcus)': { bg: '#000000', label: 'GS' },
  'Barclays': { bg: '#00AEEF', label: 'BCS' },
  'Synchrony': { bg: '#000000', label: 'SYF' },
};

const SHOP_BRANDS: Record<string, { bg: string; label: string }> = {
  'Amazon': { bg: '#FF9900', label: 'AMZ' },
  'Apple': { bg: '#333333', label: 'APL' },
  'Best Buy': { bg: '#0046BE', label: 'BBY' },
  'Costco': { bg: '#E31837', label: 'COST' },
  'Target': { bg: '#CC0000', label: 'TGT' },
  'Walmart': { bg: '#0071CE', label: 'WMT' },
  'Nike': { bg: '#111111', label: 'NKE' },
  'Nordstrom': { bg: '#000000', label: 'JWN' },
  'Home Depot': { bg: '#F96302', label: 'HD' },
  'Sephora': { bg: '#000000', label: 'SEP' },
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EMPTY: ProfileDetails = {
  occupation: null,
  company: null,
  date_of_birth: null,
  gender: null,
  relationship_status: null,
  family_size: null,
  city: null,
  location_state: null,
  location_country: DEFAULT_COUNTRY,
  household: null,
  car: null,
  travel_preference: null,
  hotel_stay_style: null,
  us_status: null,
  us_status_detail: null,
  airline_ranking: [],
  hotel_ranking: [],
  online_shopping_ranking: [],
  offline_shopping_ranking: [],
  cards: [],
  banks: [],
  goals: [],
  loans: [],
};

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */

interface StepDef {
  key: string;
  title: string;
  subtitle: string;
  label: string;
}

const STEP_META: StepDef[] = [
  { key: 'about', title: 'About you', subtitle: 'A few basics so we can match cards to your situation.', label: 'About' },
  { key: 'travel', title: 'Travel preferences', subtitle: 'How you fly and stay, so travel rewards actually fit you.', label: 'Travel' },
  { key: 'hotels', title: 'Hotel preferences', subtitle: 'Where you stay, so we match hotel cards and loyalty programs.', label: 'Hotels' },
  { key: 'shopping', title: 'Shopping', subtitle: 'Where you spend most, to match store-specific rewards.', label: 'Shopping' },
  { key: 'banks', title: 'Banks & goals', subtitle: 'Who you bank with and what you want from your cards.', label: 'Banks' },
];


interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/* ------------------------------------------------------------------ */
/*  Avatar component                                                   */
/* ------------------------------------------------------------------ */

const TRAVEL_OPTIONS_REF = TRAVEL_OPTIONS;

const ProfileAvatar = ({ form }: { form: ProfileDetails }) => {
  const skinFill = '#F4C6A0';
  const hairColor = '#6B5B73';
  const shirtColor = 'hsl(252 95% 68%)';

  const tags = useMemo(() => {
    const t: { label: string; filled: boolean }[] = [];
    t.push({ label: form.occupation ?? 'Occupation', filled: !!form.occupation });
    t.push({ label: form.city ?? form.location_state ?? 'Location', filled: !!(form.city || form.location_state) });
    if (form.travel_preference) t.push({ label: TRAVEL_OPTIONS_REF.find((o) => o.value === form.travel_preference)?.label ?? form.travel_preference, filled: true });
    if (form.airline_ranking.length) t.push({ label: `${form.airline_ranking[0]} fan`, filled: true });
    if (form.hotel_ranking.length) t.push({ label: `${form.hotel_ranking[0]} guest`, filled: true });
    if (form.banks.length) t.push({ label: `${form.banks[0].name}`, filled: true });
    if (form.goals.length) t.push({ label: form.goals[0].text, filled: true });
    return t;
  }, [form]);

  return (
    <Card className="text-center overflow-hidden">
      <CardContent className="p-6">
        <h3 className="font-display text-[15px] font-semibold mb-4">Your profile</h3>
        <div className="w-[200px] h-[200px] mx-auto mb-4 rounded-full overflow-hidden bg-gradient-to-br from-primary/15 to-muted border-[3px] border-primary/40 grid place-items-center transition-all duration-400">
          <svg viewBox="0 0 200 200" fill="none" className="w-[180px] h-[180px]">
            <ellipse cx="100" cy="85" rx="42" ry="46" fill={skinFill} />
            <ellipse cx="100" cy="60" rx="44" ry="28" fill={hairColor} />
            <circle cx="82" cy="88" r="4" fill="#2D2D2D" />
            <circle cx="118" cy="88" r="4" fill="#2D2D2D" />
            <path d="M88 104c4 6 20 6 24 0" stroke="#C47A5B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M55 170c0-28 20-44 45-44s45 16 45 44" fill={shirtColor} />
            <path d="M85 126l15 14 15-14" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {tags.map((t, i) => (
            <span
              key={i}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                t.filled
                  ? 'bg-primary/15 border border-primary/40 text-primary'
                  : 'bg-muted border border-border text-muted-foreground'
              }`}
            >
              {t.filled && '✓ '}{t.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export const OnboardingPage2 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<ProfileDetails>({ ...EMPTY });
  const [stepIndex, setStepIndex] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: "Hi! I'm Tandem. You can tell me about yourself in your own words and I'll fill in the profile for you. Or just use the form — either works!" },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([
    "I'm a software engineer in NYC",
    "I fly Delta mostly",
    "I want travel rewards",
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: (payload: ProfileDetails) => profileService.updateDetails(payload),
    onSuccess: () => navigate('/for-you-2'),
  });

  const step = STEP_META[stepIndex];
  const isLast = stepIndex === STEP_META.length - 1;
  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEP_META.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));
  const finish = () => mutation.mutate(form);

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'auto') return 'dark';
      if (prev === 'dark') return 'light';
      return 'auto';
    });
  };

  const themeAttr = theme === 'auto' ? undefined : theme;

  const sendChat = async (msg: string) => {
    const text = msg.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);
    setChatSuggestions([]);

    try {
      const token = authService.getToken();
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_URL}/profiling/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "Sorry, I couldn't process that. You can continue filling in the form instead!" },
        ]);
        setChatLoading(false);
        return;
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let reply = '';

        setChatMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

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
            if (event === 'token') {
              reply += payload.text;
              setChatMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: reply };
                return next;
              });
            } else if (event === 'suggestions') {
              setChatSuggestions(payload.items ?? []);
            }
          }
        }

        if (!reply) {
          setChatMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: "Got it! I've updated your profile." };
            return next;
          });
        }
      } else {
        const data = await res.json();
        setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply || "Got it!" }]);
        if (data.suggestions) setChatSuggestions(data.suggestions);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev.slice(0, -1).filter((m) => m.content),
        { role: 'assistant', content: "I had trouble connecting. Try again or use the form!" },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="bg-background text-foreground min-h-screen antialiased leading-relaxed tracking-tight" data-theme={themeAttr}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background border-b border-border px-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-[19px] tracking-tight no-underline text-foreground">
            <span className="w-[34px] h-[34px] rounded-[10px] shrink-0 grid place-items-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/30">
              <TandemLogo />
            </span>
            Tandem
          </Link>
          <div className="flex items-center gap-2.5">
            <button
              className="w-9 h-9 rounded-full border border-border bg-card text-muted-foreground grid place-items-center shrink-0 hover:text-foreground transition-colors"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              <span className="w-4 h-4">{theme === 'dark' ? <SunSvg /> : <MoonSvg />}</span>
            </button>
            <button
              className="inline-flex items-center gap-1.5 bg-transparent border-none text-muted-foreground text-sm font-semibold hover:text-foreground transition-colors"
              onClick={finish}
              disabled={mutation.isPending}
            >
              Skip for now →
            </button>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="max-w-[1200px] mx-auto px-4 pt-5 flex items-center">
        {STEP_META.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className={`flex-1 h-0.5 mx-2 min-w-[16px] ${done ? 'bg-primary/40' : 'bg-border'}`} />
              )}
              <button
                className="flex items-center gap-2 bg-transparent border-none p-2 whitespace-nowrap text-muted-foreground"
                onClick={() => setStepIndex(i)}
              >
                <span
                  className={`w-8 h-8 rounded-full shrink-0 grid place-items-center font-display font-bold text-[13px] border-2 transition-all duration-300 ${
                    active
                      ? 'border-primary text-primary-foreground bg-primary'
                      : done
                        ? 'border-primary text-primary bg-primary/15'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={`text-[13px] font-semibold hidden sm:inline ${active ? 'text-foreground' : ''}`}>
                  {s.label}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Body: form left + sidebar right */}
      <div className="max-w-[1200px] mx-auto px-4 pt-6 pb-12 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* Left: step content */}
        <div className="min-w-0">
          <h1 className="font-display font-bold text-[clamp(24px,3vw,32px)] mb-1">{step.title}</h1>
          <p className="text-muted-foreground text-[15px] mb-6 max-w-[52ch]">{step.subtitle}</p>

          <StepContent stepKey={step.key} form={form} set={set} />

          {mutation.isError && (
            <p className="text-destructive text-sm mt-3">
              Couldn't save: {(mutation.error as Error).message}
            </p>
          )}

          {/* Nav buttons */}
          <div className="flex gap-2.5 mt-7">
            <Button variant="outline" onClick={goBack} disabled={stepIndex === 0}>
              ← Back
            </Button>
            {!isLast && (
              <button
                className="bg-transparent border-none text-muted-foreground text-sm font-semibold px-4 py-3 hover:text-foreground transition-colors"
                onClick={goNext}
              >
                Skip
              </button>
            )}
            {isLast ? (
              <Button onClick={finish} disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : '✓ Finish'}
              </Button>
            ) : (
              <Button onClick={goNext}>
                Continue →
              </Button>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="sticky top-20 max-lg:static">
          <ProfileAvatar form={form} />

          {/* Chat panel */}
          <Card className="mt-4 overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-2 px-4 py-3.5 border-b border-border">
              <span className="w-[18px] h-[18px] text-primary"><ChatSvg /></span>
              <span className="font-display font-semibold text-sm">Chat with Tandem</span>
            </CardHeader>
            <div className="h-[200px] overflow-y-auto p-3 px-4 flex flex-col gap-2.5">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-snug ${
                    m.role === 'user'
                      ? 'self-end bg-primary text-primary-foreground rounded-[14px] rounded-br-[4px]'
                      : 'self-start bg-muted text-foreground rounded-[14px] rounded-bl-[4px]'
                  }`}
                >
                  {m.content
                    ? m.role === 'assistant'
                      ? <Markdown>{m.content}</Markdown>
                      : m.content
                    : chatLoading && i === chatMessages.length - 1
                      ? '…'
                      : ''}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {chatSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                {chatSuggestions.map((s) => (
                  <button
                    key={s}
                    className="bg-muted border border-border rounded-full px-2.5 py-1 text-[11px] text-muted-foreground font-medium hover:border-primary/40 hover:text-foreground transition-colors"
                    onClick={() => sendChat(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 px-4 py-3 border-t border-border">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(chatInput); }}
                placeholder="Tell me about yourself…"
                disabled={chatLoading}
                className="flex-1 h-10 rounded-[10px] border-[1.5px] border-border bg-muted px-3 text-[13px] text-foreground outline-none focus:border-primary/40 placeholder:text-muted-foreground"
              />
              <button
                className="w-10 h-10 rounded-[10px] border-none bg-primary text-primary-foreground grid place-items-center shrink-0 hover:bg-primary/80 disabled:opacity-50 transition-colors"
                onClick={() => sendChat(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
              >
                <span className="w-4 h-4"><SendSvg /></span>
              </button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Step content renderer                                              */
/* ------------------------------------------------------------------ */

type FormState = ProfileDetails;
type SetFn = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

const StepContent = ({
  stepKey,
  form,
  set,
}: {
  stepKey: string;
  form: FormState;
  set: SetFn;
}) => {
  switch (stepKey) {
    case 'about':
      return <AboutStep form={form} set={set} />;
    case 'travel':
      return <TravelStep form={form} set={set} />;
    case 'hotels':
      return <HotelStep form={form} set={set} />;
    case 'shopping':
      return <ShoppingStep form={form} set={set} />;
    case 'banks':
      return <BanksStep form={form} set={set} />;
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Brand badge helper                                                 */
/* ------------------------------------------------------------------ */

/* ---- Shared option card (single-select items like household, travel style) ---- */
const OptionCard = ({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    className={`relative text-center border-2 rounded-xl p-[18px_12px] flex flex-col items-center gap-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
      selected
        ? 'border-primary bg-primary/15 shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]'
        : 'bg-card border-border hover:border-primary/40'
    }`}
    onClick={onClick}
  >
    <span className={`absolute top-2.5 left-2.5 w-[18px] h-[18px] rounded-full border-2 grid place-items-center transition-all duration-150 ${
      selected ? 'border-primary bg-primary' : 'border-border bg-card'
    }`}>
      <span className={`w-[7px] h-[7px] rounded-full bg-white transition-opacity duration-150 ${selected ? 'opacity-100' : 'opacity-0'}`} />
    </span>
    {icon}
    <span className="font-display font-semibold text-[13px]">{label}</span>
  </button>
);

/* ---- Chip toggle (multi-select pill for brands) ---- */
const ChipToggle = ({
  label,
  selected,
  onClick,
  brandColor,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  brandColor?: string;
}) => (
  <button
    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold border-[1.5px] transition-all duration-150 ${
      selected
        ? 'border-primary bg-primary/15 text-foreground'
        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
    }`}
    onClick={onClick}
  >
    {brandColor && (
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: brandColor }} />
    )}
    {label}
    {selected && (
      <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-primary ml-0.5">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
);

/* ---- Field label ---- */
const FieldLabel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <label className={`block text-xs font-bold tracking-widest uppercase text-muted-foreground mb-1.5 ${className}`}>
    {children}
  </label>
);

/* ---- About ---- */
const AboutStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <div className="grid grid-cols-2 gap-3">
      <div className="mb-4">
        <FieldLabel>Occupation</FieldLabel>
        <Input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value || null)} placeholder="e.g. Software Engineer" />
      </div>
      <div className="mb-4">
        <FieldLabel>Company</FieldLabel>
        <Input value={form.company ?? ''} onChange={(e) => set('company', e.target.value || null)} placeholder="e.g. Acme Corp" />
      </div>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div className="mb-4">
        <FieldLabel>Date of birth</FieldLabel>
        <Input type="date" value={form.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value || null)} />
      </div>
      <div className="mb-4">
        <FieldLabel>City / Town</FieldLabel>
        <Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value || null)} placeholder="e.g. San Francisco" />
      </div>
      <div className="mb-4">
        <FieldLabel>State</FieldLabel>
        <select
          className="w-full h-11 rounded-xl border-[1.5px] border-border bg-card px-3.5 text-[14.5px] text-foreground outline-none transition-colors focus:border-primary/40"
          value={form.location_state ?? ''}
          onChange={(e) => set('location_state', e.target.value || null)}
        >
          <option value="">Select state…</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>

    <FieldLabel className="mt-2">Household</FieldLabel>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
      {HOUSEHOLD_OPTIONS.map((o) => (
        <OptionCard
          key={o.value}
          selected={form.household === o.value}
          onClick={() => set('household', form.household === o.value ? null : o.value)}
          icon={<span className="w-12 h-12 rounded-xl grid place-items-center text-2xl bg-muted border border-border">{o.value === 'owning' ? '\u{1F3E0}' : o.value === 'renting' ? '\u{1F511}' : '\u{1F3E6}'}</span>}
          label={o.label}
        />
      ))}
    </div>
  </div>
);

/* ---- Travel ---- */
const TravelStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <FieldLabel>Travel style</FieldLabel>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
      {TRAVEL_OPTIONS.map((o) => (
        <OptionCard
          key={o.value}
          selected={form.travel_preference === o.value}
          onClick={() => set('travel_preference', form.travel_preference === o.value ? null : o.value)}
          icon={<span className="w-12 h-12 rounded-xl grid place-items-center text-2xl bg-muted border border-border">{o.value === 'economy' ? '\u{1F4BA}' : o.value === 'leisure' ? '\u{1F334}' : '\u{1F4B0}'}</span>}
          label={o.label}
        />
      ))}
    </div>

    <FieldLabel className="mt-6">Preferred airlines</FieldLabel>
    <div className="flex flex-wrap gap-2">
      {AIRLINES.map((a) => {
        const isSelected = form.airline_ranking.includes(a);
        return (
          <ChipToggle
            key={a}
            label={a}
            selected={isSelected}
            brandColor={AIRLINE_BRANDS[a]?.bg}
            onClick={() => {
              if (isSelected) set('airline_ranking', form.airline_ranking.filter((x) => x !== a));
              else set('airline_ranking', [...form.airline_ranking, a]);
            }}
          />
        );
      })}
    </div>
  </div>
);

/* ---- Hotels ---- */
const STAY_EMOJI: Record<string, string> = {
  budget: '\u{1F4B0}',
  mid_range: '\u{1F3E8}',
  luxury: '\u{2B50}',
  boutique: '\u{1F3E1}',
};

const HotelStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <FieldLabel>Stay style</FieldLabel>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-6">
      {HOTEL_STAY_OPTIONS.map((o) => (
        <OptionCard
          key={o.value}
          selected={form.hotel_stay_style === o.value}
          onClick={() => set('hotel_stay_style', form.hotel_stay_style === o.value ? null : o.value)}
          icon={<span className="w-12 h-12 rounded-xl grid place-items-center text-2xl bg-muted border border-border">{STAY_EMOJI[o.value] ?? '\u{1F3E8}'}</span>}
          label={o.label}
        />
      ))}
    </div>

    <FieldLabel>Preferred hotels & stays</FieldLabel>
    <div className="flex flex-wrap gap-2">
      {HOTELS.map((h) => {
        const isSelected = form.hotel_ranking.includes(h);
        return (
          <ChipToggle
            key={h}
            label={h}
            selected={isSelected}
            brandColor={HOTEL_BRANDS[h]?.bg}
            onClick={() => {
              if (isSelected) set('hotel_ranking', form.hotel_ranking.filter((x) => x !== h));
              else set('hotel_ranking', [...form.hotel_ranking, h]);
            }}
          />
        );
      })}
    </div>
  </div>
);

/* ---- Shopping ---- */
const ShoppingStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <FieldLabel>Online shopping</FieldLabel>
    <div className="flex flex-wrap gap-2 mb-6">
      {ONLINE_SHOPPING.map((s) => {
        const isSelected = form.online_shopping_ranking.includes(s);
        return (
          <ChipToggle
            key={s}
            label={s}
            selected={isSelected}
            brandColor={SHOP_BRANDS[s]?.bg}
            onClick={() => {
              if (isSelected) set('online_shopping_ranking', form.online_shopping_ranking.filter((x) => x !== s));
              else set('online_shopping_ranking', [...form.online_shopping_ranking, s]);
            }}
          />
        );
      })}
    </div>

    <FieldLabel>In-store shopping</FieldLabel>
    <div className="flex flex-wrap gap-2">
      {OFFLINE_SHOPPING.map((s) => {
        const isSelected = form.offline_shopping_ranking.includes(s);
        return (
          <ChipToggle
            key={s}
            label={s}
            selected={isSelected}
            brandColor={SHOP_BRANDS[s]?.bg}
            onClick={() => {
              if (isSelected) set('offline_shopping_ranking', form.offline_shopping_ranking.filter((x) => x !== s));
              else set('offline_shopping_ranking', [...form.offline_shopping_ranking, s]);
            }}
          />
        );
      })}
    </div>
  </div>
);

/* ---- Banks & Goals ---- */
const GOAL_EMOJI: Record<string, string> = {
  travel_rewards: '✈️',
  cashback: '\u{1F4B5}',
  build_credit: '\u{1F4C8}',
  low_interest: '\u{1F4B0}',
  premium_perks: '\u{1F451}',
  balance_transfer: '\u{1F504}',
};

const BanksStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <FieldLabel>Banks you use</FieldLabel>
    <div className="flex flex-wrap gap-2 mb-6">
      {KNOWN_BANKS.map((b) => {
        const selected = form.banks.some((x) => x.name === b);
        return (
          <ChipToggle
            key={b}
            label={b}
            selected={selected}
            brandColor={BANK_BRANDS[b]?.bg}
            onClick={() => {
              if (selected) set('banks', form.banks.filter((x) => x.name !== b));
              else set('banks', [...form.banks, { name: b }]);
            }}
          />
        );
      })}
    </div>

    <FieldLabel className="mt-2">What's your main goal?</FieldLabel>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {GOAL_OPTIONS.map((o) => {
        const selected = form.goals.length > 0 && form.goals[0].text === o.value;
        return (
          <OptionCard
            key={o.value}
            selected={selected}
            onClick={() => set('goals', selected ? [] : [{ text: o.value }])}
            icon={<span className="w-12 h-12 rounded-xl grid place-items-center text-2xl bg-muted border border-border">{GOAL_EMOJI[o.value] ?? '\u{1F3AF}'}</span>}
            label={o.label}
          />
        );
      })}
    </div>
  </div>
);

