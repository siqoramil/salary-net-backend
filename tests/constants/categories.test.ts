import { describe, it, expect } from 'vitest';
import {
  EXPENSE_CATEGORIES,
  CATEGORY_IDS,
  CURRENCIES,
  LOCALES,
} from '../../src/constants/categories.js';

describe('expense category constants', () => {
  it('CATEGORY_IDS mirrors the category list in order', () => {
    expect(CATEGORY_IDS).toEqual(EXPENSE_CATEGORIES.map((c) => c.id));
  });

  it('every category has a non-empty icon and color', () => {
    for (const c of EXPENSE_CATEGORIES) {
      expect(c.icon).toBeTruthy();
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('category ids are unique', () => {
    expect(new Set(CATEGORY_IDS).size).toBe(CATEGORY_IDS.length);
  });

  it('includes the baseline currencies', () => {
    expect(CURRENCIES).toContain('UZS');
    expect(CURRENCIES).toContain('USD');
  });

  it('locales contains en + ru at minimum', () => {
    expect(LOCALES).toContain('en');
    expect(LOCALES).toContain('ru');
  });
});
