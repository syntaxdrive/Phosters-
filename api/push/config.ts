import type { IncomingMessage, ServerResponse } from 'node:http';
import { getPublicPushConfig } from '../../server/pushEngine.js';

interface VercelLikeRequest extends IncomingMessage {
  method?: string;
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

  res.status(200).json(getPublicPushConfig());
}
