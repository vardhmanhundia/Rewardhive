/**
 * Global top navigation. Shows the card links everywhere, and reflects auth
 * state: Log in / Sign up when signed out, an avatar + dropdown when signed in.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, CreditCard, Wallet, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const baseLinks = [{ to: '/cards', label: 'Browse cards', icon: CreditCard }];

export const Navbar = () => {
  const { pathname } = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Signed-in users get a Home link to their summary page, and the logo takes
  // them there rather than to the marketing landing.
  const links = isAuthenticated
    ? [
        { to: '/for-you', label: 'My Space', icon: Home },
        { to: '/evaluate', label: 'Evaluate', icon: Wallet },
        ...baseLinks,
      ]
    : baseLinks;

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14">
        <Link to="/" className="font-display text-lg font-bold tracking-tight">
          Card<span className="text-gradient">Agent</span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/15 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}

          <div className="ml-2 h-5 w-px bg-white/10" />

          {isLoading ? (
            <div className="ml-2 h-8 w-8 animate-pulse rounded-full bg-white/10" />
          ) : isAuthenticated && user ? (
            <UserMenu />
          ) : (
            <div className="ml-2 flex items-center gap-1.5">
              <Link
                to="/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-white/5"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

const UserMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
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
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};
