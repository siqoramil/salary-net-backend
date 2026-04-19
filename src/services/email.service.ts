import { env } from '../config/env.js';

export interface EmailService {
  sendVerificationEmail(to: string, token: string): Promise<{ ok: true; provider: string }>;
  sendPasswordResetEmail(to: string, token: string): Promise<{ ok: true; provider: string }>;
  sendEmailChangeCode(to: string, code: string): Promise<{ ok: true; provider: string }>;
  sendAccountDeleteCode(to: string, code: string): Promise<{ ok: true; provider: string }>;
}

const IS_DEV = env.NODE_ENV !== 'production';

// Dev-only console logging. Gated strictly to non-production so OTP codes
// and reset tokens never appear in prod stdout/log pipelines.
function devLog(label: string, payload: string): void {
  if (!IS_DEV) return;
  // eslint-disable-next-line no-console
  console.log(`[Email:dev] ${label} ${payload}`);
}

// In production, any attempt to send without a real SMTP integration must
// throw — silent success hides broken flows (email change, password reset,
// verification) from operators until users complain.
function notImplemented(feature: string): never {
  throw new Error(
    `Email provider not implemented for "${feature}". SMTP_HOST is set but ` +
      'nodemailer integration is missing. Wire up emailService before shipping.',
  );
}

export const emailService: EmailService = {
  async sendVerificationEmail(to, token) {
    const link = `https://salarynet.app/verify-email?token=${token}`;
    if (IS_DEV && !env.SMTP_HOST) {
      devLog('verify', `${to} -> ${link}`);
      return { ok: true, provider: 'dev-console' };
    }
    notImplemented('sendVerificationEmail');
  },

  async sendPasswordResetEmail(to, token) {
    const link = `https://salarynet.app/reset-password?token=${token}`;
    if (IS_DEV && !env.SMTP_HOST) {
      devLog('reset', `${to} -> ${link}`);
      return { ok: true, provider: 'dev-console' };
    }
    notImplemented('sendPasswordResetEmail');
  },

  async sendEmailChangeCode(to, code) {
    if (IS_DEV && !env.SMTP_HOST) {
      devLog('email-change code', `${to} -> ${code}`);
      return { ok: true, provider: 'dev-console' };
    }
    notImplemented('sendEmailChangeCode');
  },

  async sendAccountDeleteCode(to, code) {
    if (IS_DEV && !env.SMTP_HOST) {
      devLog('account-delete code', `${to} -> ${code}`);
      return { ok: true, provider: 'dev-console' };
    }
    notImplemented('sendAccountDeleteCode');
  },
};
