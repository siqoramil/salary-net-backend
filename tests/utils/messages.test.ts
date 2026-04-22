import { describe, it, expect } from 'vitest';
import { ErrorCodes, ErrorMessages } from '../../src/utils/messages.js';

describe('ErrorCodes / ErrorMessages', () => {
  it('every code has a matching human message', () => {
    for (const key of Object.keys(ErrorCodes) as (keyof typeof ErrorCodes)[]) {
      expect(ErrorMessages[key], `missing message for ${key}`).toBeTruthy();
      expect(typeof ErrorMessages[key]).toBe('string');
    }
  });

  it('codes match their keys (machine-readable constants)', () => {
    for (const [key, value] of Object.entries(ErrorCodes)) {
      expect(value).toBe(key);
    }
  });
});
