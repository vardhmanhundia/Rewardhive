import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import profileService, { type ProfileDetails } from '@/services/profileService';
import authService from '@/services/authService';
import {
  RELATIONSHIP_OPTIONS,
  GENDER_OPTIONS,
  HOUSEHOLD_OPTIONS,
  CAR_OPTIONS,
  TRAVEL_OPTIONS,
  US_STATUS_OPTIONS,
  US_STATUS_DETAILS,
  AIRLINES,
  ONLINE_SHOPPING,
  OFFLINE_SHOPPING,
  KNOWN_BANKS,
  US_STATES,
  DEFAULT_COUNTRY,
  HOTELS,
  type Option,
} from '@/data/profileOptions';
import './OnboardingPage2.css';

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
  { key: 'about', title: 'About you', subtitle: 'Choose the details that describe your situation so we can match better cards.', label: 'About' },
  { key: 'lifestyle', title: 'Lifestyle & status', subtitle: 'Your living situation and residency, for perk eligibility.', label: 'Lifestyle' },
  { key: 'travel', title: 'Travel preferences', subtitle: 'How you fly and stay, so travel rewards actually fit you.', label: 'Travel' },
  { key: 'hotels', title: 'Hotel preferences', subtitle: 'Where you stay, so we match hotel cards and loyalty programs.', label: 'Hotels' },
  { key: 'shopping', title: 'Shopping', subtitle: 'Where you spend most, to match store-specific rewards.', label: 'Shopping' },
  { key: 'banks', title: 'Banks & goals', subtitle: 'Who you bank with and what you want from your cards.', label: 'Banks' },
];

const REL_EMOJI: Record<string, string> = {
  single: '\u{1F464}', relationship: '\u{1F491}', living_together: '\u{1F3E0}', engaged: '\u{1F48D}',
  married: '\u{1F492}', married_with_kids: '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}', divorced: '\u{1F4DD}', widowed: '\u{1F54A}️', other: '\u{1F300}',
};

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/* ------------------------------------------------------------------ */
/*  Avatar component                                                   */
/* ------------------------------------------------------------------ */

const TRAVEL_OPTIONS_REF = TRAVEL_OPTIONS;

