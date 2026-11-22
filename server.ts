import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  generateFreshVapidKeypair,
  getPublicPushConfig,
  getPushServerStatus,
  runInactivityAndTestReminders,
  sendTargetedPushNotifications,
  verifyAdminAuthorization,
  verifyCronOrAdminAuthorization,
} from './server/pushEngine.ts';
import {
  convertUploadedDocument,
  ocrScannedPdfWithGemini,
  parseQuestionChunkWithGemini,
  verifySuperAdminAuthorization,
} from './server/questionBankEngine.ts';
import type { RemindInactiveInput, SendPushPayload } from './src/types/push.ts';
import type {
  ConvertDocumentRequest,
  OcrPdfRequest,
  ParseChunkRequest,
} from './src/types/questionBank.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use('/api/question-bank', express.json({ limit: '24mb' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/push/config', (_req, res) => {
    res.status(200).json(getPublicPushConfig());
  });

  app.get('/api/push/status', async (req, res) => {
    try {
      const authCheck = await verifyAdminAuthorization(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }
      res.status(200).json(getPushServerStatus());
    } catch (err) {
      console.error('Express /api/push/status error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected push status error.',
      });
    }
  });

  app.post('/api/push/generate-vapid', async (req, res) => {
    try {
      const authCheck = await verifyAdminAuthorization(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }
      res.status(200).json(generateFreshVapidKeypair());
    } catch (err) {
      console.error('Express /api/push/generate-vapid error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected VAPID generation error.',
      });
    }
  });

  app.post('/api/push/send', async (req, res) => {
    try {
      const authCheck = await verifyAdminAuthorization(req.headers.authorization);
      if (!authCheck.ok || !authCheck.userId) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }

      const payload = req.body as SendPushPayload | undefined;
      if (!payload || typeof payload !== 'object' || !('type' in payload)) {
        res.status(400).json({ error: 'Invalid push notification request payload.' });
        return;
      }

      const result = await sendTargetedPushNotifications(
        payload,
        authCheck.userId,
        authCheck.client
      );
      res.status(result.status).json(result.body);
    } catch (err) {
      console.error('Express /api/push/send error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected push send error.',
      });
    }
  });

  app.all('/api/push/remind-inactive', async (req, res) => {
    try {
      if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed.' });
        return;
      }

      const authCheck = await verifyCronOrAdminAuthorization(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }

      const input: RemindInactiveInput =
        req.method === 'POST' && req.body && typeof req.body === 'object'
          ? (req.body as RemindInactiveInput)
          : {};

      const result = await runInactivityAndTestReminders(
        input,
        authCheck.triggeredByUserId,
        authCheck.client,
        Boolean(authCheck.usingServiceRole)
      );
      res.status(result.status).json(result.body);
    } catch (err) {
      console.error('Express /api/push/remind-inactive error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected push reminder error.',
      });
    }
  });

  app.post('/api/question-bank/convert', async (req, res) => {
    try {
      const authCheck = await verifySuperAdminAuthorization(req.headers.authorization);
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
      console.error('Express /api/question-bank/convert error:', err);
      res.status(500).json({
        error:
          err instanceof Error
            ? `Document conversion error: ${err.message}`
            : 'Unexpected document conversion error.',
      });
    }
  });

  app.post('/api/question-bank/ocr-pdf', async (req, res) => {
    try {
      const authCheck = await verifySuperAdminAuthorization(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }

      const body = req.body as OcrPdfRequest | undefined;
      if (!body || typeof body !== 'object' || typeof body.fileBase64 !== 'string') {
        res.status(400).json({ error: 'Invalid PDF OCR payload.' });
        return;
      }

      const result = await ocrScannedPdfWithGemini(body);
      res.status(result.status).json(result.body);
    } catch (err) {
      console.error('Express /api/question-bank/ocr-pdf error:', err);
      res.status(500).json({
        error:
          err instanceof Error
            ? `PDF OCR error: ${err.message}`
            : 'Unexpected PDF OCR error.',
      });
    }
  });

  app.post('/api/question-bank/parse-chunk', async (req, res) => {
    try {
      const authCheck = await verifySuperAdminAuthorization(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }

      const body = req.body as ParseChunkRequest | undefined;
      if (!body || typeof body !== 'object' || typeof body.chunkText !== 'string') {
        res.status(400).json({ error: 'Invalid question chunk parsing payload.' });
        return;
      }

      const result = await parseQuestionChunkWithGemini(body);
      res.status(result.status).json(result.body);
    } catch (err) {
      console.error('Express /api/question-bank/parse-chunk error:', err);
      res.status(500).json({
        error:
          err instanceof Error
            ? `Question parsing error: ${err.message}`
            : 'Unexpected question parsing error.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not found.' });
        return;
      }
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output missing. Run npm run build first.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Phosters server running on http://0.0.0.0:${port}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
