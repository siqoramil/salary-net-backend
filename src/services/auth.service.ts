import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { User, type UserDoc } from '../models/index.js';
import { redis } from '../db/redis.js';
import { Errors } from '../utils/errors.js';
import { ErrorCodes, ErrorMessages } from '../utils/messages.js';
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

// Per-account brute-force protection. Independent from the per-IP rate limit
// on the /signin route so distributed attacks against a single email still
// get throttled. Counter and lock both live in Redis.
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60; // 15 min
const LOGIN_LOCK_SECONDS = 15 * 60;
const LOGIN_MAX_FAILS = 8;

function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function loginFailKey(email: string): string {
  return `login_fail:${email}`;
}

function loginLockKey(email: string): string {
  return `login_lock:${email}`;
}

export const authService = {
  async signUp(input: SignUpInput): Promise<UserDoc> {
    const exists = await User.findOne({ email: input.email }).lean();
    if (exists) throw Errors.conflict(ErrorMessages.EMAIL_TAKEN, ErrorCodes.EMAIL_TAKEN);

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
    const email = input.identifier.toLowerCase().trim();

    // Short-circuit if this account is currently locked. Same 429 code is
    // used for rate-limited scenarios so the client can reuse handling.
    const locked = await redis.get(loginLockKey(email));
    if (locked) {
      throw Errors.tooMany(ErrorMessages.ACCOUNT_LOCKED, ErrorCodes.ACCOUNT_LOCKED);
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Bump the fail counter even for non-existent emails so probing
      // yields the same lockout as real accounts (no enumeration signal).
      await authService.recordLoginFailure(email);
      throw Errors.unauthorized(ErrorMessages.INVALID_CREDENTIALS, ErrorCodes.INVALID_CREDENTIALS);
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      await authService.recordLoginFailure(email);
      throw Errors.unauthorized(ErrorMessages.INVALID_CREDENTIALS, ErrorCodes.INVALID_CREDENTIALS);
    }

    // Success — clear any pending fail counter for this account.
    await redis.del(loginFailKey(email));
    return user;
  },

  async recordLoginFailure(email: string): Promise<void> {
    const key = loginFailKey(email);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, LOGIN_FAIL_WINDOW_SECONDS);
    if (count >= LOGIN_MAX_FAILS) {
      await redis.setex(loginLockKey(email), LOGIN_LOCK_SECONDS, '1');
      await redis.del(key);
    }
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
    if (!userId) {
      throw Errors.badRequest(ErrorMessages.RESET_TOKEN_INVALID, ErrorCodes.RESET_TOKEN_INVALID);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    await User.updateOne({ _id: userId }, { $set: { passwordHash } });
    await redis.del(`pw_reset:${input.token}`);
  },

  async verifyEmail(token: string): Promise<UserDoc> {
    const userId = await redis.get(`email_verify:${token}`);
    if (!userId) {
      throw Errors.badRequest(ErrorMessages.VERIFY_TOKEN_INVALID, ErrorCodes.VERIFY_TOKEN_INVALID);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { emailVerified: true } },
      { new: true },
    );
    if (!user) throw Errors.notFound(ErrorMessages.USER_NOT_FOUND, ErrorCodes.USER_NOT_FOUND);

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
