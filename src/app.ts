import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join } from 'node:path';
import { ZodError } from 'zod';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import { connectMongo, disconnectMongo } from './db/connection.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import jwtPlugin from './plugins/jwt.plugin.js';
import { AppError } from './utils/errors.js';
import { authRoutes } from './routes/auth.routes.js';
import { expenseRoutes } from './routes/expense.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { uploadRoutes } from './routes/upload.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
          : undefined,
    },
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ===== Plugins =====
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });
  await app.register(jwtPlugin);
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  await app.register(staticPlugin, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/static/',
    decorateReply: false,
  });

  // ===== Swagger / Scalar docs =====
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SalaryNet API',
        description: 'AI-powered expense tracker backend',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(scalar, {
    routePrefix: '/docs',
    configuration: { theme: 'purple' },
  });

  // ===== Health =====
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  }));

  // ===== Routes =====
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(expenseRoutes, { prefix: '/api/v1/expenses' });
  await app.register(chatRoutes, { prefix: '/api/v1/chat' });
  await app.register(uploadRoutes, { prefix: '/api/v1/upload' });

  // ===== Error handler =====
  app.setErrorHandler((error: unknown, req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: error.flatten(),
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
    const err = error as { validation?: unknown; message?: string };
    if (err.validation) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: err.message ?? 'Validation failed',
        details: err.validation,
      });
    }
    req.log.error(error);
    return reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message ?? 'Internal',
    });
  });

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await connectMongo();
    app.log.info('MongoDB connected');
    await connectRedis();
    app.log.info('Redis connected');

    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Docs available at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      await disconnectMongo();
      await disconnectRedis();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
