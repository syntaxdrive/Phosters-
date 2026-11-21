import { supabase } from '../lib/supabase';
import type {
  PushPreferences,
  PushServerStatus,
  RemindInactiveInput,
  RemindInactiveResponse,
  SendPushPayload,
  SendPushResponse,
} from '../types/push';

export function getVapidPublicKey(): string {
  return (
    (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? ''
  );
}

export function isPushSupportedInBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function fetchDevicePushPreferences(
  userId: string,
  endpoint: string
): Promise<PushPreferences | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('push_subscriptions')
    .select('notify_lessons, notify_tests, notify_broadcasts, notify_reminders')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .maybeSingle();

  return data ?? null;
}

export async function upsertDevicePushSubscription(
  userId: string,
  subscription: PushSubscription,
  preferences: PushPreferences
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return { error: 'Browser did not provide valid push subscription keys.' };
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 300),
      notify_lessons: preferences.notify_lessons,
      notify_tests: preferences.notify_tests,
      notify_broadcasts: preferences.notify_broadcasts,
      notify_reminders: preferences.notify_reminders,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function updateDevicePushPreferences(
  userId: string,
  endpoint: string,
  patch: Partial<PushPreferences>
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { error } = await supabase
    .from('push_subscriptions')
    .update(patch)
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  return { error: error ? error.message : null };
}

export async function deleteDevicePushSubscription(
  userId: string,
  endpoint: string
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  return { error: error ? error.message : null };
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function fetchPushServerStatus(): Promise<{
  status: PushServerStatus | null;
  error: string | null;
}> {
  const token = await getAccessToken();
  if (!token) {
    return { status: null, error: 'You must be signed in as an administrator.' };
  }

  try {
    const res = await fetch('/api/push/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = (await res.json()) as PushServerStatus & { error?: string };
    if (!res.ok) {
      return { status: null, error: data.error || 'Could not verify push server status.' };
    }
    return { status: data, error: null };
  } catch {
    return {
      status: null,
      error: 'Push notification API is unreachable.',
    };
  }
}

export async function triggerPushNotification(
  payload: SendPushPayload
): Promise<{ result: SendPushResponse | null; error: string | null }> {
  const token = await getAccessToken();
  if (!token) {
    return { result: null, error: 'You must be signed in as an administrator.' };
  }

  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as SendPushResponse & { error?: string };
    if (!res.ok) {
      return { result: null, error: data.error || 'Failed to send push notification.' };
    }
    return { result: data, error: null };
  } catch {
    return {
      result: null,
      error: 'Unable to reach push notification service.',
    };
  }
}

export async function triggerInactivityReminders(
  input: RemindInactiveInput
): Promise<{ result: RemindInactiveResponse | null; error: string | null }> {
  const token = await getAccessToken();
  if (!token) {
    return { result: null, error: 'You must be signed in as an administrator.' };
  }

  try {
    const res = await fetch('/api/push/remind-inactive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as RemindInactiveResponse & { error?: string };
    if (!res.ok) {
      return { result: null, error: data.error || 'Failed to send study reminders.' };
    }
    return { result: data, error: null };
  } catch {
    return {
      result: null,
      error: 'Unable to reach push reminder service.',
    };
  }
}
