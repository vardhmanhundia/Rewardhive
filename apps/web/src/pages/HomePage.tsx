/**
 * Marketing landing (route: /). Viewable by everyone; its calls-to-action adapt
 * to whether the visitor is signed in.
 *
 * Sells what the app actually does: describe how you spend in plain language and
 * it recommends a card from a real catalog, retrieval-augmented and explained,
 * learning your preferences as you go. Built on the existing dark design system.
 */
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Search,
  FileText,
  CreditCard,
  MessageSquare,
  Layers,
  Users,
  Share2,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';

const ISSUERS = ['Chase', 'American Express', 'Capital One', 'Bank of America'];

export const HomePage = () => {
  // The landing is viewable by everyone; its calls-to-action adapt to whether
  // the visitor is signed in (login still routes to the /for-you page).
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-glow text-foreground">
      <Navbar />

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-28">
          {/* Copy */}
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Powered by Meta Muse
            </div>
            <div className="space-y-5">
              <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
                The right card,
                <br />
                <span className="text-gradient">from how you spend</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                Which card should I get? Which should I use? Is this one worth it?
                Ask in plain language — the assistant searches a real catalog,
                optimizes your wallet, and explains every pick.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {isAuthenticated ? (
                <>
                  <Link to="/for-you">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/30">
                      Go to My Space →
                    </Button>
                  </Link>
                  <Link to="/recommend">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/15 bg-white/5 hover:bg-white/10">
                      Ask for a recommendation
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/signup">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/30">
                      Find my card →
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/15 bg-white/5 hover:bg-white/10">
                      Log in
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              No forms · multi-turn chat · wallet optimizer · shared plans
            </p>
          </div>

          {/* Product preview: a real recommendation exchange */}
          <HeroPreview />
        </div>

        {/* How it works */}
        <section className="mb-28">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold tracking-tight">
              How it <span className="text-gradient">works</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              From question to answer in seconds — no applications, no credit quiz.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Step
              n={1}
              title="Describe how you spend"
              description="“I travel a few times a year and eat out a lot.” Plain language — no categories to tick, no forms to fill."
            />
            <Step
              n={2}
              title="It searches the catalog"
              description="The assistant searches a real catalog of credit cards and finds the ones that actually match your spending patterns."
            />
            <Step
              n={3}
              title="Get a pick, and the why"
              description="A grounded recommendation with the trade-offs laid out — fees, rewards, intro offers — so you decide with confidence."
            />
          </div>
        </section>

        {/* Features */}
        <section className="mb-28">
          {/* Highlighted shared plans banner */}
          <div className="mb-6 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-7 transition-all hover:-translate-y-1 hover:border-primary/40">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4 shrink-0">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                  <Users className="h-7 w-7" />
                </span>
                <div className="md:hidden">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">Share plans with anyone</h3>
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-semibold text-primary uppercase tracking-wider">New</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Collaborate on card decisions together.</p>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="hidden md:flex items-center gap-2 mb-1">
                  <h3 className="font-display text-lg font-semibold">Share plans with anyone</h3>
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-semibold text-primary uppercase tracking-wider">New</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground hidden md:block">
                  Found the perfect card? Share your conversation with a partner, friend, or family member. They can view your picks, add the thread to their own chats, and continue the conversation from where you left off.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
                  <Share2 className="h-3.5 w-3.5 text-primary" />
                  Share by link or email
                </div>
                <Link to={isAuthenticated ? '/recommend' : '/signup'}>
                  <Button size="sm" className="shadow-md shadow-primary/20">
                    Try it →
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={MessageSquare}
              title="A conversation, not a quiz"
              description="Ask in plain language and refine with follow-ups. The assistant keeps the thread so each answer builds on the last."
            />
            <FeatureCard
              icon={BarChart3}
              title="Card evaluator"
              description="Wondering if a card is worth it? Compare your current wallet against adding it — with real numbers on rewards, fees, and net value."
            />
            <FeatureCard
              icon={Wallet}
              title="Wallet optimizer"
              description="Already have cards? The assistant tells you which one to use for each purchase to maximize your rewards."
            />
            <FeatureCard
              icon={Layers}
              title="Grounded in a real catalog"
              description="Every recommendation comes from actual card products — never invented. Browse the same catalog the assistant draws on."
            />
            <FeatureCard
              icon={FileText}
              title="Explains every pick"
              description="You see the reasoning — why this card, what it costs, where it wins — not just a name dropped on you."
            />
            <FeatureCard
              icon={Sparkles}
              title="Learns your preferences"
              description="It remembers what matters to you — travel, fee tolerance, the categories you spend on — and personalizes what comes next."
            />
          </div>
        </section>

        {/* Catalog strip */}
        <section className="mb-24">
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Cards from the issuers you know
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {ISSUERS.map((issuer) => (
                <span
                  key={issuer}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium"
                >
                  {issuer}
                </span>
              ))}
            </div>
            <Link
              to="/cards"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <CreditCard className="h-4 w-4" />
              Browse the full catalog →
            </Link>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to optimize <span className="text-gradient">your wallet?</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Find the right card, use the right card, and share your plan — all in one place.
          </p>
          <Link to={isAuthenticated ? '/recommend' : '/signup'} className="mt-6 inline-block">
            <Button size="lg" className="shadow-lg shadow-primary/30">
              {isAuthenticated ? 'Ask the assistant →' : 'Get started →'}
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
};

/** A static mock of the recommendation flow — the product, not a stock card. */
const HeroPreview = () => (
  <div className="relative mx-auto w-full max-w-md">
    {/* Soft glow behind the panel */}
    <div className="absolute -inset-4 rounded-[2rem] bg-primary/10 blur-2xl" aria-hidden />
    <div className="glass relative space-y-4 rounded-3xl p-5 shadow-2xl shadow-black/40">
      {/* User asks */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          I travel a few times a year and eat out a lot
        </div>
      </div>

      {/* Pipeline line */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5 text-primary" />
        Found 3 matching cards
      </div>

      {/* Assistant answers */}
      <div className="glass rounded-2xl rounded-tl-sm p-4 text-sm leading-relaxed">
        <span className="text-foreground">Chase Sapphire Preferred</span> is the
        strongest fit — strong dining and travel rewards for a modest annual fee,
        with no foreign transaction fees abroad.
      </div>

      {/* Recommended card chip */}
      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <CreditCard className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Chase Sapphire Preferred®</p>
          <p className="text-xs text-muted-foreground">Travel · 3x dining · $95/yr</p>
        </div>
        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
          Top pick
        </span>
      </div>

      {/* Follow-up suggestions */}
      <div className="flex flex-wrap gap-2">
        {['No annual fee instead?', 'More cash back?'].map((s) => (
          <span
            key={s}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  </div>
);

interface StepProps {
  n: number;
  title: string;
  description: string;
}

const Step = ({ n, title, description }: StepProps) => (
  <div className="glass rounded-2xl p-7">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 font-display text-lg font-bold text-primary">
      {n}
    </span>
    <h3 className="font-display text-lg font-semibold mt-4 mb-2">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => (
  <div className="glass rounded-2xl p-7 transition-all hover:-translate-y-1 hover:border-primary/40">
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
      <Icon className="h-5 w-5" />
    </span>
    <h3 className="font-display text-lg font-semibold mt-4 mb-2">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);
