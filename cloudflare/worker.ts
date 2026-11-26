import {
  generateFreshVapidKeypair,
  getPublicPushConfig,
  getPushServerStatus,
  runInactivityAndTestReminders,
  sendTargetedPushNotifications,
  verifyAdminAuthorization,
  verifyCronOrAdminAuthorization,
} from '../server/pushEngine.ts';
import type { RemindInactiveInput, SendPushPayload } from '../src/types/push.ts';

interface StaticAssetsBinding {
  fetch(input: Request | URL | string): Promise<Response>;
}

interface WorkerEnv {
  ASSETS: StaticAssetsBinding;
  CRON_SECRET?: string;
}

interface WorkerScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ ok: true, service: 'phosters-cloudflare-fallback' }, 200);
    }

    if (pathname === '/api/push/config' && request.method === 'GET') {
      return jsonResponse(getPublicPushConfig(), 200);
    }

    if (pathname === '/api/push/status' && request.method === 'GET') {
      try {
        const authCheck = await verifyAdminAuthorization(
          request.headers.get('authorization') ?? undefined
        );
        if (!authCheck.ok) {
          return jsonResponse({ error: authCheck.error }, authCheck.status);
        }
        return jsonResponse(getPushServerStatus(), 200);
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : 'Unexpected push status error.' },
          500
        );
      }
    }

    if (pathname === '/api/push/generate-vapid' && request.method === 'POST') {
      try {
        const authCheck = await verifyAdminAuthorization(
          request.headers.get('authorization') ?? undefined
        );
        if (!authCheck.ok) {
          return jsonResponse({ error: authCheck.error }, authCheck.status);
        }
        return jsonResponse(generateFreshVapidKeypair(), 200);
      } catch (err) {
        return jsonResponse(
          {
            error:
              err instanceof Error ? err.message : 'Unexpected VAPID generation error.',
          },
          500
        );
      }
    }

    if (pathname === '/api/push/send' && request.method === 'POST') {
      try {
        const authCheck = await verifyAdminAuthorization(
          request.headers.get('authorization') ?? undefined
        );
        if (!authCheck.ok || !authCheck.userId) {
          return jsonResponse({ error: authCheck.error }, authCheck.status);
        }

        const payload = await readJsonBody<SendPushPayload>(request);
        if (!payload || typeof payload !== 'object' || !('type' in payload)) {
          return jsonResponse({ error: 'Invalid push notification request payload.' }, 400);
        }

        const result = await sendTargetedPushNotifications(
          payload,
          authCheck.userId,
          authCheck.client
        );
        return jsonResponse(result.body, result.status);
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : 'Unexpected push send error.' },
          500
        );
      }
    }

    if (pathname === '/api/push/remind-inactive') {
      if (request.method !== 'GET' && request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed.' }, 405);
      }

      try {
        const authCheck = await verifyCronOrAdminAuthorization(
          request.headers.get('authorization') ?? undefined
        );
        if (!authCheck.ok) {
          return jsonResponse({ error: authCheck.error }, authCheck.status);
        }

        const input: RemindInactiveInput =
          request.method === 'POST'
            ? ((await readJsonBody<RemindInactiveInput>(request)) ?? {})
            : {};

        const result = await runInactivityAndTestReminders(
          input,
          authCheck.triggeredByUserId,
          authCheck.client,
          Boolean(authCheck.usingServiceRole)
        );
        return jsonResponse(result.body, result.status);
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : 'Unexpected push reminder error.' },
          500
        );
      }
    }

    if (pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not found.' }, 404);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (pathname === '/sw.js') {
      const headers = new Headers(assetResponse.headers);
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
    }

    if (pathname === '/manifest.webmanifest') {
      const headers = new Headers(assetResponse.headers);
      headers.set('Content-Type', 'application/manifest+json');
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
    }

    return assetResponse;
  },

  async scheduled(
    _event: WorkerScheduledEvent,
    env: WorkerEnv,
    ctx: WorkerExecutionContext
  ): Promise<void> {
    if (!env.CRON_SECRET) {
      console.warn('Cloudflare scheduled reminder skipped: CRON_SECRET is not set.');
      return;
    }

    ctx.waitUntil(
      (async () => {
        const authCheck = await verifyCronOrAdminAuthorization(`Bearer ${env.CRON_SECRET}`);
        if (!authCheck.ok) {
          console.error('Cloudflare scheduled reminder auth failed:', authCheck.error);
          return;
        }
        await runInactivityAndTestReminders(
          {},
          authCheck.triggeredByUserId,
          authCheck.client,
          Boolean(authCheck.usingServiceRole)
        );
      })()
    );
  },
};
