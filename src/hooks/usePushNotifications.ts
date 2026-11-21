import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  deleteDevicePushSubscription,
  fetchDevicePushPreferences,
  getVapidPublicKey,
  isIOSDevice,
  isPushSupportedInBrowser,
  isStandalonePWA,
  updateDevicePushPreferences,
  upsertDevicePushSubscription,
  urlBase64ToUint8Array,
} from '../services/pushService';
import type { PushPreferences } from '../types/push';

const DEFAULT_PREFERENCES: PushPreferences = {
  notify_lessons: true,
  notify_tests: true,
  notify_broadcasts: true,
  notify_reminders: true,
};

export function usePushNotifications() {
  const { user } = useAuth();
  const vapidPublicKey = getVapidPublicKey();
  const isSupported = isPushSupportedInBrowser();
  const isIOS = isIOSDevice();
  const isStandalone = isStandalonePWA();

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [preferences, setPreferences] = useState<PushPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncCurrentSubscription = useCallback(async () => {
    if (!isSupported || !user) {
      setIsSubscribed(false);
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setPermission(Notification.permission);
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setSubscription(existing);
      setIsSubscribed(Boolean(existing));

      if (existing) {
        const storedPrefs = await fetchDevicePushPreferences(
          user.id,
          existing.endpoint
        );
        if (storedPrefs) {
          setPreferences(storedPrefs);
        } else if (Notification.permission === 'granted') {
          // Ensure subscription is saved in database for this user
          await upsertDevicePushSubscription(user.id, existing, DEFAULT_PREFERENCES);
        }
      }
    } catch {
      // Service worker may not be active yet in unsupported contexts
    } finally {
      setLoading(false);
    }
  }, [isSupported, user]);

  useEffect(() => {
    void syncCurrentSubscription();
  }, [syncCurrentSubscription]);

  const enablePush = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setError('Sign in first to enable notifications.');
      return false;
    }
    if (!isSupported) {
      setError('Push notifications are not supported in this browser.');
      return false;
    }
    if (!vapidPublicKey) {
      setError(
        'Push notifications are not configured yet (missing VITE_VAPID_PUBLIC_KEY).'
      );
      return false;
    }

    setError(null);
    setSaving(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        setError(
          nextPermission === 'denied'
            ? 'Notifications are blocked for Phosters. Enable Notifications in your browser or phone site settings.'
            : 'Notification permission was dismissed.'
        );
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const { error: upsertError } = await upsertDevicePushSubscription(
        user.id,
        sub,
        preferences
      );
      if (upsertError) {
        setError(upsertError);
        return false;
      }

      setSubscription(sub);
      setIsSubscribed(true);
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not enable push notifications on this device.'
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, isSupported, vapidPublicKey, preferences]);

  const disablePush = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setError(null);
    setSaving(true);
    try {
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await deleteDevicePushSubscription(user.id, endpoint);
      }
      setSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not turn off notifications on this device.'
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, subscription]);

  const updatePreferences = useCallback(
    async (patch: Partial<PushPreferences>) => {
      const next = { ...preferences, ...patch };
      setPreferences(next);
      if (!user || !subscription) return;

      setError(null);
      const { error: updateErr } = await updateDevicePushPreferences(
        user.id,
        subscription.endpoint,
        patch
      );
      if (updateErr) {
        setError(updateErr);
        setPreferences(preferences);
      }
    },
    [preferences, user, subscription]
  );

  return {
    isSupported,
    isConfigured: Boolean(vapidPublicKey),
    needsIOSInstall: isIOS && !isStandalone,
    permission,
    isSubscribed,
    preferences,
    loading,
    saving,
    error,
    enablePush,
    disablePush,
    updatePreferences,
  };
}
