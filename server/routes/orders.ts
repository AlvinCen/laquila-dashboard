// server/routes/orders.ts
import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { randomUUID } from 'crypto';


type Row = Record<string, any>;
const Q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const TABLE = 'orders';

// ---- cek kolom yang tersedia (agar tidak "no such column") ----
type ColInfo = { name: string; pk: number; type?: string }; // <-- tambahkan type
const cols = db.prepare(`PRAGMA table_info(${Q(TABLE)})`).all() as ColInfo[];
const has = (n?: string) => !!n && cols.some(c => c.name === n);
const pick = (...cands: string[]) => cands.find(has);

const C = {
  id: (cols.find(c => c.pk === 1)?.name) ?? (has('id') ? 'id' : undefined),

  invoiceNumber: pick('invoiceNumber', 'invoice_number', 'invoice_no', 'invoice'),
  noInvoice: pick('noInvoice', 'no_invoice', 'invoice_prefix'),

  createdAt: pick('createdAt', 'created_at'),
  orderDate: pick('orderDate', 'order_date', 'tglPesan', 'tgl_pesan'),
  shipDate: pick('shipDate', 'ship_date', 'tglKirim', 'tgl_kirim'),

  marketplace: pick('marketplace'),
  externalId: pick('externalId', 'external_id', 'order_no'),
  customerName: pick('customerName', 'customer_name', 'namaPelanggan', 'nama_pelanggan', 'buyer_name', 'nama'),
  city: pick('city', 'kota'),
  address: pick('address', 'alamat'),
  phone: pick('phone', 'phone_number', 'no_hp', 'hp', 'telp'),

  orderStatus: pick('orderStatus', 'order_status', 'status_order', 'status'),
  paymentStatus: pick('paymentStatus', 'payment_status', 'status_bayar', 'payment'),
  total: pick('total', 'grand_total', 'amount_total'),
};

// Ambil PK sebenarnya dari row orders
const getPk = (r: Row) => (C.id ? r[C.id] : r.__rid);
// PK asli dari tabel orders (pakai kolom PK bila ada, fallback rowid)
const ensurePk = (r: Row) => {
  if (C.id && r[C.id] !== undefined && r[C.id] !== null && String(r[C.id]).trim() !== '') return r[C.id];
  return r.__rid;
};


// order_items (opsional)
const ITEMS_T = ['order_items', 'orderItems', 'items'].find(t => {
  const r = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t) as Row | undefined;
  return !!r;
});
const I = ITEMS_T ? {
  orderId: pickItemCol(ITEMS_T, ['orderId', 'order_id', 'ordersId', 'orders_id']),
  productId: pickItemCol(ITEMS_T, ['productId', 'product_id', 'sku', 'kode_produk', 'kodeProduk']),
  productName: pickItemCol(ITEMS_T, ['productName', 'product_name', 'namaProduk', 'nama_produk', 'productTitle', 'namaBarang']),
  qty: pickItemCol(ITEMS_T, ['qty', 'quantity', 'jumlah']),
  price: pickItemCol(ITEMS_T, ['price', 'harga', 'unit_price', 'basePrice', 'hargaDasar']),
} : null;

const ITEM_PK = ITEMS_T ? pickItemCol(ITEMS_T, ['id', 'itemId', 'item_id', 'uuid']) : undefined;


// --- FK mapping: pastikan kita pakai kolom parent/child yang benar ---
// --- FK mapping: pastikan kita pakai kolom parent/child yang benar ---
type FkRow = { table: string; from: string; to: string };

const FK_ITEMS: FkRow[] = ITEMS_T
  ? (db.prepare(`PRAGMA foreign_key_list(${Q(ITEMS_T)})`).all() as FkRow[])
  : [];

// FK order_items -> orders
const FK_TO_ORDERS = FK_ITEMS.find(f => f.table === TABLE) || null;

// kolom anak di items yang mengarah ke orders, dan kolom parent di orders
const CHILD_ORDER_COL = FK_TO_ORDERS?.from || (I?.orderId ?? 'orderId');
const PARENT_ORDER_COL = FK_TO_ORDERS?.to || (C.id ?? 'rowid');

// tipe kolom FK child (biar castingnya pas)
const CHILD_COL_TYPE =
  ITEMS_T
    ? ((db.prepare(`PRAGMA table_info(${Q(ITEMS_T)})`).all() as ColInfo[])
      .find(c => c.name === CHILD_ORDER_COL)?.type ?? '')
    : '';

