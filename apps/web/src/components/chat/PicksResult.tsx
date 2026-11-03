import { CreditCard } from 'lucide-react';
import type { CardRewardPick } from '@/services/cardService';

interface Props {
  picks: CardRewardPick[];
}

export const PicksResult = ({ picks }: Props) => {
  if (picks.length === 0) return null;

  return (
    <div className="space-y-2">
      {picks.map((p, i) => (
        <div
          key={p.card_id}
          className={`rounded-xl border p-3 ${
            i === 0 ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03]'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate text-sm font-semibold">{p.card_name}</span>
                {i === 0 && (
                  <span className="shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-300">
                    Best
                  </span>
                )}
                {p.specific && (
                  <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                    Special deal
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground pl-6">
                {p.rate} · {p.reward_label}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-lg font-bold tabular-nums">{p.effective_pct}%</p>
              <p className="text-xs text-muted-foreground">{p.issuer}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
