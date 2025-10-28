import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { db } from './db';

// Import routes
import healthRoutes from './routes/health';
import productRoutes from './routes/products';
import walletRoutes from './routes/wallets';
import financeCategoryRoutes from './routes/financeCategories';
import orderRoutes from './routes/orders';
import cashFlowRoutes from './routes/cashflow';
import settlementRoutes from './routes/settlements';
import analyticsRoutes from './routes/analytics';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import devRoutes from './routes/dev';

declare module 'fastify' {
    interface FastifyInstance {
        auth: any;
    }
}

// FIX: Removed the problematic `declare module '@fastify/jwt'` block which caused a "module not found" error. Type errors related to missing plugin properties on Fastify objects will be handled with type assertions in the respective route files.

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
    },
  },
  bodyLimit: 1024 * 1024, // 1MB
});

// Register plugins
server.register(cors, {
  origin: 'http://localhost:3000',
  credentials: true,
});

server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

server.register(cookie);
server.register(jwt, {
    secret: process.env.JWT_SECRET || 'change_me_dev_secret',
    cookie: {
        cookieName: process.env.JWT_COOKIE_NAME || 'laquila_token',
        signed: false, // The JWT is already signed
    }
});

server.decorate('auth', async (request, reply) => {
    try {
        await (request as any).jwtVerify();
    } catch (err) {
        reply.status(401).send({ message: 'Unauthorized' });
    }
});

// Register routes
server.register(healthRoutes, { prefix: '/api' });
server.register(productRoutes, { prefix: '/api/products' });
server.register(walletRoutes, { prefix: '/api/wallets' });
server.register(financeCategoryRoutes, { prefix: '/api/finance-categories' });
server.register(orderRoutes, { prefix: '/api/orders' });
server.register(cashFlowRoutes, { prefix: '/api/cashflow' });
server.register(settlementRoutes, { prefix: '/api/settlements' });
server.register(analyticsRoutes, { prefix: '/api/analytics' });
server.register(authRoutes, { prefix: '/api/auth' });
server.register(userRoutes, { prefix: '/api/users' });
server.register(devRoutes, { prefix: '/api/dev' });

// Centralized error handler
server.setErrorHandler((error, request, reply) => {
    if (error.validation) {
        server.log.warn(`Validation error for ${request.method} ${request.url}: ${JSON.stringify(error.validation)}`);
        reply.status(400).send({
            message: 'Validation failed',
            errors: error.validation,
        });
    } else {
        server.log.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
});


const start = async () => {
  try {
    // Check DB connection
    const result = db.prepare('SELECT 1').get();
    server.log.info('Database connection successful.');

    await server.listen({ port: 4000 });
    server.log.info(`Server listening on http://localhost:4000`);
  } catch (err) {
    server.log.error(err);
    // FIX: Cast `process` to `any` to resolve TypeScript error about missing `exit` property.
    (process as any).exit(1);
  }
};

start();