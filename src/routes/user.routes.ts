import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcrypt';
import { z } from 'zod';

import { User } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { passwordSchema, localeSchema } from '../schemas/auth.schema.js';
import type { UserDoc } from '../models/user.model.js';

const userPublicSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  defaultCurrency: z.enum(['UZS', 'USD', 'EUR', 'RUB']),
  locale: localeSchema,
  emailVerified: z.boolean(),
});

function toPublic(u: UserDoc) {
  return {
    id: String(u._id),
    fullName: u.fullName,
    email: u.email,
    avatarUrl: u.avatarUrl ?? null,
    defaultCurrency: u.defaultCurrency,
    locale: u.locale,
    emailVerified: u.emailVerified,
  };
}

export async function userRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.addHook('onRequest', app.authenticate);

  // ===== Get me =====
  app.get(
    '/me',
    {
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        response: { 200: userPublicSchema },
      },
    },
    async (req) => {
      const user = await User.findById(req.user.sub);
      if (!user) throw Errors.notFound('User not found');
      return toPublic(user);
    },
  );

  // ===== Update profile =====
  app.patch(
    '/me',
    {
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: z.object({
          fullName: z.string().min(2).max(100).optional(),
          avatarUrl: z.string().url().nullable().optional(),
          defaultCurrency: z.enum(['UZS', 'USD', 'EUR', 'RUB']).optional(),
          locale: localeSchema.optional(),
        }),
        response: { 200: userPublicSchema },
      },
    },
    async (req) => {
      // Delete old avatar file if avatarUrl is changing
      if (req.body.avatarUrl !== undefined) {
        const oldUser = await User.findById(req.user.sub);
        if (oldUser?.avatarUrl) {
          const staticPath = new URL(oldUser.avatarUrl).pathname;
          if (staticPath.startsWith('/static/')) {
            const filePath = path.join('./uploads', staticPath.replace('/static/', ''));
            fs.unlink(filePath).catch(() => {});
          }
        }
      }

      const user = await User.findByIdAndUpdate(
        req.user.sub,
        { $set: req.body },
        { new: true },
      );
      if (!user) throw Errors.notFound('User not found');
      return toPublic(user);
    },
  );

  // ===== Change password =====
  app.patch(
    '/me/password',
    {
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: z.object({
          currentPassword: z.string().min(1),
          newPassword: passwordSchema,
        }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const user = await User.findById(req.user.sub);
      if (!user) throw Errors.notFound('User not found');

      const ok = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!ok) throw Errors.unauthorized('Current password is incorrect');

      user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
      await user.save();
      return { ok: true as const };
    },
  );

  // ===== Delete account =====
  app.delete(
    '/me',
    {
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      await User.findByIdAndDelete(req.user.sub);
      return { ok: true as const };
    },
  );
}
