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

    return orders.map((o: any) => ({ ...o, items: JSON.parse(o.items) }));
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

  // UPDATE ORDER (+ optional replace items)
  server.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Skema UPDATE: izinkan null untuk field opsional
    const UpdateItemSchema = z.object({
      productId: z.string().nullable().optional(),
      productName: z.string(),
      basePrice: z.number().int(),
      qty: z.number().int().positive(),
      warna: z.string().nullable().optional(),
    });

    const UpdateOrderSchema = z.object({
      tglPesan: z.string().nullable().optional(),
      marketplace: z.string().nullable().optional(),
      namaPelanggan: z.string().nullable().optional(),
      items: z.array(UpdateItemSchema).nullable().optional(),
      noIdPesanan: z.string().nullable().optional(),
      tglKirim: z.string().nullable().optional(),
      cargo: z.string().nullable().optional(),
      kota: z.string().nullable().optional(),
      alamat: z.string().nullable().optional(),
      noHp: z.string().nullable().optional(),
    });

    const parsed = UpdateOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error);
    }
    const { items, ...data } = parsed.data;

    // pastikan order ada
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!existing) {
      return reply.status(404).send({ message: 'Order not found' });
    }

    // bangun SET dinamis — abaikan field yang undefined; untuk field bernilai null:
    // - kolom yang nullable (noIdPesanan, cargo, kota, alamat, noHp, tglKirim) akan di-set NULL
    // - kolom yang NOT NULL (createdAt, marketplace, namaPelanggan) di-skip jika null
    const set: string[] = [];
    const vals: any[] = [];

    if (data.tglPesan !== undefined && data.tglPesan !== null) {
      set.push('createdAt = ?');
      vals.push(getWibISOString(data.tglPesan));
    }
    if (data.tglKirim !== undefined) {
      set.push('tglKirim = ?');
      vals.push(data.tglKirim ? getWibISOString(data.tglKirim) : null);
    }
    if (data.marketplace !== undefined && data.marketplace !== null) {
      set.push('marketplace = ?'); vals.push(data.marketplace);
    }
    if (data.namaPelanggan !== undefined && data.namaPelanggan !== null) {
      set.push('namaPelanggan = ?'); vals.push(data.namaPelanggan);
    }
    if (data.noIdPesanan !== undefined) { set.push('noIdPesanan = ?'); vals.push(data.noIdPesanan ?? null); }
    if (data.cargo !== undefined) { set.push('cargo = ?'); vals.push(data.cargo ?? null); }
    if (data.kota !== undefined) { set.push('kota = ?'); vals.push(data.kota ?? null); }
    if (data.alamat !== undefined) { set.push('alamat = ?'); vals.push(data.alamat ?? null); }
    if (data.noHp !== undefined) { set.push('noHp = ?'); vals.push(data.noHp ?? null); }

    const tx = db.transaction(() => {
      if (set.length) {
        db.prepare(`UPDATE orders SET ${set.join(', ')} WHERE id = ?`).run(...vals, id);
      }

      // Jika client mengirim key "items":
      // - items === null  -> tidak mengubah item
      // - items === []    -> hapus semua item
      // - items adalah array -> replace semua
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'items')) {
        if (Array.isArray(items)) {
          db.prepare('DELETE FROM order_items WHERE orderId = ?').run(id);
          if (items.length) {
            const ins = db.prepare(`
            INSERT INTO order_items (id, orderId, productId, productName, basePrice, qty, warna)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
            for (const it of items) {
              ins.run(
                `item_${nanoid()}`,
                id,
                it.productId ?? null,
                it.productName,
                it.basePrice,
                it.qty,
                it.warna ?? null
              );
            }
          }
        }
        // jika items === null -> do nothing
      }
    });

    try {
      tx();
      const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      const updatedItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(id);
      const totalRow = db.prepare(
        'SELECT COALESCE(SUM(basePrice * qty), 0) AS total FROM order_items WHERE orderId = ?'
      ).get(id) as { total: number };

      return reply.send({ ...updatedOrder, items: updatedItems, total: totalRow.total });
    } catch (err: any) {
      request.server.log.error(err);
      return reply.status(500).send({ message: 'Failed to update order.', error: err.message });
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
