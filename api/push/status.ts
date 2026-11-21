import type { IncomingMessage, ServerResponse } from 'node:http';
import { getPushServerStatus, verifyAdminAuthorization } from '../../server/pushEngine';

interface VercelLikeRequest extends IncomingMessage {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse extends ServerResponse {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
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
}
