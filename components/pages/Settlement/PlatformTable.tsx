import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SalesOrder, Wallet, FinanceCategory, PaymentStatus, OrderStatus, CashFlowEntry } from '../../../types';
import { fetchSalesOrders, fetchWallets, fetchFinanceCategories, recordSettlement, fetchCashFlowEntries } from '../../../services/api';
import { Card, CardHeader, CardContent } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Label } from '../../ui/Label';
import { Select } from '../../ui/Select';
import { formatCurrency, toDateTimeLocal } from '../../../utils/formatters';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

const SettlementForm: React.FC<{
    order: SalesOrder;
    wallets: Wallet[];
    incomeCategories: FinanceCategory[];
    cashFlowEntries: CashFlowEntry[];
    onSave: (settlementData: { amount: number; walletId: string; categoryId: string; tanggal: string; }) => Promise<void>;
    onCancel: () => void;
}> = ({ order, wallets, incomeCategories, cashFlowEntries, onSave, onCancel }) => {
    const sisaTagihan = order.total - (order.jumlahDilunasi || 0);
    const [amount, setAmount] = useState(sisaTagihan);
    const [walletId, setWalletId] = useState('all');
    const [categoryId, setCategoryId] = useState(incomeCategories[0]?.id || '');
    const [tanggal, setTanggal] = useState(() => toDateTimeLocal(new Date().toISOString()));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const { showToast } = useToast();
    const { filterWallets, canAccessWallet } = useAuth();
    
    const accessibleWallets = filterWallets(wallets);

    const currentBalance = useMemo(() => {
        if (!cashFlowEntries) return 0;

        if (walletId === 'all') {
             return cashFlowEntries.reduce((acc, entry) => {
                if (!canAccessWallet(entry.walletId) && (!entry.toWalletId || !canAccessWallet(entry.toWalletId))) return acc;
                if (entry.type === 'income') return acc + entry.jumlah;
                if (entry.type === 'expense') return acc - entry.jumlah;
                return acc;
            }, 0);
        }

        return cashFlowEntries.reduce((acc, entry) => {
            let balanceChange = 0;
            if (entry.walletId === walletId) {
                if (entry.type === 'income') balanceChange += entry.jumlah;
                if (entry.type === 'expense') balanceChange -= entry.jumlah;
                if (entry.type === 'transfer') balanceChange -= entry.jumlah;
            }
            if (entry.toWalletId === walletId && entry.type === 'transfer') {
                balanceChange += entry.jumlah;
            }
            return acc + balanceChange;
        }, 0);

    }, [walletId, cashFlowEntries, canAccessWallet]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (amount <= 0) {
            setError('Jumlah pelunasan harus lebih dari 0.');
            return;
        }
        if (walletId === 'all' || !walletId) {
            setError('Silakan pilih wallet tujuan spesifik.');
            return;
        }
        if (!categoryId) {
            setError('Silakan pilih kategori penjualan.');
            return;
        }
        
        setIsSaving(true);
        try {
            await onSave({ amount, walletId, categoryId, tanggal });
        } catch (e: any) {
            const errorMessage = e.message || 'Gagal menyimpan pelunasan.';
            setError(errorMessage);
            showToast(errorMessage, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Sisa Tagihan</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(sisaTagihan)}</p>
                {/* FIX: Changed property access from noInvoice to invoiceNumber. */}
                <p className="text-xs text-muted-foreground mt-1">Invoice: {order.invoiceNumber}</p>
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="amount">Jumlah Pelunasan</Label>
                <Input 
                    id="amount" 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required 
                    data-testid="settlement-amount"
                />
            </div>
             <div className="grid gap-1.5">
                <Label htmlFor="tanggal">Tanggal Pelunasan</Label>
                <Input 
                    id="tanggal" 
                    type="datetime-local" 
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    required 
                />
            </div>
             <div className="grid gap-1.5">
                <div className="flex justify-between items-baseline">
                    <Label htmlFor="walletId">Masuk ke Wallet</Label>
                    <span className="text-xs text-muted-foreground">Saldo Saat Ini: <strong>{formatCurrency(currentBalance)}</strong></span>
                </div>
                <Select id="walletId" value={walletId} onChange={(e) => setWalletId(e.target.value)} required>
                    <option value="all">Semua Wallet (Lihat Saldo)</option>
                    {accessibleWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="categoryId">Kategori Penjualan</Label>
                <Select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                    {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
            </div>
            <div className="grid gap-1.5">
                <Label>Deskripsi</Label>
                {/* FIX: Changed property access from noInvoice to invoiceNumber. */}
                <Input value={`Pelunasan untuk Invoice ${order.invoiceNumber}`} readOnly disabled />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
                <Button type="submit" disabled={isSaving || walletId === 'all'}>
                    {isSaving ? 'Menyimpan...' : 'Simpan Pelunasan'}
                </Button>
            </div>
        </form>
    );
};

const PaymentStatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full inline-block';
    const statusStyles: Record<PaymentStatus, string> = {
        'Pending': 'bg-gray-100 text-gray-800',
        'Partial': 'bg-yellow-100 text-yellow-800',
        'Settled': 'bg-green-100 text-green-800',
    };
    return <span className={`${baseClasses} ${statusStyles[status]}`}>{status}</span>;
}


const SettlementPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [allOrders, setAllOrders] = useState<SalesOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<FinanceCategory[]>([]);
    const [cashFlowEntries, setCashFlowEntries] = useState<CashFlowEntry[]>([]);
    
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const { showToast } = useToast();
    const { hasPermission } = useAuth();
    const canSettle = hasPermission('settlement', 'settle');

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [walletData, categoryData, salesOrderData, cashFlowData] = await Promise.all([
                fetchWallets(),
                fetchFinanceCategories(),
                fetchSalesOrders(),
                fetchCashFlowEntries()
            ]);
            setWallets(walletData);
            setIncomeCategories(categoryData.filter(c => c.type === 'income'));
            setAllOrders(salesOrderData);
            setCashFlowEntries(cashFlowData);
        } catch (err: any) {
            setError(err.message || 'Gagal memuat data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const displayedOrders = useMemo(() => {
        const settlementCandidates = allOrders.filter(order => 
            order.paymentStatus !== 'Settled' && order.orderStatus !== 'Cancelled'
        );

        const filteredList = searchQuery
            ? settlementCandidates.filter(order => {
                const lowerQuery = searchQuery.toLowerCase();
                return (
                    order.namaPelanggan?.toLowerCase().includes(lowerQuery) ||
                    // FIX: Changed property access from noInvoice to invoiceNumber.
                    order.invoiceNumber.toLowerCase().includes(lowerQuery) ||
                    order.noIdPesanan?.toLowerCase().includes(lowerQuery)
                );
            })
            : settlementCandidates;
        
        // FIX: Changed sorting to use the mandatory `createdAt` field for reliability.
        return filteredList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [allOrders, searchQuery]);
    
    const handleSaveSettlement = async (settlementData: { amount: number; walletId: string; categoryId: string; tanggal: string }) => {
        if (!selectedOrder) return;
        
        try {
            const { amount, walletId, categoryId, tanggal } = settlementData;
            const result = await recordSettlement(selectedOrder.id, amount, walletId, categoryId, tanggal);
            if(result.success && result.updatedOrder) {
                showToast(`Pelunasan berhasil — Payment: ${result.updatedOrder.paymentStatus}`, 'success');
                setSelectedOrder(null); 
                await loadInitialData(); // Reload all data to reflect changes
            } else {
                throw new Error(result.message);
            }
        } catch(e: any) {
            console.error('Failed to save settlement:', e);
            throw e;
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <h2 className="text-xl font-semibold">Settlement</h2>
                    <p className="text-sm text-muted-foreground">
                        Daftar sales order yang belum lunas. Cari untuk filter atau langsung pilih untuk melunasi.
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-6">
                        <Input 
                            type="search"
                            placeholder="Cari No Invoice, ID Pesanan, atau Nama Pelanggan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-grow"
                            aria-label="Cari Sales Order"
                        />
                    </div>

                    {isLoading && <p className="text-center text-muted-foreground">Memuat data order...</p>}
                    {error && <p className="text-destructive text-center">{error}</p>}

                    <div className="space-y-3">
                        {!isLoading && displayedOrders.length > 0 && displayedOrders.map(order => {
                            const sisaTagihan = order.total - (order.jumlahDilunasi || 0);
                            return (
                                <div key={order.id} className="border rounded-lg p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-gray-50">
                                    <div className="grid grid-cols-1 gap-y-4 text-sm sm:flex-grow sm:grid sm:grid-cols-4 sm:gap-x-4 sm:gap-y-2">
                                        <div>
                                            <p className="font-semibold text-gray-800">{order.namaPelanggan}</p>
                                            {/* FIX: Changed property access from noInvoice to invoiceNumber. */}
                                            <p className="text-muted-foreground">{order.invoiceNumber} / {order.noIdPesanan}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-800">{new Date(order.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                            <p className="text-muted-foreground">Tgl Pesan</p>
                                        </div>
                                        <div>
                                            <PaymentStatusBadge status={order.paymentStatus} />
                                            <p className="text-muted-foreground">Payment Status</p>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">{formatCurrency(order.total)}</p>
                                            <p className="text-muted-foreground">Total</p>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 flex sm:flex-col items-center justify-between sm:text-right gap-2 pt-4 sm:pt-0 border-t sm:border-t-0">
                                        <div className="flex-1">
                                            {sisaTagihan > 0 ? (
                                                <>
                                                    <p className="font-bold text-destructive">{formatCurrency(sisaTagihan)}</p>
                                                    <p className="text-xs text-muted-foreground">Sisa Tagihan</p>
                                                </>
                                            ) : (
                                                <p className="font-bold text-green-600">Lunas</p>
                                            )}
                                        </div>
                                        {canSettle && (
                                            <Button 
                                                onClick={() => setSelectedOrder(order)} 
                                                disabled={sisaTagihan <= 0}
                                                size="sm"
                                                // FIX: Changed property access from noInvoice to invoiceNumber.
                                                data-testid={`settle-button-${order.invoiceNumber}`}
                                            >
                                                Lunasi
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                         {!isLoading && displayedOrders.length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">Tidak ada sales order yang perlu dilunasi.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            
            {selectedOrder && (
                // FIX: Changed property access from noInvoice to invoiceNumber.
                <Modal title={`Pelunasan untuk ${selectedOrder.invoiceNumber}`} onClose={() => setSelectedOrder(null)}>
                    <SettlementForm 
                        order={selectedOrder}
                        wallets={wallets}
                        incomeCategories={incomeCategories}
                        cashFlowEntries={cashFlowEntries}
                        onSave={handleSaveSettlement}
                        onCancel={() => setSelectedOrder(null)}
                    />
                </Modal>
            )}
        </>
    );
};

export default SettlementPage;