import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Award, BookOpen, Home, Shield, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';

interface AppShellProps {
  children: ReactNode;
}

const studentNavItems = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/subjects', label: 'Subjects', icon: BookOpen, end: false },
  { to: '/app/results', label: 'Results', icon: Award, end: false },
  { to: '/app/profile', label: 'Profile', icon: User, end: false },
];

export function AppShell({ children }: AppShellProps) {
  const { user, profile, signOut, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const isAuthenticated = Boolean(user);
  const isAdmin = profile?.role === 'admin';

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header
        className={[
          'bg-white border-b border-slate-200 z-30',
          isAuthenticated ? 'md:sticky md:top-0' : 'sticky top-0',
        ].join(' ')}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element brand wordmark */}
          <Link
            to={isAuthenticated ? '/app' : '/'}
            className="text-xl font-bold tracking-tight text-phosters-700 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-phosters-600 rounded"
          >
            Phosters
          </Link>

          {/* Zone 2: Desktop single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            {isAuthenticated ? (
              <>
                {studentNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'py-1 whitespace-nowrap shrink-0 transition-colors duration-150',
                        isActive
                          ? 'text-phosters-700 font-semibold underline decoration-2 underline-offset-8'
                          : 'hover:text-slate-900',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                {isAdmin && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      [
                        'py-1 whitespace-nowrap shrink-0 transition-colors duration-150',
                        isActive
                          ? 'text-phosters-700 font-semibold underline decoration-2 underline-offset-8'
                          : 'hover:text-slate-900',
                      ].join(' ')
                    }
                  >
                    Admin
                  </NavLink>
                )}
              </>
            ) : (
              <>
                <Link
                  to="/"
                  className="py-1 whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors"
                >
                  Overview
                </Link>
                <Link
                  to="/login"
                  className="py-1 whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
              </>
            )}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="md:hidden inline-flex items-center gap-1.5 min-h-[44px] px-2.5 text-sm font-semibold text-phosters-700 hover:text-phosters-800 whitespace-nowrap shrink-0"
                  >
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    <span>Admin</span>
                  </Link>
                )}
                <Button
                  variant="secondary"
                  onClick={handleSignOut}
                  loading={signingOut}
                  className="hidden md:inline-flex"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="md:hidden inline-flex items-center justify-center min-h-[44px] px-3 text-sm font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
                >
                  Sign In
                </Link>
                {isConfigured ? (
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    Create Account
                  </Link>
                ) : (
                  <Link
                    to="/setup"
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    Setup Guide
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        className={[
          'flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8',
          isAuthenticated ? 'pb-24 md:pb-10' : '',
        ].join(' ')}
      >
        {children}
      </main>

      <footer className="hidden md:block border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-slate-500">
          <span>Phosters Tutorial Centre · JAMB UTME &amp; UI Post-UTME</span>
          <span>Lightweight mobile-first learning</span>
        </div>
      </footer>

      {/* Mobile bottom navigation bar for authenticated users */}
      {isAuthenticated && (
        <nav
          aria-label="Mobile navigation"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden pb-safe"
        >
          <div className="grid grid-cols-4 items-center h-14">
            {studentNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'flex flex-col items-center justify-center min-h-[48px] text-[11px] transition-colors',
                      isActive
                        ? 'text-phosters-700 font-semibold'
                        : 'text-slate-500 hover:text-slate-800 font-medium',
                    ].join(' ')
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="mt-0.5 leading-none">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
