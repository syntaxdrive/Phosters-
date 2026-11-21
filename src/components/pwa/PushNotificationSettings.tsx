import { useState } from 'react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface PushNotificationSettingsProps {
  variant: 'banner' | 'card';
}

const DISMISS_STORAGE_KEY = 'phosters_push_banner_dismissed';

export function PushNotificationSettings({ variant }: PushNotificationSettingsProps) {
  const {
    isSupported,
    isConfigured,
    needsIOSInstall,
    permission,
    isSubscribed,
    preferences,
    loading,
    saving,
    error,
    enablePush,
    disablePush,
    updatePreferences,
  } = usePushNotifications();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function handleDismissBanner() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // Ignore storage failures
    }
  }

  async function handleEnable() {
    setStatusMessage(null);
    const ok = await enablePush();
    if (ok) {
      setStatusMessage(
        'Push notifications enabled on this device. You will receive alerts even when Phosters is closed.'
      );
    }
  }

  async function handleDisable() {
    setStatusMessage(null);
    const ok = await disablePush();
    if (ok) {
      setStatusMessage('Push notifications turned off for this device.');
    }
  }

  if (variant === 'banner') {
    if (loading || dismissed || isSubscribed || !isConfigured) {
      return null;
    }

    if (needsIOSInstall) {
      return (
        <Card padding="md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0 mt-0.5">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Get lecture &amp; test alerts on iPhone
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Tap <strong>Share</strong> then <strong>Add to Home Screen</strong> to install Phosters and unlock native lock-screen notifications.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissBanner}
              aria-label="Dismiss notification tip"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </Card>
      );
    }

    if (!isSupported || permission === 'denied') {
      return null;
    }

    return (
      <Card padding="md" className="border-phosters-200 dark:border-phosters-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0 mt-0.5">
              <BellRing className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Stay notified on this phone
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Receive native alerts for new lectures, tutor broadcasts, practice tests, and study reminders — even when the app is closed.
              </p>
              {error && <p className="text-xs font-medium text-red-600 dark:text-red-400 pt-1">{error}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <Button onClick={() => void handleEnable()} loading={saving}>
              Enable Alerts
            </Button>
            <button
              type="button"
              onClick={handleDismissBanner}
              aria-label="Dismiss notification prompt"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0 mt-0.5">
            {isSubscribed ? (
              <BellRing className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Bell className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Native Push Notifications
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Receive alerts on this device for new lecture uploads, broadcasts, pending tests, and study reminders even when you are not in the app.
            </p>
          </div>
        </div>

        {isSupported && isConfigured && !needsIOSInstall && (
          <div className="shrink-0">
            {isSubscribed ? (
              <Button
                variant="secondary"
                onClick={() => void handleDisable()}
                loading={saving}
              >
                <BellOff className="h-4 w-4" aria-hidden="true" />
                <span>Turn Off</span>
              </Button>
            ) : (
              <Button onClick={() => void handleEnable()} loading={saving}>
                <BellRing className="h-4 w-4" aria-hidden="true" />
                <span>Enable Notifications</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {statusMessage && <Alert tone="success">{statusMessage}</Alert>}

      {needsIOSInstall ? (
        <Alert tone="info" title="Install Phosters on your Home Screen first">
          On iPhone and iPad, Safari requires installing the app via{' '}
          <strong>Share -&gt; Add to Home Screen</strong> before enabling native push notifications.
        </Alert>
      ) : !isSupported ? (
        <Alert tone="info">
          This browser does not support Web Push notifications. Open Phosters in Chrome, Edge, or Safari (installed on Home Screen) to enable alerts.
        </Alert>
      ) : !isConfigured ? (
        <Alert tone="info">
          Push notifications will become available once the administrator configures the VAPID public key.
        </Alert>
      ) : permission === 'denied' && !isSubscribed ? (
        <Alert tone="warning" title="Notifications blocked in browser settings">
          Allow notifications for Phosters in your browser or device site settings, then reload and tap Enable Notifications.
        </Alert>
      ) : null}

      {isSubscribed && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Choose what alerts this device receives
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                {
                  key: 'notify_lessons',
                  label: 'New lecture uploads',
                  desc: 'When a tutor publishes a new lesson in your subjects',
                },
                {
                  key: 'notify_tests',
                  label: 'Practice tests & quizzes',
                  desc: 'New CBT tests and reminders to try unattempted tests',
                },
                {
                  key: 'notify_broadcasts',
                  label: 'Tutor broadcasts & links',
                  desc: 'Announcements, live class notices, and study links',
                },
                {
                  key: 'notify_reminders',
                  label: 'Study & streak reminders',
                  desc: 'Helpful nudges if you have not opened Phosters for a few days',
                },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={(e) =>
                    void updatePreferences({ [item.key]: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.label}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{item.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
