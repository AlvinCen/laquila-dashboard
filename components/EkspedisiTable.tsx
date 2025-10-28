import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Wallet, FinanceCategory, CashFlowEntryInput, CashFlowEntry } from '../types';
import { fetchWallets, fetchFinanceCategories, addCashFlowEntry, fetchCashFlowEntries, deleteCashFlowEntry, updateCashFlowEntry } from '../services/api';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import CashFlowEntryForm from './CashFlowEntryForm';
import { formatCurrency } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { DownloadIcon } from './icons/DownloadIcon';
import { exportCashFlowToXLSX } from '../utils/xlsx-generator';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { ChevronsUpDownIcon } from './icons/ChevronsUpDownIcon';

declare var Swal: any;

// --- Main Transactions Page Component ---
const TransactionsPage: React.FC = () => {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [categories, setCategories] = useState<FinanceCategory[]>([]);
    const [entries, setEntries] = useState<CashFlowEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Modal state management
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null);
    const [createType, setCreateType] = useState<'income' | 'expense' | 'transfer' | null>(null);

    // State for filtering, sorting, and pagination
    const [filters, setFilters] = useState({
        type: 'all', category: 'all', wallet: 'all',
        startDate: '', endDate: '', query: '',
    });
    const [sortConfig, setSortConfig] = useState<{ key: keyof CashFlowEntry; direction: 'ascending' | 'descending' } | null>({ key: 'tanggal', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    const { showToast } = useToast();
    const { hasPermission, filterWallets } = useAuth();
    const [isExporting, setIsExporting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const fpRef = useRef<any>(null);

    const canCreate = hasPermission('cash-flow', 'create');
    const canUpdate = hasPermission('cash-flow', 'update');
    const canDelete = hasPermission('cash-flow', 'delete');
    const canExport = hasPermission('cash-flow', 'export');

    const accessibleWallets = useMemo(() => filterWallets(wallets), [wallets, filterWallets]);

    useEffect(() => {
        if (!inputRef.current || !(window as any).flatpickr || fpRef.current) return;

        fpRef.current = (window as any).flatpickr(inputRef.current, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            altInputClass: 'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            locale: (window as any).flatpickr.l10ns.id,
            defaultDate: [filters.startDate, filters.endDate].filter(Boolean),
            onChange: (selectedDates: Date[]) => {
                const [start, end] = selectedDates;
                setFilters(prev => ({
                    ...prev,
                    startDate: start ? start.toISOString().slice(0, 10) : '',
                    endDate: end ? end.toISOString().slice(0, 10) : ''
                }));
                setCurrentPage(1);
            },
        });
        
        if(inputRef.current) {
            inputRef.current.style.position = 'absolute';
            inputRef.current.style.opacity = '0';
            inputRef.current.style.pointerEvents = 'none';
            inputRef.current.style.height = '0';
            inputRef.current.style.padding = '0';
        }
        
        return () => {
            if (fpRef.current) {
                fpRef.current.destroy();
                fpRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (fpRef.current) {
            fpRef.current.setDate([filters.startDate || null, filters.endDate || null], false, 'Y-m-d');
        }
    }, [filters.startDate, filters.endDate]);


    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [walletData, categoryData, entriesData] = await Promise.all([
                fetchWallets(),
                fetchFinanceCategories(),
                fetchCashFlowEntries(),
            ]);
            setWallets(walletData);
            setCategories(categoryData);
            setEntries(entriesData);
        } catch (err) {
            setError('Gagal memuat data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEntry(null);
        setCreateType(null);
    };

    const handleEditClick = (entry: CashFlowEntry) => {
        setEditingEntry(entry);
        setCreateType(null);
        setIsModalOpen(true);
    };
    
    const handleAddClick = (type: 'income' | 'expense' | 'transfer') => {
        setCreateType(type);
        setEditingEntry(null);
        setIsModalOpen(true);
    };

    const handleSaveEntry = async (data: CashFlowEntryInput) => {
        try {
            if (editingEntry) {
                await updateCashFlowEntry(editingEntry.id, data);
            } else {
                await addCashFlowEntry(data);
            }
            showToast('Transaksi berhasil disimpan!', 'success');
            handleCloseModal();
            loadData();
        } catch (error: any) {
            showToast(error.message || 'Gagal menyimpan transaksi.', 'error');
            console.error(error);
        }
    };


    const handleDeleteClick = async (id: string) => {
        Swal.fire({
            title: 'Apakah Anda yakin?',
            text: "Transaksi ini akan dihapus secara permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result: { isConfirmed: boolean }) => {
            if (result.isConfirmed) {
                try {
                    await deleteCashFlowEntry(id);
                    showToast('Transaksi berhasil dihapus.', 'success');
                    loadData();
                } catch (err: any) {
                    setError(err.message || 'Gagal menghapus transaksi.');
                    showToast(err.message || 'Gagal menghapus transaksi.', 'error');
                }
            }
        });
    };
    
    const getWalletName = (id: string) => wallets.find(w => w.id === id)?.name || id;

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1); // Reset to first page on filter change
    };

    const requestSort = (key: keyof CashFlowEntry) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const processedEntries = useMemo(() => {
        let filtered = entries.filter(entry => {
            const entryDate = new Date(entry.tanggal);
            const startDate = filters.startDate ? new Date(filters.startDate) : null;
            const endDate = filters.endDate ? new Date(filters.endDate) : null;
            if (startDate) startDate.setUTCHours(0, 0, 0, 0);
            if (endDate) endDate.setUTCHours(23, 59, 59, 999);

            const matchType = filters.type === 'all' || entry.type === filters.type;
            const categoryName = categories.find(c => c.id === filters.category)?.name;
            const matchCategory = filters.category === 'all' || (entry.kategori && entry.kategori === categoryName);
            const matchWallet = filters.wallet === 'all' || entry.walletId === filters.wallet || entry.toWalletId === filters.wallet;
            const matchDate = (!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate);
            const matchQuery = filters.query === '' || (entry.deskripsi && entry.deskripsi.toLowerCase().includes(filters.query.toLowerCase())) || (entry.kategori && entry.kategori.toLowerCase().includes(filters.query.toLowerCase()));
            const isWalletAccessible = accessibleWallets.some(w => w.id === entry.walletId) || (entry.toWalletId && accessibleWallets.some(w => w.id === entry.toWalletId));

            return matchType && matchCategory && matchWallet && matchDate && matchQuery && isWalletAccessible;
        });

        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (valA === undefined || valA === null) return 1;
                if (valB === undefined || valB === null) return -1;
                
                // Special handling for date sorting
                if (sortConfig.key === 'tanggal') {
                    const dateA = new Date(valA as string).getTime();
                    const dateB = new Date(valB as string).getTime();
                    if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                }

                if (valA < valB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }

        return filtered;
    }, [entries, filters, categories, sortConfig, accessibleWallets]);
    
    const handleExportClick = async () => {
        if (typeof (window as any).ExcelJS === 'undefined' || typeof (window as any).saveAs === 'undefined') {
            showToast('Pustaka ekspor belum siap, mohon tunggu sebentar.', 'info');
            return;
        }
        setIsExporting(true);
        try {
            let finalStartDate: string;
            let finalEndDate: string;
            let dataToExport: CashFlowEntry[];

            // Determine date range and filter data accordingly
            if (filters.startDate && filters.endDate) {
                finalStartDate = filters.startDate;
                finalEndDate = filters.endDate;
                dataToExport = [...processedEntries];
            } else {
                // Default to year-to-date if no range is selected
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');

                finalStartDate = `${year}-01-01`;
                finalEndDate = `${year}-${month}-${day}`;

                const startDate = new Date(finalStartDate);
                startDate.setUTCHours(0, 0, 0, 0);
                const endDate = new Date(finalEndDate);
                endDate.setUTCHours(23, 59, 59, 999);

                // Filter from the original 'entries' list
                dataToExport = entries.filter(entry => {
                    const entryDate = new Date(entry.tanggal);
                    return entryDate >= startDate && entryDate <= endDate;
                });
            }


            const formatPeriodForExport = (startDateStr: string, endDateStr: string): string => {
                const startDate = new Date(startDateStr + 'T00:00:00Z');
                const endDate = new Date(endDateStr + 'T00:00:00Z');
                
                // As per user request, display the day after the selected end date for the label.
                endDate.setUTCDate(endDate.getUTCDate() + 1);

                const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' };
                
                const startDay = startDate.toLocaleDateString('id-ID', { day: '2-digit', timeZone: 'UTC' });
                const endDay = endDate.toLocaleDateString('id-ID', { day: '2-digit', timeZone: 'UTC' });
                const startMonthYear = startDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
                const endMonthYear = endDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
    
                if (startMonthYear === endMonthYear) {
                    if (startDateStr === endDateStr) return startDate.toLocaleDateString('id-ID', options).toUpperCase();
                    return `${startDay}–${endDay} ${startMonthYear}`;
                } else {
                    return `${startDate.toLocaleDateString('id-ID', options)} - ${endDate.toLocaleDateString('id-ID', options)}`.toUpperCase();
                }
            };
            
            const periodLabel = formatPeriodForExport(finalStartDate, finalEndDate);
            const sortedDataToExport = dataToExport.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
            
            const blob = await exportCashFlowToXLSX(sortedDataToExport, wallets, periodLabel);
            
            (window as any).saveAs(blob, `Cash Flow - ${periodLabel}.xlsx`);

            showToast('Ekspor berhasil!', 'success');
        } catch (err) {
            console.error("Export failed:", err);
            showToast('Ekspor gagal. Silakan coba lagi.', 'error');
        } finally {
            setIsExporting(false);
        }
    };


    const paginatedEntries = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [processedEntries, currentPage]);

    const totalPages = Math.ceil(processedEntries.length / ITEMS_PER_PAGE);

    const SortableHeader: React.FC<{ sortKey: keyof CashFlowEntry; children: React.ReactNode; className?: string; }> = ({ sortKey, children, className }) => {
        const isSorted = sortConfig?.key === sortKey;
        const direction = sortConfig?.direction;
        const Icon = isSorted ? (direction === 'ascending' ? ArrowUpIcon : ArrowDownIcon) : ChevronsUpDownIcon;
        const iconColor = isSorted ? 'text-primary' : 'text-muted-foreground/50';

        return (
            <th className={`px-4 py-3 cursor-pointer select-none`} onClick={() => requestSort(sortKey)}>
                <div className={`flex items-center gap-2 ${className || ''}`}>
                    <span>{children}</span>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
            </th>
        );
    };
    
    const modalTitle = useMemo(() => {
        if (editingEntry) return 'Edit Transaksi';
        if (createType === 'income') return 'Tambah Pemasukan';
        if (createType === 'expense') return 'Tambah Pengeluaran';
        if (createType === 'transfer') return 'Buat Transfer';
        return 'Transaksi';
    }, [editingEntry, createType]);

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-semibold">Riwayat Transaksi</h2>
                            <p className="text-sm text-muted-foreground">
                                Kelola semua transaksi keuangan Anda di satu tempat.
                            </p>
                        </div>
                        <div className="flex space-x-2 flex-shrink-0 flex-wrap gap-2">
                            {canCreate && (
                                <>
                                <Button variant="outline" onClick={() => handleAddClick('income')}>+ Pemasukan</Button>
                                <Button variant="outline" onClick={() => handleAddClick('expense')}>+ Pengeluaran</Button>
                                <Button variant="outline" onClick={() => handleAddClick('transfer')}>Transfer</Button>
                                </>
                            )}
                            {canExport && (
                            <Button variant="secondary" onClick={handleExportClick} disabled={isExporting}>
                                <DownloadIcon className="h-4 w-4 mr-2" />
                                {isExporting ? 'Mengekspor...' : 'Ekspor .XLSX'}
                            </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4 p-4 mb-4 bg-muted rounded-lg border">
                        <div className="flex-grow min-w-[150px] grid gap-1.5">
                            <Label>Tipe</Label>
                            <Select data-testid="type-filter" name="type" value={filters.type} onChange={handleFilterChange}>
                                <option value="all">Semua Tipe</option>
                                <option value="income">Pemasukan</option>
                                <option value="expense">Pengeluaran</option>
                                <option value="transfer">Transfer</option>
                            </Select>
                        </div>
                        <div className="flex-grow min-w-[150px] grid gap-1.5">
                             <Label>Kategori</Label>
                            <Select name="category" value={filters.category} onChange={handleFilterChange}>
                                <option value="all">Semua Kategori</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                        </div>
                        <div className="flex-grow min-w-[150px] grid gap-1.5">
                             <Label>Wallet</Label>
                            <Select name="wallet" value={filters.wallet} onChange={handleFilterChange}>
                                <option value="all">Semua Wallet</option>
                                {accessibleWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </Select>
                        </div>
                        <div className="flex-grow min-w-[240px] grid gap-1.5 relative">
                            <Label htmlFor="date-range-picker-tx">Periode</Label>
                            <input
                                id="date-range-picker-tx"
                                ref={inputRef}
                                placeholder="Pilih rentang tanggal"
                                className="flatpickr-anchor"
                            />
                        </div>
                        <div className="flex-grow w-full grid gap-1.5">
                            <Label>Cari</Label>
                            <Input name="query" value={filters.query} onChange={handleFilterChange} placeholder="Cari deskripsi atau kategori..."/>
                        </div>
                    </div>


                    {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-left min-w-[900px]">
                            <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50">
                                <tr>
                                    <SortableHeader sortKey="tanggal">Tanggal</SortableHeader>
                                    <SortableHeader sortKey="type">Tipe</SortableHeader>
                                    <SortableHeader sortKey="kategori">Kategori</SortableHeader>
                                    <SortableHeader sortKey="deskripsi">Deskripsi</SortableHeader>
                                    <SortableHeader sortKey="jumlah" className="justify-end">Jumlah</SortableHeader>
                                    <SortableHeader sortKey="walletId">Wallet</SortableHeader>
                                    {(canUpdate || canDelete) && <th className="px-4 py-3 text-center">Aksi</th>}
                                </tr>
                            </thead>
                            <tbody className="text-gray-900">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Memuat data...</td></tr>
                                ) : paginatedEntries.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada transaksi yang cocok dengan filter.</td></tr>
                                ) : (
                                    paginatedEntries.map((entry) => {
                                        let amountStyle = '', amountPrefix = '', walletInfo = getWalletName(entry.walletId);
                                        switch (entry.type) {
                                            case 'income': amountStyle = 'text-green-600 font-bold'; amountPrefix = '+'; break;
                                            case 'expense': amountStyle = 'text-destructive font-bold'; amountPrefix = '-'; break;
                                            case 'transfer': amountStyle = 'text-muted-foreground'; walletInfo = `${getWalletName(entry.walletId)} → ${getWalletName(entry.toWalletId || '')}`; break;
                                        }
                                        return (
                                            <tr key={entry.id} className="border-b bg-white hover:bg-gray-50">
                                                <td className="px-4 py-2">{new Date(entry.tanggal).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                <td className="px-4 py-2 capitalize">{entry.type}</td>
                                                <td className="px-4 py-2">{entry.kategori || '-'}</td>
                                                <td className="px-4 py-2">{entry.deskripsi || '-'}</td>
                                                <td className={`px-4 py-2 text-right ${amountStyle}`}>{amountPrefix}{formatCurrency(entry.jumlah)}</td>
                                                <td className="px-4 py-2">{walletInfo}</td>
                                                {(canUpdate || canDelete) && (
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex justify-center space-x-2">
                                                            {canUpdate && <Button variant="ghost" size="sm" onClick={() => handleEditClick(entry)} aria-label={`Edit transaksi ${entry.id}`}><EditIcon className="h-4 w-4" /></Button>}
                                                            {canDelete && <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(entry.id)} aria-label={`Hapus transaksi ${entry.id}`}><TrashIcon className="h-4 w-4 text-destructive" /></Button>}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                         <div className="flex justify-between items-center mt-4 text-sm">
                            <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Sebelumnya</Button>
                            <span className="text-muted-foreground">Halaman {currentPage} dari {totalPages}</span>
                            <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Berikutnya</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {isModalOpen && (
                <Modal title={modalTitle} onClose={handleCloseModal}>
                    <CashFlowEntryForm
                        entryToEdit={editingEntry}
                        createType={createType}
                        wallets={wallets}
                        financeCategories={categories}
                        onSave={handleSaveEntry}
                        onCancel={handleCloseModal}
                    />
                </Modal>
            )}
        </>
    );
};

export default TransactionsPage;
