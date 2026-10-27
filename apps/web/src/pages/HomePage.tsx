/**
 * Home page with Tailwind CSS
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';

export const HomePage = () => {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-glow text-foreground">
      <Navbar />
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
          {/* Copy */}
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Powered by AI agents
            </div>
            <div className="space-y-5">
              <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
                Your wallet,
                <br />
                <span className="text-gradient">managed by AI</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                Add, organize, and understand your cards through a single
                natural-language command. No forms, just conversation.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {isAuthenticated ? (
                <>
                  <Link to="/recommend">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/30">
                      Get a recommendation →
                    </Button>
                  </Link>
                  <Link to="/cards">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/15 bg-white/5 hover:bg-white/10">
                      Browse cards
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/signup">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/30">
                      Get Started →
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
          </div>

          {/* Floating card visual */}
          <div className="relative flex justify-center lg:justify-end py-8">
            <div className="animate-float card-face relative w-[22rem] max-w-full aspect-[1.586] rounded-2xl p-6 text-white">
              <div className="flex justify-between items-start">
                <span className="font-display text-lg font-semibold tracking-tight">
                  Card Agent
                </span>
                <span className="text-xs uppercase tracking-widest opacity-70">
                  Virtual
                </span>
              </div>
              <div className="card-chip mt-8 h-9 w-12 rounded-md" />
              <div className="mt-5 font-mono text-xl tracking-[0.2em]">
                4242 •••• •••• 1337
              </div>
              <div className="mt-6 flex justify-between items-end text-sm">
                <div>
                  <div className="text-[0.6rem] uppercase opacity-60">Card Holder</div>
                  <div className="font-medium">A. Developer</div>
                </div>
                <div>
                  <div className="text-[0.6rem] uppercase opacity-60">Expires</div>
                  <div className="font-medium">11/27</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            emoji="💬"
            title="Just Ask"
            description="“Add my Amex ending 1337, expires 11/27.” The agent parses it and files the card for you."
          />
          <FeatureCard
            emoji="⚡"
            title="AI Analysis"
            description="LangGraph workflows surface insights, spot duplicates, and flag cards about to expire."
          />
          <FeatureCard
            emoji="🔐"
            title="Secure by Design"
            description="Credentials are hashed, sessions are token-based, and your data stays yours."
          />
        </div>
      </div>

      {/* Trust Section */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <StatCard number="⌘K" label="Command-bar workflow" />
            <StatCard number="Real-time" label="Streaming agent steps" />
            <StatCard number="0 forms" label="Natural-language input" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface FeatureCardProps {
  emoji: string;
  title: string;
  description: string;
}

const FeatureCard = ({ emoji, title, description }: FeatureCardProps) => (
  <div className="glass rounded-2xl p-7 transition-all hover:-translate-y-1 hover:border-primary/40">
    <div className="text-3xl mb-4">{emoji}</div>
    <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);

interface StatCardProps {
  number: string;
  label: string;
}

const StatCard = ({ number, label }: StatCardProps) => (
  <div>
    <p className="font-display text-3xl font-bold text-gradient">{number}</p>
    <p className="text-sm text-muted-foreground mt-2">{label}</p>
  </div>
);
