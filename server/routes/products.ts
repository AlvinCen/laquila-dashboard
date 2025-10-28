import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { nanoid } from 'nanoid';
import { getWibISOString } from '../utils/time';

const ProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  basePrice: z.number().int().positive(),
  // kelengkapanImage and kelengkapanMime are not in the schema, so we don't validate them here
});

export default async function productRoutes(server: FastifyInstance) {

  // GET all products
  server.get('/', async (request, reply) => {
    const stmt = db.prepare('SELECT * FROM products ORDER BY createdAt DESC');
    const products = stmt.all();
    return products;
  });

  // CREATE a new product
  server.post('/', async (request, reply) => {
    const result = ProductSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send(result.error);
    }
    const { name, sku, basePrice } = result.data;

    const newProduct = {
      id: `prod_${nanoid()}`,
      name,
      sku,
      basePrice,
      createdAt: getWibISOString(),
    };

    const stmt = db.prepare('INSERT INTO products (id, name, sku, basePrice, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run(newProduct.id, newProduct.name, newProduct.sku, newProduct.basePrice, newProduct.createdAt);

    return reply.status(201).send(newProduct);
  });

   // UPDATE a product
   server.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = ProductSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send(result.error);
    }
    const { name, sku, basePrice } = result.data;
    
    const stmt = db.prepare('UPDATE products SET name = ?, sku = ?, basePrice = ? WHERE id = ?');
    const info = stmt.run(name, sku, basePrice, id);

    if (info.changes === 0) {
      return reply.status(404).send({ message: 'Product not found' });
    }
    
    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return updatedProduct;
  });

  // DELETE a product
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    const info = stmt.run(id);

    if (info.changes === 0) {
        return reply.status(404).send({ message: 'Product not found' });
    }
    return { success: true };
  });
}
