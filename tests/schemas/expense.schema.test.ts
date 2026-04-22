import { describe, it, expect } from 'vitest';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
} from '../../src/schemas/expense.schema.js';

describe('createExpenseSchema', () => {
  const base = {
    amount: 10000,
    currency: 'UZS',
    category: 'food',
    description: 'lunch',
    expenseDate: '2026-04-20T10:00:00.000Z',
  };

  it('accepts a valid body and coerces expenseDate to Date', () => {
    const parsed = createExpenseSchema.parse(base);
    expect(parsed.expenseDate).toBeInstanceOf(Date);
    expect(parsed.description).toBe('lunch');
  });

  it('defaults description to empty string when omitted', () => {
    const { description: _d, ...rest } = base;
    const parsed = createExpenseSchema.parse(rest);
    expect(parsed.description).toBe('');
  });

  it('rejects non-positive amounts', () => {
    expect(createExpenseSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...base, amount: -5 }).success).toBe(false);
  });

  it('rejects unknown categories and currencies', () => {
    expect(createExpenseSchema.safeParse({ ...base, category: 'bribes' }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...base, currency: 'BTC' }).success).toBe(false);
  });

  it('accepts null or omitted receiptUrl', () => {
    expect(createExpenseSchema.safeParse({ ...base, receiptUrl: null }).success).toBe(true);
    expect(createExpenseSchema.safeParse({ ...base }).success).toBe(true);
  });

  it('rejects malformed receiptUrl', () => {
    expect(createExpenseSchema.safeParse({ ...base, receiptUrl: 'not-a-url' }).success).toBe(false);
  });
});

describe('updateExpenseSchema', () => {
  it('is a partial — all fields optional', () => {
    expect(updateExpenseSchema.safeParse({}).success).toBe(true);
    expect(updateExpenseSchema.safeParse({ amount: 50 }).success).toBe(true);
  });
});

describe('listExpensesQuerySchema', () => {
  it('defaults limit to 20', () => {
    expect(listExpensesQuerySchema.parse({}).limit).toBe(20);
  });

  it('coerces limit from string and clamps to 1..100', () => {
    expect(listExpensesQuerySchema.parse({ limit: '15' }).limit).toBe(15);
    expect(listExpensesQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listExpensesQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('coerces date strings to Date', () => {
    const parsed = listExpensesQuerySchema.parse({
      from: '2026-01-01',
      to: '2026-02-01',
    });
    expect(parsed.from).toBeInstanceOf(Date);
    expect(parsed.to).toBeInstanceOf(Date);
  });
});
