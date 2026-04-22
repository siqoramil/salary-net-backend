import { describe, it, expect } from 'vitest';
import { AppError, Errors } from '../../src/utils/errors.js';

describe('AppError', () => {
  it('carries statusCode, code, message, and details', () => {
    const err = new AppError(418, 'TEAPOT', 'I am a teapot', { hint: 'try coffee' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('TEAPOT');
    expect(err.message).toBe('I am a teapot');
    expect(err.details).toEqual({ hint: 'try coffee' });
  });

  it('omits details when not provided', () => {
    const err = new AppError(500, 'X', 'y');
    expect(err.details).toBeUndefined();
  });
});

describe('Errors helpers', () => {
  it('badRequest -> 400', () => {
    const e = Errors.badRequest();
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('BAD_REQUEST');
    expect(e.message).toBe('Bad request');
  });

  it('badRequest supports custom message, code, details', () => {
    const e = Errors.badRequest('nope', 'VALIDATION', { field: 'email' });
    expect(e.code).toBe('VALIDATION');
    expect(e.message).toBe('nope');
    expect(e.details).toEqual({ field: 'email' });
  });

  it.each([
    ['unauthorized', 401, 'UNAUTHORIZED'],
    ['forbidden', 403, 'FORBIDDEN'],
    ['notFound', 404, 'NOT_FOUND'],
    ['conflict', 409, 'CONFLICT'],
    ['tooMany', 429, 'TOO_MANY_REQUESTS'],
    ['internal', 500, 'INTERNAL_ERROR'],
  ] as const)('%s returns AppError with status %d and code %s', (name, status, code) => {
    const e = Errors[name]();
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(status);
    expect(e.code).toBe(code);
  });
});
