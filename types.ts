// --- DATABASE ALIGNED TYPES ---

// From 'products' table
export interface Product {
  id: string;
  name: string;
  sku: string | null;
  basePrice: number;
  createdAt: string; // ISO String
  // The following are no longer in the DB, but kept for FE components temporarily
  kelengkapanImage?: string; 
  kelengkapanMime?: string;
  // Deprecated properties
  kodeProduk?: string;
  namaProduk?: string;
  tahunHpp?: number;
  hargaDasar?: number;
}
export type ProductInput = Omit<Product, 'id' | 'createdAt'>;

// From 'wallets' table
export interface Wallet {
  id: string;
  name: string;
}
export type WalletInput = Omit<Wallet, 'id'>;

// From 'finance_categories' table
export interface FinanceCategory {
    id: string;
    name: string;
    type: 'income' | 'expense';
}
export type FinanceCategoryInput = Omit<FinanceCategory, 'id'>;

// From 'order_items' table
export interface SalesOrderItem {
    id: string;
    orderId: string;
    productId: string | null;
    productName: string;
    basePrice: number;
    qty: number;
    warna: string;
    // Derived/calculated property
    jumlah: number;
    // Deprecated properties
    kodeProduk?: string;
    namaProduk?: string;
    hargaDasar?: number;
    kuantitas?: number;
    printKelengkapan?: string;
}
export type SalesOrderItemInput = Omit<SalesOrderItem, 'id' | 'orderId' | 'jumlah'>;

export type PaymentStatus = 'Pending' | 'Partial' | 'Settled';
export type OrderStatus = 'Confirmed' | 'Cancelled';

// From 'orders' table
export interface SalesOrder {
    id: string;
    invoiceNumber: string;
    marketplace: string;
    createdAt: string; // ISO String
    paymentStatus: PaymentStatus;
    orderStatus: OrderStatus;
    jumlahDilunasi: number;
    items: SalesOrderItem[];
    total: number; // This is a calculated field from the API
    // The following are no longer in DB but needed for form state
    noIdPesanan?: string;
    tglPesan?: string; // date
    tglKirim?: string; // date
    cargo?: string; // optional
    namaPelanggan?: string;
    kota?: string;
    alamat?: string;
    noHp?: string;
}
// FIX: Redefined SalesOrderInput to match the actual API payload structure for creating/updating orders.
// This resolves a type error in SalesOrderForm where server-generated fields were incorrectly required.
export type SalesOrderInput = {
  id?: string;
  marketplace: string;
  orderStatus: OrderStatus;
  items: SalesOrderItemInput[];
  tglPesan: string;
  namaPelanggan: string;
  noIdPesanan?: string;
  tglKirim?: string;
  cargo?: string;
  kota?: string;
  alamat?: string;
  noHp?: string;
};


export function derivePaymentStatus(total: number, dilunasi: number): PaymentStatus {
  if (total > 0 && dilunasi >= total) return 'Settled';
  if (dilunasi > 0) return 'Partial';
  return 'Pending';
}


// From 'cashflow' table
export type CashFlowType = 'income' | 'expense' | 'transfer';

export interface CashFlowEntry {
    id: string;
    type: CashFlowType;
    jumlah: number;
    kategori: string | null;
    walletId: string;
    toWalletId: string | null;
    tanggal: string; // ISO String
    deskripsi: string | null;
}
export type CashFlowEntryInput = Omit<CashFlowEntry, 'id'>;


// --- RBAC (Role-Based Access Control) ---
export type Role = 'admin' | 'staff';
export type Module = 'master-data' | 'sales-order' | 'settlement' | 'cash-flow' | 'growth-insight' | 'user-management' | 'order-analytic';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'export' | 'settle' | 'cancel';

export type PermissionsMap = {
  [M in Module]?: Action[];
};

// From 'users' table
export interface User {
  id: string;
  username: string;
  password?: string; // Plaintext for mock API
  role: Role;
  permissions: PermissionsMap; // Stored as JSON string in DB
  allowedWalletIds: 'all' | string[]; // Stored as JSON string or 'all'
}

export type UserInput = Omit<User, 'id'> & { id?: string };



// --- DEPRECATED / LEGACY TYPES ---
export interface Settlement {
    id: string;
    salesOrderId: string;
    noInvoice: string;
    jumlahPelunasan: number;
    kategoriPenjualan: string;
    tanggal: string;
}
export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
}
export type CustomerInput = Omit<Customer, 'id'> & { id?: string };

export interface SalesProduct {
    id: string;
    code: string;
    name: string;
    price: number;
}

export interface SalesItem {
    id: string;
    idx: number;
    productCode: string;
    productName: string;
    price: number;
    qty: number;
    color: string;
    subtotal: number;
}
export interface Payment {
    id: string;
    date: string;
    amount: number;
    method?: string;
}
export interface SalesInvoice {
    id?: string;
    invoiceNumber: string;
    orderDate: string;
    platform: string;
    receiptNumber: string;
    ekspedisi: string;
    customerId: string;
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    items: SalesItem[];
    biayaLainnya: number;
    ongkosKirim: number;
    grandTotal: number;
    status: 'Pending' | 'Partial' | 'Paid' | 'Complete';
    payments: Payment[];
}
export interface MasterProduct {
  id: string;
  no: number;
  kodeProduk: string;
  namaProduk: string;
  totalHpp: number;
}
export interface Material {}
export interface Purchase {}
export interface Platform {
  id: string;
  name: string;
}
export type PlatformInput = Omit<Platform, 'id'> & { id?: string };

export interface Ekspedisi {
  id: string;
  name: string;
}
export type EkspedisiInput = Omit<Ekspedisi, 'id'> & { id?: string };

export interface PaymentMethod {
  id: string;
  name: string;
}
export type PaymentMethodInput = Omit<PaymentMethod, 'id'> & { id?: string };