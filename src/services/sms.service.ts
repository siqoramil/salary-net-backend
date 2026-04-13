import { env } from '../config/env.js';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getEskizToken(): Promise<string | null> {
  if (!env.ESKIZ_EMAIL || !env.ESKIZ_PASSWORD) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const form = new FormData();
  form.append('email', env.ESKIZ_EMAIL);
  form.append('password', env.ESKIZ_PASSWORD);

  const res = await fetch(`${env.ESKIZ_BASE_URL}/auth/login`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Eskiz auth failed: ${res.status}`);
  }
  const data = (await res.json()) as { data?: { token?: string } };
  if (!data.data?.token) throw new Error('Eskiz auth: no token in response');

  cachedToken = {
    token: data.data.token,
    expiresAt: Date.now() + 25 * 24 * 60 * 60 * 1000, // 25 days
  };
  return cachedToken.token;
}

export interface SmsService {
  sendOtp(phone: string, code: string): Promise<{ ok: true; provider: string }>;
}

export const smsService: SmsService = {
  async sendOtp(phone, code) {
    const token = await getEskizToken().catch(() => null);

    // Dev fallback: log to console when credentials missing
    if (!token) {
      // eslint-disable-next-line no-console
      console.log(`[SMS:dev] OTP for ${phone}: ${code}`);
      return { ok: true, provider: 'dev-console' };
    }

    const message = `SalaryNet: verification code ${code}. Do not share.`;
    const form = new FormData();
    form.append('mobile_phone', phone.replace('+', ''));
    form.append('message', message);
    form.append('from', env.ESKIZ_SENDER);

    const res = await fetch(`${env.ESKIZ_BASE_URL}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Eskiz send failed: ${res.status} ${text}`);
    }

    return { ok: true, provider: 'eskiz' };
  },
};
