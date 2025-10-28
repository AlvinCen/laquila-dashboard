import {
    Product, ProductInput,
    Wallet, WalletInput,
    FinanceCategory, FinanceCategoryInput,
    SalesOrder, SalesOrderInput,
    CashFlowEntry, CashFlowEntryInput,
    User, UserInput,
    Platform
} from '../types';

// Safely access Vite environment variables with optional chaining.
// This prevents runtime errors if `import.meta.env` is not populated by the build tool,
// falling back to a default value.
const BASE_URL = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:4000/api';

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        return Promise.reject(errorData);
    }
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
        return {}; // Handle No Content responses gracefully
    }
    return response.json();
};

const api = {
    get: (path: string) => fetch(`${BASE_URL}${path}`, { credentials: 'include' }).then(handleResponse),
    post: (path: string, body: any) => fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    }).then(handleResponse),
    put: (path: string, body: any) => fetch(`${BASE_URL}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    }).then(handleResponse),
    delete: (path: string) => fetch(`${BASE_URL}${path}`, {
        method: 'DELETE',
        credentials: 'include',
    }).then(handleResponse),
};

// === Normalizers & Adapters ===

// Parse "harga" dari berbagai format: "20000", "20.000", "20,000", "Rp 20.000,50"
const toNumber = (v: any): number => {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined) return 0;
    const s = String(v)
        .replace(/[^\d.,-]/g, '')              // buang "Rp", spasi, dsb
        .replace(/\.(?=\d{3}(\D|$))/g, '')     // buang titik ribuan (20.000 -> 20000)
        .replace(',', '.');                    // koma desimal -> titik
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : 0;
};

// ---- util ----
type AnyObj = Record<string, any>;

/* ===================== PRODUCT ===================== */
// Kembalikan field inti sesuai tipe Product KAMU (sku/name/basePrice/createdAt?)
// Lalu tambahkan semua alias (kodeProduk, kode_produk, namaProduk, harga_dasar, dll)
// Supaya ProductTable apa pun tetap dapat nilai.
const productFromAPI = (row: AnyObj): Product => {
  const basePrice =
    toNumber(row.basePrice ?? row.harga_dasar ?? row.base_price ?? row.price ?? row.harga ?? 0);

  const sku =
    row.sku ?? row.code ?? row.kode ?? row.kode_produk ?? row.product_code ?? row.kodeProduk ?? '';

  const name =
    row.name ?? row.nama ?? row.nama_produk ?? row.product_name ?? row.namaProduk ?? '';

  const hppYear = Number(
    row.hppYear ?? row.tahun_hpp ?? row.hpp_year ?? row.tahunHpp ?? 0
  );

  const p: any = {
    // field yang memang ada di tipe Product kamu
    id: String(row.id ?? row.product_id ?? row.uuid ?? ''),
    sku,
    name,
    basePrice,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),

    // alias supaya table apa pun tetap kebaca
    code: sku,
    kode: sku,
    kode_produk: sku,
    kodeProduk: sku,

    nama: name,
    nama_produk: name,
    namaProduk: name,

    hppYear,
    tahunHpp: hppYear,

    harga_dasar: basePrice,
    hargaDasar: basePrice,
    base_price: basePrice,
    price: basePrice,
  };

  return p as Product;
};

const productToAPI = (input: Partial<Product> | AnyObj): AnyObj => {
  const i: any = input;
  const sku = i.sku ?? i.code ?? i.kode ?? i.kodeProduk ?? i.kode_produk;
  const name = i.name ?? i.nama ?? i.namaProduk ?? i.nama_produk;
  const hppYear = i.hppYear ?? i.tahunHpp;
  const basePrice = toNumber(i.basePrice ?? i.hargaDasar ?? i.harga_dasar ?? i.price);

  return {
    kode_produk: sku,
    nama_produk: name,
    tahun_hpp: hppYear,
    harga_dasar: basePrice,
  };
};

/* ===================== WALLET ===================== */
// Sama: kembalikan field inti + alias umum (number/nomor)
const walletFromAPI = (row: AnyObj): Wallet => {
  const num =
    String(row.number ?? row.nomor ?? row.accountNumber ?? row.noRek ?? row.no_rekening ?? '');

  const w: any = {
    id: String(row.id ?? row.wallet_id ?? ''),
    name: row.name ?? row.nama ?? '',
    number: num,
    balance: toNumber(row.balance ?? row.saldo ?? 0),

    // alias
    nama: row.name ?? row.nama ?? '',
    nomor: num,
    saldo: toNumber(row.balance ?? row.saldo ?? 0),
  };

  return w as Wallet;
};

const walletToAPI = (input: Partial<Wallet> | AnyObj): AnyObj => {
  const i: any = input;
  const num = i.number ?? i.nomor ?? i.accountNumber ?? i.noRek;
  return {
    nama: i.name ?? i.nama,
    nomor: String(num ?? ''),
    saldo: toNumber(i.balance ?? i.saldo),
  };
};

/* ===================== FINANCE CATEGORY ===================== */
const financeCategoryFromAPI = (row: AnyObj): FinanceCategory => ({
    id: String(row.id ?? ''),
    name: row.name ?? row.nama ?? row.nama_kategori ?? '',
    type: row.type ?? row.jenis ?? 'expense',
});
const financeCategoryToAPI = (input: Partial<FinanceCategoryInput> | Partial<FinanceCategory>): AnyObj => ({
    nama_kategori: (input as any).name ?? '',
    jenis: (input as any).type ?? 'expense',
});


// --- DATA MANAGEMENT APIS (FOR DEV) ---
export const resetMockData = (): Promise<{ success: boolean, message: string }> => api.post('/dev/seed', {});
export const clearMockData = (): Promise<{ success: boolean, message: string }> => api.post('/dev/clear', {});


// --- PRODUCT APIS ---
export const fetchProducts = (): Promise<Product[]> =>
    api.get('/products').then((rows: any[]) => rows.map(productFromAPI));

export const addProduct = (product: ProductInput): Promise<Product> =>
    api.post('/products', productToAPI(product)).then(productFromAPI);

export const updateProduct = (id: string, productUpdate: Partial<ProductInput>): Promise<Product> =>
    api.put(`/products/${id}`, productToAPI(productUpdate)).then(productFromAPI);

export const deleteProduct = (id: string): Promise<{ success: boolean }> =>
    api.delete(`/products/${id}`);

// --- WALLET APIS ---
export const fetchWallets = (): Promise<Wallet[]> =>
    api.get('/wallets').then((rows: any[]) => rows.map(walletFromAPI));

export const addWallet = (wallet: WalletInput): Promise<Wallet> =>
    api.post('/wallets', walletToAPI(wallet)).then(walletFromAPI);

export const updateWallet = (id: string, walletUpdate: Partial<WalletInput>): Promise<Wallet> =>
    api.put(`/wallets/${id}`, walletToAPI(walletUpdate)).then(walletFromAPI);

export const deleteWallet = (id: string): Promise<{ success: boolean }> =>
    api.delete(`/wallets/${id}`);

// --- FINANCE CATEGORY APIS ---
export const fetchFinanceCategories = (): Promise<FinanceCategory[]> =>
    api.get('/finance-categories').then((rows: any[]) => rows.map(financeCategoryFromAPI));

export const addFinanceCategory = (category: FinanceCategoryInput): Promise<FinanceCategory> =>
    api.post('/finance-categories', financeCategoryToAPI(category)).then(financeCategoryFromAPI);

export const updateFinanceCategory = (id: string, categoryUpdate: Partial<FinanceCategoryInput>): Promise<FinanceCategory> =>
    api.put(`/finance-categories/${id}`, financeCategoryToAPI(categoryUpdate)).then(financeCategoryFromAPI);

export const deleteFinanceCategory = (id: string): Promise<{ success: boolean }> =>
    api.delete(`/finance-categories/${id}`);


// --- SALES ORDER APIS ---
export const getNextInvoiceNumber = (): Promise<{ invoiceNumber: string }> => api.get('/orders/next-invoice');
export const fetchSalesOrders = (): Promise<SalesOrder[]> => api.get('/orders');
export const saveSalesOrder = (order: SalesOrderInput): Promise<SalesOrder> => {
    if (order.id) {
        return api.put(`/orders/${order.id}`, order);
    }
    return api.post('/orders', order);
};
export const cancelSalesOrder = (id: string): Promise<{ success: boolean, message: string }> => api.post(`/orders/${id}/cancel`, {});

// --- FINANCE APIS ---
export const recordSettlement = async (
    salesOrderId: string,
    amount: number,
    walletId: string,
    categoryId: string,
    tanggal: string
): Promise<{ success: boolean; message: string; updatedOrder: SalesOrder | null }> => {
    return api.post(`/settlements`, { salesOrderId, amount, walletId, categoryId, tanggal });
};

export const fetchCashFlowEntries = (): Promise<CashFlowEntry[]> => api.get('/cashflow');
export const addCashFlowEntry = (entry: CashFlowEntryInput): Promise<CashFlowEntry> => api.post('/cashflow', entry);
export const updateCashFlowEntry = (id: string, entryUpdate: CashFlowEntryInput): Promise<CashFlowEntry> => api.put(`/cashflow/${id}`, entryUpdate);
export const deleteCashFlowEntry = (id: string): Promise<{ success: boolean }> => api.delete(`/cashflow/${id}`);

// --- ANALYTICS APIS ---
export const fetchOrderAnalytics = (params: { marketplace: string; granularity: 'daily' | 'monthly' }) => {
    const query = new URLSearchParams(params as any).toString();
    return api.get(`/analytics/orders?${query}`);
};

// --- USER & AUTH APIS ---
export const login = (username: string, password: string, remember: boolean): Promise<{ ok: boolean, user: User }> => api.post('/auth/login', { username, password, remember });
export const checkSession = (): Promise<{ user: User }> => api.get('/auth/me');
export const logout = (): Promise<{ ok: boolean }> => api.post('/auth/logout', {});

export const fetchUsers = (): Promise<User[]> => api.get('/users');
export const saveUser = (userInput: UserInput): Promise<User> => {
    if (userInput.id) {
        return api.put(`/users/${userInput.id}`, userInput);
    }
    return api.post('/users', userInput);
};
export const deleteUser = (id: string): Promise<{ success: boolean }> => api.delete(`/users/${id}`);

// FIX: Added mock implementations for missing legacy API functions to resolve import errors.
// --- LEGACY/OTHER APIS ---
export const saveSalesInvoice = async (invoice: any): Promise<{ success: boolean, message: string }> => {
    console.warn("saveSalesInvoice is a mock function and does not persist data.");
    return Promise.resolve({ success: true, message: "Invoice saved successfully (mock)." });
};

export const deleteSalesInvoice = async (id: string): Promise<{ success: boolean }> => {
    console.warn("deleteSalesInvoice is a mock function and does not persist data.");
    return Promise.resolve({ success: true });
};

export const addPlatform = async (platform: any): Promise<any> => Promise.resolve({ ...platform, id: `new_${Date.now()}` });
export const updatePlatform = async (id: string, platform: any): Promise<any> => Promise.resolve({ ...platform, id });

export const addEkspedisi = async (ekspedisi: any): Promise<any> => Promise.resolve({ ...ekspedisi, id: `new_${Date.now()}` });
export const updateEkspedisi = async (id: string, ekspedisi: any): Promise<any> => Promise.resolve({ ...ekspedisi, id });

export const addCustomer = async (customer: any): Promise<any> => Promise.resolve({ ...customer, id: `new_${Date.now()}` });
export const updateCustomer = async (id: string, customer: any): Promise<any> => Promise.resolve({ ...customer, id });
export const deleteCustomer = async (id: string): Promise<{ success: boolean }> => Promise.resolve({ success: true });

export const addPaymentMethod = async (method: any): Promise<any> => Promise.resolve({ ...method, id: `new_${Date.now()}` });
export const updatePaymentMethod = async (id: string, method: any): Promise<any> => Promise.resolve({ ...method, id });
export const deletePaymentMethod = async (id: string): Promise<{ success: boolean }> => Promise.resolve({ success: true });

// These were for components that are no longer central but might be re-used.
// Mapping them to new backend sources if available.
export const fetchCustomers = async (query?: string): Promise<any[]> => {
    // This feature is not backed by the new schema, returning empty.
    return Promise.resolve([]);
};
export const fetchPlatforms = (): Promise<Platform[]> => {
    // Mocking this as it's static and not in the DB schema provided by user
    const mockPlatforms: Platform[] = [
        { id: 'PLT-001', name: 'Shopee' },
        { id: 'PLT-002', name: 'Tokopedia' },
        { id: 'PLT-003', name: 'TikTok Shop' },
        { id: 'PLT-004', name: 'WhatsApp' },
        { id: 'PLT-005', name: 'Lainnya' },
    ];
    return Promise.resolve(mockPlatforms);
};
export const fetchEkspedisi = async (): Promise<any[]> => {
    // This feature is not backed by the new schema, returning empty.
    return Promise.resolve([]);
};
export const fetchPaymentMethods = async (): Promise<any[]> => {
    // This feature is not backed by the new schema, returning empty.
    return Promise.resolve([]);
};