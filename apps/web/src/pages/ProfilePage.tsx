/**
 * Profile page — the user's account identity plus an editable set of
 * lifestyle/financial details and the credit cards they hold (tagged by
 * category). The data feeds card recommendations. The user id is never shown.
 */
import {useEffect, useMemo, useRef, useState} from 'react';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Plus, X, Save, RotateCcw, CreditCard as CardIcon} from 'lucide-react';
import {useAuth} from '@/context/AuthContext';
import {Navbar} from '@/components/Navbar';
import {CreditCardVisual} from '@/components/CreditCardVisual';
import profileService, {
  type ProfileDetails,
} from '@/services/profileService';
import cardService, {type CardProduct} from '@/services/cardService';
import {
  RELATIONSHIP_OPTIONS,
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
  CARD_CATEGORIES,
  type Option,
} from '@/data/profileOptions';
import {ArrowUp, ArrowDown, Search} from 'lucide-react';

const EMPTY: ProfileDetails = {
  occupation: null,
  company: null,
  relationship_status: null,
  family_size: null,
  location_state: null,
  location_country: null,
  household: null,
  car: null,
  travel_preference: null,
  us_status: null,
  us_status_detail: null,
  airline_ranking: [],
  online_shopping_ranking: [],
  offline_shopping_ranking: [],
  cards: [],
  banks: [],
  goals: [],
  loans: [],
};

const toOptions = (values: string[]): Option[] =>
  values.map((v) => ({value: v, label: v}));

