import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Calculator,
  Clock,
  FileText,
  HardDrive,
  Home,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Settings,
  Shield,
  SlidersHorizontal,
  Sun,
  Target,
  User,
  UserPlus,
  Wifi,
  X,
} from 'lucide-react';
import { LEGAL_CONTACT_EMAIL, LEGAL_DOCUMENTS } from '../../data/legalPolicies';
import { useAuth } from '../../hooks/useAuth';
import { useDataSaver } from '../../hooks/useDataSaver';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useTheme, type ThemeMode } from '../../hooks/useTheme';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { Button } from '../ui/Button';

interface AppShellProps {
  children: ReactNode;
}

const studentNavItems = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/subjects', label: 'Subjects', icon: BookOpen, end: false },
  { to: '/app/mocks', label: 'Mocks', icon: Clock, end: false },
  { to: '/app/results', label: 'Results', icon: Award, end: false },
  { to: '/app/profile', label: 'Profile', icon: User, end: false },
];

const themeChoices: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: Monitor },
];

export function AppShell({ children }: AppShellProps) {
  const { user, profile, signOut, isConfigured } = useAuth();
  const { dataLite, toggleDataLite } = useDataSaver();
  const { pendingCount } = useOfflineSync();
  const { isInstalled } = usePWAInstall();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isAuthenticated = Boolean(user);
  const isAdmin = profile?.role === 'admin';
  const isChurchSite =
    location.pathname === '/ministries' || location.pathname === '/church';
  const isSettingsActive =
    location.pathname === '/settings' || location.pathname.startsWith('/legal');

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    setDrawerOpen(false);
    await signOut();
    setSigningOut(false);
    navigate('/login');
  }

  if (isChurchSite) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header
        className={[
          'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-30',
          isAuthenticated ? 'md:sticky md:top-0' : 'sticky top-0',
        ].join(' ')}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Zone 1: Brand mark & wordmark */}
          <Link
            to={isAuthenticated ? '/app' : '/'}
            className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-phosters-700 dark:text-phosters-400 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-phosters-600 rounded"
          >
            <img
              src="/src/assets/images/phosters_logo_1795220277630.jpg"
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-md object-contain bg-white border border-slate-200 dark:border-slate-700"
            />
            <span>Phosters</span>
          </Link>

          {/* Zone 2: Desktop single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
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
                          ? 'text-phosters-700 dark:text-phosters-400 font-semibold underline decoration-2 underline-offset-8'
                          : 'hover:text-slate-900 dark:hover:text-white',
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
                          ? 'text-phosters-700 dark:text-phosters-400 font-semibold underline decoration-2 underline-offset-8'
                          : 'hover:text-slate-900 dark:hover:text-white',
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
                  className="py-1 whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Overview
                </Link>
                <Link
                  to="/login"
                  className="py-1 whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Sign In
                </Link>
              </>
            )}
          </nav>

          {/* Zone 3: Install CTA, Auth action, Settings gear icon & Hamburger menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden sm:flex">
              <PWAInstallButton variant="header" />
            </div>

            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="md:hidden inline-flex items-center gap-1 min-h-[44px] px-2 text-sm font-semibold text-phosters-700 dark:text-phosters-400 hover:text-phosters-800 dark:hover:text-phosters-300 whitespace-nowrap shrink-0"
                  >
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden xs:inline">Admin</span>
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
              <div className="flex items-center gap-1.5">
                <Link
                  to="/login"
                  className="hidden sm:inline-flex md:hidden items-center justify-center min-h-[44px] px-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0"
                >
                  Sign In
                </Link>
                {isConfigured ? (
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center min-h-[40px] px-3 sm:px-4 py-1.5 rounded-lg bg-phosters-600 text-white text-xs sm:text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    Create Account
                  </Link>
                ) : (
                  <Link
                    to="/setup"
                    className="inline-flex items-center justify-center min-h-[40px] px-3 sm:px-4 py-1.5 rounded-lg bg-phosters-600 text-white text-xs sm:text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    Setup Guide
                  </Link>
                )}
              </div>
            )}

            <Link
              to="/settings"
              aria-label="Settings"
              title="Settings & legal policies"
              className={[
                'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors cursor-pointer shrink-0',
                isSettingsActive
                  ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-700 dark:text-phosters-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
              ].join(' ')}
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>

            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls="app-navigation-drawer"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Hamburger navigation drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
          />

          <aside
            id="app-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative z-10 w-full max-w-xs h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <img
                  src="/src/assets/images/phosters_logo_1795220277630.jpg"
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-md object-contain bg-white border border-slate-200 dark:border-slate-700"
                />
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Phosters Menu
                </span>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-6">
              {/* Quick Appearance Switcher */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Appearance
                </p>
                <div
                  role="radiogroup"
                  aria-label="Theme switcher"
                  className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
                >
                  {themeChoices.map((choice) => {
                    const Icon = choice.icon;
                    const active = theme === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTheme(choice.value)}
                        className={[
                          'inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                          active
                            ? 'bg-white dark:bg-slate-900 text-phosters-700 dark:text-phosters-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                        ].join(' ')}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{choice.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Data-Lite Toggle */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Mobile Data Saver
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dataLite}
                  onClick={toggleDataLite}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-3 min-h-[44px] rounded-xl border text-left transition-colors cursor-pointer',
                    dataLite
                      ? 'border-phosters-600 bg-phosters-50 dark:bg-phosters-900/40 text-phosters-800 dark:text-phosters-300'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2.5 text-xs font-semibold">
                    <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Data-Lite Mode</span>
                  </span>
                  <span className="text-xs font-bold tabular-nums">
                    {dataLite ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Navigation Links */}
              <nav aria-label="Drawer navigation" className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 pb-1">
                  Navigation
                </p>
                {isAuthenticated ? (
                  <>
                    {studentNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            [
                              'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                            ].join(' ')
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                    <NavLink
                      to="/app/offline"
                      className={({ isActive }) =>
                        [
                          'flex items-center justify-between gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                        ].join(' ')
                      }
                    >
                      <span className="flex items-center gap-3">
                        <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Offline Study</span>
                      </span>
                      {pendingCount > 0 && (
                        <span className="text-xs font-semibold text-phosters-700 dark:text-phosters-400 tabular-nums">
                          {pendingCount} queued
                        </span>
                      )}
                    </NavLink>
                    <NavLink
                      to="/app/missed-questions"
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                        ].join(' ')
                      }
                    >
                      <Target className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Missed Questions Drill</span>
                    </NavLink>
                    <NavLink
                      to="/app/admission-guide"
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                        ].join(' ')
                      }
                    >
                      <Calculator className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>UI Aggregate &amp; Combos</span>
                    </NavLink>
                    <NavLink
                      to="/app/setup-exams"
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                        ].join(' ')
                      }
                    >
                      <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Exams &amp; Subjects</span>
                    </NavLink>
                    {isAdmin && (
                      <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                          [
                            'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                              : 'text-phosters-700 dark:text-phosters-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                          ].join(' ')
                        }
                      >
                        <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Admin Workspace</span>
                      </NavLink>
                    )}
                  </>
                ) : (
                  <>
                    <NavLink
                      to="/"
                      end
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                        ].join(' ')
                      }
                    >
                      <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Overview</span>
                    </NavLink>
                    <NavLink
                      to="/login"
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                        ].join(' ')
                      }
                    >
                      <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Sign In</span>
                    </NavLink>
                    {isConfigured ? (
                      <NavLink
                        to="/signup"
                        className={({ isActive }) =>
                          [
                            'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                          ].join(' ')
                        }
                      >
                        <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Create Account</span>
                      </NavLink>
                    ) : (
                      <NavLink
                        to="/setup"
                        className="flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Setup Guide</span>
                      </NavLink>
                    )}
                  </>
                )}

                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                    ].join(' ')
                  }
                >
                  <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Settings</span>
                </NavLink>
              </nav>

              {/* Legal & Policies inside Drawer (accessible in both PWA and Website) */}
              <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 pb-1">
                  Legal &amp; Policies
                </p>
                {LEGAL_DOCUMENTS.map((doc) => (
                  <NavLink
                    key={doc.slug}
                    to={`/legal/${doc.slug}`}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 px-3 min-h-[40px] rounded-lg text-xs sm:text-sm transition-colors',
                        isActive
                          ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                      ].join(' ')
                    }
                  >
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span>{doc.title}</span>
                  </NavLink>
                ))}
              </div>

              <PWAInstallButton variant="card" />
            </div>

            {isAuthenticated && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={handleSignOut}
                  loading={signingOut}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>Sign Out</span>
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}

      <OfflineIndicator />

      <main
        className={[
          'flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8',
          isAuthenticated && isInstalled ? 'pb-24 md:pb-10' : '',
        ].join(' ')}
      >
        {children}
      </main>

      {/* Website-only footer (omitted automatically when installed as standalone PWA) */}
      {!isInstalled && (
        <footer
          className={[
            'border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
            isAuthenticated ? 'pb-20 md:pb-0' : '',
          ].join(' ')}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="sm:col-span-2 space-y-2.5">
                <div className="inline-flex items-center gap-2 text-base font-bold text-phosters-700 dark:text-phosters-400">
                  <img
                    src="/src/assets/images/phosters_logo_1795220277630.jpg"
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-md object-contain bg-white border border-slate-200 dark:border-slate-700"
                  />
                  <span>Phosters Tutorial Centre</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
                  Structured video lectures, study notes, and CBT practice simulations for Nigerian students preparing for JAMB UTME and University of Ibadan (UI) Post-UTME. Independent tutorial platform not affiliated with JAMB or UI.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Contact:{' '}
                  <a
                    href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                    className="font-medium text-phosters-700 dark:text-phosters-400 hover:underline"
                  >
                    {LEGAL_CONTACT_EMAIL}
                  </a>
                </p>
              </div>

              <div className="space-y-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Platform
                </h2>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  <li>
                    <Link to={isAuthenticated ? '/app' : '/'} className="hover:text-phosters-700 dark:hover:text-phosters-400 transition-colors">
                      {isAuthenticated ? 'Student Home' : 'Overview'}
                    </Link>
                  </li>
                  <li>
                    <Link to={isAuthenticated ? '/app/subjects' : '/signup'} className="hover:text-phosters-700 dark:hover:text-phosters-400 transition-colors">
                      {isAuthenticated ? 'Subjects & Lessons' : 'Create Student Account'}
                    </Link>
                  </li>
                  <li>
                    <Link to={isAuthenticated ? '/app/results' : '/login'} className="hover:text-phosters-700 dark:hover:text-phosters-400 transition-colors">
                      {isAuthenticated ? 'CBT Results' : 'Sign In'}
                    </Link>
                  </li>
                  <li>
                    <Link to="/settings" className="hover:text-phosters-700 dark:hover:text-phosters-400 transition-colors">
                      App Settings &amp; Dark Mode
                    </Link>
                  </li>
                  <li>
                    <Link to="/ministries" className="hover:text-phosters-700 dark:hover:text-phosters-400 transition-colors">
                      The Phosters Ministries
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Legal &amp; Policies
                </h2>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  {LEGAL_DOCUMENTS.map((doc) => (
                    <li key={doc.slug}>
                      <Link
                        to={`/legal/${doc.slug}`}
                        className="hover:text-phosters-700 dark:hover:text-phosters-400 transition-colors"
                      >
                        {doc.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>© {new Date().getFullYear()} Phosters Tutorial Centre. All rights reserved.</span>
              <span>JAMB UTME &amp; UI Post-UTME Study Platform</span>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile bottom navigation bar for authenticated users */}
      {isAuthenticated && (
        <nav
          aria-label="Mobile navigation"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 md:hidden pb-safe"
        >
          <div className="grid grid-cols-5 items-center h-14">
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
                        ? 'text-phosters-700 dark:text-phosters-400 font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium',
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
