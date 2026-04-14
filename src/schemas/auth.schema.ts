import { z } from 'zod';

export const emailSchema = z
  .string({ required_error: 'Please enter your email address.' })
  .email('Please enter a valid email address.')
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string({ required_error: 'Please enter a password.' })
  .min(8, 'Password must be at least 8 characters long.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.');

export const localeSchema = z.enum(['en', 'ru', 'fr', 'es', 'ar', 'zh', 'ko', 'ja']).default('en');

export const signUpSchema = z
  .object({
    fullName: z
      .string({ required_error: 'Please enter your full name.' })
      .min(2, 'Your name must be at least 2 characters long.')
      .max(100, 'Your name is too long.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'Please confirm your password.' }),
    locale: localeSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'The passwords you entered do not match.',
    path: ['confirmPassword'],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  identifier: z
    .string({ required_error: 'Please enter your email address.' })
    .min(3, 'Please enter a valid email address.'),
  password: z
    .string({ required_error: 'Please enter your password.' })
    .min(1, 'Please enter your password.'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Missing refresh token.' })
    .min(10, 'Your session is invalid. Please sign in again.'),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z
    .string({ required_error: 'Please enter your email address.' })
    .email('Please enter a valid email address.'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: 'Missing reset token.' })
      .min(10, 'This reset link is invalid. Please request a new one.'),
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'Please confirm your password.' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'The passwords you entered do not match.',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'Missing verification token.' })
    .min(10, 'This verification link is invalid. Please request a new one.'),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const authResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    fullName: z.string(),
    email: z.string(),
    avatarUrl: z.string().nullable(),
    defaultCurrency: z.enum(['UZS', 'USD', 'EUR', 'RUB']),
    locale: localeSchema,
    emailVerified: z.boolean(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
