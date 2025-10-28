import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { nanoid } from 'nanoid';
import { getWibISOString } from '../utils/time';

const CashFlowSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  jumlah: z.number().positive(),
  tanggal: z.string(), // datetime-local string
  walletId: z.string(),
  toWalletId: z.string().optional().nullable(),
  kategori: z.string().optional().nullable(),
  deskripsi: z.string().optional().nullable(),
});

export default async function cashFlowRoutes(server: FastifyInstance) {

  server.get('/', async (request, reply) => {
    const entries = db.prepare('SELECT * FROM cashflow ORDER BY tanggal DESC').all();
    return entries;
  });

  server.post('/', async (request, reply) => {
    const result = CashFlowSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send(result.error);
    }
    const data = result.data;
    
    // Convert category ID to name if it's an income/expense
    let categoryName = data.kategori;
    if (data.type !== 'transfer' && data.kategori) {
        const category = db.prepare('SELECT name FROM finance_categories WHERE id = ?').get(data.kategori);
        if (category) {
            categoryName = category.name;
        }
    }

    const newEntry = {
      id: `cf_${nanoid()}`,
      ...data,
      kategori: categoryName,
      tanggal: getWibISOString(data.tanggal),
    };

    const stmt = db.prepare(`
        INSERT INTO cashflow (id, type, jumlah, tanggal, walletId, toWalletId, kategori, deskripsi)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(newEntry.id, newEntry.type, newEntry.jumlah, newEntry.tanggal, newEntry.walletId, newEntry.toWalletId, newEntry.kategori, newEntry.deskripsi);
    
    return reply.status(201).send(newEntry);
  });
  
  // You can add PUT and DELETE handlers here as well, similar to products
}