const asChildPk = (v: any) => /INT/i.test(CHILD_COL_TYPE) ? Number(v) : String(v);

// ---- Produk: cari table & kolom referensi yang benar (ikut FK) ----
const PRODUCTS_T = ['products', 'product', 'master_products', 'product_master'].find(t => {
  const r = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t) as Row | undefined;
  return !!r;
}) || null;

const PRODUCTS_REF_COL = (() => {
  if (!PRODUCTS_T) return undefined;
  // Kalau ada FK order_items -> products, pakai target kolomnya
  const fk = FK_ITEMS.find(f => f.table === PRODUCTS_T);
  if (fk?.to) return fk.to;
  // fallback: tebak kolom yang umum
  const cs = db.prepare(`PRAGMA table_info(${Q(PRODUCTS_T)})`).all() as ColInfo[];
  const has = (n: string) => cs.some(c => c.name === n);
  return ['id', 'productId', 'product_id', 'sku', 'kode', 'kode_produk', 'kodeProduk'].find(has);
})();
const MUST_USE_ID_FOR_CHILD = true; // PRAGMA: order_items.orderId -> orders.id

function ensureOrderHasId(row: Row): string {
  // kalau kolom id ada dan kosong, isi dengan UUID baru
  if (C.id) {
    const cur = row[C.id];
    if (cur !== null && cur !== undefined && String(cur).trim() !== '') return String(cur);
    const newId = randomUUID();
    db.prepare(`UPDATE ${Q(TABLE)} SET ${Q(C.id)}=? WHERE rowid=?`).run(newId, row.__rid);
    return newId;
  }
  // fallback (harusnya gak pernah kepakai di skema kamu)
  return String(row.__rid);
}


function productExists(pid: any) {
  if (!PRODUCTS_T || !PRODUCTS_REF_COL || pid === null || pid === undefined || pid === '') return true;
  const r = db.prepare(`SELECT 1 FROM ${Q(PRODUCTS_T)} WHERE ${Q(PRODUCTS_REF_COL)}=? LIMIT 1`).get(pid) as Row | undefined;
  return !!r;
}

const FK = ITEMS_T
  ? (db.prepare(`PRAGMA foreign_key_list(${Q(ITEMS_T)})`).all() as FkRow[])
    .find(f => f.table === TABLE) || null
  : null;


function pickItemCol(table: string, cands: string[]) {
  const cs = db.prepare(`PRAGMA table_info(${Q(table)})`).all() as ColInfo[];
  const has = (n: string) => cs.some(c => c.name === n);
  return cands.find(has);
}

// Migrasi legacy: kalau orders.id kosong (''), ganti ke UUID baru dan update semua child
function migrateEmptyParentIdAndChildren(row: Row): string {
  if (!C.id) return String(row.__rid);
  const oldId = String(row[C.id] ?? '');
  if (oldId.trim() !== '') return oldId;

  const newId = randomUUID();
  const tx = db.transaction(() => {
    db.prepare('PRAGMA defer_foreign_keys=ON').run();
    // update parent id
    db.prepare(`UPDATE ${Q(TABLE)} SET ${Q(C.id)}=? WHERE rowid=?`).run(newId, row.__rid);
    // relink semua anak ke id baru
    if (ITEMS_T) {
      db.prepare(`UPDATE ${Q(ITEMS_T!)} SET ${Q(CHILD_ORDER_COL)}=? WHERE ${Q(CHILD_ORDER_COL)}=?`).run(newId, oldId);
    }
  });
  tx();
  return newId;
}



