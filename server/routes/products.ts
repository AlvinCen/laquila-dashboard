import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { nanoid } from 'nanoid';
import { getWibISOString } from '../utils/time';

const ProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  basePrice: z.number().int().positive(),
  hppYear: z.number().int().min(1900).max(2100).optional().nullable(),
  // kelengkapanImage and kelengkapanMime are not in the schema, so we don't validate them here
});

// body untuk UPDATE boleh partial
const ProductUpdate = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  basePrice: z.number().optional(),
  hppYear: z.number().int().min(1900).max(2100).nullable().optional(),
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
    const { name, sku, basePrice, hppYear } = result.data;

    const newProduct = {
      id: `prod_${nanoid()}`,
      name,
      sku,
      basePrice,
      hppYear,
      createdAt: getWibISOString(),
    };

    const stmt = db.prepare('INSERT INTO products (id, name, sku, basePrice, hppYear, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(newProduct.id, newProduct.name, newProduct.sku, newProduct.basePrice, newProduct.hppYear, newProduct.createdAt);

    return reply.status(201).send(newProduct);
  });

  // UPDATE a product
  server.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = ProductUpdate.parse(req.body); // validasi camelCase

    // bangun SET clause tanpa trailing comma
    const set: string[] = [];
    const vals: any[] = [];

    if (body.sku !== undefined) { set.push('sku = ?'); vals.push(body.sku); }
    if (body.name !== undefined) { set.push('name = ?'); vals.push(body.name); }
    if (body.basePrice !== undefined) { set.push('basePrice = ?'); vals.push(body.basePrice); }
    if (body.hppYear !== undefined) { set.push('hppYear = ?'); vals.push(body.hppYear); }

    if (set.length === 0) return reply.code(400).send({ error: 'No fields to update' });

    const sql = `UPDATE products SET ${set.join(', ')} WHERE id = ?`;
    vals.push(id);

    // better-sqlite3
    db.prepare(sql).run(vals);

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return reply.send(row); // response tetap camelCase
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
