import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  FileText,
  HardDrive,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { LEGAL_CONTACT_EMAIL, LEGAL_DOCUMENTS } from '../data/legalPolicies';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTheme, type ThemeMode } from '../hooks/useTheme';
import { clearAllOfflineDataForUser } from '../lib/offlineDb';
import { formatBytes } from '../services/offlineSyncService';
import { PushNotificationSettings } from '../components/pwa/PushNotificationSettings';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string; icon: typeof Sun }[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'High-contrast daylight surfaces',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low-glare night study mode',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follows your device theme',
    icon: Monitor,
  },
];

export function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const {
    isOnline,
    isSyncing,
    summary,
    pendingCount,
    totalBytes,
    refreshVault,
    syncNow,
  } = useOfflineSync();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { isInstalled } = usePWAInstall();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [clearingOffline, setClearingOffline] = useState(false);
  const [confirmClearOffline, setConfirmClearOffline] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    navigate('/login');
  }

  async function handleClearOfflineStorage() {
    if (!user) return;
    setClearingOffline(true);
    await clearAllOfflineDataForUser(user.id);
    await refreshVault();
    setClearingOffline(false);
    setConfirmClearOffline(false);
    setOfflineStatus('Cleared all offline lessons, PDFs, and cached data on this device.');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Customize appearance, manage push alerts, view your account, and read Phosters legal policies.
        </p>
      </div>

      {/* Appearance / Dark mode */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Appearance
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Currently displaying <span className="font-semibold capitalize">{resolvedTheme}</span> mode.
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Theme mode"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
        >
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(opt.value)}
                className={[
                  'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer min-h-[56px]',
                  selected
                    ? 'border-phosters-600 bg-phosters-50 dark:bg-phosters-900/40 dark:border-phosters-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/70',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'h-5 w-5 shrink-0 mt-0.5',
                    selected
                      ? 'text-phosters-700 dark:text-phosters-400'
                      : 'text-slate-500 dark:text-slate-400',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {opt.label}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {opt.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Push Notifications */}
      {user ? (
        <PushNotificationSettings variant="card" />
      ) : (
        <Card padding="lg" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0 mt-0.5">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Native Push Notifications
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sign in to enable lecture alerts, tutor broadcasts, and test reminders on this device.
              </p>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
          >
            Sign In
          </Link>
        </Card>
      )}

      {/* App Install / Standalone status */}
      {isInstalled ? (
        <Card padding="md" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Running as installed Phosters app
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Full-screen native mode is active on this device.
            </p>
          </div>
        </Card>
      ) : (
        <PWAInstallButton variant="card" />
      )}

      {/* Offline Study & Device Storage */}
      {user && (
        <Card padding="lg" className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0 mt-0.5">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Offline Study &amp; Storage
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
                {summary?.savedLessons.length ?? 0} saved lessons ·{' '}
                {summary?.savedMaterials.length ?? 0} study PDFs ·{' '}
                {summary?.savedTests.length ?? 0} practice tests ·{' '}
                {formatBytes(totalBytes)} used
                {pendingCount > 0 ? ` · ${pendingCount} pending sync` : ''}
              </p>
            </div>
          </div>

          {offlineStatus && <Alert tone="info">{offlineStatus}</Alert>}

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/app/offline"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Open Offline Library
            </Link>

            {pendingCount > 0 && (
              <Button
                variant="secondary"
                loading={isSyncing}
                disabled={!isOnline}
                onClick={() => void syncNow()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Sync Pending ({pendingCount})</span>
              </Button>
            )}

            {totalBytes > 0 &&
              (!confirmClearOffline ? (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmClearOffline(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Clear Offline Storage</span>
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmClearOffline(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    loading={clearingOffline}
                    onClick={() => void handleClearOfflineStorage()}
                  >
                    Confirm Clear
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Account shortcuts when logged in */}
      {user && (
        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Account &amp; Learning
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <Link
              to="/app/profile"
              className="flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                <User className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span>Profile, phone &amp; password</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </Link>
            <Link
              to="/app/setup-exams"
              className="flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                <BookOpen className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span>Target exams &amp; subjects</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-phosters-700 dark:text-phosters-400">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  <span>Admin workspace</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            )}
          </div>

          <div className="pt-2">
            <Button
              variant="secondary"
              onClick={() => void handleSignOut()}
              loading={signingOut}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign Out</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Legal & Policies (accessible in both PWA and Website) */}
      <Card padding="lg" className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Legal &amp; Policies
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Review how Phosters handles student records, CBT integrity, offline caching, and safety.
          </p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {LEGAL_DOCUMENTS.map((doc) => (
            <Link
              key={doc.slug}
              to={`/legal/${doc.slug}`}
              className="flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <FileText
                  className="h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                    {doc.title}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                    {doc.summary}
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
          Support &amp; privacy contact:{' '}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="font-medium text-phosters-700 dark:text-phosters-400 hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </Card>
    </div>
  );
}
