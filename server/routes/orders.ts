// server/routes/orders.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

/* =====================  TABLE & COLUMNS DETECTION  ===================== */

function detectTable(): string {
  const r = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('orders','sales_orders','sales') LIMIT 1"
    )
    .get() as { name?: string } | undefined;
  return r?.name ?? "orders";
}
const TABLE = detectTable();

type ColInfo = { name: string; pk: number };
const infos = db.prepare(`PRAGMA table_info('${TABLE}')`).all() as ColInfo[];
const has = (n: string) => infos.some((c) => c.name === n);

const pick = (...cands: string[]) => cands.find(has);

const C = {
  id: infos.find((c) => c.pk === 1)?.name || (has("id") ? "id" : undefined),
  invoice: pick("no_invoice", "invoice_no", "invoice"),
  orderDate: pick("order_date", "tgl_pesan", "tanggal_pesan"),
  shipDate: pick("ship_date", "tgl_kirim", "tanggal_kirim"),
  marketplace: pick("marketplace", "channel"),
  externalId: pick("external_order_id", "external_id", "order_no", "order_id", "no_id_pesanan"),
  customerName: pick("customer_name", "nama_pelanggan", "buyer_name", "nama"),
  city: pick("city", "kota"),
  address: pick("address", "alamat"),
  phone: pick("phone", "no_hp", "hp", "telp", "phone_number"),
  orderStatus: pick("order_status", "status_order", "status"),
  paymentStatus: pick("payment_status", "status_bayar", "payment"),
  total: pick("total", "grand_total", "amount_total"),
  createdAt: pick("createdAt", "created_at", "created"),
};

const SELECT_ID = C.id ? `COALESCE(${q(C.id)}, rowid) AS id` : `rowid AS id`;

/* ==============================  SCHEMAS  =============================== */

const CreateOrderSchema = z.object({
  invoice: z.string().optional(),
  orderDate: z.coerce.date().optional(),
  shipDate: z.coerce.date().optional(),
  marketplace: z.string().optional(),
  externalId: z.string().optional(),
  customerName: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  orderStatus: z.string().optional(),
  paymentStatus: z.string().optional(),
  total: z.number().optional(),
});

const UpdateOrderSchema = CreateOrderSchema.partial();

/* ==============================  HELPERS  =============================== */

const toISO = (d?: Date) => (d ? new Date(d).toISOString() : undefined);

function mapRow(raw: any) {
  const id = raw?.id ?? raw?.rowid;
  const r: any = { id: String(id ?? "") };
  if (C.invoice) r.invoice = raw[C.invoice];
  if (C.orderStatus) r.orderStatus = raw[C.orderStatus];
  if (C.paymentStatus) r.paymentStatus = raw[C.paymentStatus];
  if (C.total) r.total = Number(raw[C.total] ?? 0);
  return r;
}

/* ==============================  ROUTES  ================================ */

export default async function ordersRoutes(app: FastifyInstance) {
  // GET /
  app.get("/", async (_req, reply) => {
    const cols = [SELECT_ID, "*"];
    const orderBy = C.createdAt ? q(C.createdAt) : "rowid";
    const rows = db.prepare(`SELECT ${cols.join(",")} FROM ${q(TABLE)} ORDER BY ${orderBy} DESC`).all();
    reply.send(rows.map(mapRow));
  });

  // POST /
  app.post("/", async (req, reply) => {
    const b = CreateOrderSchema.parse(req.body ?? {});
    const setCols: string[] = [];
    const vals: any[] = [];
    const push = (col?: string, val?: any) => {
      if (!col || val === undefined) return;
      setCols.push(q(col));
      vals.push(val);
    };

    push(C.invoice, b.invoice);
    push(C.orderDate, toISO(b.orderDate));
    push(C.shipDate, toISO(b.shipDate));
    push(C.marketplace, b.marketplace);
    push(C.externalId, b.externalId);
    push(C.customerName, b.customerName);
    push(C.city, b.city);
    push(C.address, b.address);
    push(C.phone, b.phone);
    push(C.orderStatus, b.orderStatus);
    push(C.paymentStatus, b.paymentStatus);
    push(C.total, b.total !== undefined ? Number(b.total) || 0 : undefined);

    if (!setCols.length) return reply.code(400).send({ error: "No fields to insert" });

    const placeholders = setCols.map(() => "?").join(", ");
    db.prepare(`INSERT INTO ${q(TABLE)} (${setCols.join(", ")}) VALUES (${placeholders})`).run(...vals);

    const row = db.prepare(`SELECT ${SELECT_ID}, * FROM ${q(TABLE)} WHERE rowid = last_insert_rowid()`).get();
    reply.send(mapRow(row));
  });

  // PUT /:id
  app.put("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = UpdateOrderSchema.parse(req.body ?? {});

    const sets: string[] = [];
    const vals: any[] = [];
    const push = (col?: string, val?: any) => {
      if (!col || val === undefined) return;
      sets.push(`${q(col)} = ?`);
      vals.push(val);
    };

    push(C.invoice, b.invoice);
    push(C.orderDate, toISO(b.orderDate));
    push(C.shipDate, toISO(b.shipDate));
    push(C.marketplace, b.marketplace);
    push(C.externalId, b.externalId);
    push(C.customerName, b.customerName);
    push(C.city, b.city);
    push(C.address, b.address);
    push(C.phone, b.phone);
    push(C.orderStatus, b.orderStatus);
    push(C.paymentStatus, b.paymentStatus);
    if (b.total !== undefined) push(C.total, Number(b.total) || 0);

    if (!sets.length) return reply.code(400).send({ error: "No fields to update" });

    const idNum = Number(id);
    const where = C.id ? `(${q(C.id)} = ? OR rowid = ?)` : `rowid = ?`;

    if (C.id) db.prepare(`UPDATE ${q(TABLE)} SET ${sets.join(", ")} WHERE ${where}`).run(...vals, id, isNaN(idNum) ? -1 : idNum);
    else db.prepare(`UPDATE ${q(TABLE)} SET ${sets.join(", ")} WHERE ${where}`).run(...vals, isNaN(idNum) ? -1 : idNum);

    const row = C.id
      ? db.prepare(`SELECT ${SELECT_ID}, * FROM ${q(TABLE)} WHERE ${q(C.id)} = ? OR rowid = ? LIMIT 1`).get(id, isNaN(idNum) ? -1 : idNum)
      : db.prepare(`SELECT ${SELECT_ID}, * FROM ${q(TABLE)} WHERE rowid = ? LIMIT 1`).get(isNaN(idNum) ? -1 : idNum);

    reply.send(mapRow(row));
  });

  // DELETE /:id
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const idNum = Number(id);
    const where = C.id ? `(${q(C.id)} = ? OR rowid = ?)` : `rowid = ?`;
    if (C.id) db.prepare(`DELETE FROM ${q(TABLE)} WHERE ${where}`).run(id, isNaN(idNum) ? -1 : idNum);
    else db.prepare(`DELETE FROM ${q(TABLE)} WHERE ${where}`).run(isNaN(idNum) ? -1 : idNum);
    reply.code(204).send();
  });
}
