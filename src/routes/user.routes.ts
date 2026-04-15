import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcrypt';
import { z } from 'zod';

import { User, Expense, Budget, Conversation, Message } from '../models/index.js';
import { OtpCode } from '../models/otpCode.model.js';
import { Errors } from '../utils/errors.js';
import { ErrorCodes, ErrorMessages } from '../utils/messages.js';
import { passwordSchema, localeSchema, emailSchema } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';
import { emailService } from '../services/email.service.js';
import type { UserDoc } from '../models/user.model.js';

const EMAIL_CHANGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_CODE_LENGTH = 8;

// Cryptographically random alphanumeric OTP (no ambiguous chars).
// 8 chars from a 32-char alphabet → 32^8 ≈ 10^12 entropy.
function generateOtpCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const bytes = crypto.randomBytes(OTP_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < OTP_CODE_LENGTH; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
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
        body: z.object({ code: z.string().length(OTP_CODE_LENGTH) }),
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

      const providedBuf = Buffer.from(req.body.code);
      const storedBuf = Buffer.from(otp.code);
      const codeMatches =
        providedBuf.length === storedBuf.length &&
        crypto.timingSafeEqual(providedBuf, storedBuf);
      if (!codeMatches) {
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

      // Security: revoke all existing refresh tokens so other sessions are
      // signed out. The current client will refresh on next 401.
      await authService.revokeAllRefreshTokens(String(user._id));

      return { ok: true as const };
    },
  );

  // ===== Delete account =====
  // Requires current-password re-confirmation. Cascades through all user-
  // owned collections so no orphan data remains after deletion.
  app.delete(
    '/me',
    {
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: z.object({ currentPassword: z.string().min(1) }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const userId = req.user.sub;
      const user = await User.findById(userId);
      if (!user) throw Errors.notFound(ErrorMessages.USER_NOT_FOUND, ErrorCodes.USER_NOT_FOUND);

      const ok = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!ok) {
        throw Errors.unauthorized(
          ErrorMessages.CURRENT_PASSWORD_WRONG,
          ErrorCodes.CURRENT_PASSWORD_WRONG,
        );
      }

      // Collect receipt files for best-effort cleanup from disk.
      const userExpenses = await Expense.find(
        { userId, receiptUrl: { $ne: null } },
        { receiptUrl: 1 },
      ).lean();

      // Find the user's conversations so we can delete their messages too,
      // since Message is linked by conversationId (no direct userId field).
      const convIds = await Conversation.find({ userId }, { _id: 1 }).lean();

      await Promise.all([
        Expense.deleteMany({ userId }),
        Budget.deleteMany({ userId }),
        Message.deleteMany({ conversationId: { $in: convIds.map((c) => c._id) } }),
        Conversation.deleteMany({ userId }),
        OtpCode.deleteMany({ 'payload.userId': userId }),
        authService.revokeAllRefreshTokens(userId),
      ]);

      await User.findByIdAndDelete(userId);

      // Best-effort removal of uploaded receipt images after DB cleanup.
      for (const exp of userExpenses) {
        if (!exp.receiptUrl) continue;
        try {
          const staticPath = new URL(exp.receiptUrl).pathname;
          if (!staticPath.startsWith('/static/')) continue;
          const filePath = path.join(
            process.cwd(),
            'uploads',
            staticPath.replace('/static/', ''),
          );
          fs.unlink(filePath).catch(() => {});
        } catch {
          // ignore malformed URLs
        }
      }

      // Also unlink the avatar, if any.
      if (user.avatarUrl) {
        try {
          const staticPath = new URL(user.avatarUrl).pathname;
          if (staticPath.startsWith('/static/')) {
            const filePath = path.join(
              process.cwd(),
              'uploads',
              staticPath.replace('/static/', ''),
            );
            fs.unlink(filePath).catch(() => {});
          }
        } catch {
          // ignore
        }
      }

      return { ok: true as const };
    },
  );
}
