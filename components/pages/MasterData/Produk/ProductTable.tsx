import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../../../types';
import { fetchProducts, deleteProduct } from '../../../../services/api';
import { Button } from '../../../ui/Button';
import { PlusIcon } from '../../../icons/PlusIcon';
import { EditIcon } from '../../../icons/EditIcon';
import { TrashIcon } from '../../../icons/TrashIcon';
import { Modal } from '../../../ui/Modal';
import ProductForm from './ProductForm';
import { formatCurrency } from '../../../../utils/formatters';
import { useToast } from '../../../../contexts/ToastContext';
import { ArrowUpIcon } from '../../../icons/ArrowUpIcon';
import { ArrowDownIcon } from '../../../icons/ArrowDownIcon';
import { ChevronsUpDownIcon } from '../../../icons/ChevronsUpDownIcon';
import { DownloadIcon } from '../../../icons/DownloadIcon';
import { exportProductsToXLSX } from '../../../../utils/xlsx-generator';
import { useAuth } from '../../../../contexts/AuthContext';
import { printKelengkapanProduct } from '../../../../utils/print-thermal';
import { PrinterIcon } from '../../../icons/PrinterIcon';

declare var Swal: any;

interface ProductTableProps {
  searchQuery: string;
}

const ProductTable: React.FC<ProductTableProps> = ({ searchQuery }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'ascending' | 'descending' } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  
  const [printingProductId, setPrintingProductId] = useState<string | null>(null);

  const canCreate = hasPermission('master-data', 'create');
  const canUpdate = hasPermission('master-data', 'update');
  const canDelete = hasPermission('master-data', 'delete');
  const canExport = hasPermission('master-data', 'export');
  const canRead = hasPermission('master-data', 'read');


  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      setError('Gagal memuat data produk.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const lowercasedQuery = searchQuery.toLowerCase();
    return products.filter(p => 
      p.namaProduk.toLowerCase().includes(lowercasedQuery) ||
      p.kodeProduk.toLowerCase().includes(lowercasedQuery)
    );
  }, [products, searchQuery]);

  const requestSort = (key: keyof Product) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedProducts = useMemo(() => {
    let sortableItems = [...filteredProducts];
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }
    return sortableItems;
  }, [filteredProducts, sortConfig]);

  const handleAddClick = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: "Anda tidak akan bisa mengembalikan ini!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result: { isConfirmed: boolean }) => {
      if (result.isConfirmed) {
        try {
          await deleteProduct(id);
          showToast('Produk berhasil dihapus.', 'success');
          loadProducts();
        } catch (err: any) {
          setError(err.message || 'Gagal menghapus produk.');
          showToast(err.message || 'Gagal menghapus produk.', 'error');
        }
      }
    });
  };

  const handlePrintClick = (product: Product) => {
    if (!product.kelengkapanImage) {
      showToast('Produk ini tidak memiliki gambar kelengkapan untuk dicetak.', 'error');
      return;
    }
    setPrintingProductId(product.id);
    showToast('Mempersiapkan data print...', 'info');
    try {
        printKelengkapanProduct('100x150', {
            productName: product.namaProduk,
            sku: product.kodeProduk,
            kelengkapanImage: product.kelengkapanImage,
            kelengkapanMime: product.kelengkapanMime,
        });
        // Reset loading state after a short delay
        setTimeout(() => setPrintingProductId(null), 2000);
    } catch (e) {
        console.error('Print failed:', e);
        showToast('Gagal mempersiapkan print.', 'error');
        setPrintingProductId(null);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };
  
  const handleSaveSuccess = () => {
    handleModalClose();
    showToast(`Produk berhasil ${editingProduct ? 'diperbarui' : 'ditambahkan'}.`, 'success');
    loadProducts();
  };
  
  const handleExportClick = async () => {
      if (typeof (window as any).ExcelJS === 'undefined' || typeof (window as any).saveAs === 'undefined') {
          showToast('Pustaka ekspor belum siap, mohon tunggu sebentar.', 'info');
          return;
      }
      setIsExporting(true);
      try {
          const dataToExport = sortedProducts;
          const blob = await exportProductsToXLSX(dataToExport);
          const date = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
          (window as any).saveAs(blob, `Daftar Produk - ${date}.xlsx`);
          showToast('Ekspor daftar produk berhasil!', 'success');
      } catch (err) {
          console.error("Export failed:", err);
          showToast('Ekspor gagal. Silakan coba lagi.', 'error');
      } finally {
          setIsExporting(false);
      }
  };

  const SortableHeader: React.FC<{ sortKey: keyof Product; children: React.ReactNode; className?: string }> = ({ sortKey, children, className }) => {
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

  if (isLoading) return <div>Memuat data produk...</div>;
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Daftar Produk</h3>
        <div className="flex space-x-2">
            {canExport && (
              <Button variant="outline" onClick={handleExportClick} disabled={isExporting}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  {isExporting ? 'Mengekspor...' : 'Ekspor .XLSX'}
              </Button>
            )}
            {canCreate && (
              <Button onClick={handleAddClick}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Tambah Produk
              </Button>
            )}
        </div>
      </div>
      {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50">
            <tr>
              <SortableHeader sortKey="kodeProduk">Kode Produk</SortableHeader>
              <SortableHeader sortKey="namaProduk">Nama Produk</SortableHeader>
              <SortableHeader sortKey="tahunHpp">Tahun HPP</SortableHeader>
              <SortableHeader sortKey="hargaDasar" className="justify-end">Harga Dasar</SortableHeader>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-900">
            {sortedProducts.length > 0 ? (
              sortedProducts.map((p) => (
                <tr key={p.id} className="border-b bg-white hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{p.kodeProduk}</td>
                  <td className="px-4 py-2">{p.namaProduk}</td>
                  <td className="px-4 py-2">{p.tahunHpp}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(p.hargaDasar)}</td>
                  <td className="px-4 py-2 text-center">
                      <div className="flex justify-center space-x-1">
                          {canRead && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handlePrintClick(p)} 
                              title="Print Kelengkapan (100x150mm)"
                              disabled={printingProductId === p.id}
                            >
                                <PrinterIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {canUpdate && (
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(p)} title="Edit">
                                <EditIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(p.id)} title="Hapus">
                                <TrashIcon className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                      </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'Tidak ada produk yang cocok dengan pencarian.' : 'Belum ada produk.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
          <Modal title={editingProduct ? 'Edit Produk' : 'Tambah Produk'} onClose={handleModalClose}>
              <ProductForm 
                product={editingProduct} 
                onSaveSuccess={handleSaveSuccess}
                onCancel={handleModalClose}
              />
          </Modal>
      )}
    </div>
  );
};

export default ProductTable;