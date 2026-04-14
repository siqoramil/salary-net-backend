export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  badRequest: (message = 'Bad request', code = 'BAD_REQUEST', details?: unknown) =>
    new AppError(400, code, message, details),
  unauthorized: (message = 'Unauthorized', code = 'UNAUTHORIZED') =>
    new AppError(401, code, message),
  forbidden: (message = 'Forbidden', code = 'FORBIDDEN') =>
    new AppError(403, code, message),
  notFound: (message = 'Not found', code = 'NOT_FOUND') =>
    new AppError(404, code, message),
  conflict: (message = 'Conflict', code = 'CONFLICT') =>
    new AppError(409, code, message),
  tooMany: (message = 'Too many requests', code = 'TOO_MANY_REQUESTS') =>
    new AppError(429, code, message),
  internal: (message = 'Internal server error', code = 'INTERNAL_ERROR') =>
    new AppError(500, code, message),
};
