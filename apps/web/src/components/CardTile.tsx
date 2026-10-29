/**
 * Compact catalog tile: the "basic info" view of a card in the browse grid
 * and in recommendation results. Links to the full detail page.
 */
import { Link } from 'react-router-dom';
import { CreditCardVisual } from '@/components/CreditCardVisual';
import type { CardProduct } from '@/services/cardService';

interface Props {
  card: CardProduct;
  /** Optional rate badge shown over the card art, e.g. "3%". */
  badge?: string;
  /** Emphasize this tile (ring + "Top pick" tag) — used by the best-card explorer. */
  highlight?: boolean;
}

export const CardTile = ({ card, badge, highlight = false }: Props) => {
  const topReward = card.rewards[0];

  return (
    <Link
      to={`/cards/${card.id}`}
      className={`glass group relative flex flex-col rounded-2xl p-4 transition-all hover:-translate-y-1 hover:border-primary/40 ${
        highlight ? 'ring-2 ring-primary/60' : ''
      }`}
    >
      {highlight && (
        <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-primary px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-primary-foreground shadow-lg">
          Top pick
        </span>
      )}
      {badge && (
        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur">
          {badge}
        </span>
      )}
      <CreditCardVisual card={card} className="max-w-[20rem]" />

      <div className="mt-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-semibold leading-tight">{card.name}</h3>
          <p className="text-xs text-muted-foreground">{card.issuer}</p>
        </div>
        {card.card_type && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            {card.card_type}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="text-foreground font-medium">
            {card.annual_fee === 0 ? 'No annual fee' : `$${card.annual_fee}`}
          </span>
          {card.annual_fee !== 0 && ' / yr'}
        </span>
        {topReward && (
          <span>
            <span className="text-foreground font-medium">{topReward.rate}</span>{' '}
            {topReward.category.toLowerCase()}
          </span>
        )}
      </div>

      {card.summary && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {card.summary}
        </p>
      )}

      <span className="mt-3 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        View details →
      </span>
    </Link>
  );
};
