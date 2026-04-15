import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { expenseService } from '../services/expense.service.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
} from '../schemas/expense.schema.js';

const expenseResponseSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  category: z.string(),
  description: z.string(),
  receiptUrl: z.string().nullable(),
  expenseDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function serializeExpense(doc: {
  _id: { toString(): string };
  amount: number;
  currency: string;
  category: string;
  description?: string;
  receiptUrl?: string | null;
  expenseDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    amount: doc.amount,
    currency: doc.currency,
    category: doc.category,
    description: doc.description ?? '',
    receiptUrl: doc.receiptUrl ?? null,
    expenseDate: doc.expenseDate.toISOString(),
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
  };
}

export async function expenseRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('onRequest', app.authenticate);

  // ===== List =====
  app.get(
    '/',
    {
      schema: {
        tags: ['expenses'],
        summary: 'List expenses (paginated)',
        security: [{ bearerAuth: [] }],
        querystring: listExpensesQuerySchema,
        response: {
          200: z.object({
            items: z.array(expenseResponseSchema),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    async (req) => {
      const { items, nextCursor } = await expenseService.list(req.user.sub, req.query);
      return { items: items.map(serializeExpense), nextCursor };
    },
  );

  // ===== Create =====
  app.post(
    '/',
    {
      schema: {
        tags: ['expenses'],
        summary: 'Create expense',
        security: [{ bearerAuth: [] }],
        body: createExpenseSchema,
        response: { 200: expenseResponseSchema },
      },
    },
    async (req) => {
      const doc = await expenseService.create(req.user.sub, req.body);
      return serializeExpense(doc);
    },
  );

  // ===== Summary ===== (static routes before /:id)
  app.get(
    '/summary',
    {
      schema: {
        tags: ['expenses'],
        summary: 'Aggregate totals for a period',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
          date: z.coerce.date().optional(),
        }),
        response: {
          200: z.object({
            period: z.string(),
            from: z.string(),
            to: z.string(),
            byCurrency: z.array(
              z.object({
                currency: z.string(),
                total: z.number(),
                count: z.number(),
              }),
            ),
          }),
        },
      },
    },
    async (req) => expenseService.summary(req.user.sub, req.query.period, req.query.date ?? new Date()),
  );

  // ===== By category =====
  app.get(
    '/by-category',
    {
      schema: {
        tags: ['expenses'],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          from: z.coerce.date(),
          to: z.coerce.date(),
        }),
        response: {
          200: z.array(
            z.object({
              category: z.string(),
              currency: z.string(),
              total: z.number(),
              count: z.number(),
            }),
          ),
        },
      },
    },
    async (req) => expenseService.byCategory(req.user.sub, req.query.from, req.query.to),
  );

  // ===== Trends =====
  app.get(
    '/trends',
    {
      schema: {
        tags: ['expenses'],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          from: z.coerce.date(),
          to: z.coerce.date(),
          granularity: z.enum(['day', 'week', 'month']).default('day'),
        }),
        response: {
          200: z.array(
            z.object({
              bucket: z.string(),
              total: z.number(),
            }),
          ),
        },
      },
    },
    async (req) =>
      expenseService.trends(req.user.sub, req.query.from, req.query.to, req.query.granularity),
  );

  // ===== Get one =====
  app.get(
    '/:id',
    {
      schema: {
        tags: ['expenses'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: { 200: expenseResponseSchema },
      },
    },
    async (req) => {
      const doc = await expenseService.getOne(req.user.sub, req.params.id);
      return serializeExpense(doc);
    },
  );

  // ===== Update =====
  app.patch(
    '/:id',
    {
      schema: {
        tags: ['expenses'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        body: updateExpenseSchema,
        response: { 200: expenseResponseSchema },
      },
    },
    async (req) => {
      const doc = await expenseService.update(req.user.sub, req.params.id, req.body);
      return serializeExpense(doc);
    },
  );

  // ===== Delete =====
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['expenses'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      await expenseService.remove(req.user.sub, req.params.id);
      return { ok: true as const };
    },
  );
}
