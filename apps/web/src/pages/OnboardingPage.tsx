import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import profileService, { type ProfileDetails } from '@/services/profileService';
import cardService from '@/services/cardService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/data/profileOptions';


/* ------------------------------------------------------------------ */
/*  SVG helpers                                                        */
/* ------------------------------------------------------------------ */

const RewardHiveLogo = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 2.5 L17.5 6 L17.5 13 L12 16.5 L6.5 13 L6.5 6 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 9.5 L15 11.25 L15 14.75 L12 16.5 L9 14.75 L9 11.25 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 16.5 L12 21.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
  { key: 'banking', title: 'Banks & cards', subtitle: 'Who you bank with and the cards you already hold.', label: 'Banking' },
  { key: 'goals', title: 'Your goals', subtitle: "What you want from your cards, so we optimize for the right rewards.", label: 'Goals' },
];


/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export const OnboardingPage = () => {
  const navigate = useNavigate();
  useAuth();

  const [form, setForm] = useState<ProfileDetails>({ ...EMPTY });
  const [stepIndex, setStepIndex] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: (payload: ProfileDetails) => profileService.updateDetails(payload),
    onSuccess: () => navigate('/for-you'),
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

  return (
    <div className="bg-background text-foreground min-h-screen lg:h-screen lg:overflow-hidden lg:flex lg:flex-col antialiased leading-relaxed tracking-tight" data-theme={themeAttr}>
      {/* Header */}
      <header className="shrink-0 sticky top-0 z-30 bg-background border-b border-border px-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-[19px] tracking-tight no-underline text-foreground">
            <span className="w-[34px] h-[34px] rounded-[10px] shrink-0 grid place-items-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/30">
              <RewardHiveLogo />
            </span>
            RewardHive
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
      <div className="shrink-0 w-full max-w-[1400px] mx-auto px-4 pt-5 flex items-center">
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

      {/* Body: full-width form */}
      <div className="w-full px-8 pt-6 pb-6 flex flex-col flex-1 min-h-0">
        <h1 className="font-display font-bold text-[clamp(24px,3vw,32px)] mb-1">{step.title}</h1>
        <p className="text-muted-foreground text-[15px] mb-5 max-w-[52ch]">{step.subtitle}</p>

        <div className="flex-1 rounded-lg border border-border bg-card shadow-sm p-6 min-h-0 overflow-y-auto">
          <StepContent stepKey={step.key} form={form} set={set} />
        </div>

        {mutation.isError && (
          <p className="text-destructive text-sm mt-3">
            Couldn't save: {(mutation.error as Error).message}
          </p>
        )}

        {/* Nav buttons */}
        <div className="shrink-0 flex gap-2.5 mt-5">
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
    case 'banking':
      return <BankingStep form={form} set={set} />;
    case 'goals':
      return <GoalsStep form={form} set={set} />;
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

/* ---- Multi-select dropdown ----
 * A searchable dropdown whose chosen options render as removable chips below it.
 * Pass `single` to behave like a one-choice dropdown (selecting replaces and
 * closes). Options carry an optional brand `color` dot. */
interface MSOption {
  value: string;
  label: string;
  color?: string;
}

const MultiSelect = ({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  searchable = true,
  single = false,
  emptyText = 'No matches',
}: {
  options: MSOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  single?: boolean;
  emptyText?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const reposition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    reposition();

    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const byValue = (v: string) => options.find((o) => o.value === v);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const toggle = (value: string) => {
    if (single) {
      onChange(selected[0] === value ? [] : [value]);
      setQuery('');
      setOpen(false);
      return;
    }
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  const triggerText = selected.length
    ? single
      ? byValue(selected[0])?.label ?? placeholder
      : `${selected.length} selected`
    : placeholder;

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 h-11 rounded-xl border-[1.5px] border-border bg-card px-3.5 text-[14.5px] text-left outline-none transition-colors hover:border-primary/40 focus:border-primary/40"
      >
        <span className={selected.length ? 'text-foreground' : 'text-muted-foreground'}>
          {triggerText}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: 260, zIndex: 9999 }}
            className="rounded-xl border border-border bg-background shadow-lg overflow-hidden flex flex-col"
          >
            {searchable && (
              <div className="shrink-0 p-2 border-b border-border">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full h-9 rounded-lg border-[1.5px] border-border bg-muted px-3 text-[13px] text-foreground outline-none focus:border-primary/40 placeholder:text-muted-foreground"
                />
              </div>
            )}
            <ul className="overflow-auto py-1 flex-1 min-h-0">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</li>
              ) : (
                filtered.map((o) => {
                  const isSel = selected.includes(o.value);
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          toggle(o.value);
                        }}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/60 ${
                          isSel ? 'text-foreground font-semibold' : 'text-muted-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {o.color && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: o.color }}
                            />
                          )}
                          {o.label}
                        </span>
                        {isSel && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selected.map((v) => {
            const o = byValue(v);
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold border-[1.5px] border-primary bg-primary/15 text-foreground"
              >
                {o?.color && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: o.color }}
                  />
                )}
                {o?.label ?? v}
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  className="text-muted-foreground hover:text-destructive leading-none text-base ml-0.5"
                  aria-label={`Remove ${o?.label ?? v}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
    <MultiSelect
      single
      searchable={false}
      placeholder="Select your housing situation…"
      options={HOUSEHOLD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      selected={form.household ? [form.household] : []}
      onChange={(vals) => set('household', vals[0] ?? null)}
    />
  </div>
);

/* ---- Travel ---- */
const TravelStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <FieldLabel>Travel style</FieldLabel>
    <div className="grid grid-cols-3 gap-3">
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
    <MultiSelect
      placeholder="Add airlines…"
      options={AIRLINES.map((a) => ({ value: a, label: a, color: AIRLINE_BRANDS[a]?.bg }))}
      selected={form.airline_ranking}
      onChange={(vals) => set('airline_ranking', vals)}
    />
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
    <div className="grid grid-cols-4 gap-3 mb-6">
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
    <MultiSelect
      placeholder="Add hotels & stays…"
      options={HOTELS.map((h) => ({ value: h, label: h, color: HOTEL_BRANDS[h]?.bg }))}
      selected={form.hotel_ranking}
      onChange={(vals) => set('hotel_ranking', vals)}
    />
  </div>
);

/* ---- Shopping ---- */
const ShoppingStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <FieldLabel>Online shopping</FieldLabel>
    <div className="mb-6">
      <MultiSelect
        placeholder="Add online stores…"
        options={ONLINE_SHOPPING.map((s) => ({ value: s, label: s, color: SHOP_BRANDS[s]?.bg }))}
        selected={form.online_shopping_ranking}
        onChange={(vals) => set('online_shopping_ranking', vals)}
      />
    </div>

    <FieldLabel>In-store shopping</FieldLabel>
    <MultiSelect
      placeholder="Add in-store retailers…"
      options={OFFLINE_SHOPPING.map((s) => ({ value: s, label: s, color: SHOP_BRANDS[s]?.bg }))}
      selected={form.offline_shopping_ranking}
      onChange={(vals) => set('offline_shopping_ranking', vals)}
    />
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

const BankingStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <FieldLabel>Banks you use</FieldLabel>
    <div className="mb-6">
      <MultiSelect
        placeholder="Add banks…"
        options={KNOWN_BANKS.map((b) => ({ value: b, label: b, color: BANK_BRANDS[b]?.bg }))}
        selected={form.banks.map((b) => b.name)}
        onChange={(vals) => set('banks', vals.map((name) => ({ name })))}
      />
    </div>

    <CardsStep form={form} set={set} />
  </div>
);

const GoalsStep = ({ form, set }: { form: FormState; set: SetFn }) => (
  <div>
    <FieldLabel>What are your goals?</FieldLabel>
    <MultiSelect
      placeholder="Add goals…"
      searchable={false}
      options={GOAL_OPTIONS.map((o) => ({ value: o.value, label: `${GOAL_EMOJI[o.value] ?? '\u{1F3AF}'}  ${o.label}` }))}
      selected={form.goals.map((g) => g.text)}
      onChange={(vals) => set('goals', vals.map((text) => ({ text })))}
    />
  </div>
);

/* ---- Current cards ----
 * Catalog cards are stored by `card_id`; a card not in the catalog is kept as a
 * free-text `name` with `custom: true`. Category defaults to 'all' here — users
 * refine per-card tags later from their profile. */
const CardsStep = ({ form, set }: { form: FormState; set: SetFn }) => {
  const { data: catalog = [], isLoading, isError } = useQuery({
    queryKey: ['cards', 'catalog'],
    queryFn: () => cardService.getAllCards(),
  });
  const [customName, setCustomName] = useState('');

  const catalogSelected = form.cards
    .filter((c) => !c.custom && c.card_id)
    .map((c) => c.card_id as string);
  const onCatalogChange = (ids: string[]) => {
    const nameById = new Map(catalog.map((c) => [c.id, c.name]));
    const catalogCards = ids.map(
      (id) =>
        form.cards.find((c) => !c.custom && c.card_id === id) ?? {
          card_id: id,
          name: nameById.get(id) ?? null,
          category: 'all',
          custom: false,
        },
    );
    set('cards', [...catalogCards, ...form.cards.filter((c) => c.custom)]);
  };

  const customCards = form.cards.filter((c) => c.custom);
  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const exists = form.cards.some((c) => c.custom && (c.name ?? '').toLowerCase() === name.toLowerCase());
    if (!exists) set('cards', [...form.cards, { card_id: null, name, category: 'all', custom: true }]);
    setCustomName('');
  };
  const removeCustom = (name: string | null) =>
    set('cards', form.cards.filter((c) => !(c.custom && c.name === name)));

  return (
    <div>
      <FieldLabel>Cards you currently have</FieldLabel>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading cards…</p>
      ) : isError ? (
        <p className="text-destructive text-sm">
          Couldn't load the card list — you can still add your cards by name below.
        </p>
      ) : (
        <MultiSelect
          placeholder="Add cards you hold…"
          emptyText="No cards found"
          options={catalog.map((card) => ({
            value: card.id,
            label: card.issuer ? `${card.name} (${card.issuer})` : card.name,
            color: BANK_BRANDS[card.issuer]?.bg,
          }))}
          selected={catalogSelected}
          onChange={onCatalogChange}
        />
      )}

      <FieldLabel className="mt-6">Have one that's not listed?</FieldLabel>
      <div className="flex gap-2 w-full">
        <Input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder="e.g. Local credit union Visa"
        />
        <Button variant="outline" onClick={addCustom} disabled={!customName.trim()}>
          Add
        </Button>
      </div>
      {customCards.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {customCards.map((c) => (
            <span
              key={c.name}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold border-[1.5px] border-primary bg-primary/15 text-foreground"
            >
              {c.name}
              <button
                className="text-muted-foreground hover:text-destructive leading-none text-base"
                onClick={() => removeCustom(c.name)}
                aria-label={`Remove ${c.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

