import { env } from '../config/env.js';

export interface EmailService {
  sendVerificationEmail(to: string, token: string): Promise<{ ok: true; provider: string }>;
  sendPasswordResetEmail(to: string, token: string): Promise<{ ok: true; provider: string }>;
  sendEmailChangeCode(to: string, code: string): Promise<{ ok: true; provider: string }>;
}

// Dev-only console logging. In production, if SMTP is not configured we
// silently succeed (acts as a no-op) rather than spraying secrets to stdout.
function devLog(label: string, payload: string): void {
  if (env.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console
  console.log(`[Email:dev] ${label} ${payload}`);
}

// NOTE: Real SMTP integration via nodemailer can be added once SMTP creds are available.
export const emailService: EmailService = {
  async sendVerificationEmail(to, token) {
    const link = `https://salarynet.app/verify-email?token=${token}`;
    if (!env.SMTP_HOST) {
      devLog('verify', `${to} -> ${link}`);
      return { ok: true, provider: env.NODE_ENV === 'production' ? 'noop' : 'dev-console' };
    }
    // TODO: integrate nodemailer here
    return { ok: true, provider: 'smtp-stub' };
  },

  async sendPasswordResetEmail(to, token) {
    const link = `https://salarynet.app/reset-password?token=${token}`;
    if (!env.SMTP_HOST) {
      devLog('reset', `${to} -> ${link}`);
      return { ok: true, provider: env.NODE_ENV === 'production' ? 'noop' : 'dev-console' };
    }
    return { ok: true, provider: 'smtp-stub' };
  },

  async sendEmailChangeCode(to, code) {
    if (!env.SMTP_HOST) {
      devLog('email-change code', `${to} -> ${code}`);
      return { ok: true, provider: env.NODE_ENV === 'production' ? 'noop' : 'dev-console' };
    }
    return { ok: true, provider: 'smtp-stub' };
  },
};
