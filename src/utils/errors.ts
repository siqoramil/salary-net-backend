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
  badRequest: (message = 'Bad request', details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Unauthorized') =>
    new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Forbidden') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found') =>
    new AppError(404, 'NOT_FOUND', message),
  conflict: (message = 'Conflict') =>
    new AppError(409, 'CONFLICT', message),
  tooMany: (message = 'Too many requests') =>
    new AppError(429, 'TOO_MANY_REQUESTS', message),
  internal: (message = 'Internal server error') =>
    new AppError(500, 'INTERNAL_ERROR', message),
};
