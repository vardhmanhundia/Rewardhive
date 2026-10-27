/**
 * Full detail view for a single card.
 */
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CreditCardVisual } from '@/components/CreditCardVisual';
import cardService from '@/services/cardService';

export const CardDetailPage = () => {
  const { id = '' } = useParams();
  const { data: card, isLoading, isError } = useQuery({
    queryKey: ['card', id],
    queryFn: () => cardService.getCard(id),
    enabled: !!id,
  });

  return (
    <div className="min-h-screen bg-glow text-foreground">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <Link
          to="/cards"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all cards
        </Link>

        {isLoading && <div className="glass h-80 animate-pulse rounded-2xl" />}
        {isError && <p className="text-destructive">Card not found.</p>}

        {card && (
          <div className="grid gap-8 md:grid-cols-[22rem_1fr]">
            {/* Left: visual + quick facts */}
            <div className="space-y-5">
              <CreditCardVisual card={card} />
              <dl className="glass space-y-3 rounded-2xl p-5 text-sm">
                <Fact label="Issuer" value={card.issuer} />
                <Fact label="Network" value={card.network} />
                <Fact
                  label="Annual fee"
                  value={card.annual_fee === 0 ? 'No annual fee' : `$${card.annual_fee}`}
                />
                <Fact label="APR" value={card.apr} />
                <Fact
                  label="Foreign tx fee"
                  value={
                    card.foreign_transaction_fee === 0
                      ? 'None'
                      : card.foreign_transaction_fee != null
                        ? `${card.foreign_transaction_fee}%`
                        : undefined
                  }
                />
                <Fact label="Credit needed" value={card.credit_score_required} />
              </dl>
            </div>

            {/* Right: narrative */}
            <div className="space-y-8">
              <div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                  {card.card_type ?? 'Card'}
                </span>
                <h1 className="font-display mt-3 text-3xl font-bold tracking-tight">
                  {card.name}
                </h1>
                {card.summary && (
                  <p className="mt-3 text-muted-foreground leading-relaxed">{card.summary}</p>
                )}
              </div>

              {card.intro_offer && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Intro offer
                  </p>
                  <p className="mt-1 text-sm">{card.intro_offer}</p>
                </div>
              )}

              {card.rewards.length > 0 && (
                <Section title="Rewards">
                  <div className="divide-y divide-white/5">
                    {card.rewards.map((r) => (
                      <div key={r.category} className="flex items-center justify-between py-2">
                        <span className="text-sm text-muted-foreground">{r.category}</span>
                        <span className="font-display font-semibold text-gradient">{r.rate}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Benefits">
                <ul className="space-y-2">
                  {card.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const Fact = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  ) : null;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="glass rounded-2xl p-5">
    <h2 className="font-display mb-3 text-lg font-semibold">{title}</h2>
    {children}
  </div>
);