const ProfileAvatar = ({ form }: { form: ProfileDetails }) => {
  const gender = form.gender;
  const skinFill = '#F4C6A0';
  const hairColor = gender === 'female' ? '#5B3A29' : gender === 'male' ? '#3B2F2F' : '#6B5B73';
  const shirtColor = gender === 'female' ? 'var(--th-primary)' : gender === 'male' ? 'var(--amber)' : 'var(--info)';

  const tags = useMemo(() => {
    const t: { label: string; filled: boolean }[] = [];
    t.push({ label: form.gender ? (GENDER_OPTIONS.find((o) => o.value === form.gender)?.label ?? form.gender) : 'Gender', filled: !!form.gender });
    t.push({ label: form.occupation ?? 'Occupation', filled: !!form.occupation });
    t.push({ label: form.relationship_status ? (RELATIONSHIP_OPTIONS.find((o) => o.value === form.relationship_status)?.label ?? form.relationship_status) : 'Status', filled: !!form.relationship_status });
    t.push({ label: form.city ?? form.location_state ?? 'Location', filled: !!(form.city || form.location_state) });
    if (form.travel_preference) t.push({ label: TRAVEL_OPTIONS_REF.find((o) => o.value === form.travel_preference)?.label ?? form.travel_preference, filled: true });
    if (form.airline_ranking.length) t.push({ label: `${form.airline_ranking[0]} fan`, filled: true });
    if (form.hotel_ranking.length) t.push({ label: `${form.hotel_ranking[0]} guest`, filled: true });
    if (form.banks.length) t.push({ label: `${form.banks[0].name}`, filled: true });
    return t;
  }, [form]);

  return (
    <div className="ob2-avatar-panel">
      <h3>Your profile</h3>
      <div className="ob2-avatar-wrap">
        <svg viewBox="0 0 200 200" fill="none">
          <ellipse cx="100" cy="85" rx="42" ry="46" fill={skinFill} />
          {gender === 'female' ? (
            <>
              <ellipse cx="100" cy="62" rx="44" ry="32" fill={hairColor} />
              <path d="M56 72c-4 25-2 55 10 70" stroke={hairColor} strokeWidth="12" strokeLinecap="round" fill="none" />
              <path d="M144 72c4 25 2 55-10 70" stroke={hairColor} strokeWidth="12" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <ellipse cx="100" cy="60" rx="44" ry="28" fill={hairColor} />
          )}
          <circle cx="82" cy="88" r="4" fill="#2D2D2D" />
          <circle cx="118" cy="88" r="4" fill="#2D2D2D" />
          <path d="M88 104c4 6 20 6 24 0" stroke="#C47A5B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M55 170c0-28 20-44 45-44s45 16 45 44" fill={shirtColor} />
          <path d="M85 126l15 14 15-14" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
        </svg>
      </div>
      <div className="ob2-avatar-tags">
        {tags.map((t, i) => (
          <span key={i} className={`ob2-avatar-tag ${t.filled ? 'filled' : ''}`}>
            {t.filled && '✓ '}{t.label}
          </span>
        ))}
      </div>
    </div>
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
    <div className="ob2" data-theme={themeAttr}>
      <header className="ob2-header">
        <div className="ob2-header-inner">
          <Link to="/" className="ob2-brand">
            <span className="ob2-logo"><TandemLogo /></span>
            Tandem
          </Link>
          <div className="ob2-header-actions">
            <button className="ob2-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <SunSvg /> : <MoonSvg />}
            </button>
            <button className="ob2-skip" onClick={finish} disabled={mutation.isPending}>
              Skip for now →
            </button>
          </div>
        </div>
      </header>

      <div className="ob2-stepper">
        {STEP_META.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <div className={`ob2-step-line ${done ? 'done' : ''}`} />}
              <button className={`ob2-step-dot ${active ? 'active' : ''}`} onClick={() => setStepIndex(i)}>
                <span className={`ob2-step-num ${active ? 'active' : done ? 'done' : ''}`}>
                  {done ? '✓' : i + 1}
                </span>
                <span className="ob2-step-label">{s.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="ob2-body">
        <div className="ob2-main">
          <h1 className="ob2-step-title">{step.title}</h1>
          <p className="ob2-step-sub">{step.subtitle}</p>

          <StepContent stepKey={step.key} form={form} set={set} setForm={setForm} />

          {mutation.isError && (
            <p style={{ color: 'var(--alert)', fontSize: 14, marginTop: 12 }}>
              Couldn't save: {(mutation.error as Error).message}
            </p>
          )}

          <div className="ob2-nav">
            <button className="ob2-btn ob2-btn-ghost" onClick={goBack} disabled={stepIndex === 0}>
              ← Back
            </button>
            {!isLast && (
              <button className="ob2-btn ob2-btn-text" onClick={goNext}>
                Skip
              </button>
            )}
            {isLast ? (
              <button className="ob2-btn ob2-btn-primary" onClick={finish} disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : '✓ Finish'}
              </button>
            ) : (
              <button className="ob2-btn ob2-btn-primary" onClick={goNext}>
                Continue →
              </button>
            )}
          </div>
        </div>

        <aside className="ob2-sidebar">
          <ProfileAvatar form={form} />

          <div className="ob2-chat">
            <div className="ob2-chat-header">
              <ChatSvg />
              Chat with Tandem
            </div>
            <div className="ob2-chat-messages">
              {chatMessages.map((m, i) => (
                <div key={i} className={`ob2-chat-msg ${m.role}`}>
                  {m.content || (chatLoading && i === chatMessages.length - 1 ? '…' : '')}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {chatSuggestions.length > 0 && (
              <div className="ob2-chat-suggestions">
                {chatSuggestions.map((s) => (
                  <button key={s} className="ob2-chat-sug" onClick={() => sendChat(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="ob2-chat-input">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(chatInput); }}
                placeholder="Tell me about yourself…"
                disabled={chatLoading}
              />
              <button className="ob2-chat-send" onClick={() => sendChat(chatInput)} disabled={chatLoading || !chatInput.trim()}>
                <SendSvg />
              </button>
            </div>
          </div>
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
  setForm,
}: {
  stepKey: string;
  form: FormState;
  set: SetFn;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) => {
  switch (stepKey) {
    case 'about':
      return <AboutStep form={form} set={set} />;
    case 'lifestyle':
      return <LifestyleStep form={form} set={set} setForm={setForm} />;
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

const BrandBadge = ({ name, brands }: { name: string; brands: Record<string, { bg: string; label: string }> }) => {
  const brand = brands[name];
  if (!brand) return <span className="ob2-option-icon">{name.charAt(0)}</span>;
  return (
    <span className="ob2-option-icon">
      <span className="ob2-brand-badge" style={{ background: brand.bg }}>{brand.label}</span>
    </span>
  );
};

/* ---- About ---- */
const AboutStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="ob2-field">
        <label>Occupation</label>
        <input className="ob2-input" value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value || null)} placeholder="e.g. Software Engineer" />
      </div>
      <div className="ob2-field">
        <label>Company</label>
        <input className="ob2-input" value={form.company ?? ''} onChange={(e) => set('company', e.target.value || null)} placeholder="e.g. Acme Corp" />
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      <div className="ob2-field">
        <label>Date of birth</label>
        <input className="ob2-input" type="date" value={form.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value || null)} />
      </div>
      <div className="ob2-field">
        <label>City / Town</label>
        <input className="ob2-input" value={form.city ?? ''} onChange={(e) => set('city', e.target.value || null)} placeholder="e.g. San Francisco" />
      </div>
      <div className="ob2-field">
        <label>State</label>
        <select className="ob2-select" value={form.location_state ?? ''} onChange={(e) => set('location_state', e.target.value || null)}>
          <option value="">Select state…</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>

    <label className="ob2-field-label" style={{ marginTop: 8 }}>Gender</label>
    <div className="ob2-card-grid">
      {GENDER_OPTIONS.map((o) => (
        <button
          key={o.value}
          className={`ob2-option-card ${form.gender === o.value ? 'selected' : ''}`}
          onClick={() => set('gender', form.gender === o.value ? null : o.value)}
        >
          <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
          <span className="ob2-option-icon">{o.value === 'male' ? '♂️' : o.value === 'female' ? '♀️' : o.value === 'non_binary' ? '⚧️' : '\u{1F91D}'}</span>
          <span className="ob2-option-label">{o.label}</span>
        </button>
      ))}
    </div>

    <label className="ob2-field-label" style={{ marginTop: 20 }}>Relationship status</label>
    <div className="ob2-card-grid">
      {RELATIONSHIP_OPTIONS.map((o) => (
        <button
          key={o.value}
          className={`ob2-option-card ${form.relationship_status === o.value ? 'selected' : ''}`}
          onClick={() => set('relationship_status', form.relationship_status === o.value ? null : o.value)}
        >
          <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
          <span className="ob2-option-icon">{REL_EMOJI[o.value] ?? '\u{1F300}'}</span>
          <span className="ob2-option-label">{o.label}</span>
        </button>
      ))}
    </div>

    {(form.relationship_status === 'married_with_kids' || form.relationship_status === 'living_together') && (
      <div className="ob2-field" style={{ marginTop: 16 }}>
        <label>Family size</label>
        <input className="ob2-input" type="number" value={form.family_size?.toString() ?? ''} onChange={(e) => set('family_size', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 4" />
      </div>
    )}

    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 16 }}>
      <div className="ob2-field">
        <label>Country</label>
        <input className="ob2-input" value={form.location_country ?? ''} onChange={(e) => set('location_country', e.target.value || null)} placeholder="e.g. United States" />
      </div>
    </div>
  </div>
);

/* ---- Lifestyle ---- */
const LifestyleStep = ({ form, set, setForm }: { form: FormState; set: SetFn; setForm: React.Dispatch<React.SetStateAction<FormState>> }) => (
  <div>
    <label className="ob2-field-label">Household</label>
    <div className="ob2-card-grid">
      {HOUSEHOLD_OPTIONS.map((o) => (
        <button key={o.value} className={`ob2-option-card ${form.household === o.value ? 'selected' : ''}`} onClick={() => set('household', form.household === o.value ? null : o.value)}>
          <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
          <span className="ob2-option-icon">{o.value === 'owning' ? '\u{1F3E0}' : o.value === 'renting' ? '\u{1F511}' : '\u{1F3E6}'}</span>
          <span className="ob2-option-label">{o.label}</span>
        </button>
      ))}
    </div>

    <label className="ob2-field-label" style={{ marginTop: 20 }}>Car</label>
    <div className="ob2-card-grid">
      {CAR_OPTIONS.map((o) => (
        <button key={o.value} className={`ob2-option-card ${form.car === o.value ? 'selected' : ''}`} onClick={() => set('car', form.car === o.value ? null : o.value)}>
          <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
          <span className="ob2-option-icon">{o.value === 'financed' ? '\u{1F4B3}' : o.value === 'owned' ? '\u{1F697}' : '\u{1F699}'}</span>
          <span className="ob2-option-label">{o.label}</span>
        </button>
      ))}
    </div>

    <label className="ob2-field-label" style={{ marginTop: 20 }}>US status</label>
    <div className="ob2-card-grid">
      {US_STATUS_OPTIONS.map((o) => (
        <button key={o.value} className={`ob2-option-card ${form.us_status === o.value ? 'selected' : ''}`} onClick={() => setForm((prev) => ({ ...prev, us_status: prev.us_status === o.value ? null : o.value, us_status_detail: null }))}>
          <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
          <span className="ob2-option-icon">{o.value === 'citizen' ? '\u{1F1FA}\u{1F1F8}' : o.value === 'visa' ? '\u{1F4CB}' : o.value === 'green_card' ? '\u{1F49A}' : '✈️'}</span>
          <span className="ob2-option-label">{o.label}</span>
        </button>
      ))}
    </div>

    {form.us_status && US_STATUS_DETAILS[form.us_status] && (
      <div className="ob2-field" style={{ marginTop: 16 }}>
        <label>{form.us_status === 'visa' ? 'Visa type' : 'Green card category'}</label>
        <select className="ob2-select" value={form.us_status_detail ?? ''} onChange={(e) => set('us_status_detail', e.target.value || null)}>
          <option value="">Select…</option>
          {US_STATUS_DETAILS[form.us_status].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )}
  </div>
);

/* ---- Travel ---- */
const TravelStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <label className="ob2-field-label">Travel style</label>
    <div className="ob2-card-grid">
      {TRAVEL_OPTIONS.map((o) => (
        <button key={o.value} className={`ob2-option-card ${form.travel_preference === o.value ? 'selected' : ''}`} onClick={() => set('travel_preference', form.travel_preference === o.value ? null : o.value)}>
          <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
          <span className="ob2-option-icon">{o.value === 'economy' ? '\u{1F4BA}' : o.value === 'leisure' ? '\u{1F334}' : '\u{1F4B0}'}</span>
          <span className="ob2-option-label">{o.label}</span>
        </button>
      ))}
    </div>

    <label className="ob2-field-label" style={{ marginTop: 24 }}>Airline ranking — most preferred first</label>
    <div className="ob2-card-grid" style={{ marginBottom: 16 }}>
      {AIRLINES.map((a) => {
        const isSelected = form.airline_ranking.includes(a);
        return (
          <button
            key={a}
            className={`ob2-option-card ${isSelected ? 'selected' : ''}`}
            onClick={() => {
              if (isSelected) set('airline_ranking', form.airline_ranking.filter((x) => x !== a));
              else set('airline_ranking', [...form.airline_ranking, a]);
            }}
          >
            <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
            <BrandBadge name={a} brands={AIRLINE_BRANDS} />
            <span className="ob2-option-label">{a}</span>
          </button>
        );
      })}
    </div>

    {form.airline_ranking.length > 0 && (
      <RankingList ranking={form.airline_ranking} options={AIRLINES} onChange={(r) => set('airline_ranking', r)} addLabel="Add an airline…" brands={AIRLINE_BRANDS} />
    )}
  </div>
);

/* ---- Hotels ---- */
const HotelStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <label className="ob2-field-label">Pick your preferred hotel chains</label>
    <div className="ob2-card-grid" style={{ marginBottom: 16 }}>
      {HOTELS.map((h) => {
        const isSelected = form.hotel_ranking.includes(h);
        return (
          <button
            key={h}
            className={`ob2-option-card ${isSelected ? 'selected' : ''}`}
            onClick={() => {
              if (isSelected) set('hotel_ranking', form.hotel_ranking.filter((x) => x !== h));
              else set('hotel_ranking', [...form.hotel_ranking, h]);
            }}
          >
            <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
            <BrandBadge name={h} brands={HOTEL_BRANDS} />
            <span className="ob2-option-label">{h}</span>
          </button>
        );
      })}
    </div>

    {form.hotel_ranking.length > 0 && (
      <div>
        <label className="ob2-field-label">Rank your favorites</label>
        <RankingList ranking={form.hotel_ranking} options={HOTELS} onChange={(r) => set('hotel_ranking', r)} addLabel="Add another hotel…" brands={HOTEL_BRANDS} />
      </div>
    )}
  </div>
);

/* ---- Shopping ---- */
const ShoppingStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <label className="ob2-field-label">Online shopping — most preferred first</label>
    <div className="ob2-card-grid" style={{ marginBottom: 16 }}>
      {ONLINE_SHOPPING.slice(0, 10).map((s) => {
        const isSelected = form.online_shopping_ranking.includes(s);
        return (
          <button key={s} className={`ob2-option-card ${isSelected ? 'selected' : ''}`} onClick={() => {
            if (isSelected) set('online_shopping_ranking', form.online_shopping_ranking.filter((x) => x !== s));
            else set('online_shopping_ranking', [...form.online_shopping_ranking, s]);
          }}>
            <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
            <BrandBadge name={s} brands={SHOP_BRANDS} />
            <span className="ob2-option-label">{s}</span>
          </button>
        );
      })}
    </div>
    <RankingList ranking={form.online_shopping_ranking} options={ONLINE_SHOPPING} onChange={(r) => set('online_shopping_ranking', r)} addLabel="Add a retailer…" brands={SHOP_BRANDS} />

    <label className="ob2-field-label" style={{ marginTop: 24 }}>Offline shopping — most preferred first</label>
    <RankingList ranking={form.offline_shopping_ranking} options={OFFLINE_SHOPPING} onChange={(r) => set('offline_shopping_ranking', r)} addLabel="Add a store…" brands={SHOP_BRANDS} />
  </div>
);

/* ---- Banks & Goals ---- */
const BanksStep = ({ form, set }: { form: FormState; set: SetFn }) => {
  const [goalDraft, setGoalDraft] = useState('');
  const [loanDraft, setLoanDraft] = useState('');

  return (
    <div>
      <label className="ob2-field-label">Banks you use</label>
      <div className="ob2-card-grid" style={{ marginBottom: 16 }}>
        {KNOWN_BANKS.map((b) => {
          const selected = form.banks.some((x) => x.name === b);
          return (
            <button key={b} className={`ob2-option-card ${selected ? 'selected' : ''}`} onClick={() => {
              if (selected) set('banks', form.banks.filter((x) => x.name !== b));
              else set('banks', [...form.banks, { name: b }]);
            }}>
              <span className="ob2-radio"><span className="ob2-radio-dot" /></span>
              <BrandBadge name={b} brands={BANK_BRANDS} />
              <span className="ob2-option-label">{b}</span>
            </button>
          );
        })}
      </div>

      <label className="ob2-field-label" style={{ marginTop: 20 }}>Goals</label>
      <div className="ob2-chips">
        {form.goals.map((g, i) => (
          <span key={i} className="ob2-chip selected">
            {g.text}
            <button className="ob2-chip-remove" onClick={() => set('goals', form.goals.filter((_, idx) => idx !== i))}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="ob2-input"
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && goalDraft.trim()) { set('goals', [...form.goals, { text: goalDraft.trim() }]); setGoalDraft(''); } }}
          placeholder="e.g. build credit, travel rewards…"
        />
        <button className="ob2-btn ob2-btn-ghost" style={{ padding: '0 16px' }} onClick={() => { if (goalDraft.trim()) { set('goals', [...form.goals, { text: goalDraft.trim() }]); setGoalDraft(''); } }}>Add</button>
      </div>

      <label className="ob2-field-label" style={{ marginTop: 20 }}>Loans</label>
      <div className="ob2-chips">
        {form.loans.map((l, i) => (
          <span key={i} className="ob2-chip selected">
            {l.loan_type}
            <button className="ob2-chip-remove" onClick={() => set('loans', form.loans.filter((_, idx) => idx !== i))}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="ob2-input"
          value={loanDraft}
          onChange={(e) => setLoanDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && loanDraft.trim()) { set('loans', [...form.loans, { loan_type: loanDraft.trim() }]); setLoanDraft(''); } }}
          placeholder="e.g. mortgage, auto, student…"
        />
        <button className="ob2-btn ob2-btn-ghost" style={{ padding: '0 16px' }} onClick={() => { if (loanDraft.trim()) { set('loans', [...form.loans, { loan_type: loanDraft.trim() }]); setLoanDraft(''); } }}>Add</button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Shared: ranking list                                               */
/* ------------------------------------------------------------------ */

const RankingList = ({
  ranking,
  options,
  onChange,
  addLabel,
  brands,
}: {
  ranking: string[];
  options: string[];
  onChange: (r: string[]) => void;
  addLabel: string;
  brands?: Record<string, { bg: string; label: string }>;
}) => {
  const available = options.filter((o) => !ranking.includes(o));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ranking.length) return;
    const next = [...ranking];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div>
      {ranking.length > 0 && (
        <div className="ob2-rank-list">
          {ranking.map((item, i) => {
            const brand = brands?.[item];
            return (
              <div key={item} className="ob2-rank-item">
                <span className="ob2-rank-num">{i + 1}</span>
                {brand && (
                  <span className="ob2-rank-badge" style={{ background: brand.bg }}>{brand.label}</span>
                )}
                <span className="ob2-rank-name">{item}</span>
                <button className="ob2-rank-btn" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button className="ob2-rank-btn" onClick={() => move(i, i + 1)} disabled={i === ranking.length - 1} aria-label="Move down">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button className="ob2-rank-btn" onClick={() => onChange(ranking.filter((x) => x !== item))} aria-label="Remove">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
      {available.length > 0 && (
        <select className="ob2-select" value="" onChange={(e) => e.target.value && onChange([...ranking, e.target.value])}>
          <option value="">{addLabel}</option>
          {available.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  );
};
