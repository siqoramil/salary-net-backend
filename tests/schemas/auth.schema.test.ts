import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  signUpSchema,
  signInSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../src/schemas/auth.schema.js';

describe('emailSchema', () => {
  it('lowercases the email', () => {
    expect(emailSchema.parse('Me@Example.COM')).toBe('me@example.com');
  });

  it('rejects invalid email', () => {
    expect(emailSchema.safeParse('nope').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it.each([
    ['Short1!', false, 'too short'],
    ['alllowercase1!', false, 'no uppercase'],
    ['NoDigits!', false, 'no digit'],
    ['NoSpecial1', false, 'no special char'],
    ['Valid1Pass!', true, 'valid'],
  ])('password "%s" valid=%s (%s)', (pw, valid) => {
    expect(passwordSchema.safeParse(pw).success).toBe(valid);
  });
});

describe('signUpSchema', () => {
  const base = {
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    password: 'Valid1Pass!',
    confirmPassword: 'Valid1Pass!',
    locale: 'en' as const,
  };

  it('accepts a well-formed body', () => {
    expect(signUpSchema.parse(base).email).toBe('jane@example.com');
  });

  it('defaults locale to en when omitted', () => {
    const { locale: _locale, ...rest } = base;
    const parsed = signUpSchema.parse(rest);
    expect(parsed.locale).toBe('en');
  });

  it('rejects mismatched passwords', () => {
    const result = signUpSchema.safeParse({ ...base, confirmPassword: 'Different1Pass!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.issues.find((i) => i.path[0] === 'confirmPassword');
      expect(err?.message).toMatch(/do not match/i);
    }
  });

  it('rejects short names', () => {
    expect(signUpSchema.safeParse({ ...base, fullName: 'J' }).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('requires identifier and password', () => {
    expect(signInSchema.safeParse({ identifier: 'me@x.com', password: 'x' }).success).toBe(true);
    expect(signInSchema.safeParse({ identifier: '', password: 'x' }).success).toBe(false);
    expect(signInSchema.safeParse({ identifier: 'me@x.com', password: '' }).success).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('rejects tokens shorter than 10 chars', () => {
    expect(refreshSchema.safeParse({ refreshToken: 'short' }).success).toBe(false);
    expect(refreshSchema.safeParse({ refreshToken: 'a'.repeat(20) }).success).toBe(true);
  });
});

describe('forgotPasswordSchema', () => {
  it('requires a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ identifier: 'me@x.com' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ identifier: 'not-email' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('requires matching passwords and a non-trivial token', () => {
    const ok = resetPasswordSchema.safeParse({
      token: 'a'.repeat(20),
      password: 'Valid1Pass!',
      confirmPassword: 'Valid1Pass!',
    });
    expect(ok.success).toBe(true);

    const mismatch = resetPasswordSchema.safeParse({
      token: 'a'.repeat(20),
      password: 'Valid1Pass!',
      confirmPassword: 'Other1Pass!',
    });
    expect(mismatch.success).toBe(false);
  });
});
