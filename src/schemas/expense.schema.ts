import { z } from 'zod';
import { CATEGORY_IDS, CURRENCIES } from '../constants/categories.js';

export const createExpenseSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(CURRENCIES as unknown as [string, ...string[]]),
  category: z.enum(CATEGORY_IDS as unknown as [string, ...string[]]),
  description: z.string().max(500).default(''),
  receiptUrl: z.string().url().nullable().optional(),
  expenseDate: z.coerce.date(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema.partial();
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const listExpensesQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  category: z.enum(CATEGORY_IDS as unknown as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
