import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { SalesOrder, OrderStatus, Product } from '../types';
import { fetchSalesOrders, cancelSalesOrder, fetchProducts } from '../services/api';
import SalesOrderTable from './SalesOrderTable';
import { Modal } from './ui/Modal';
import SalesOrderForm from './SalesOrderForm';
import { useToast } from '../contexts/ToastContext';
import { printMultiKelengkapan } from '../utils/print-thermal';

declare var Swal: any;

const SalesOrderPage: React.FC = () => {
    const [allOrders, setAllOrders] = useState<SalesOrder[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
    const { showToast } = useToast();
    
    // States for client-side filtering and sorting
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof SalesOrder; direction: 'ascending' | 'descending' }>({ key: 'createdAt', direction: 'descending' });
    const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);


    const loadOrders = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [orderData, productData] = await Promise.all([
                fetchSalesOrders(),
                fetchProducts()
            ]);
            setAllOrders(orderData);
            setProducts(productData);
        } catch (err) {
            setError('Gagal memuat data sales order.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);
    
    const requestSort = (key: keyof SalesOrder) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const filteredAndSortedOrders = useMemo(() => {
        let sortableItems = [...allOrders]
            .filter(order => {
                if (statusFilter === 'All') return true;
                return order.orderStatus === statusFilter;
            })
            .filter(order => {
                const orderDate = order.tglPesan;
                if (startDate && orderDate < startDate) return false;
                if (endDate && orderDate > endDate) return false;
                return true;
            })
            .filter(order => {
                if (!searchQuery) return true;
                const lowerQuery = searchQuery.toLowerCase();
                return (
                    order.namaPelanggan?.toLowerCase().includes(lowerQuery) ||
                    order.invoiceNumber.toLowerCase().includes(lowerQuery) ||
                    order.noIdPesanan?.toLowerCase().includes(lowerQuery)
                );
            });

        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (valA === undefined || valA === null) return 1;
                if (valB === undefined || valB === null) return -1;
                
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        
        return sortableItems;

    }, [allOrders, searchQuery, statusFilter, startDate, endDate, sortConfig]);


    const handleAddClick = () => {
        setEditingOrder(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (order: SalesOrder) => {
        setEditingOrder(order);
        setIsModalOpen(true);
    };

    const handleCancelClick = async (id: string) => {
        Swal.fire({
            title: 'Batalkan Sales Order?',
            text: 'Ini akan mengubah status order menjadi "Cancelled". Tindakan ini tidak bisa diurungkan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, batalkan!',
            cancelButtonText: 'Tidak',
        }).then(async (result: { isConfirmed: boolean }) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await cancelSalesOrder(id);
                    if (apiResult.success) {
                        showToast(apiResult.message, 'success');
                        loadOrders();
                    } else {
                        showToast(apiResult.message, 'error');
                    }
                } catch (err) {
                    setError('Gagal membatalkan sales order.');
                    showToast('Gagal membatalkan sales order.', 'error');
                }
            }
        });
    };
    
    const handlePrintKelengkapan = (order: SalesOrder) => {
        const itemsToPrint = order.items
            .map(item => {
                const product = products.find(p => p.id === item.productId);
                if (product && product.kelengkapanImage) {
                    return {
                        productName: item.productName,
                        // FIX: Changed property access from deprecated kodeProduk to sku.
                        sku: product.sku || '',
                        color: item.warna,
                        qty: item.qty,
                        kelengkapanImage: product.kelengkapanImage,
                        kelengkapanMime: product.kelengkapanMime,
                    };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        if (itemsToPrint.length > 0) {
            setPrintingOrderId(order.id);
            // FIX: Corrected property access from `noInvoice` to `invoiceNumber` to match the `SalesOrder` type definition.
            showToast(`Mempersiapkan print untuk ${order.invoiceNumber}...`, 'info');
            try {
                // FIX: Corrected property access from `noInvoice` to `invoiceNumber`.
                printMultiKelengkapan('80', `Kelengkapan Invoice: ${order.invoiceNumber}`, itemsToPrint);
                 setTimeout(() => setPrintingOrderId(null), 2000);
            } catch (e) {
                console.error('Print failed:', e);
                showToast('Gagal mempersiapkan print.', 'error');
                setPrintingOrderId(null);
            }
        } else {
            showToast('Tidak ada item yang memiliki kelengkapan produk di order ini.', 'error');
        }
    };


    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingOrder(null);
    };

    const handleSaveSuccess = () => {
        handleModalClose();
        const message = editingOrder 
            ? 'Sales order berhasil diperbarui.' 
            : 'Sales Order dibuat (Payment: Pending, Order: Payment)';
        showToast(message, 'success');
        loadOrders();
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <h2 className="text-xl font-semibold">Sales Order</h2>
                    <p className="text-sm text-muted-foreground">
                        Kelola semua pesanan penjualan dari berbagai marketplace.
                    </p>
                </CardHeader>
                <CardContent>
                    <SalesOrderTable 
                        orders={filteredAndSortedOrders}
                        isLoading={isLoading}
                        error={error}
                        onAdd={handleAddClick}
                        onEdit={handleEditClick}
                        onCancel={handleCancelClick}
                        onPrint={handlePrintKelengkapan}
                        printingOrderId={printingOrderId}
                        query={searchQuery}
                        onQueryChange={setSearchQuery}
                        statusFilter={statusFilter}
                        onStatusChange={setStatusFilter}
                        startDate={startDate}
                        onStartDateChange={setStartDate}
                        endDate={endDate}
                        onEndDateChange={setEndDate}
                        sortConfig={sortConfig}
                        requestSort={requestSort}
                    />
                </CardContent>
            </Card>
            {isModalOpen && (
                <Modal 
                    // FIX: Corrected property access from `noInvoice` to `invoiceNumber` to match the `SalesOrder` type definition.
                    title={editingOrder ? `Edit Sales Order: ${editingOrder.invoiceNumber}` : 'Tambah Sales Order Baru'} 
                    onClose={handleModalClose}
                    size="xl"
                >
                    <SalesOrderForm 
                        order={editingOrder}
                        onSaveSuccess={handleSaveSuccess}
                        onCancel={handleModalClose}
                    />
                </Modal>
            )}
        </>
    );
};

export default SalesOrderPage;
