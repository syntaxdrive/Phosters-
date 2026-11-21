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

async function parsePushApiResponse<T>(
  res: Response,
  fallbackError: string
): Promise<{ data: T | null; error: string | null }> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return {
      data: null,
      error: `Push service returned HTTP ${res.status} with an unreadable response.`,
    };
  }

  let parsed: (T & { error?: string }) | null = null;
  if (rawText.trim()) {
    try {
      parsed = JSON.parse(rawText) as T & { error?: string };
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    const trimmed = rawText.trim();
    const looksHtml =
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html');

    if (res.status === 404) {
      return {
        data: null,
        error:
          'Push API endpoint returned 404 Not Found. Verify that the /api/push serverless routes are deployed.',
      };
    }

    if (looksHtml) {
      return {
        data: null,
        error: `Push API returned an HTML page instead of JSON (HTTP ${res.status}). On Vercel, check that Deployment Protection is disabled or /api routes are deploying cleanly.`,
      };
    }

    const snippet = trimmed.slice(0, 140);
    return {
      data: null,
      error: snippet
        ? `Push API returned HTTP ${res.status}: ${snippet}`
        : `Push API returned an empty non-JSON response (HTTP ${res.status}).`,
    };
  }

  if (!res.ok) {
    return { data: null, error: parsed.error || `${fallbackError} (HTTP ${res.status})` };
  }

  return { data: parsed as T, error: null };
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
    const parsed = await parsePushApiResponse<PushServerStatus>(
      res,
      'Could not verify push server status.'
    );
    return { status: parsed.data, error: parsed.error };
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
    return {
      status: null,
      error: `Push notification API is unreachable${detail}.`,
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
    const parsed = await parsePushApiResponse<SendPushResponse>(
      res,
      'Failed to send push notification.'
    );
    return { result: parsed.data, error: parsed.error };
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
    return {
      result: null,
      error: `Unable to reach push notification service${detail}.`,
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
    const parsed = await parsePushApiResponse<RemindInactiveResponse>(
      res,
      'Failed to send study reminders.'
    );
    return { result: parsed.data, error: parsed.error };
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
    return {
      result: null,
      error: `Unable to reach push reminder service${detail}.`,
    };
  }
}
