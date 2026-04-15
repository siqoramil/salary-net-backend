import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { env } from '../config/env.js';
import { Errors } from '../utils/errors.js';
import { ErrorCodes, ErrorMessages } from '../utils/messages.js';
import { authService } from '../services/auth.service.js';
import {
  signUpSchema,
  signInSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  authResponseSchema,
} from '../schemas/auth.schema.js';
import type { UserDoc } from '../models/user.model.js';

function userToPublic(user: UserDoc) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    defaultCurrency: user.defaultCurrency,
    locale: user.locale,
    emailVerified: user.emailVerified,
  };
}

async function issueTokens(app: FastifyInstance, userId: string) {
  const accessToken = await app.jwt.sign(
    { sub: userId, type: 'access' },
    { expiresIn: env.JWT_ACCESS_TTL },
  );
  const refreshToken = await app.jwt.sign(
    { sub: userId, type: 'refresh' },
    { key: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_TTL },
  );
  await authService.storeRefreshToken(userId, refreshToken);
  return { accessToken, refreshToken };
}

// Tight rate limit for credential-testing endpoints. 10 attempts per
// 15 minutes per IP. Blocks brute-force against valid emails.
const AUTH_RATE_LIMIT = {
  max: 10,
  timeWindow: '15 minutes',
};

export async function authRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ===== Sign up =====
  app.post(
    '/signup',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Register a new user with email and password',
        body: signUpSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (req) => {
      const user = await authService.signUp(req.body);
      const tokens = await issueTokens(app, String(user._id));
      return { user: userToPublic(user), ...tokens };
    },
  );

  // ===== Sign in =====
  app.post(
    '/signin',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Sign in with email and password',
        body: signInSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (req) => {
      const user = await authService.signIn(req.body);
      const tokens = await issueTokens(app, String(user._id));
      return { user: userToPublic(user), ...tokens };
    },
  );

  // ===== Refresh =====
  app.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Refresh access token',
        body: refreshSchema,
        response: {
          200: z.object({ accessToken: z.string(), refreshToken: z.string() }),
        },
      },
    },
    async (req) => {
      let decoded: { sub: string; type: 'access' | 'refresh' };
      try {
        decoded = await app.jwt.verify<{ sub: string; type: 'access' | 'refresh' }>(
          req.body.refreshToken,
          { key: env.JWT_REFRESH_SECRET },
        );
      } catch {
        throw Errors.unauthorized(ErrorMessages.REFRESH_INVALID, ErrorCodes.REFRESH_INVALID);
      }
      if (decoded.type !== 'refresh') {
        throw Errors.unauthorized(ErrorMessages.REFRESH_INVALID, ErrorCodes.REFRESH_INVALID);
      }
      const valid = await authService.isRefreshTokenValid(decoded.sub, req.body.refreshToken);
      if (!valid) {
        throw Errors.unauthorized(ErrorMessages.REFRESH_REVOKED, ErrorCodes.REFRESH_REVOKED);
      }
      await authService.revokeRefreshToken(decoded.sub, req.body.refreshToken);
      return issueTokens(app, decoded.sub);
    },
  );

  // ===== Forgot password =====
  app.post(
    '/forgot-password',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Request password reset email',
        body: forgotPasswordSchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => authService.forgotPassword(req.body),
  );

  // ===== Reset password =====
  app.post(
    '/reset-password',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Set new password using reset token',
        body: resetPasswordSchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      await authService.resetPassword(req.body);
      return { ok: true as const };
    },
  );

  // ===== Verify email =====
  app.post(
    '/verify-email',
    {
      schema: {
        tags: ['auth'],
        summary: 'Verify email via opaque token',
        body: verifyEmailSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (req) => {
      const user = await authService.verifyEmail(req.body.token);
      const tokens = await issueTokens(app, String(user._id));
      return { user: userToPublic(user), ...tokens };
    },
  );

  // ===== Logout =====
  app.post(
    '/logout',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Logout (revoke refresh token)',
        security: [{ bearerAuth: [] }],
        body: z.object({ refreshToken: z.string().optional() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const userId = req.user.sub;
      if (req.body.refreshToken) {
        await authService.revokeRefreshToken(userId, req.body.refreshToken);
      } else {
        await authService.revokeAllRefreshTokens(userId);
      }
      return { ok: true as const };
    },
  );
}
