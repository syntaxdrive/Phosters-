import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  runInactivityAndTestReminders,
  verifyCronOrAdminAuthorization,
} from '../../server/pushEngine';
import type { RemindInactiveInput } from '../../src/types/push';

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
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const authHeader =
    typeof req.headers.authorization === 'string'
      ? req.headers.authorization
      : undefined;
  const authCheck = await verifyCronOrAdminAuthorization(authHeader);
  if (!authCheck.ok) {
    res.status(authCheck.status).json({ error: authCheck.error });
    return;
  }

  let input: RemindInactiveInput = {};
  if (req.method === 'POST' && req.body) {
    try {
      input = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as RemindInactiveInput;
    } catch {
      res.status(400).json({ error: 'Invalid JSON payload.' });
      return;
    }
  }

  const result = await runInactivityAndTestReminders(
    input,
    authCheck.triggeredByUserId
  );
  res.status(result.status).json(result.body);
}
