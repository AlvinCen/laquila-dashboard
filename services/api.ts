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
    if (v == null) return 0;
    const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : 0;
};


/* ===================== PRODUCT ===================== */
// Kembalikan field inti sesuai tipe Product KAMU (sku/name/basePrice/createdAt?)
// Lalu tambahkan semua alias (kodeProduk, kode_produk, namaProduk, harga_dasar, dll)
// Supaya ProductTable apa pun tetap dapat nilai.
// FE -> SERVER (POST/PUT) — backend butuh camelCase

// ---- NORMALIZER PRODUK: bikin semua alias kunci ada ----
const normalizeProduct = (r: any) => {
  const id = String(r.id ?? r.product_id ?? r.uuid ?? '');
  const sku =
    r.sku ?? r.code ?? r.kode ?? r.kode_produk ?? r.kodeProduk ?? '';
  const name =
    r.name ?? r.nama ?? r.nama_produk ?? r.namaProduk ?? '';
  const basePrice = toNumber(r.basePrice ?? r.harga_dasar ?? r.hargaDasar ?? r.base_price ?? r.price ?? 0);
  const hppYear = r.hppYear ?? r.tahunHpp ?? r.tahun_hpp ?? null;

  // kembalikan field utama + SEMUA alias yang biasa dipakai tabel
  return {
    id,
    // utama (camelCase)
    sku, name, basePrice, hppYear,

    // alias untuk kompatibilitas tabel lama
    code: sku, kode: sku, kode_produk: sku, kodeProduk: sku,
    nama: name, nama_produk: name, namaProduk: name,
    price: basePrice, base_price: basePrice, harga_dasar: basePrice, hargaDasar: basePrice,
    tahunHpp: hppYear, tahun_hpp: hppYear,
  };
};
const toServerProductBody = (p: any) => ({
  sku:       p.sku ?? p.code ?? p.kode ?? p.kode_produk ?? p.kodeProduk ?? '',
  name:      p.name ?? p.nama ?? p.nama_produk ?? p.namaProduk ?? '',
  basePrice: toNumber(p.basePrice ?? p.harga_dasar ?? p.hargaDasar ?? p.price),
  hppYear:   Number(p.hppYear ?? p.tahunHpp ?? p.tahun_hpp ?? new Date().getFullYear()),
});



/* ===================== WALLET ===================== */
// Sama: kembalikan field inti + alias umum (number/nomor)
// FE -> SERVER (POST/PUT)
const toServerWallet = (w:any) => ({
  name: w?.name ?? w?.nama ?? '',
  number: String(w?.number ?? w?.nomor ?? ''),
  balance: Number(w?.balance ?? w?.saldo ?? 0),
});

const fromServerWallet = (r:any): Wallet => ({
  id: String(r?.id ?? r?.wallet_id ?? r?.uuid ?? ''),
  name: r?.name ?? r?.nama ?? '',
  number: String(r?.number ?? r?.nomor ?? ''),
  balance: Number(r?.balance ?? r?.saldo ?? 0),
});

/* ===================== FINANCE CATEGORY ===================== */
// FE -> SERVER
const toServerFinCat = (x:any) => ({
  name: x?.name ?? x?.nama ?? '',
  type: (x?.type ?? x?.jenis ?? x?.tipe ?? 'expense'),
});
const fromServerFinCat = (r:any): FinanceCategory => ({
  id: String(r?.id ?? r?.category_id ?? r?.uuid ?? ''),   // <-- JANGAN kosong
  name: r?.name ?? r?.nama ?? '',
  type: (r?.type ?? r?.jenis ?? 'expense'),
});


// --- DATA MANAGEMENT APIS (FOR DEV) ---
export const resetMockData = (): Promise<{ success: boolean, message: string }> => api.post('/dev/seed', {});
export const clearMockData = (): Promise<{ success: boolean, message: string }> => api.post('/dev/clear', {});


// --- PRODUCT APIS ---
export const fetchProducts = async () => {
  const rows = await api.get('/products');
  return (Array.isArray(rows) ? rows : []).map(normalizeProduct);
};

export const addProduct = async (payload: any) => {
  const res = await api.post('/products', toServerProductBody(payload));
  return normalizeProduct(res);
};

export const updateProduct = async (id: string, payload: any) => {
  const res = await api.put(`/products/${id}`, toServerProductBody(payload));
  return normalizeProduct(res);
};


export const deleteProduct = (id: string): Promise<{ success: boolean }> =>
    api.delete(`/products/${id}`);

// --- WALLET APIS ---
export async function fetchWallets(): Promise<Wallet[]> {
  const res = await api.get('/wallets');
  return (Array.isArray(res) ? res : []).map(fromServerWallet);
}
export async function addWallet(input:any): Promise<Wallet> {
  const res = await api.post('/wallets', toServerWallet(input));
  return fromServerWallet(res);
}
export async function updateWallet(id:string, input:any): Promise<Wallet> {
  const res = await api.put(`/wallets/${id}`, toServerWallet(input));
  return fromServerWallet(res);
}
export async function deleteWallet(id:string): Promise<void> {
  await api.delete(`/wallets/${id}`);
}

// --- FINANCE CATEGORY APIS ---
export async function fetchFinanceCategories(): Promise<FinanceCategory[]> {
  const res = await api.get('/finance-categories');
  return (Array.isArray(res) ? res : []).map(fromServerFinCat);
}

export async function addFinanceCategory(input:any): Promise<FinanceCategory> {
  const res = await api.post('/finance-categories', toServerFinCat(input));
  return fromServerFinCat(res);
}

export async function updateFinanceCategory(id:string, input:any): Promise<FinanceCategory> {
  const res = await api.put(`/finance-categories/${id}`, toServerFinCat(input));
  return fromServerFinCat(res);
}

export async function deleteFinanceCategory(id:string): Promise<void> {
  await api.delete(`/finance-categories/${id}`);
}

// --- SALES ORDER APIS ---
export const getNextInvoiceNumber = (): Promise<{ invoiceNumber: string }> => api.get('/orders/next-invoice');
export async function fetchSalesOrders(params?: {
  status?: 'Confirmed'|'Cancelled'
  startDate?: string
  endDate?: string
  q?: string
}): Promise<SalesOrder[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.startDate) qs.set('startDate', params.startDate)
  if (params?.endDate) qs.set('endDate', params.endDate)
  if (params?.q) qs.set('q', params.q)
  const res = await fetch(`/orders?${qs.toString()}`)
  if (!res.ok) throw new Error('Gagal memuat data sales order.')
  return res.json()
}

export async function saveSalesOrder(payload: SalesOrderInput) {
  const isEdit = Boolean(payload.id)
  const res = await fetch(`/orders${isEdit ? `/${payload.id}` : ''}`, {
    method: isEdit ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(isEdit ? 'UPDATE_ORDER_FAILED' : 'CREATE_ORDER_FAILED')
  return res.json()
}

export async function cancelSalesOrder(id: string) {
  const res = await fetch(`/orders/${id}/cancel`, { method: 'POST' })
  if (!res.ok) throw new Error('CANCEL_ORDER_FAILED')
  return res.json()
}

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