import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { nanoid } from 'nanoid';
import { getWibISOString } from '../utils/time';
import { derivePaymentStatus } from '../../types';

const SettlementSchema = z.object({
  salesOrderId: z.string(),
  amount: z.number().positive(),
  walletId: z.string(),
  categoryId: z.string(),
  tanggal: z.string(), // datetime-local string
});

export default async function settlementRoutes(server: FastifyInstance) {
  server.post('/', async (request, reply) => {
    const result = SettlementSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send(result.error);
    }
    const { salesOrderId, amount, walletId, categoryId, tanggal } = result.data;
    
    const runTransaction = db.transaction(() => {
        const order = db.prepare('SELECT o.*, (SELECT SUM(oi.basePrice * oi.qty) FROM order_items oi WHERE oi.orderId = o.id) as total FROM orders o WHERE o.id = ?').get(salesOrderId);
        if (!order) {
            throw new Error('Sales order tidak ditemukan.');
        }

        const category = db.prepare('SELECT name FROM finance_categories WHERE id = ?').get(categoryId);
        if (!category) {
            throw new Error('Kategori penjualan tidak ditemukan.');
        }

        const sisaTagihan = order.total - order.jumlahDilunasi;
        if (sisaTagihan <= 0) {
            throw new Error('Order ini sudah lunas.');
        }

        const newJumlahDilunasi = order.jumlahDilunasi + amount;
        const newPaymentStatus = derivePaymentStatus(order.total, newJumlahDilunasi);
        
        db.prepare('UPDATE orders SET jumlahDilunasi = ?, paymentStatus = ? WHERE id = ?')
          .run(newJumlahDilunasi, newPaymentStatus, salesOrderId);

        db.prepare(`
            INSERT INTO cashflow (id, type, jumlah, kategori, walletId, tanggal, deskripsi)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`cf_${nanoid()}`, 'income', amount, category.name, walletId, getWibISOString(tanggal), `Pelunasan untuk Invoice ${order.invoiceNumber}`);
        
        const updatedOrder = db.prepare('SELECT o.*, (SELECT SUM(oi.basePrice * oi.qty) FROM order_items oi WHERE oi.orderId = o.id) as total FROM orders o WHERE o.id = ?').get(salesOrderId);
        return updatedOrder;
    });

    try {
        const updatedOrder = runTransaction();
        return { success: true, message: "Pelunasan berhasil dicatat.", updatedOrder };
    } catch (err: any) {
        return reply.status(400).send({ success: false, message: err.message, updatedOrder: null });
    }
  });
}