function insertItems(orderPk: any, items: any[]) {
  if (!ITEMS_T || !Array.isArray(items) || items.length === 0) return false;

  const cols = [ITEM_PK, CHILD_ORDER_COL, I?.productId, I?.productName, I?.qty, I?.price]
    .filter(Boolean) as string[];

  const stmt = db.prepare(
    `INSERT INTO ${Q(ITEMS_T!)} (${cols.map(Q).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  );

  const childPk = asChildPk(orderPk);

  for (const it of items) {
    let pid = it.productId ?? it.sku ?? it.kode ?? null;
    if (!productExists(pid)) pid = null;

    const vals = cols.map((c) => {
      if (c === ITEM_PK) return randomUUID();           // <-- PK item
      if (c === CHILD_ORDER_COL) return childPk;        // <-- FK ke orders.id
      if (c === I?.productId) return pid;
      if (c === I?.productName) return it.productName ?? it.namaProduk ?? it.product_name ?? it.productTitle ?? it.namaBarang ?? '';
      if (c === I?.qty) return Number(it.qty ?? 0);
      if (c === I?.price) return Number(it.price ?? it.basePrice ?? it.hargaDasar ?? 0);
      return null;
    });

    stmt.run(...vals);
  }
  return true;
}




function computeTotal(orderPk: any, items?: any[]): number | undefined {
  const key = asChildPk(orderPk); // <-- penting: samakan tipe dgn kolom child
  if (ITEMS_T && I?.qty && I?.price) {
    const r = db.prepare(
      `SELECT COALESCE(SUM(${Q(I.qty)} * COALESCE(${Q(I.price)},0)),0) AS t
       FROM ${Q(ITEMS_T!)} WHERE ${Q(CHILD_ORDER_COL)}=?`
    ).get(key) as Row | undefined;       // <-- pakai key
    return Number(r?.t ?? 0);
  }
  if (Array.isArray(items) && items.length) {
    return items.reduce(
      (acc: number, it: any) => acc + Number(it.qty ?? 0) * Number(it.price ?? it.basePrice ?? it.hargaDasar ?? 0),
      0
    );
  }
  return undefined;
}



// Ambil items untuk 1 order (map ke shape FE)
function selectItems(orderPk: any): Array<{ productId: string | null; productName: string; qty: number; price: number }> {
  if (!ITEMS_T) return [];
  const key = asChildPk(orderPk); // <-- penting
  const rs = db.prepare(
    `SELECT * FROM ${Q(ITEMS_T!)} WHERE ${Q(CHILD_ORDER_COL)}=?`
  ).all(key) as Row[];             // <-- pakai key
  return rs.map(r => ({
    productId: I?.productId ? (r[I.productId] ?? null) : null,
    productName: I?.productName ? String(r[I.productName] ?? '') : '',
    qty: I?.qty ? Number(r[I.qty] ?? 0) : 0,
    price: I?.price ? Number(r[I.price] ?? 0) : 0,
  }));
}



// ---- helpers ----
const pad4 = (n: number) => String(n).padStart(4, '0');
const mmYY = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${yy}`;
};
const SELECT_ID =
  C.id ? `CASE WHEN ${Q(C.id)} IS NULL OR ${Q(C.id)}='' THEN rowid ELSE ${Q(C.id)} END AS id` : `rowid AS id`;

// DB row -> response (lengkap + alias utk UI)
function mapRow(r: Row) {
  const inv = r.invoiceNumber ?? r.invoice_number ?? r.invoice_no ?? r.invoice ?? '';
  const prefix = r.noInvoice ?? r.no_invoice ?? (typeof inv === 'string' ? (inv.split('-')[0] || '') : '');
  const createdAt = r.createdAt ?? r.orderDate ?? r.order_date ?? r.tglPesan ?? r.tgl_pesan ?? '';

  const namaPelanggan =
    r.namaPelanggan ?? r.customerName ?? r.customer_name ?? r.buyer_name ?? r.nama ?? '';

  return {
    id: String(r.id ?? ''),
    invoice: String(inv),
    no_invoice: String(prefix),
    orderDate: String(createdAt),
    tgl_pesan: r.tglPesan ?? r.tgl_pesan ?? null,
    tgl_kirim: r.tglKirim ?? r.tgl_kirim ?? null,
    marketplace: String(r.marketplace ?? ''),
    customerName: String(namaPelanggan),
    paymentStatus: String(r.paymentStatus ?? r.payment_status ?? ''),
    orderStatus: String(r.orderStatus ?? r.order_status ?? r.status ?? ''),
    total: Number(r.total ?? r.grand_total ?? r.amount_total ?? 0),

    // alias yang dibaca tabel
    invoiceNumber: String(inv),
    noInvoice: String(prefix),
    createdAt: String(createdAt),
    namaPelanggan: String(namaPelanggan),
  };
}

// Body FE -> nilai siap insert/update (cover camelCase & snake_case)
const bodyToValues = (b: any) => ({
  invoice: b.invoice ?? b.invoiceNumber ?? null,
  no_invoice: b.no_invoice ?? b.noInvoice ?? null,
  createdAt: b.orderDate ?? b.createdAt ?? b.tglPesan ?? b.tgl_pesan ?? new Date().toISOString(),
  tgl_pesan: b.tgl_pesan ?? b.tglPesan ?? null,
  tgl_kirim: b.tgl_kirim ?? b.tglKirim ?? null,
  marketplace: b.marketplace ?? '',
  externalId: b.externalId ?? b.no_id_pesanan ?? '',
  customerName: b.customerName ?? b.namaPelanggan ?? '',
  city: b.city ?? b.kota ?? '',
  address: b.address ?? b.alamat ?? '',
  phone: b.phone ?? b.no_hp ?? '',
  orderStatus: b.orderStatus ?? 'Confirmed',
  paymentStatus: b.paymentStatus ?? b.payment_status ?? '',
  total: Number(b.total ?? 0),
});


// ============================================================
export default async function ordersRoutes(app: FastifyInstance) {
  // LIST (default: semua status)
  app.get('/', async (req, rep) => {
    try {
      const q = (req.query as { status?: string }) || {};
      let where = '';
      if (C.orderStatus && q.status) {
        if (q.status === 'cancelled') where = `WHERE ${Q(C.orderStatus)}='Cancelled'`;
        if (q.status === 'active') where = `WHERE ${Q(C.orderStatus)} IS NULL OR ${Q(C.orderStatus)}!='Cancelled'`;
      }
      const orderBy = C.createdAt ?? C.orderDate ?? (C.id ? C.id : 'rowid');

      const rows = db.prepare(`
        SELECT rowid AS __rid, ${SELECT_ID.replace(' AS id', '')}, * 
        FROM ${Q(TABLE)}
        ${where}
        ORDER BY ${orderBy === 'rowid' ? 'rowid' : Q(orderBy)} DESC
      `).all() as Row[];

      const safe = rows.map(r => mapRow({ ...r, id: r.id ?? r.__rid }));
      return rep.send(safe);
    } catch (e: any) {
      return rep.code(500).send({ error: 'DB_ERROR', detail: e.message });
    }
  });

  // DETAIL
  app.get('/:id', async (req, rep) => {
    try {
      const { id } = req.params as { id: string };
      if (!id || !String(id).trim()) return rep.code(400).send({ error: 'INVALID_ID' });
      const rid = Number(id);
      const where = C.id ? `(${Q(C.id)} = ? OR rowid = ?)` : `rowid = ?`;
      const row = (C.id
        ? db.prepare(`SELECT ${SELECT_ID}, * FROM ${Q(TABLE)} WHERE ${where}`).get(id, isNaN(rid) ? -1 : rid)
        : db.prepare(`SELECT ${SELECT_ID}, * FROM ${Q(TABLE)} WHERE ${where}`).get(isNaN(rid) ? -1 : rid)
      ) as Row | undefined;
      if (!row) return rep.code(404).send({ error: 'NOT_FOUND' });
      const pk = getPk(row);
      const items = selectItems(pk);
      return rep.send({ ...mapRow(row), items });

    } catch (e: any) {
      return rep.code(500).send({ error: 'DB_ERROR', detail: e.message });
    }
  });

  // CREATE
  app.post('/', async (req, rep) => {
    try {
      const b = req.body as any;
      const v = bodyToValues(b);

      const prefix = v.no_invoice || mmYY(v.tgl_pesan || v.createdAt);
      const invoice =
        C.invoiceNumber
          ? (v.invoice || (() => {
            const last = db.prepare(
              C.noInvoice
                ? `SELECT ${Q(C.invoiceNumber)} AS inv FROM ${Q(TABLE)} WHERE ${Q(C.noInvoice)}=@prefix ORDER BY ${Q(C.invoiceNumber)} DESC LIMIT 1`
                : `SELECT ${Q(C.invoiceNumber)} AS inv FROM ${Q(TABLE)} WHERE ${Q(C.invoiceNumber)} LIKE @pfx ORDER BY ${Q(C.invoiceNumber)} DESC LIMIT 1`
            ).get(C.noInvoice ? { prefix } : { pfx: `${prefix}-%` }) as Row | undefined;
            const next = last?.inv?.split?.('-')?.[1] ? Number(last.inv.split('-')[1]) + 1 : 1;
            return `${prefix}-${pad4(next)}`;
          })())
          : undefined;

      const colsIns: string[] = [];
      const valsIns: any[] = [];
      const push = (col?: string, val?: any) => { if (!col || val === undefined) return; colsIns.push(Q(col)); valsIns.push(val); };

      push(C.invoiceNumber, invoice);
      if (C.noInvoice) push(C.noInvoice, prefix);
      push(C.createdAt, v.createdAt);
      push(C.orderDate, v.tgl_pesan);
      push(C.shipDate, v.tgl_kirim);
      push(C.marketplace, v.marketplace);
      push(C.externalId, v.externalId);
      push(C.customerName, v.customerName);
      push(C.city, v.city);
      push(C.address, v.address);
      push(C.phone, v.phone);
      push(C.orderStatus, v.orderStatus);
      push(C.paymentStatus, v.paymentStatus);
      push(C.total, 0);

      db.prepare(`INSERT INTO ${Q(TABLE)} (${colsIns.join(',')}) VALUES (${valsIns.map(() => '?').join(',')})`).run(...valsIns);

      const created = db.prepare(`SELECT rowid AS __rid, ${SELECT_ID.replace(' AS id', '')}, * FROM ${Q(TABLE)} WHERE rowid = last_insert_rowid()`).get() as Row;

      // pastikan punya id valid dan pakai itu untuk anak
      const parentIdForChild = MUST_USE_ID_FOR_CHILD ? ensureOrderHasId(created) : String(created.__rid);

      if (Array.isArray(b.items) && b.items.length) {
        insertItems(parentIdForChild, b.items);
        const tval = computeTotal(parentIdForChild, b.items);
        if (C.total && typeof tval === 'number') {
          db.prepare(`UPDATE ${Q(TABLE)} SET ${Q(C.total)}=? WHERE ${Q(C.id!)}=?`).run(tval, parentIdForChild);
        }
      }

      const orderPk = getPk(created);

      const items = selectItems(orderPk);

      // Kembalikan 200 agar FE tidak menandai error
      return rep.send({ ...mapRow({ ...created, id: created.id ?? created.__rid }), items });

    } catch (e: any) {
      return rep.code(500).send({ error: 'DB_ERROR', detail: e.message });
    }
  });

  // UPDATE
  // UPDATE
  app.put('/:id', async (req, rep) => {
    try {
      const { id } = req.params as { id: string };
      if (!id || !String(id).trim()) return rep.code(400).send({ error: 'INVALID_ID' });
      const rid = Number(id);

      const b = req.body as any;
      const v = bodyToValues(b);

      const sets: string[] = [];
      const vals: any[] = [];
      const push = (col?: string, val?: any) => { if (!col || val === undefined) return; sets.push(`${Q(col)}=?`); vals.push(val); };

      if (v.invoice !== null && v.invoice !== undefined) push(C.invoiceNumber, v.invoice);
      if (v.no_invoice !== null && v.no_invoice !== undefined) push(C.noInvoice, v.no_invoice);
      push(C.createdAt, v.createdAt);
      push(C.orderDate, v.tgl_pesan);
      push(C.shipDate, v.tgl_kirim);
      push(C.marketplace, v.marketplace);
      push(C.externalId, v.externalId);
      push(C.customerName, v.customerName);
      push(C.city, v.city);
      push(C.address, v.address);
      push(C.phone, v.phone);
      push(C.orderStatus, v.orderStatus);
      push(C.paymentStatus, v.paymentStatus);

      if (sets.length) {
        if (C.id) db.prepare(`UPDATE ${Q(TABLE)} SET ${sets.join(', ')} WHERE (${Q(C.id)}=? OR rowid=?)`).run(...vals, id, isNaN(rid) ? -1 : rid);
        else db.prepare(`UPDATE ${Q(TABLE)} SET ${sets.join(', ')} WHERE rowid=?`).run(...vals, isNaN(rid) ? -1 : rid);
      }

      // --- Items ---
      const bodyItems: any[] | undefined =
        Array.isArray(b.items) ? b.items :
          Array.isArray(b.orderItems) ? b.orderItems :
            Array.isArray(b.detailItems) ? b.detailItems :
              Array.isArray(b.detail) ? b.detail : undefined;

      let keyUsedForChild: any = undefined;

      if (bodyItems) {
        // Ambil row parent & pastikan punya 'id' (karena FK -> orders.id)
        const parentRow = db.prepare(
          `SELECT rowid AS __rid, ${SELECT_ID.replace(' AS id', '')}, * 
         FROM ${Q(TABLE)}
         WHERE ${C.id ? `${Q(C.id)}=? OR rowid=?` : `rowid=?`}`
        ).get(C.id ? [id, isNaN(rid) ? -1 : rid] : [isNaN(rid) ? -1 : rid]) as Row | undefined;

        if (parentRow) {
          keyUsedForChild = ensureOrderHasId(parentRow); // selalu pakai orders.id (TEXT)

          const tx = db.transaction(() => {
            if (ITEMS_T) {
              db.prepare(`DELETE FROM ${Q(ITEMS_T!)} WHERE ${Q(CHILD_ORDER_COL)}=?`).run(keyUsedForChild);
            }
            insertItems(keyUsedForChild, bodyItems);

            const tval = computeTotal(keyUsedForChild, bodyItems);
            if (C.total && typeof tval === 'number') {
              db.prepare(`UPDATE ${Q(TABLE)} SET ${Q(C.total)}=? WHERE ${Q(C.id!)}=?`).run(tval, keyUsedForChild);
            }
          });
          tx();
        }
      }

      // Reload order & items dengan kunci yang SAMA seperti saat insert
      const after = db.prepare(
        `SELECT rowid AS __rid, ${SELECT_ID.replace(' AS id', '')}, * 
       FROM ${Q(TABLE)} 
       WHERE ${C.id ? `${Q(C.id)}=? OR rowid=?` : `rowid=?`}`
      ).get(C.id ? [id, isNaN(rid) ? -1 : rid] : [isNaN(rid) ? -1 : rid]) as Row | undefined;

      if (!after) return rep.code(404).send({ error: 'NOT_FOUND' });

      const items = selectItems(keyUsedForChild ?? getPk(after));
      const payload = { ...mapRow({ ...after, id: after.id ?? after.__rid }), items };

      // Bila tabel orders memang tidak punya kolom total, hitung untuk response saja
      if (!C.total) {
        const t = computeTotal(keyUsedForChild ?? getPk(after));
        (payload as any).total = Number(t ?? 0);
      }

      return rep.send(payload);
    } catch (e: any) {
      return rep.code(500).send({ error: 'DB_ERROR', detail: e.message });
    }
  });



  // CANCEL (set status; tidak menyembunyikan dari list)
  app.post('/:id/cancel', async (req, rep) => {
    try {
      const { id } = req.params as { id: string };
      if (!id || !String(id).trim()) return rep.code(400).send({ error: 'INVALID_ID' });
      const rid = Number(id);
      const found = db.prepare(`SELECT rowid AS __rid, ${SELECT_ID.replace(' AS id', '')}, * FROM ${Q(TABLE)} WHERE ${C.id ? `${Q(C.id)}=? OR rowid=?` : `rowid=?`}`)
        .get(C.id ? [id, isNaN(rid) ? -1 : rid] : [isNaN(rid) ? -1 : rid]) as Row | undefined;
      if (!found) return rep.code(404).send({ error: 'NOT_FOUND' });
      if (!C.orderStatus) return rep.code(400).send({ error: 'SCHEMA_MISSING_ORDER_STATUS' });
      // set status Cancelled
      db.prepare(`
  UPDATE ${Q(TABLE)}
  SET ${Q(C.orderStatus)}='Cancelled'
  WHERE ${C.id ? `${Q(C.id)}=? OR rowid=?` : `rowid=?`}
`).run(C.id ? [id, isNaN(rid) ? -1 : rid] : [isNaN(rid) ? -1 : rid]);

      // kirim objek order terbaru (biar FE bisa mutasi state tanpa refresh)
      const row = db.prepare(`
  SELECT rowid AS __rid, ${SELECT_ID.replace(' AS id', '')}, * 
  FROM ${Q(TABLE)} 
  WHERE ${C.id ? `${Q(C.id)}=? OR rowid=?` : `rowid=?`}
`).get(C.id ? [id, isNaN(rid) ? -1 : rid] : [isNaN(rid) ? -1 : rid]) as Row;

      return rep.send(mapRow({ ...row, id: row.id ?? row.__rid }));


    } catch (e: any) {
      return rep.code(500).send({ error: 'DB_ERROR', detail: e.message });
    }
  });
}
