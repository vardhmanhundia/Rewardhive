import type { CardRewardPick } from '@/services/cardService';
import { PicksResult } from './PicksResult';

interface Props {
  picks: CardRewardPick[];
  spendBaseline?: Record<string, number>;
}

export const EvaluateResult = ({ picks, spendBaseline }: Props) => {
  if (picks.length === 0) return null;

  const totalSpend = spendBaseline
    ? Object.values(spendBaseline).reduce((a, b) => a + b, 0)
    : null;

  return (
    <div className="space-y-3">
      {totalSpend !== null && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Based on ~${totalSpend.toLocaleString()}/yr estimated spend
          </p>
        </div>
      )}
      <PicksResult picks={picks} />
    </div>
  );
};
