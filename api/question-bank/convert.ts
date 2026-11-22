import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  convertUploadedDocument,
  verifySuperAdminAuthorization,
} from '../../server/questionBankEngine.js';
import type { ConvertDocumentRequest } from '../../src/types/questionBank';

interface VercelLikeRequest extends IncomingMessage {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelLikeResponse extends ServerResponse {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '24mb',
    },
  },
};

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
    const authCheck = await verifySuperAdminAuthorization(authHeader);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({ error: authCheck.error });
      return;
    }

    const body = req.body as ConvertDocumentRequest | undefined;
    if (!body || typeof body !== 'object' || typeof body.fileBase64 !== 'string') {
      res.status(400).json({ error: 'Invalid document conversion payload.' });
      return;
    }

    const result = await convertUploadedDocument(body);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Question Bank convert handler error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? `Document conversion error: ${err.message}`
          : 'Unexpected document conversion error.',
    });
  }
}
