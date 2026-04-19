// Centralized user-facing error messages. Keep them friendly, specific,
// and actionable so the mobile client can surface them directly in toasts.

export const ErrorMessages = {
  // ===== Auth =====
  EMAIL_TAKEN: 'An account with this email already exists. Try signing in instead.',
  INVALID_CREDENTIALS: 'Wrong email or password. Please try again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  REFRESH_INVALID: 'Your session is no longer valid. Please sign in again.',
  REFRESH_REVOKED: 'You were signed out. Please sign in again.',
  RESET_TOKEN_INVALID: 'This password reset link is invalid or has expired. Request a new one.',
  VERIFY_TOKEN_INVALID: 'This verification link is invalid or has expired. Request a new one.',

  // ===== User / profile =====
  USER_NOT_FOUND: 'Account not found. Please sign in again.',
  EMAIL_UNCHANGED: 'Please enter a different email address.',
  EMAIL_IN_USE: 'This email is already used by another account.',
  CURRENT_PASSWORD_WRONG: 'Your current password is incorrect.',
  ACCOUNT_LOCKED: 'Too many failed login attempts. Please try again in a few minutes.',

  // ===== Email change OTP =====
  NO_PENDING_EMAIL_CHANGE: 'No email change is in progress. Please start again.',
  NO_PENDING_ACCOUNT_DELETE: 'No account deletion is in progress. Please start again.',
  OTP_EXPIRED: 'The verification code has expired. Please request a new one.',
  OTP_TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Please request a new code.',
  OTP_INVALID: 'The code you entered is incorrect. Please try again.',
  OTP_PENDING_BROKEN: 'The pending email change is no longer valid. Please start again.',

  // ===== Expenses =====
  EXPENSE_INVALID_ID: 'That expense link is not valid.',
  EXPENSE_NOT_FOUND: 'This expense no longer exists. It may have been deleted.',

  // ===== Debtors =====
  DEBTOR_INVALID_ID: 'That debtor record link is not valid.',
  DEBTOR_NOT_FOUND: 'This debtor record no longer exists. It may have been deleted.',

  // ===== Chat =====
  CONVERSATION_NOT_FOUND: 'Conversation not found. Start a new chat.',

  // ===== Upload =====
  UPLOAD_NO_FILE: 'No file was selected. Please choose an image.',
  UPLOAD_UNSUPPORTED_TYPE: 'Only JPG, PNG, WebP and HEIC images are supported.',
  UPLOAD_TOO_LARGE: 'That image is too large. Maximum size is 10 MB.',

  // ===== Generic =====
  VALIDATION_FAILED: 'Please check your input and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again in a moment.',
  NOT_FOUND: 'We could not find what you were looking for.',
  FORBIDDEN: 'You do not have permission to do that.',
  TOO_MANY_REQUESTS: 'Too many requests. Please slow down and try again.',
} as const;

// Machine-readable codes (what the mobile client may branch on)
export const ErrorCodes = {
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  REFRESH_INVALID: 'REFRESH_INVALID',
  REFRESH_REVOKED: 'REFRESH_REVOKED',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  VERIFY_TOKEN_INVALID: 'VERIFY_TOKEN_INVALID',

  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_UNCHANGED: 'EMAIL_UNCHANGED',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  CURRENT_PASSWORD_WRONG: 'CURRENT_PASSWORD_WRONG',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  NO_PENDING_EMAIL_CHANGE: 'NO_PENDING_EMAIL_CHANGE',
  NO_PENDING_ACCOUNT_DELETE: 'NO_PENDING_ACCOUNT_DELETE',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_INVALID: 'OTP_INVALID',
  OTP_PENDING_BROKEN: 'OTP_PENDING_BROKEN',

  EXPENSE_INVALID_ID: 'EXPENSE_INVALID_ID',
  EXPENSE_NOT_FOUND: 'EXPENSE_NOT_FOUND',

  DEBTOR_INVALID_ID: 'DEBTOR_INVALID_ID',
  DEBTOR_NOT_FOUND: 'DEBTOR_NOT_FOUND',

  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',

  UPLOAD_NO_FILE: 'UPLOAD_NO_FILE',
  UPLOAD_UNSUPPORTED_TYPE: 'UPLOAD_UNSUPPORTED_TYPE',
  UPLOAD_TOO_LARGE: 'UPLOAD_TOO_LARGE',

  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
} as const;
