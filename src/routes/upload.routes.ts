import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';

import { Errors } from '../utils/errors.js';
import { ErrorCodes, ErrorMessages } from '../utils/messages.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (pre-compression)
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 82;

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
      if (!file) {
        throw Errors.badRequest(ErrorMessages.UPLOAD_NO_FILE, ErrorCodes.UPLOAD_NO_FILE);
      }
      if (!ALLOWED_MIME.has(file.mimetype)) {
        throw Errors.badRequest(
          ErrorMessages.UPLOAD_UNSUPPORTED_TYPE,
          ErrorCodes.UPLOAD_UNSUPPORTED_TYPE,
        );
      }

      const buffer = await file.toBuffer();
      if (buffer.length > MAX_BYTES) {
        throw Errors.badRequest(ErrorMessages.UPLOAD_TOO_LARGE, ErrorCodes.UPLOAD_TOO_LARGE);
      }

      let processed: Buffer;
      try {
        processed = await sharp(buffer, { failOn: 'error' })
          .rotate()
          .resize({
            width: MAX_DIMENSION,
            height: MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
      } catch {
        throw Errors.badRequest(
          ErrorMessages.UPLOAD_UNSUPPORTED_TYPE,
          ErrorCodes.UPLOAD_UNSUPPORTED_TYPE,
        );
      }

      const filename = `${randomUUID()}.jpg`;
      const filepath = join(UPLOAD_DIR, filename);
      await writeFile(filepath, processed);

      return { url: `/static/${filename}` };
    },
  );
}