export const ProfilePage = () => {
  const {user, isLoading: authLoading} = useAuth();
  const queryClient = useQueryClient();

  const {data: details, isLoading} = useQuery({
    queryKey: ['profile-details'],
    queryFn: () => profileService.getDetails(),
    enabled: !!user,
  });

  const {data: catalog} = useQuery({
    queryKey: ['cards'],
    queryFn: () => cardService.getAllCards(),
  });

  const [form, setForm] = useState<ProfileDetails>(EMPTY);

  // Reset the editable form whenever freshly loaded/saved data arrives.
  // Country defaults to the United States when unset.
  useEffect(() => {
    if (details) {
      setForm({
        ...details,
        location_country: details.location_country ?? DEFAULT_COUNTRY,
      });
    }
  }, [details]);

  const mutation = useMutation({
    mutationFn: (payload: ProfileDetails) => profileService.updateDetails(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(['profile-details'], saved);
    },
  });

  // Baseline mirrors the country default applied on load, so a freshly loaded
  // profile isn't flagged dirty.
  const baseline = useMemo(() => {
    const d = details ?? EMPTY;
    return {...d, location_country: d.location_country ?? DEFAULT_COUNTRY};
  }, [details]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const set = <K extends keyof ProfileDetails>(key: K, value: ProfileDetails[K]) =>
    setForm((prev) => ({...prev, [key]: value}));

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-glow text-foreground">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-10">
          <div className="glass h-40 animate-pulse rounded-2xl" />
        </main>
      </div>
    );
  }

  const createdDate = user
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-glow text-foreground">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Your profile
          </h1>
          <p className="text-muted-foreground mt-1">
            Tell us about yourself so recommendations fit your life.
          </p>
        </div>

        {/* Account (read-only) */}
        <Section title="Account" description="From your login — not editable here.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadOnly label="Name" value={`${user?.first_name ?? ''} ${user?.last_name ?? ''}`} />
            <ReadOnly label="Email" value={user?.email ?? ''} />
            <ReadOnly label="Status" value={user?.is_active ? 'Active' : 'Inactive'} />
            <ReadOnly label="Member since" value={createdDate} />
          </div>
        </Section>

        {/* Lifestyle & finances */}
        <Section title="About you">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Occupation">
              <TextInput
                value={form.occupation ?? ''}
                onChange={(v) => set('occupation', v || null)}
                placeholder="e.g. Software Engineer"
              />
            </Field>

            <Field label="Company">
              <TextInput
                value={form.company ?? ''}
                onChange={(v) => set('company', v || null)}
                placeholder="Where do you work? e.g. Acme Corp"
              />
            </Field>

            <Field label="Relationship">
              <Select
                value={form.relationship_status ?? ''}
                options={RELATIONSHIP_OPTIONS}
                onChange={(v) => set('relationship_status', v || null)}
              />
            </Field>

            {form.relationship_status === 'family' && (
              <Field label="Family size">
                <TextInput
                  type="number"
                  value={form.family_size?.toString() ?? ''}
                  onChange={(v) => set('family_size', v ? Number(v) : null)}
                  placeholder="e.g. 4"
                />
              </Field>
            )}

            <Field label="State">
              <Select
                value={form.location_state ?? ''}
                options={toOptions(US_STATES)}
                onChange={(v) => set('location_state', v || null)}
              />
            </Field>
            <Field label="Country">
              <TextInput
                value={form.location_country ?? ''}
                onChange={(v) => set('location_country', v || null)}
                placeholder="e.g. United States"
              />
            </Field>

            <Field label="Household">
              <Select
                value={form.household ?? ''}
                options={HOUSEHOLD_OPTIONS}
                onChange={(v) => set('household', v || null)}
              />
            </Field>
            <Field label="Car">
              <Select
                value={form.car ?? ''}
                options={CAR_OPTIONS}
                onChange={(v) => set('car', v || null)}
              />
            </Field>

            <Field label="US status">
              <Select
                value={form.us_status ?? ''}
                options={US_STATUS_OPTIONS}
                onChange={(v) =>
                  // Changing the parent status invalidates the sub-type.
                  setForm((prev) => ({
                    ...prev,
                    us_status: v || null,
                    us_status_detail: null,
                  }))
                }
              />
            </Field>

            {form.us_status && US_STATUS_DETAILS[form.us_status] && (
              <Field
                label={form.us_status === 'visa' ? 'Visa type' : 'Green card category'}
              >
                <Select
                  value={form.us_status_detail ?? ''}
                  options={US_STATUS_DETAILS[form.us_status]}
                  onChange={(v) => set('us_status_detail', v || null)}
                />
              </Field>
            )}
          </div>
        </Section>

        {/* Travel */}
        <Section title="Travel preferences">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Travel style">
              <Select
                value={form.travel_preference ?? ''}
                options={TRAVEL_OPTIONS}
                onChange={(v) => set('travel_preference', v || null)}
              />
            </Field>
          </div>
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Airline ranking
            </p>
            <p className="mb-3 text-sm text-muted-foreground">
              Add airlines in order of preference — most preferred at the top.
            </p>
            <AirlineRanking
              ranking={form.airline_ranking}
              onChange={(r) => set('airline_ranking', r)}
            />
          </div>
        </Section>

        {/* Shopping */}
        <Section
          title="Shopping preferences"
          description="Rank where you shop most — most preferred at the top. Used to match store-specific card rewards."
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Online shopping
              </p>
              <RankedPicker
                ranking={form.online_shopping_ranking}
                options={ONLINE_SHOPPING}
                placeholder="Search a retailer…"
                onChange={(r) => set('online_shopping_ranking', r)}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Offline shopping
              </p>
              <RankedPicker
                ranking={form.offline_shopping_ranking}
                options={OFFLINE_SHOPPING}
                placeholder="Search a store…"
                onChange={(r) => set('offline_shopping_ranking', r)}
              />
            </div>
          </div>
        </Section>

        {/* Banks / Goals / Loans */}
        <Section title="Banks">
          <BankPicker
            selected={form.banks.map((b) => b.name)}
            onChange={(names) => set('banks', names.map((name) => ({name})))}
          />
        </Section>

        <Section title="Goals">
          <ChipList
            items={form.goals.map((g) => g.text)}
            placeholder="Add a goal…"
            onAdd={(text) => set('goals', [...form.goals, {text}])}
            onRemove={(i) => set('goals', form.goals.filter((_, idx) => idx !== i))}
          />
        </Section>

        <Section title="Loans">
          <ChipList
            items={form.loans.map((l) => l.loan_type)}
            placeholder="Add a loan type (e.g. mortgage, auto, student)…"
            onAdd={(loan_type) => set('loans', [...form.loans, {loan_type}])}
            onRemove={(i) => set('loans', form.loans.filter((_, idx) => idx !== i))}
          />
        </Section>

        {/* Cards */}
        <Section
          title="Your cards"
          description="The cards you hold, grouped by how you use them."
        >
          <CardsEditor
            held={form.cards}
            catalog={catalog ?? []}
            onChange={(cards) => set('cards', cards)}
          />
        </Section>

        {/* Raw JSON */}
        <details className="glass rounded-2xl p-5">
          <summary className="cursor-pointer font-display font-semibold">
            Full profile data (JSON)
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-muted-foreground">
            {JSON.stringify(form, null, 2)}
          </pre>
        </details>
      </main>

      {/* Save bar */}
      {isDirty && (
        <div className="sticky bottom-0 z-20 border-t border-white/10 bg-background/80 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {mutation.isError
                ? `Error: ${(mutation.error as Error).message}`
                : 'You have unsaved changes.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForm(baseline)}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-white/5"
              >
                <RotateCcw className="h-4 w-4" />
                Discard
              </button>
              <button
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- layout */

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="glass rounded-2xl p-5">
    <div className="mb-4">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {children}
  </section>
);

const Field = ({label, children}: {label: string; children: React.ReactNode}) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

const ReadOnly = ({label, value}: {label: string; value: string}) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-1 text-sm font-medium">{value || '—'}</p>
  </div>
);

