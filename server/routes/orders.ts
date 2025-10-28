import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { nanoid } from 'nanoid';
import { getNextInvoiceNumber } from '../utils/invoice';
import { getWibISOString } from '../utils/time';

const OrderItemSchema = z.object({
  productId: z.string().optional().nullable(),
  productName: z.string(),
  basePrice: z.number().int(),
  qty: z.number().int().positive(),
  warna: z.string().optional(),
});

const CreateOrderSchema = z.object({
  tglPesan: z.string(), // datetime-local string
  marketplace: z.string(),
  namaPelanggan: z.string(),
  items: z.array(OrderItemSchema).min(1),
  noIdPesanan: z.string().optional(),
  tglKirim: z.string().optional(),
  cargo: z.string().optional(),
  kota: z.string().optional(),
  alamat: z.string().optional(),
  noHp: z.string().optional(),
});

export default async function orderRoutes(server: FastifyInstance) {

  server.get('/next-invoice', async (request, reply) => {
    return { invoiceNumber: getNextInvoiceNumber() };
  });

  server.get('/', async (request, reply) => {
    const orders = db.prepare(`
        SELECT 
            o.*, 
            (SELECT SUM(oi.basePrice * oi.qty) FROM order_items oi WHERE oi.orderId = o.id) as total,
            json_group_array(
                json_object(
                    'id', i.id,
                    'productId', i.productId,
                    'productName', i.productName,
                    'basePrice', i.basePrice,
                    'qty', i.qty,
                    'warna', i.warna
                )
            ) as items
        FROM orders o
        LEFT JOIN order_items i ON o.id = i.orderId
        GROUP BY o.id
        ORDER BY o.createdAt DESC
    `).all();

    return orders.map((o: any) => ({...o, items: JSON.parse(o.items)}));
  });

  server.post('/', async (request, reply) => {
    const result = CreateOrderSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send(result.error);
    }
    const { items, ...orderData } = result.data;

    const newOrder = {
      id: `ord_${nanoid()}`,
      invoiceNumber: getNextInvoiceNumber(),
      createdAt: getWibISOString(orderData.tglPesan),
      tglKirim: orderData.tglKirim ? getWibISOString(orderData.tglKirim) : null,
      paymentStatus: 'Pending',
      orderStatus: 'Confirmed',
      jumlahDilunasi: 0,
      ...orderData
    };

    const runTransaction = db.transaction(() => {
        const orderStmt = db.prepare(`
            INSERT INTO orders (id, invoiceNumber, createdAt, tglKirim, marketplace, noIdPesanan, cargo, namaPelanggan, kota, alamat, noHp, paymentStatus, orderStatus, jumlahDilunasi)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        orderStmt.run(
            newOrder.id, newOrder.invoiceNumber, newOrder.createdAt, newOrder.tglKirim, newOrder.marketplace, newOrder.noIdPesanan,
            newOrder.cargo, newOrder.namaPelanggan, newOrder.kota, newOrder.alamat, newOrder.noHp, newOrder.paymentStatus,
            newOrder.orderStatus, newOrder.jumlahDilunasi
        );
        
        const itemStmt = db.prepare(`
            INSERT INTO order_items (id, orderId, productId, productName, basePrice, qty, warna)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
            itemStmt.run(`item_${nanoid()}`, newOrder.id, item.productId, item.productName, item.basePrice, item.qty, item.warna);
        }
    });

    try {
        runTransaction();
        const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(newOrder.id);
        const createdItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(newOrder.id);
        return reply.status(201).send({ ...createdOrder, items: createdItems });
    } catch (err: any) {
        server.log.error(err);
        return reply.status(500).send({ message: 'Failed to create order.', error: err.message });
    }
  });

   server.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

    if (!order) {
        return reply.status(404).send({ message: 'Order not found' });
    }

    if (order.jumlahDilunasi > 0) {
        return reply.status(400).send({ success: false, message: "Tidak bisa membatalkan order yang sudah dibayar sebagian." });
    }

    const stmt = db.prepare('UPDATE orders SET orderStatus = ? WHERE id = ?');
    stmt.run('Cancelled', id);

    return { success: true, message: "Order berhasil dibatalkan." };
  });

}
