import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  sendTargetedPushNotifications,
  verifyAdminAuthorization,
} from '../../server/pushEngine.js';
import type { SendPushPayload } from '../../src/types/push.js';

interface VercelLikeRequest extends IncomingMessage {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse extends ServerResponse {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
}

async function readRequestJson(req: VercelLikeRequest): Promise<unknown> {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : undefined;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    const authHeader =
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined;
    const authCheck = await verifyAdminAuthorization(authHeader);
    if (!authCheck.ok || !authCheck.userId) {
      res.status(authCheck.status).json({ error: authCheck.error });
      return;
    }

    let payload: SendPushPayload | undefined;
    try {
      payload = (await readRequestJson(req)) as SendPushPayload | undefined;
    } catch {
      res.status(400).json({ error: 'Invalid JSON payload.' });
      return;
    }

    if (!payload || typeof payload !== 'object' || !('type' in payload)) {
      res.status(400).json({ error: 'Invalid push notification request payload.' });
      return;
    }

    const result = await sendTargetedPushNotifications(payload, authCheck.userId);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Push send handler error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? `Push service internal error: ${err.message}`
          : 'Unexpected push service error.',
    });
  }
}
