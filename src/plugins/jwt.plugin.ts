import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; type: 'access' | 'refresh' };
    user: { sub: string; type: 'access' | 'refresh' };
  }
}

async function jwtPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: {
      private: env.JWT_ACCESS_SECRET,
      public: env.JWT_ACCESS_SECRET,
    },
    sign: { expiresIn: env.JWT_ACCESS_TTL },
  });

  app.decorate('authenticate', async (req, reply) => {
    try {
      await req.jwtVerify();
      if (req.user.type !== 'access') {
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token type' });
      }
    } catch {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }
  });
}

export default fp(jwtPlugin, { name: 'jwt-plugin' });
