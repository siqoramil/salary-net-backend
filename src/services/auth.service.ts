import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { User, type UserDoc } from '../models/index.js';
import { redis } from '../db/redis.js';
import { Errors } from '../utils/errors.js';
import { emailService } from './email.service.js';
import type {
  SignUpInput,
  SignInInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../schemas/auth.schema.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const RESET_TOKEN_TTL_SECONDS = 60 * 30; // 30 min

function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const authService = {
  async signUp(input: SignUpInput): Promise<UserDoc> {
    const exists = await User.findOne({ email: input.email }).lean();
    if (exists) throw Errors.conflict('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await User.create({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      locale: input.locale,
    });

    const token = generateOpaqueToken();
    await redis.setex(`email_verify:${token}`, RESET_TOKEN_TTL_SECONDS, String(user._id));
    await emailService.sendVerificationEmail(input.email, token);

    return user;
  },

  async signIn(input: SignInInput): Promise<UserDoc> {
    const user = await User.findOne({ email: input.identifier.toLowerCase().trim() });
    if (!user) throw Errors.unauthorized('Invalid credentials');

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw Errors.unauthorized('Invalid credentials');

    return user;
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true }> {
    const user = await User.findOne({ email: input.identifier.toLowerCase() });

    if (user) {
      const token = generateOpaqueToken();
      await redis.setex(`pw_reset:${token}`, RESET_TOKEN_TTL_SECONDS, String(user._id));
      await emailService.sendPasswordResetEmail(input.identifier, token);
    }

    // Always return ok to prevent user enumeration
    return { ok: true };
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const userId = await redis.get(`pw_reset:${input.token}`);
    if (!userId) throw Errors.badRequest('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    await User.updateOne({ _id: userId }, { $set: { passwordHash } });
    await redis.del(`pw_reset:${input.token}`);
  },

  async verifyEmail(token: string): Promise<UserDoc> {
    const userId = await redis.get(`email_verify:${token}`);
    if (!userId) throw Errors.badRequest('Invalid or expired verification token');

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { emailVerified: true } },
      { new: true },
    );
    if (!user) throw Errors.notFound('User not found');

    await redis.del(`email_verify:${token}`);
    return user;
  },

  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await redis.setex(`refresh:${userId}:${hash}`, REFRESH_TOKEN_TTL_SECONDS, '1');
  },

  async isRefreshTokenValid(userId: string, refreshToken: string): Promise<boolean> {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const v = await redis.get(`refresh:${userId}:${hash}`);
    return v === '1';
  },

  async revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await redis.del(`refresh:${userId}:${hash}`);
  },

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const stream = redis.scanStream({ match: `refresh:${userId}:*`, count: 100 });
    const keys: string[] = [];
    for await (const batch of stream) {
      keys.push(...(batch as string[]));
    }
    if (keys.length) await redis.del(...keys);
  },
};
