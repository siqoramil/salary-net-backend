import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { chatService } from '../services/chat.service.js';

const conversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});

function serializeConversation(c: {
  _id: { toString(): string };
  title?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: c._id.toString(),
    title: c.title ?? null,
    createdAt: (c.createdAt ?? new Date()).toISOString(),
    updatedAt: (c.updatedAt ?? new Date()).toISOString(),
  };
}

function serializeMessage(m: {
  _id: { toString(): string };
  conversationId: { toString(): string };
  role: 'user' | 'assistant';
  content: string;
  metadata?: unknown;
  createdAt?: Date;
}) {
  return {
    id: m._id.toString(),
    conversationId: m.conversationId.toString(),
    role: m.role,
    content: m.content,
    metadata: m.metadata ?? null,
    createdAt: (m.createdAt ?? new Date()).toISOString(),
  };
}

export async function chatRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.addHook('onRequest', app.authenticate);

  // ===== List conversations =====
  app.get(
    '/conversations',
    {
      schema: {
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(conversationSchema) },
      },
    },
    async (req) => {
      const items = await chatService.listConversations(req.user.sub);
      return items.map(serializeConversation);
    },
  );

  // ===== Create conversation =====
  app.post(
    '/conversations',
    {
      schema: {
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        body: z.object({ title: z.string().max(200).optional() }),
        response: { 200: conversationSchema },
      },
    },
    async (req) => {
      const conv = await chatService.createConversation(req.user.sub, req.body.title);
      return serializeConversation(conv);
    },
  );

  // ===== Get or create latest =====
  app.get(
    '/conversations/latest',
    {
      schema: {
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        response: { 200: conversationSchema },
      },
    },
    async (req) => {
      const conv = await chatService.getOrCreateLatest(req.user.sub);
      return serializeConversation(conv);
    },
  );

  // ===== List messages =====
  app.get(
    '/conversations/:id/messages',
    {
      schema: {
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(50),
          before: z.string().optional(),
        }),
        response: { 200: z.array(messageSchema) },
      },
    },
    async (req) => {
      const items = await chatService.listMessages(
        req.params.id,
        req.user.sub,
        req.query.limit,
        req.query.before,
      );
      return items.map(serializeMessage);
    },
  );

  // ===== Send message =====
  app.post(
    '/conversations/:id/messages',
    {
      schema: {
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        body: z.object({ content: z.string().min(1).max(4000) }),
        response: { 200: messageSchema },
      },
    },
    async (req) => {
      const msg = await chatService.sendMessage(
        req.params.id,
        req.user.sub,
        req.body.content,
      );
      return serializeMessage(msg);
    },
  );

  // ===== Delete conversation =====
  app.delete(
    '/conversations/:id',
    {
      schema: {
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      await chatService.deleteConversation(req.params.id, req.user.sub);
      return { ok: true as const };
    },
  );
}
