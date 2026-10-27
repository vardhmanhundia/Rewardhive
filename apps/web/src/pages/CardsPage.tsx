/**
 * Browse the full card catalog with client-side search, filter, and sort.
 * This is the "show basic info of available cards" view.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CardTile } from '@/components/CardTile';
import cardService, { type CardProduct } from '@/services/cardService';

type SortKey = 'name' | 'fee-asc' | 'fee-desc';
type TierKey = 'all' | 'none' | 'mid' | 'premium';

/** Group cards by "premiumness" using the annual fee. */
function tierOf(fee: number): Exclude<TierKey, 'all'> {
  if (fee === 0) return 'none';
  if (fee < 250) return 'mid';
  return 'premium';
}

const TIER_LABELS: Record<Exclude<TierKey, 'all'>, string> = {
  none: 'No annual fee',
  mid: 'Mid-tier (under $250)',
  premium: 'Premium ($250+)',
};

export const CardsPage = () => {
  const { data: cards, isLoading, isError } = useQuery({
    queryKey: ['cards'],
    queryFn: () => cardService.getAllCards(),
  });

  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
  const [issuer, setIssuer] = useState<string>('all');
  const [tier, setTier] = useState<TierKey>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const types = useMemo(() => {
    const set = new Set<string>();
    cards?.forEach((c) => c.card_type && set.add(c.card_type));
    return Array.from(set).sort();
  }, [cards]);

  const issuers = useMemo(() => {
    const set = new Set<string>();
    cards?.forEach((c) => set.add(c.issuer));
    return Array.from(set).sort();
  }, [cards]);

  const visible = useMemo(() => {
    let list: CardProduct[] = cards ? [...cards] : [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.name, c.issuer, c.summary, ...c.benefits].join(' ').toLowerCase().includes(q),
      );
    }
    if (type !== 'all') list = list.filter((c) => c.card_type === type);
    if (issuer !== 'all') list = list.filter((c) => c.issuer === issuer);
    if (tier !== 'all') list = list.filter((c) => tierOf(c.annual_fee) === tier);
    list.sort((a, b) => {
      if (sort === 'fee-asc') return a.annual_fee - b.annual_fee;
      if (sort === 'fee-desc') return b.annual_fee - a.annual_fee;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [cards, search, type, issuer, tier, sort]);

  return (
    <div className="min-h-screen bg-glow text-foreground">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight">Available cards</h1>
          <p className="text-muted-foreground mt-1">
            Browse the catalog the assistant draws on when it makes a recommendation.
          </p>
        </div>

        {/* Controls */}
        <div className="glass mb-8 flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards, perks, issuers…"
              className="h-10 w-full rounded-md border border-input bg-background/60 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All companies</option>
            {issuers.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>

          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as TierKey)}
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All tiers</option>
            <option value="none">{TIER_LABELS.none}</option>
            <option value="mid">{TIER_LABELS.mid}</option>
            <option value="premium">{TIER_LABELS.premium}</option>
          </select>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="name">Sort: Name</option>
            <option value="fee-asc">Fee: low to high</option>
            <option value="fee-desc">Fee: high to low</option>
          </select>
        </div>

        {/* Grid */}
        {isLoading && <SkeletonGrid />}
        {isError && (
          <p className="text-destructive">Couldn't load cards. Is the backend running?</p>
        )}
        {cards && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {visible.length} {visible.length === 1 ? 'card' : 'cards'}
            </p>
            {visible.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
                No cards match those filters.
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((card) => (
                  <CardTile key={card.id} card={card} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const SkeletonGrid = () => (
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="glass h-72 animate-pulse rounded-2xl" />
    ))}
  </div>
);
