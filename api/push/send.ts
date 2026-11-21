import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  sendTargetedPushNotifications,
  verifyAdminAuthorization,
} from '../../server/pushEngine';
import type { SendPushPayload } from '../../src/types/push';

interface VercelLikeRequest extends IncomingMessage {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse extends ServerResponse {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
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
    payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as
      | SendPushPayload
      | undefined;
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
}
