import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

interface SWWindowClient {
  url: string;
  focused?: boolean;
  focus: () => Promise<SWWindowClient>;
  navigate?: (url: string) => Promise<SWWindowClient | null>;
}

interface SWNotification extends Notification {
  data: { url?: string } | null;
}

interface SWPushEvent extends Event {
  data: {
    json: () => unknown;
    text: () => string;
  } | null;
  waitUntil: (promise: Promise<unknown>) => void;
}

interface SWNotificationEvent extends Event {
  notification: SWNotification;
  waitUntil: (promise: Promise<unknown>) => void;
}

interface SWGlobalScope {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
  location: Location;
  skipWaiting: () => Promise<void>;
  registration: ServiceWorkerRegistration & {
    showNotification: (
      title: string,
      options?: NotificationOptions & { renotify?: boolean }
    ) => Promise<void>;
  };
  clients: {
    matchAll: (options?: {
      type?: 'window' | 'worker' | 'sharedworker' | 'all';
      includeUncontrolled?: boolean;
    }) => Promise<SWWindowClient[]>;
    openWindow: (url: string) => Promise<SWWindowClient | null>;
  };
  addEventListener: (
    type: string,
    listener: (event: Event) => void
  ) => void;
}

const sw = self as unknown as SWGlobalScope;

void sw.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute((self as unknown as SWGlobalScope).__WB_MANIFEST || []);

if (import.meta.env.PROD) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      denylist: [/^\/api\//],
    })
  );
}

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

function sanitizeTargetPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/app';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/app';
  }
  return trimmed;
}

sw.addEventListener('push', (rawEvent: Event) => {
  const event = rawEvent as SWPushEvent;
  let title = 'Phosters';
  let body = 'You have a new study update on Phosters.';
  let url = '/app';
  let tag = 'phosters-update';

  if (event.data) {
    try {
      const payload = event.data.json() as Record<string, unknown>;
      if (typeof payload.title === 'string' && payload.title.trim()) {
        title = payload.title.trim();
      }
      if (typeof payload.body === 'string' && payload.body.trim()) {
        body = payload.body.trim();
      }
      url = sanitizeTargetPath(payload.url);
      if (typeof payload.tag === 'string' && payload.tag.trim()) {
        tag = payload.tag.trim();
      }
    } catch {
      const text = event.data.text();
      if (text && text.trim()) {
        body = text.trim();
      }
    }
  }

  event.waitUntil(
    sw.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      tag,
      renotify: true,
      data: { url },
    })
  );
});

sw.addEventListener('notificationclick', (rawEvent: Event) => {
  const event = rawEvent as SWNotificationEvent;
  event.notification.close();

  const targetPath = sanitizeTargetPath(event.notification.data?.url);
  const fullTargetUrl = new URL(targetPath, sw.location.origin).href;

  event.waitUntil(
    sw.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(sw.location.origin)) {
            if (typeof client.navigate === 'function') {
              await client.navigate(fullTargetUrl);
            }
            return client.focus();
          }
        }
        return sw.clients.openWindow(fullTargetUrl);
      })
  );
});