/* ---------------------------------------------------------------- inputs */

const inputClass =
  'h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring';

const TextInput = ({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) => (
  <input
    type={type}
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={inputClass}
  />
);

const Select = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
    <option value="">Not set</option>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

/** Ordered airline preference: add from a dropdown, then reorder / remove. */
const AirlineRanking = ({
  ranking,
  onChange,
}: {
  ranking: string[];
  onChange: (ranking: string[]) => void;
}) => {
  const available = AIRLINES.filter((a) => !ranking.includes(a));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ranking.length) return;
    const next = [...ranking];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {ranking.length > 0 && (
        <ol className="space-y-2">
          {ranking.map((airline, i) => (
            <li
              key={airline}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{airline}</span>
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="rounded p-1 text-muted-foreground hover:bg-white/5 disabled:opacity-30"
                aria-label={`Move ${airline} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === ranking.length - 1}
                className="rounded p-1 text-muted-foreground hover:bg-white/5 disabled:opacity-30"
                aria-label={`Move ${airline} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(ranking.filter((a) => a !== airline))}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${airline}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...ranking, e.target.value])}
          className={inputClass}
        >
          <option value="">Add an airline…</option>
          {available.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

/**
 * A searchable single-select: type to filter a known list, click a result to
 * pick it. Used to add entries to a {@link RankedPicker}. Closes on outside
 * click or Escape; no free text (selection must come from the list).
 */
const SearchableSelect = ({
  options,
  onSelect,
  placeholder,
}: {
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the menu when focus/click moves outside the component.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const choose = (value: string) => {
    onSelect(value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          placeholder={placeholder ?? 'Search…'}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && filtered.length > 0) {
              e.preventDefault();
              choose(filtered[0]);
            }
          }}
          className={`${inputClass} pl-9`}
        />
      </div>
      {open && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
          ) : (
            filtered.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  // mousedown fires before the input's blur, so the pick registers.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary/60"
                >
                  {o}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

/**
 * Ordered preference list built from a known set of options: add via a
 * searchable dropdown, then reorder / remove. Mirrors {@link AirlineRanking}
 * but with search, for longer option lists (shopping retailers/stores).
 */
const RankedPicker = ({
  ranking,
  options,
  placeholder,
  onChange,
}: {
  ranking: string[];
  options: string[];
  placeholder?: string;
  onChange: (ranking: string[]) => void;
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
    <div className="space-y-3">
      {ranking.length > 0 && (
        <ol className="space-y-2">
          {ranking.map((item, i) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{item}</span>
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="rounded p-1 text-muted-foreground hover:bg-white/5 disabled:opacity-30"
                aria-label={`Move ${item} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === ranking.length - 1}
                className="rounded p-1 text-muted-foreground hover:bg-white/5 disabled:opacity-30"
                aria-label={`Move ${item} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(ranking.filter((x) => x !== item))}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${item}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {available.length > 0 && (
        <SearchableSelect
          options={available}
          placeholder={placeholder}
          onSelect={(v) => onChange([...ranking, v])}
        />
      )}
    </div>
  );
};

/** Pick banks from a known list (no free text); shown as removable chips. */
const BankPicker = ({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (names: string[]) => void;
}) => {
  const available = KNOWN_BANKS.filter((b) => !selected.includes(b));
  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-sm"
            >
              {name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((b) => b !== name))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
          className={inputClass}
        >
          <option value="">Add a bank…</option>
          {available.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

/** Add/remove list rendered as removable chips. */
const ChipList = ({
  items,
  placeholder,
  onAdd,
  onRemove,
}: {
  items: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v) {
      onAdd(v);
      setDraft('');
    }
  };
  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-sm"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-secondary/40 px-3 text-sm hover:bg-secondary"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- cards */

type SavedCard = ProfileDetails['cards'][number];

const cardKey = (c: SavedCard) =>
  `${c.custom ? `custom:${c.name}` : c.card_id}-${c.category}`;

const CardsEditor = ({
  held,
  catalog,
  onChange,
}: {
  held: SavedCard[];
  catalog: CardProduct[];
  onChange: (cards: SavedCard[]) => void;
}) => {
  const [category, setCategory] = useState(CARD_CATEGORIES[0]);
  const [picked, setPicked] = useState('');
  const [customName, setCustomName] = useState('');

  const byId = useMemo(() => {
    const m = new Map<string, CardProduct>();
    catalog.forEach((c) => m.set(c.id, c));
    return m;
  }, [catalog]);

  // "all" shows the whole catalog; any other category filters to cards whose
  // type matches it. The list may be empty, which is fine — the user can still
  // add a custom card.
  const matching = useMemo(
    () =>
      category === 'all'
        ? catalog
        : catalog.filter((c) => (c.card_type ?? '').toLowerCase() === category.toLowerCase()),
    [catalog, category],
  );

  // Group the selectable cards by type for a parent→child (optgroup) dropdown.
  const matchingGroups = useMemo(() => {
    const g = new Map<string, CardProduct[]>();
    matching.forEach((c) => {
      const type = c.card_type?.trim();
      const label = type ? type[0].toUpperCase() + type.slice(1) : 'Other';
      const list = g.get(label) ?? [];
      list.push(c);
      g.set(label, list);
    });
    return Array.from(g.entries());
  }, [matching]);

  // Reset the picked catalog card when the category (hence the list) changes.
  useEffect(() => setPicked(''), [category]);

  // Group held cards by category for display.
  const grouped = useMemo(() => {
    const g = new Map<string, SavedCard[]>();
    held.forEach((h) => {
      const list = g.get(h.category) ?? [];
      list.push(h);
      g.set(h.category, list);
    });
    return Array.from(g.entries());
  }, [held]);

  const addCatalog = () => {
    if (!picked) return;
    // Under "all" the picker is just a browse-everything view, so tag the card
    // with its own type instead of the literal "all".
    const product = byId.get(picked);
    const cat =
      category === 'all' ? (product?.card_type?.toLowerCase() || 'everyday') : category;
    if (held.some((h) => !h.custom && h.card_id === picked && h.category === cat)) return;
    onChange([...held, {card_id: picked, name: null, category: cat, custom: false}]);
    setPicked('');
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    if (held.some((h) => h.custom && h.name === name && h.category === category)) return;
    onChange([...held, {card_id: null, name, category, custom: true}]);
    setCustomName('');
  };

  const remove = (card: SavedCard) =>
    onChange(held.filter((h) => cardKey(h) !== cardKey(card)));

  return (
    <div className="space-y-6">
      {/* Picker: choose a category first, then a matching catalog card. */}
      <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sm:w-44">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {CARD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Card in this category
            </span>
            <div className="flex gap-2">
              <select
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                disabled={matching.length === 0}
                className={inputClass}
              >
                <option value="">
                  {matching.length === 0
                    ? category === 'all'
                      ? 'No catalog cards available'
                      : 'No catalog cards in this category'
                    : 'Choose a card…'}
                </option>
                {matchingGroups.map(([group, cards]) => (
                  <optgroup key={group} label={group}>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.issuer}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                onClick={addCatalog}
                disabled={!picked}
                className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </label>
        </div>

        {/* Escape hatch: a card not in the catalog. */}
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Not listed? Add your own
          </span>
          <div className="flex gap-2">
            <input
              value={customName}
              placeholder="Card name, e.g. Local Credit Union Visa"
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
              className={inputClass}
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!customName.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-secondary/40 px-4 text-sm hover:bg-secondary disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add custom
            </button>
          </div>
        </div>
      </div>

      {held.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <CardIcon className="mx-auto mb-2 h-6 w-6 opacity-60" />
          No cards yet. Pick a category and add one above.
        </div>
      ) : (
        grouped.map(([cat, cards]) => (
          <div key={cat}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {cat}
            </h3>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((h) => {
                const product = h.custom || !h.card_id ? undefined : byId.get(h.card_id);
                return (
                  <div
                    key={cardKey(h)}
                    className={`glass rounded-2xl p-4 ${
                      h.custom ? 'border-dashed border-primary/40' : ''
                    }`}
                  >
                    {product ? (
                      <CreditCardVisual card={product} className="max-w-[20rem]" />
                    ) : (
                      <div className="flex aspect-[1.586] w-full items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5">
                        <CardIcon className="h-7 w-7 text-muted-foreground opacity-60" />
                      </div>
                    )}
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display font-semibold leading-tight">
                          {product?.name ?? h.name ?? 'Unknown card'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product?.issuer ?? (h.custom ? 'Added by you' : 'Unknown issuer')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(h)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove card"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {h.custom && (
                      <span className="mt-2 inline-block rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-primary">
                        Custom
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
