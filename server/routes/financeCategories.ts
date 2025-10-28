import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { nanoid } from 'nanoid';

const CategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
});

export default async function financeCategoryRoutes(server: FastifyInstance) {
  server.get('/', async () => {
    return db.prepare('SELECT * FROM finance_categories ORDER BY type, name').all();
  });

  server.post('/', async (request, reply) => {
    const result = CategorySchema.safeParse(request.body);
    if (!result.success) return reply.status(400).send(result.error);
    const newCategory = { id: `fin_${nanoid()}`, ...result.data };
    db.prepare('INSERT INTO finance_categories (id, name, type) VALUES (?, ?, ?)')
      .run(newCategory.id, newCategory.name, newCategory.type);
    return reply.status(201).send(newCategory);
  });

  server.delete('/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const info = db.prepare('DELETE FROM finance_categories WHERE id = ?').run(id);
      if (info.changes === 0) return reply.status(404).send({ message: 'Category not found' });
      return { success: true };
  });
}
