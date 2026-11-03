import { Sparkles, CreditCard, Check } from 'lucide-react';
import { CardTile } from '@/components/CardTile';
import type { CardProduct } from '@/services/cardService';

interface Props {
  cards: CardProduct[];
  done: boolean;
  busy: boolean;
  addedCardIds: Set<string>;
  onEvaluate: (cardId: string) => void;
  onAddCard: (cardId: string, cardName: string) => void;
}

export const RecommendResult = ({ cards, done, busy, addedCardIds, onEvaluate, onAddCard }: Props) => {
  if (cards.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <div key={card.id} className="flex flex-col">
          <CardTile card={card} />
          {done && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onEvaluate(card.id)}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                Is this worth it?
              </button>
              {addedCardIds.has(card.id) ? (
                <span className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/20 px-3 py-2 text-xs font-medium text-green-400">
                  <Check className="h-3 w-3" />
                  Added
                </span>
              ) : (
                <button
                  onClick={() => onAddCard(card.id, card.name)}
                  disabled={busy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-300 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                >
                  <CreditCard className="h-3 w-3" />
                  I got this card
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
