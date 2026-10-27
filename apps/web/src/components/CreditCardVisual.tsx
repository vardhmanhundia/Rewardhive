/**
 * A stylized credit-card "face" rendered from catalog data (no real card numbers).
 * Gradient is derived from the card id so each product looks distinct.
 */
import type { CardProduct } from '@/services/cardService';

const GRADIENTS = [
  'linear-gradient(135deg, hsl(252 85% 42%), hsl(258 80% 22%))',
  'linear-gradient(135deg, hsl(190 85% 38%), hsl(214 80% 22%))',
  'linear-gradient(135deg, hsl(330 75% 44%), hsl(268 75% 26%))',
  'linear-gradient(135deg, hsl(150 65% 34%), hsl(190 75% 22%))',
  'linear-gradient(135deg, hsl(32 85% 48%), hsl(14 75% 30%))',
  'linear-gradient(135deg, hsl(240 10% 32%), hsl(240 14% 14%))',
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

interface Props {
  card: CardProduct;
  className?: string;
}

export const CreditCardVisual = ({ card, className = '' }: Props) => (
  <div
    className={`relative aspect-[1.586] w-full rounded-2xl p-5 text-white overflow-hidden ${className}`}
    style={{
      backgroundImage: gradientFor(card.id),
      boxShadow: '0 20px 45px -20px hsl(252 90% 50% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.18)',
    }}
  >
    <div className="flex justify-between items-start">
      <span className="font-display text-base font-semibold leading-tight">{card.name}</span>
      <span className="text-[0.6rem] uppercase tracking-widest opacity-70">
        {card.network ?? 'Card'}
      </span>
    </div>
    <div className="card-chip mt-6 h-8 w-11 rounded-md" />
    <div className="mt-4 font-mono text-lg tracking-[0.18em]">•••• •••• •••• ••••</div>
    <div className="mt-4 flex justify-between items-end text-xs">
      <div>
        <div className="text-[0.55rem] uppercase opacity-60">Issuer</div>
        <div className="font-medium">{card.issuer}</div>
      </div>
      <div className="text-right">
        <div className="text-[0.55rem] uppercase opacity-60">Annual fee</div>
        <div className="font-medium">
          {card.annual_fee === 0 ? 'No fee' : `$${card.annual_fee}`}
        </div>
      </div>
    </div>
  </div>
);
