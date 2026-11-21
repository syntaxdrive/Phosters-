import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  runInactivityAndTestReminders,
  verifyCronOrAdminAuthorization,
} from '../../server/pushEngine.js';
import type { RemindInactiveInput } from '../../src/types/push.js';

interface VercelLikeRequest extends IncomingMessage {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse extends ServerResponse {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
}

async function readOptionalJson(req: VercelLikeRequest): Promise<RemindInactiveInput> {
  if (req.body !== undefined) {
    if (!req.body) return {};
    return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as RemindInactiveInput;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? (JSON.parse(raw) as RemindInactiveInput) : {};
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  try {
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
    if (req.method === 'POST') {
      try {
        input = await readOptionalJson(req);
      } catch {
        res.status(400).json({ error: 'Invalid JSON payload.' });
        return;
      }
    }

    const result = await runInactivityAndTestReminders(
      input,
      authCheck.triggeredByUserId,
      authCheck.client,
      Boolean(authCheck.usingServiceRole)
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Push remind-inactive handler error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? `Push reminder internal error: ${err.message}`
          : 'Unexpected push reminder error.',
    });
  }
}
