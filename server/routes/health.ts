import { FastifyInstance, FastifyPluginOptions } from 'fastify';

export default async function healthRoutes(server: FastifyInstance, options: FastifyPluginOptions) {
  server.get('/health', async (request, reply) => {
    return { ok: true, timestamp: new Date().toISOString() };
  });
}
