import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';

import { Errors } from '../utils/errors.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.addHook('onRequest', app.authenticate);

  await mkdir(UPLOAD_DIR, { recursive: true });

  app.post(
    '/receipt',
    {
      schema: {
        tags: ['upload'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        response: { 200: z.object({ url: z.string() }) },
      },
    },
    async (req) => {
      const file = await req.file();
      if (!file) throw Errors.badRequest('No file uploaded');
      if (!ALLOWED_MIME.has(file.mimetype)) {
        throw Errors.badRequest(`Unsupported mime type: ${file.mimetype}`);
      }

      const buffer = await file.toBuffer();
      if (buffer.length > MAX_BYTES) {
        throw Errors.badRequest('File too large (max 5MB)');
      }

      const ext = extname(file.filename || '') || '.jpg';
      const filename = `${randomUUID()}${ext}`;
      const filepath = join(UPLOAD_DIR, filename);
      await writeFile(filepath, buffer);

      // Public path (served via /static prefix)
      return { url: `/static/${filename}` };
    },
  );
}
