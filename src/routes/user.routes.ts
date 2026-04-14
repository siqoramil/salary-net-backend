import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcrypt';
import { z } from 'zod';

import { User } from '../models/index.js';
import { OtpCode } from '../models/otpCode.model.js';
import { Errors } from '../utils/errors.js';
import { ErrorCodes, ErrorMessages } from '../utils/messages.js';
import { passwordSchema, localeSchema, emailSchema } from '../schemas/auth.schema.js';
import { emailService } from '../services/email.service.js';
import type { UserDoc } from '../models/user.model.js';

const EMAIL_CHANGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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
      if (!user) throw Errors.notFound(ErrorMessages.USER_NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
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
      const current = await User.findById(req.user.sub);
      if (!current) throw Errors.notFound(ErrorMessages.USER_NOT_FOUND, ErrorCodes.USER_NOT_FOUND);

      const oldAvatarUrl = current.avatarUrl;
      const avatarReplaced =
        req.body.avatarUrl !== undefined &&
        req.body.avatarUrl !== oldAvatarUrl &&
        !!oldAvatarUrl;

      const user = await User.findByIdAndUpdate(
        req.user.sub,
        { $set: req.body },
        { new: true },
      );
      if (!user) throw Errors.notFound(ErrorMessages.USER_NOT_FOUND, ErrorCodes.USER_NOT_FOUND);

      // Delete old avatar file only after DB update succeeds and the URL
      // actually changed, so a failed update never leaves a dangling reference.
      if (avatarReplaced && oldAvatarUrl) {
        try {
          const staticPath = new URL(oldAvatarUrl).pathname;
          if (staticPath.startsWith('/static/')) {
            const filePath = path.join(process.cwd(), 'uploads', staticPath.replace('/static/', ''));
            fs.unlink(filePath).catch(() => {});
          }
        } catch {
          // ignore malformed URLs
        }
      }

      return toPublic(user);
    },
  );

  // ===== Request email change (send OTP to new email) =====
  app.post(
    '/me/email/request-change',
    {
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: z.object({ newEmail: emailSchema }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const user = await User.findById(req.user.sub);
      if (!user) throw Errors.notFound(ErrorMessages.USER_NOT_FOUND, ErrorCodes.USER_NOT_FOUND);

      if (req.body.newEmail === user.email) {
        throw Errors.badRequest(ErrorMessages.EMAIL_UNCHANGED, ErrorCodes.EMAIL_UNCHANGED);
      }

      const taken = await User.findOne({ email: req.body.newEmail });
      if (taken) throw Errors.conflict(ErrorMessages.EMAIL_IN_USE, ErrorCodes.EMAIL_IN_USE);

      // Invalidate any previous pending email-change OTP for this user
      await OtpCode.deleteMany({
        purpose: 'email_change',
        'payload.userId': String(user._id),
      });

      const code = generateOtpCode();
      await OtpCode.create({
        target: req.body.newEmail,
        channel: 'email',
        code,
        purpose: 'email_change',
        expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
        payload: { userId: String(user._id), newEmail: req.body.newEmail },
      });

      await emailService.sendEmailChangeCode(req.body.newEmail, code);
      return { ok: true as const };
    },
  );

  // ===== Confirm email change =====
  app.post(
    '/me/email/confirm-change',
    {
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: z.object({ code: z.string().length(6) }),
        response: { 200: userPublicSchema },
      },
    },
    async (req) => {
      const otp = await OtpCode.findOne({
        purpose: 'email_change',
        'payload.userId': req.user.sub,
      }).sort({ createdAt: -1 });

      if (!otp) {
        throw Errors.notFound(
          ErrorMessages.NO_PENDING_EMAIL_CHANGE,
          ErrorCodes.NO_PENDING_EMAIL_CHANGE,
        );
      }
      if (otp.expiresAt.getTime() < Date.now()) {
        await otp.deleteOne();
        throw Errors.badRequest(ErrorMessages.OTP_EXPIRED, ErrorCodes.OTP_EXPIRED);
      }
      if ((otp.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
        await otp.deleteOne();
        throw Errors.tooMany(ErrorMessages.OTP_TOO_MANY_ATTEMPTS, ErrorCodes.OTP_TOO_MANY_ATTEMPTS);
      }

      if (otp.code !== req.body.code) {
        otp.attempts = (otp.attempts ?? 0) + 1;
        await otp.save();
        throw Errors.badRequest(ErrorMessages.OTP_INVALID, ErrorCodes.OTP_INVALID);
      }

      const newEmail = (otp.payload as { newEmail?: string } | null)?.newEmail;
      if (!newEmail) {
        await otp.deleteOne();
        throw Errors.badRequest(
          ErrorMessages.OTP_PENDING_BROKEN,
          ErrorCodes.OTP_PENDING_BROKEN,
        );
      }

      // Re-check uniqueness at confirm time (race protection)
      const taken = await User.findOne({ email: newEmail });
      if (taken && String(taken._id) !== req.user.sub) {
        await otp.deleteOne();
        throw Errors.conflict(ErrorMessages.EMAIL_IN_USE, ErrorCodes.EMAIL_IN_USE);
      }

      const user = await User.findByIdAndUpdate(
        req.user.sub,
        { $set: { email: newEmail, emailVerified: true } },
        { new: true },
      );
      if (!user) throw Errors.notFound(ErrorMessages.USER_NOT_FOUND, ErrorCodes.USER_NOT_FOUND);

      await otp.deleteOne();
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
      if (!user) throw Errors.notFound(ErrorMessages.USER_NOT_FOUND, ErrorCodes.USER_NOT_FOUND);

      const ok = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!ok) {
        throw Errors.unauthorized(
          ErrorMessages.CURRENT_PASSWORD_WRONG,
          ErrorCodes.CURRENT_PASSWORD_WRONG,
        );
      }

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
