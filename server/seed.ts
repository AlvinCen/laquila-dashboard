// server/seed.ts
import { db } from './db';
import { nanoid } from 'nanoid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc); dayjs.extend(tz);
const WIB = 'Asia/Jakarta';

const run = db.prepare.bind(db);
const tx = db.transaction((fn: () => void) => fn());

// ===== Helpers =====
const toISO = (v: string | Date) => dayjs.tz(v, WIB).toDate().toISOString();

// add column if UI but DB belum punya
function ensureColumns() {
    // Tambah kolom hppYear di products kalau belum ada
    const cols = db.prepare(`PRAGMA table_info(products);`).all() as { name: string }[];
    if (!cols.find(c => c.name === 'hppYear')) {
        db.prepare(`ALTER TABLE products ADD COLUMN hppYear INTEGER;`).run();
    }
}

// ===== Clear all =====
function wipe() {
    run(`DELETE FROM order_items`);
    run(`DELETE FROM orders`);
    run(`DELETE FROM products`);
    run(`DELETE FROM cashflow`);
    run(`DELETE FROM users`);
    // reset meta jika dipakai untuk invoice sequence
    try { run(`DELETE FROM meta WHERE key IN ('invoicePrefix','invoiceSeq')`); } catch { }
}


// ===== RUN ALL =====
tx(() => {
    ensureColumns();
    wipe();
    // ===== Seed Users =====
    const upsert = db.prepare(`
  INSERT INTO users (id, username, password, role, permissions, allowedWalletIds)
  VALUES (@id, @username, @password, @role, @permissions, @allowedWalletIds)
  ON CONFLICT(username) DO UPDATE SET
    password = excluded.password,
    role = excluded.role,
    permissions = excluded.permissions,
    allowedWalletIds = excluded.allowedWalletIds
`);

    const users = [
        { id: 'u_admin', username: 'admin', password: '1234', role: 'admin', permissions: '{}', allowedWalletIds: 'all' },
        { id: 'u_staff', username: 'staff', password: '1234', role: 'staff', permissions: '{}', allowedWalletIds: 'all' },
    ];

    db.transaction(() => users.forEach(u => upsert.run(u)))();
    console.log('✅ Users ready: admin/1234, staff/1234');
});

console.log('✅ Seed selesai: users, database siap digunakan.');
