import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Button } from '../../ui/Button';
import { fetchCashFlowEntries, fetchSalesOrders, fetchWallets } from '../../../services/api';
import { CashFlowEntry, SalesOrder, Wallet } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import { generateProfitLossDocx } from '../../../utils/docx-generator';
import { DocumentIcon } from '../../icons/DocumentIcon';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Select } from '../../ui/Select';

type PeriodMode = 'daily' | 'monthly';

const getInitialDateRange = () => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
    };
};

const getMonthRange = (monthInput: string) => {
    if (!monthInput) return getInitialDateRange();
    const [year, month] = monthInput.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(Date.UTC(year, month, 0));
    return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
    };
};

const GrowthInsightPage: React.FC = () => {
    const [cashFlowEntries, setCashFlowEntries] = useState<CashFlowEntry[]>([]);
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
    const [dateRange, setDateRange] = useState(getInitialDateRange());
    const [monthInput, setMonthInput] = useState(new Date().toISOString().slice(0, 7));
    const [libsReady, setLibsReady] = useState(false);
    const { showToast } = useToast();
    const { hasPermission, filterWallets } = useAuth();
    const canExport = hasPermission('growth-insight', 'export');
    
    const [selectedWalletId, setSelectedWalletId] = useState<'all' | string>('all');
    
    const accessibleWallets = useMemo(() => filterWallets(wallets), [wallets, filterWallets]);


    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [cashFlowData, salesOrderData, walletData] = await Promise.all([
                    fetchCashFlowEntries(),
                    fetchSalesOrders(),
                    fetchWallets()
                ]);
                setCashFlowEntries(cashFlowData);
                setSalesOrders(salesOrderData);
                setWallets(walletData);
            } catch (err: any) {
                setError(err.message || 'Gagal memuat data untuk insight.');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        let isMounted = true;
        const resolveDocx = new Promise<void>((resolve, reject) => {
            let attempts = 0;
            const interval = setInterval(() => {
                if (typeof (window as any).docx !== 'undefined') { clearInterval(interval); resolve();
                } else if (attempts >= 10) { clearInterval(interval); import('docx').then(() => resolve()).catch(reject); }
                attempts++;
            }, 100);
        });
        const resolveSaveAs = new Promise<void>((resolve) => {
            const interval = setInterval(() => {
                if (typeof (window as any).saveAs === 'function') { clearInterval(interval); resolve(); }
            }, 100);
        });

        Promise.all([resolveDocx, resolveSaveAs]).then(() => { if (isMounted) { setLibsReady(true); } })
            .catch((error) => {
                console.error("Failed to load export libraries:", error);
                if (isMounted) { showToast("Gagal memuat pustaka ekspor.", 'error'); }
            });
        
        return () => { isMounted = false; };
    }, [showToast]);

    const currentBalance = useMemo(() => {
        const relevantEntries = cashFlowEntries.filter(entry => {
            if (accessibleWallets.length === wallets.length) return true; // admin or all access
            return accessibleWallets.some(w => w.id === entry.walletId) || (entry.toWalletId && accessibleWallets.some(w => w.id === entry.toWalletId));
        });

        if (selectedWalletId === 'all') {
             return relevantEntries.reduce((acc, entry) => {
                if (entry.type === 'income') return acc + entry.jumlah;
                if (entry.type === 'expense') return acc - entry.jumlah;
                return acc;
            }, 0);
        }

        return relevantEntries.reduce((acc, entry) => {
            let balanceChange = 0;
            if (entry.walletId === selectedWalletId) {
                if (entry.type === 'income') balanceChange += entry.jumlah;
                if (entry.type === 'expense') balanceChange -= entry.jumlah;
                if (entry.type === 'transfer') balanceChange -= entry.jumlah;
            }
            if (entry.toWalletId === selectedWalletId && entry.type === 'transfer') {
                balanceChange += entry.jumlah;
            }
            return acc + balanceChange;
        }, 0);

    }, [selectedWalletId, cashFlowEntries, accessibleWallets, wallets]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };
    
    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => { setMonthInput(e.target.value); };
    const activeDateRange = useMemo(() => {
        if (periodMode === 'monthly') { return getMonthRange(monthInput); }
        return dateRange;
    }, [periodMode, dateRange, monthInput]);

    const financialData = useMemo(() => {
        const startDate = new Date(activeDateRange.start + 'T00:00:00Z');
        const endDate = new Date(activeDateRange.end + 'T23:59:59Z');

        const filteredCashFlow = cashFlowEntries.filter(entry => {
            const entryDate = new Date(entry.tanggal);
            const isWalletAccessible = accessibleWallets.some(w => w.id === entry.walletId) || (entry.toWalletId && accessibleWallets.some(w => w.id === entry.toWalletId));
            return entryDate >= startDate && entryDate <= endDate && isWalletAccessible;
        });
        const filteredSalesOrders = salesOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= startDate && orderDate <= endDate;
        });

        const initialData = { totalIncome: 0, totalExpense: 0, incomeByCategory: {} as Record<string, number>, expenseByCategory: {} as Record<string, number> };
        const cashFlowMetrics = filteredCashFlow.reduce((acc, entry) => {
            if (entry.type === 'income' && entry.kategori) {
                acc.totalIncome += entry.jumlah;
                acc.incomeByCategory[entry.kategori] = (acc.incomeByCategory[entry.kategori] || 0) + entry.jumlah;
            } else if (entry.type === 'expense' && entry.kategori) {
                acc.totalExpense += entry.jumlah;
                acc.expenseByCategory[entry.kategori] = (acc.expenseByCategory[entry.kategori] || 0) + entry.jumlah;
            }
            return acc;
        }, initialData);
        
        const totalSalesOrderValue = filteredSalesOrders.reduce((sum, order) => {
            // Correctly sum up basePrice * qty from items, as order.total is now calculated by API
            const orderValue = order.items.reduce((itemSum, item) => itemSum + (item.basePrice * item.qty), 0);
            return sum + orderValue;
        }, 0);

        const totalSettlements = filteredCashFlow.filter(entry => entry.type === 'income' && entry.deskripsi?.startsWith('Pelunasan')).reduce((sum, entry) => sum + entry.jumlah, 0);

        const penjualanKandangLainnya = Math.max(totalSettlements - totalSalesOrderValue, 0);
        const biayaPemasaran = Math.max(totalSalesOrderValue - totalSettlements, 0);
        const marketingBudget = penjualanKandangLainnya - biayaPemasaran;

        const profitOrLoss = cashFlowMetrics.totalIncome - cashFlowMetrics.totalExpense;

        return { ...cashFlowMetrics, profitOrLoss, marketingBudget, totalSalesOrderValue };
    }, [cashFlowEntries, salesOrders, activeDateRange, accessibleWallets]);

    const sortedIncomeCategories = useMemo(() => Object.entries(financialData.incomeByCategory).sort(([,a], [,b]) => (Number(b) || 0) - (Number(a) || 0)), [financialData.incomeByCategory]);
    const sortedExpenseCategories = useMemo(() => Object.entries(financialData.expenseByCategory).sort(([,a], [,b]) => (Number(b) || 0) - (Number(a) || 0)), [financialData.expenseByCategory]);
    const maxChartValue = useMemo(() => Math.max(financialData.totalIncome, financialData.totalExpense, 1), [financialData.totalIncome, financialData.totalExpense]);

    const handleExport = async () => {
        if (!libsReady) { showToast("Pustaka ekspor belum siap, mohon tunggu sebentar.", 'info'); return; }
        setIsExporting(true);
        try {
            let periodString = '';
            if (periodMode === 'monthly' && monthInput) {
                const [year, month] = monthInput.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                periodString = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
            } else {
                 const start = new Date(activeDateRange.start + 'T00:00:00Z'); const end = new Date(activeDateRange.end + 'T00:00:00Z');
                 const startDay = start.toLocaleDateString('id-ID', { day: '2-digit', timeZone: 'UTC' }); const endDay = end.toLocaleDateString('id-ID', { day: '2-digit', timeZone: 'UTC' });
                 const startMonthYear = start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
                 const endMonthYear = end.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
                 if (startMonthYear === endMonthYear) { periodString = `${startDay} - ${endDay} ${startMonthYear}`; } 
                 else {
                    const formattedStart = start.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
                    const formattedEnd = end.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
                    periodString = `${formattedStart} - ${formattedEnd}`;
                 }
            }
            const salesCategories = ['Penjualan Kandang Puyuh', 'Penjualan Kandang Kelinci', 'Penjualan Kandang Burung', 'Penjualan Kandang Ayam', 'Aksesoris Kandang', 'Coating'];
            const salesData = salesCategories.map(cat => ({ name: cat.replace('Penjualan ', ''), value: financialData.incomeByCategory[cat] || 0 }));
            const otherSales = Object.entries(financialData.incomeByCategory).reduce((sum, [cat, val]) => {
                if (!salesCategories.includes(cat) && cat !== 'Tambah Modal' && cat !== 'Tarik Modal') { return sum + Number(val); }
                return sum;
            }, 0);
            if(otherSales > 0) salesData.push({ name: 'Others', value: otherSales });
            const totalSales = salesData.reduce((sum, item) => sum + item.value, 0);
            const cogsData = [{ name: 'Persediaan Awal', value: 0 }, { name: 'Persediaan Akhir', value: 0 }, { name: 'Bahan Baku', value: financialData.expenseByCategory['Material'] || 0 }, { name: 'Listrik & Gas', value: financialData.expenseByCategory['Gas & Listrik'] || 0 }, { name: 'Tenaga Kerja', value: financialData.expenseByCategory['Tenaga Kerja'] || 0 }];
            const opExData = [{ name: 'Pengiriman', value: financialData.expenseByCategory['Pengiriman'] || 0 }, { name: 'Pemasaran', value: financialData.expenseByCategory['Pemasaran'] || 0 }, { name: 'Administrasi & Umum', value: financialData.expenseByCategory['Adm & Umum'] || 0 }, { name: 'Perlengkapan', value: financialData.expenseByCategory['Perlengkapan'] || 0 }];
            const blob = await generateProfitLossDocx({ period: periodString, salesData, cogsData, opExData, totalSales });
            (window as any).saveAs(blob, `Laporan Laba Rugi - ${periodString}.docx`);
        } catch(err) {
            console.error("Failed to export DOCX:", err);
            showToast("Gagal membuat dokumen. Silakan coba lagi.", 'error');
        } finally { setIsExporting(false); }
    };

    const MetricCard: React.FC<{ title: string; value: number; color?: string; }> = ({ title, value, color = 'text-foreground' }) => (<Card className="text-center"><CardContent className="p-4"><p className="text-sm text-muted-foreground">{title}</p><p className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</p></CardContent></Card>);
    const CategoryList: React.FC<{ title: string; data: [string, number][]; }> = ({ title, data }) => (<div><h4 className="text-lg font-semibold mb-2">{title}</h4><div className="space-y-2 max-h-48 overflow-y-auto pr-2">{data.length > 0 ? data.map(([category, amount]) => (<div key={category} className="flex justify-between items-center bg-gray-50 p-2 rounded-md text-sm"><span className="text-gray-700 truncate pr-2">{category}</span><span className="font-medium flex-shrink-0">{formatCurrency(amount)}</span></div>)) : <p className="text-sm text-muted-foreground">Tidak ada data.</p>}</div></div>);
    const PeriodModeButton: React.FC<{ mode: PeriodMode; label: string; }> = ({ mode, label }) => { const isActive = periodMode === mode; return (<button onClick={() => setPeriodMode(mode)} className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-gray-200'}`} data-testid={`period-picker-${mode}`}>{label}</button>); };

    if (isLoading) return <Card><CardContent className="p-6 text-center text-muted-foreground">Memuat data...</CardContent></Card>;
    if (error) return <Card><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card>;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div><h2 className="text-xl font-semibold">Growth Insight</h2><p className="text-sm text-muted-foreground">Analisis performa bisnis berdasarkan rentang tanggal yang dipilih.</p></div>
                    {canExport && <Button variant="outline" onClick={handleExport} disabled={isExporting || !libsReady}><DocumentIcon className="h-4 w-4 mr-2" />{isExporting ? 'Mengekspor...' : (!libsReady ? 'Memuat...' : 'Ekspor .DOCX')}</Button>}
                </div>
            </CardHeader>
            <CardContent className="space-y-8">
                 <div className="p-4 bg-muted rounded-lg space-y-4">
                    <div className="flex space-x-2 p-1 bg-background rounded-lg max-w-sm mx-auto"><PeriodModeButton mode="daily" label="Harian" /><PeriodModeButton mode="monthly" label="Bulanan" /></div>
                    {periodMode === 'daily' && (<div className="flex flex-col sm:flex-row gap-4 items-center animate-fadeIn"><div className="flex-1 w-full sm:w-auto"><Label htmlFor="start">Tanggal Mulai</Label><Input type="date" name="start" id="start" value={dateRange.start} onChange={handleDateChange} /></div><div className="flex-1 w-full sm:w-auto"><Label htmlFor="end">Tanggal Selesai</Label><Input type="date" name="end" id="end" value={dateRange.end} onChange={handleDateChange} /></div></div>)}
                    {periodMode === 'monthly' && (<div className="flex justify-center animate-fadeIn"><div className="w-full max-w-xs"><Label htmlFor="month">Pilih Bulan & Tahun</Label><Input type="month" name="month" id="month" value={monthInput} onChange={handleMonthChange} /></div></div>)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end p-4 border rounded-lg">
                    <div className="grid gap-1.5">
                        <Label htmlFor="wallet-filter">Pilih Wallet untuk Saldo</Label>
                        <Select id="wallet-filter" value={selectedWalletId} onChange={(e) => setSelectedWalletId(e.target.value)}>
                            <option value="all">Semua Wallet</option>
                            {accessibleWallets.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                        </Select>
                    </div>
                    <div className="text-right bg-gray-50 p-4 rounded-lg h-full flex flex-col justify-center"><p className="text-sm text-muted-foreground">Saldo Saat Ini</p><p className="text-2xl font-bold">{formatCurrency(currentBalance)}</p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard title="Total Pemasukan" value={financialData.totalIncome} color="text-green-600" />
                    <MetricCard title="Total Pengeluaran" value={financialData.totalExpense} color="text-destructive" />
                    <MetricCard title="Laba / Rugi" value={financialData.profitOrLoss} color={financialData.profitOrLoss >= 0 ? 'text-blue-600' : 'text-destructive'} />
                    <MetricCard title="Marketing budget" value={financialData.marketingBudget} color={financialData.marketingBudget >= 0 ? 'text-foreground' : 'text-destructive'}/>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t">
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-center">Pemasukan vs Pengeluaran</h4>
                        <div className="flex justify-around items-end h-64 bg-gray-50 p-4 rounded-lg">
                            <div className="flex flex-col justify-end items-center w-1/3 h-full text-center"><div className="w-1/2 bg-green-500 rounded-t-md transition-all duration-500" style={{ height: `${(financialData.totalIncome / maxChartValue) * 100}%` }} title={`Pemasukan: ${formatCurrency(financialData.totalIncome)}`}></div><p className="text-sm font-bold text-green-600 mt-2">{formatCurrency(financialData.totalIncome)}</p><p className="text-xs font-medium">Pemasukan</p></div>
                            <div className="flex flex-col justify-end items-center w-1/3 h-full text-center"><div className="w-1/2 bg-red-500 rounded-t-md transition-all duration-500" style={{ height: `${(financialData.totalExpense / maxChartValue) * 100}%` }} title={`Pengeluaran: ${formatCurrency(financialData.totalExpense)}`}></div><p className="text-sm font-bold text-destructive mt-2">{formatCurrency(financialData.totalExpense)}</p><p className="text-xs font-medium">Pengeluaran</p></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        <CategoryList title="Penjualan per Kategori" data={sortedIncomeCategories} /><CategoryList title="Pengeluaran per Kategori" data={sortedExpenseCategories} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default GrowthInsightPage;
