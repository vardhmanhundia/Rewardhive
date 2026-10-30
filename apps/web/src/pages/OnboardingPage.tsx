/**
 * First-run onboarding stepper. New users are sent here right after signup to
 * fill in the profile details that power card recommendations. Every step is
 * optional: the user can skip any single step or bail out of the whole flow
 * with "Skip for now". Whatever has been entered so far is saved (partial PUT)
 * both when a step is skipped-to-finish and when the flow is completed.
 *
 * The data model and option sets are shared with the full ProfilePage; this is
 * just a guided, one-field-group-at-a-time way to enter the same thing.
 */
import {useMemo, useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {useMutation} from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  SkipForward,
} from 'lucide-react';
import {useAuth} from '@/context/AuthContext';
import profileService, {type ProfileDetails} from '@/services/profileService';
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
  type Option,
} from '@/data/profileOptions';

const EMPTY: ProfileDetails = {
  occupation: null,
  company: null,
  relationship_status: null,
  family_size: null,
  location_state: null,
  location_country: DEFAULT_COUNTRY,
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

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const {user} = useAuth();

  const [form, setForm] = useState<ProfileDetails>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);

  const set = <K extends keyof ProfileDetails>(key: K, value: ProfileDetails[K]) =>
    setForm((prev) => ({...prev, [key]: value}));

  const mutation = useMutation({
    mutationFn: (payload: ProfileDetails) => profileService.updateDetails(payload),
    onSuccess: () => navigate('/'),
  });

  // A step is just a title/subtitle plus the fields it renders. Order matters:
  // lighter identity questions first, richer preference lists later.
  const steps = useMemo(
    () => [
      {
        title: 'About you',
        subtitle: 'The basics. These help us match cards to your situation.',
        render: () => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                placeholder="e.g. Acme Corp"
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
          </div>
        ),
      },
      {
        title: 'Lifestyle & status',
        subtitle: 'Your living situation and residency, for perk eligibility.',
        render: () => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        ),
      },
      {
        title: 'Travel',
        subtitle: 'How you fly, so travel rewards actually fit you.',
        render: () => (
          <div className="space-y-5">
            <Field label="Travel style">
              <Select
                value={form.travel_preference ?? ''}
                options={TRAVEL_OPTIONS}
                onChange={(v) => set('travel_preference', v || null)}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Airline ranking
              </p>
              <p className="mb-3 text-sm text-muted-foreground">
                Add airlines in order of preference — most preferred at the top.
              </p>
              <Ranking
                ranking={form.airline_ranking}
                options={AIRLINES}
                addLabel="Add an airline…"
                onChange={(r) => set('airline_ranking', r)}
              />
            </div>
          </div>
        ),
      },
      {
        title: 'Shopping',
        subtitle: 'Where you spend most, to match store-specific rewards.',
        render: () => (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Online shopping
              </p>
              <Ranking
                ranking={form.online_shopping_ranking}
                options={ONLINE_SHOPPING}
                addLabel="Add a retailer…"
                onChange={(r) => set('online_shopping_ranking', r)}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Offline shopping
              </p>
              <Ranking
                ranking={form.offline_shopping_ranking}
                options={OFFLINE_SHOPPING}
                addLabel="Add a store…"
                onChange={(r) => set('offline_shopping_ranking', r)}
              />
            </div>
          </div>
        ),
      },
      {
        title: 'Banks & goals',
        subtitle: 'Who you bank with and what you want from your cards.',
        render: () => (
          <div className="space-y-6">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Banks you use
              </p>
              <BankPicker
                selected={form.banks.map((b) => b.name)}
                onChange={(names) => set('banks', names.map((name) => ({name})))}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Goals
              </p>
              <ChipList
                items={form.goals.map((g) => g.text)}
                placeholder="Add a goal (e.g. build credit, travel rewards)…"
                onAdd={(text) => set('goals', [...form.goals, {text}])}
                onRemove={(i) =>
                  set('goals', form.goals.filter((_, idx) => idx !== i))
                }
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Loans
              </p>
              <ChipList
                items={form.loans.map((l) => l.loan_type)}
                placeholder="Add a loan type (e.g. mortgage, auto, student)…"
                onAdd={(loan_type) => set('loans', [...form.loans, {loan_type}])}
                onRemove={(i) =>
                  set('loans', form.loans.filter((_, idx) => idx !== i))
                }
              />
            </div>
          </div>
        ),
      },
    ],
    [form],
  );

  const isLast = stepIndex === steps.length - 1;
  const step = steps[stepIndex];

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  // Finish the flow: persist whatever has been entered and head home. Used by
  // both "Finish" on the last step and "Skip for now" from anywhere.
  const finish = () => mutation.mutate(form);

  return (
    <div className="min-h-screen bg-glow text-foreground">
      <header className="border-b border-white/5 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            Card<span className="text-gradient">Agent</span>
          </Link>
          <button
            onClick={finish}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            <SkipForward className="h-4 w-4" />
            Skip for now
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-2">
          <p className="text-sm text-muted-foreground">
            Welcome{user?.first_name ? `, ${user.first_name}` : ''} 👋
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Set up your profile
          </h1>
          <p className="mt-1 text-muted-foreground">
            A few quick questions so recommendations fit your life. You can skip
            anything and change it later.
          </p>
        </div>

        <Stepper
          steps={steps.map((s) => s.title)}
          current={stepIndex}
          onJump={setStepIndex}
        />

        <section className="glass mt-6 rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="font-display text-xl font-semibold">{step.title}</h2>
            <p className="text-sm text-muted-foreground">{step.subtitle}</p>
          </div>
          {step.render()}
        </section>

        {mutation.isError && (
          <p className="mt-4 text-sm text-destructive">
            Couldn’t save: {(mutation.error as Error).message}
          </p>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            disabled={stepIndex === 0 || mutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={goNext}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                Skip
              </button>
            )}
            {isLast ? (
              <button
                onClick={finish}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {mutation.isPending ? 'Saving…' : 'Finish'}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

/* --------------------------------------------------------------- stepper */

const Stepper = ({
  steps,
  current,
  onJump,
}: {
  steps: string[];
  current: number;
  onJump: (index: number) => void;
}) => (
  <div className="flex items-center gap-2">
    {steps.map((title, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <div key={title} className="flex flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => onJump(i)}
            className="flex items-center gap-2"
            aria-label={`Go to step ${i + 1}: ${title}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : done
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary/50 text-muted-foreground'
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={`hidden text-sm font-medium sm:inline ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {title}
            </span>
          </button>
          {i < steps.length - 1 && (
            <span className="h-px flex-1 bg-border" aria-hidden />
          )}
        </div>
      );
    })}
  </div>
);

/* ---------------------------------------------------------------- inputs */

const inputClass =
  'h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring';

const Field = ({label, children}: {label: string; children: React.ReactNode}) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

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

/** Ordered preference list: add from a dropdown, then reorder / remove. */
const Ranking = ({
  ranking,
  options,
  addLabel,
  onChange,
}: {
  ranking: string[];
  options: string[];
  addLabel: string;
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
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...ranking, e.target.value])}
          className={inputClass}
        >
          <option value="">{addLabel}</option>
          {available.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
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

/** Add/remove free-text list rendered as removable chips. */
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
          Add
        </button>
      </div>
    </div>
  );
};
