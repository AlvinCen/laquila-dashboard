import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { nanoid } from 'nanoid';

const WalletSchema = z.object({
  name: z.string().min(1),
});

export default async function walletRoutes(server: FastifyInstance) {
  server.get('/', async () => {
    return db.prepare('SELECT * FROM wallets ORDER BY name').all();
  });
  server.post('/', async (request, reply) => {
    const result = WalletSchema.safeParse(request.body);
    if (!result.success) return reply.status(400).send(result.error);
    const newWallet = { id: `wall_${nanoid()}`, name: result.data.name };
    db.prepare('INSERT INTO wallets (id, name) VALUES (?, ?)')
      .run(newWallet.id, newWallet.name);
    return reply.status(201).send(newWallet);
  });
   server.delete('/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const info = db.prepare('DELETE FROM wallets WHERE id = ?').run(id);
      if (info.changes === 0) return reply.status(404).send({ message: 'Wallet not found' });
      return { success: true };
  });
}
