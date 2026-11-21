import type { IncomingMessage, ServerResponse } from 'node:http';
import { getPushServerStatus, verifyAdminAuthorization } from '../../server/pushEngine.js';

interface VercelLikeRequest extends IncomingMessage {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse extends ServerResponse {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    const authHeader =
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined;
    const authCheck = await verifyAdminAuthorization(authHeader);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({ error: authCheck.error });
      return;
    }

    res.status(200).json(getPushServerStatus());
  } catch (err) {
    console.error('Push status handler error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? `Push status internal error: ${err.message}`
          : 'Unexpected push status error.',
    });
  }
}
