import React, { useRef, useEffect } from 'react';
import { SalesOrder, PaymentStatus, OrderStatus } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { formatCurrency } from '../utils/formatters';
import { Label } from './ui/Label';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { ChevronsUpDownIcon } from './icons/ChevronsUpDownIcon';
import { useAuth } from '../contexts/AuthContext';

interface SalesOrderTableProps {
    orders: SalesOrder[];
    isLoading: boolean;
    error: string | null;
    onAdd: () => void;
    onEdit: (order: SalesOrder) => void;
    onCancel: (id: string) => void;
    query: string;
    onQueryChange: (query: string) => void;
    statusFilter: OrderStatus | 'All';
    onStatusChange: (status: OrderStatus | 'All') => void;
    startDate: string;
    onStartDateChange: (date: string) => void;
    endDate: string;
    onEndDateChange: (date: string) => void;
    sortConfig: { key: keyof SalesOrder; direction: 'ascending' | 'descending' } | null;
    requestSort: (key: keyof SalesOrder) => void;
}

const PaymentStatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full inline-block';
    const statusStyles: Record<PaymentStatus, string> = {
        'Pending': 'bg-gray-100 text-gray-800',
        'Partial': 'bg-yellow-100 text-yellow-800',
        'Settled': 'bg-green-100 text-green-800',
    };
    return <span className={`${baseClasses} ${statusStyles[status]}`}>{status}</span>;
}

const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full inline-block';
    const statusStyles: Record<OrderStatus, string> = {
        'Confirmed': 'bg-indigo-100 text-indigo-800',
        'Cancelled': 'bg-red-100 text-red-800',
    };
    const label = status === 'Confirmed' ? 'Payment' : status;
    return <span className={`${baseClasses} ${statusStyles[status]}`}>{label}</span>;
}


const SalesOrderTable: React.FC<SalesOrderTableProps> = ({ 
    orders, isLoading, error, onAdd, onEdit, onCancel, 
    query, onQueryChange, statusFilter, onStatusChange,
    startDate, onStartDateChange, endDate, onEndDateChange,
    sortConfig, requestSort
}) => {
    
    const inputRef = useRef<HTMLInputElement>(null);
    const fpRef = useRef<any>(null);
    const { hasPermission } = useAuth();
    
    const canCreate = hasPermission('sales-order', 'create');
    const canUpdate = hasPermission('sales-order', 'update');
    const canCancel = hasPermission('sales-order', 'cancel');

    useEffect(() => {
        if (!inputRef.current || !(window as any).flatpickr || fpRef.current) return;

        fpRef.current = (window as any).flatpickr(inputRef.current, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            altInputClass: 'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            locale: (window as any).flatpickr.l10ns.id,
            defaultDate: [startDate, endDate].filter(Boolean),
            onChange: (sel: Date[]) => {
                const [s, e] = sel;
                onStartDateChange(s ? s.toISOString().slice(0, 10) : '');
                onEndDateChange(e ? e.toISOString().slice(0, 10) : '');
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
            fpRef.current.setDate([startDate || null, endDate || null], false, 'Y-m-d');
        }
    }, [startDate, endDate]);


    const SortableHeader: React.FC<{ sortKey: keyof SalesOrder; children: React.ReactNode; className?: string; }> = ({ sortKey, children, className }) => {
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
    
    return (
        <div>
            <div className="flex justify-end mb-4">
                {canCreate && (
                    <Button onClick={onAdd} className="w-full sm:w-auto">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Tambah Order
                    </Button>
                )}
            </div>
            
            <div className="flex flex-wrap items-end gap-4 p-4 mb-4 bg-muted rounded-lg border">
                 <div className="flex-grow min-w-[200px] grid gap-1.5">
                    <Label htmlFor="search-query">Search</Label>
                    <Input 
                        id="search-query"
                        type="search"
                        placeholder="Cari nama, invoice..."
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                    />
                </div>
                <div className="flex-grow sm:flex-grow-0 min-w-[150px] grid gap-1.5">
                    <Label htmlFor="status-filter">Order Status</Label>
                    <Select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => onStatusChange(e.target.value as OrderStatus | 'All')}
                        aria-label="Filter by order status"
                    >
                        <option value="All">Semua Status</option>
                        <option value="Confirmed">Payment</option>
                    </Select>
                </div>
                <div className="flex-grow sm:flex-grow-0 min-w-[240px] grid gap-1.5 relative">
                    <Label htmlFor="date-range-picker">Periode Tgl Pesan</Label>
                     <input
                        id="date-range-picker"
                        ref={inputRef}
                        placeholder="Pilih rentang tanggal"
                        className="flatpickr-anchor"
                    />
                </div>
            </div>


            {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}
            
            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left min-w-[900px]">
                    <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50">
                        <tr>
                            <SortableHeader sortKey="noInvoice">No Invoice</SortableHeader>
                            <SortableHeader sortKey="tglPesan">Tgl Pesan</SortableHeader>
                            <SortableHeader sortKey="namaPelanggan">Nama Pelanggan</SortableHeader>
                            <SortableHeader sortKey="marketplace">Marketplace</SortableHeader>
                            <SortableHeader sortKey="total" className="justify-end">Total</SortableHeader>
                            <th className="px-4 py-3 text-center">Payment Status</th>
                            <th className="px-4 py-3 text-center">Order Status</th>
                            {(canUpdate || canCancel) && <th className="px-4 py-3 text-center">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody className="text-gray-900">
                        {isLoading ? (
                            <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Memuat data...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada data sales order yang cocok.</td></tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order.id} className="border-b bg-white hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium">{order.noInvoice}</td>
                                    <td className="px-4 py-2">{new Date(order.tglPesan).toLocaleDateString('id-ID')}</td>
                                    <td className="px-4 py-2">{order.namaPelanggan}</td>
                                    <td className="px-4 py-2">{order.marketplace}</td>
                                    <td className="px-4 py-2 text-right font-bold">{formatCurrency(order.total)}</td>
                                    <td className="px-4 py-2 text-center">
                                        {order.orderStatus === 'Cancelled' ? (
                                            <span className="text-muted-foreground">-</span>
                                        ) : (
                                            <PaymentStatusBadge status={order.paymentStatus} />
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <OrderStatusBadge status={order.orderStatus} />
                                    </td>
                                    {(canUpdate || canCancel) && (
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex justify-center space-x-1">
                                            {canUpdate && (
                                                <Button variant="ghost" size="sm" onClick={() => onEdit(order)}>
                                                    <EditIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {canCancel && order.orderStatus !== 'Cancelled' && (
                                                <Button variant="ghost" size="sm" onClick={() => onCancel(order.id)} title="Batalkan Order">
                                                    <TrashIcon className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SalesOrderTable;
