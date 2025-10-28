PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,                    -- 'admin' | 'staff'
  permissions TEXT NOT NULL DEFAULT '{}',-- JSON string
  allowedWalletIds TEXT NOT NULL DEFAULT 'all'
);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL                     -- 'income' | 'expense'
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  basePrice INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  invoiceNumber TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,               -- ISO (UTC)
  tglKirim TEXT,                         -- ISO (UTC) nullable
  marketplace TEXT NOT NULL,             -- shopee|tokopedia|manual|...
  noIdPesanan TEXT,
  cargo TEXT,
  namaPelanggan TEXT,
  kota TEXT,
  alamat TEXT,
  noHp TEXT,
  paymentStatus TEXT NOT NULL DEFAULT 'Pending', -- Pending|Partial|Settled
  orderStatus TEXT NOT NULL DEFAULT 'Active',    -- Active|Cancelled
  jumlahDilunasi INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  productId TEXT,
  productName TEXT NOT NULL,
  basePrice INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  warna TEXT,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cashflow (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                    -- income|expense|transfer
  jumlah INTEGER NOT NULL,
  tanggal TEXT NOT NULL,                 -- ISO (UTC)
  walletId TEXT NOT NULL,
  toWalletId TEXT,
  kategori TEXT,
  deskripsi TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_cashflow_tanggal ON cashflow(tanggal);
CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);
