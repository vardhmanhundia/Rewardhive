/**
 * Global top navigation + mobile bottom tab bar.
 * Desktop: horizontal links in the top bar.
 * Mobile: logo + auth in top bar, nav links in a fixed bottom tab bar.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, CreditCard, Wallet, User, LogOut, ChevronDown, Sparkles, MessageSquare, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const baseLinks = [{ to: '/cards', label: 'Browse', icon: CreditCard }];

export const Navbar = () => {
  const { pathname } = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  const links = isAuthenticated
    ? [
        { to: '/for-you', label: 'For You', icon: Home },
        { to: '/recommend', label: 'Chat', icon: MessageSquare },
        { to: '/which-card', label: 'Which card?', icon: Sparkles },
        { to: '/evaluate', label: 'Evaluate', icon: Wallet },
        ...baseLinks,
      ]
    : baseLinks;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-md">
        <nav className="max-w-[1400px] mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            Card<span className="text-gradient">Pilot</span>
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => {
              const active = pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/15 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Auth area — always visible */}
          <div className="flex items-center gap-1">
            <div className="hidden sm:block ml-2 h-5 w-px bg-white/10" />

            {isLoading ? (
              <div className="ml-2 h-8 w-8 animate-pulse rounded-full bg-white/10" />
            ) : isAuthenticated && user ? (
              <>
                <button
                  type="button"
                  aria-label="Notifications"
                  className="ml-2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-white/5"
                >
                  <Bell className="w-4 h-4" />
                </button>
                <UserMenu />
              </>
            ) : (
              <div className="ml-2 flex items-center gap-1.5">
                <Link
                  to="/login"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-white/5"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Mobile bottom tab bar — visible only on small screens for auth'd users */}
      {isAuthenticated && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/5 bg-background/80 backdrop-blur-md sm:hidden">
          <div className="flex items-stretch justify-around h-14 px-1">
            {links.map(({ to, label, icon: Icon }) => {
              const active = pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="truncate max-w-[64px]">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};

const UserMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className="relative ml-2" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-white/5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials || <User className="h-4 w-4" />}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="glass absolute right-0 mt-2 w-56 overflow-hidden rounded-xl p-1 shadow-xl"
        >
          <div className="border-b border-white/5 px-3 py-2.5">
            <p className="truncate text-sm font-medium">
              {user.first_name} {user.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};
