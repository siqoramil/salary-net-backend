import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { debtorService } from '../services/debtor.service.js';

const currencyEnum = z.enum(['UZS', 'USD', 'EUR', 'RUB']);
const typeEnum = z.enum(['lent', 'borrowed']);

const debtorResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  personName: z.string(),
  amount: z.number(),
  currency: z.string(),
  date: z.string(),
  description: z.string(),
  isSettled: z.boolean(),
  settledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function serializeDebtor(doc: {
  _id: { toString(): string };
  type: string;
  personName: string;
  amount: number;
  currency: string;
  date: Date;
  description?: string;
  isSettled: boolean;
  settledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    personName: doc.personName,
    amount: doc.amount,
    currency: doc.currency,
    date: doc.date.toISOString(),
    description: doc.description ?? '',
    isSettled: doc.isSettled,
    settledAt: doc.settledAt ? doc.settledAt.toISOString() : null,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
  };
}

const createDebtorSchema = z.object({
  type: typeEnum,
  personName: z.string().min(1).max(200),
  amount: z.number().positive(),
  currency: currencyEnum,
  date: z.coerce.date(),
  description: z.string().max(500).optional(),
});

const updateDebtorSchema = z.object({
  personName: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  currency: currencyEnum.optional(),
  date: z.coerce.date().optional(),
  description: z.string().max(500).optional(),
  isSettled: z.boolean().optional(),
  settledAt: z.coerce.date().nullable().optional(),
});

export async function debtorRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('onRequest', app.authenticate);

  // ===== List =====
  app.get(
    '/',
    {
      schema: {
        tags: ['debtors'],
        summary: 'List debt records',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          type: typeEnum.optional(),
          isSettled: z.coerce.boolean().optional(),
        }),
        response: { 200: z.array(debtorResponseSchema) },
      },
    },
    async (req) => {
      const docs = await debtorService.list(req.user.sub, req.query);
      return docs.map(serializeDebtor);
    },
  );

  // ===== Create =====
  app.post(
    '/',
    {
      schema: {
        tags: ['debtors'],
        summary: 'Create debt record',
        security: [{ bearerAuth: [] }],
        body: createDebtorSchema,
        response: { 200: debtorResponseSchema },
      },
    },
    async (req) => {
      const doc = await debtorService.create(req.user.sub, req.body);
      return serializeDebtor(doc);
    },
  );

  // ===== Mark settled =====
  app.post(
    '/:id/settled',
    {
      schema: {
        tags: ['debtors'],
        summary: 'Mark debt as settled',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: { 200: debtorResponseSchema },
      },
    },
    async (req) => {
      const doc = await debtorService.markSettled(req.user.sub, req.params.id);
      return serializeDebtor(doc);
    },
  );

  // ===== Get one =====
  app.get(
    '/:id',
    {
      schema: {
        tags: ['debtors'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: { 200: debtorResponseSchema },
      },
    },
    async (req) => {
      const doc = await debtorService.getOne(req.user.sub, req.params.id);
      return serializeDebtor(doc);
    },
  );

  // ===== Update =====
  app.patch(
    '/:id',
    {
      schema: {
        tags: ['debtors'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        body: updateDebtorSchema,
        response: { 200: debtorResponseSchema },
      },
    },
    async (req) => {
      const doc = await debtorService.update(req.user.sub, req.params.id, req.body);
      return serializeDebtor(doc);
    },
  );

  // ===== Delete =====
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['debtors'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      await debtorService.remove(req.user.sub, req.params.id);
      return { ok: true as const };
    },
  );
}
