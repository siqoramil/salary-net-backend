import { env } from '../config/env.js';

export interface EmailService {
  sendVerificationEmail(to: string, token: string): Promise<{ ok: true; provider: string }>;
  sendPasswordResetEmail(to: string, token: string): Promise<{ ok: true; provider: string }>;
  sendEmailChangeCode(to: string, code: string): Promise<{ ok: true; provider: string }>;
}

// NOTE: Real SMTP integration via nodemailer can be added once SMTP creds are available.
// For now, this is a dev-friendly stub that logs the link to the console.
export const emailService: EmailService = {
  async sendVerificationEmail(to, token) {
    const link = `https://salarynet.app/verify-email?token=${token}`;
    if (!env.SMTP_HOST) {
      // eslint-disable-next-line no-console
      console.log(`[Email:dev] verify ${to} -> ${link}`);
      return { ok: true, provider: 'dev-console' };
    }
    // TODO: integrate nodemailer here
    // eslint-disable-next-line no-console
    console.log(`[Email:smtp-stub] would send verify to ${to}: ${link}`);
    return { ok: true, provider: 'smtp-stub' };
  },

  async sendPasswordResetEmail(to, token) {
    const link = `https://salarynet.app/reset-password?token=${token}`;
    if (!env.SMTP_HOST) {
      // eslint-disable-next-line no-console
      console.log(`[Email:dev] reset ${to} -> ${link}`);
      return { ok: true, provider: 'dev-console' };
    }
    // eslint-disable-next-line no-console
    console.log(`[Email:smtp-stub] would send reset to ${to}: ${link}`);
    return { ok: true, provider: 'smtp-stub' };
  },

  async sendEmailChangeCode(to, code) {
    if (!env.SMTP_HOST) {
      // eslint-disable-next-line no-console
      console.log(`[Email:dev] email-change code ${to} -> ${code}`);
      return { ok: true, provider: 'dev-console' };
    }
    // eslint-disable-next-line no-console
    console.log(`[Email:smtp-stub] would send email-change code to ${to}: ${code}`);
    return { ok: true, provider: 'smtp-stub' };
  },
};
