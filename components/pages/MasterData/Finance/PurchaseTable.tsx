
import React, { useState, useEffect, useMemo } from 'react';
import { FinanceCategory } from '../../../../types';
import { fetchFinanceCategories, deleteFinanceCategory } from '../../../../services/api';
import { Button } from '../../../ui/Button';
import { PlusIcon } from '../../../icons/PlusIcon';
import { EditIcon } from '../../../icons/EditIcon';
import { TrashIcon } from '../../../icons/TrashIcon';
import { Modal } from '../../../ui/Modal';
import FinanceCategoryForm from './PurchaseForm';
import { useToast } from '../../../../contexts/ToastContext';

declare var Swal: any;

const CategoryList: React.FC<{
  title: string;
  categories: FinanceCategory[];
  onEdit: (category: FinanceCategory) => void;
  onDelete: (id: string) => void;
  searchQuery: string;
}> = ({ title, categories, onEdit, onDelete, searchQuery }) => (
  <div>
    <h4 className="text-md font-semibold mb-2">{title}</h4>
    <div className="border rounded-lg">
      {categories.length > 0 ? (
        <ul className="divide-y">
          {categories.map((cat, idx) => (
            <li key={cat.id || `cat-${idx}`} className="flex justify-between items-center p-3 hover:bg-gray-50">
              <span className="text-sm">{cat.name}</span>
              <div className="flex space-x-1">
                <Button variant="ghost" size="sm" onClick={() => onEdit(cat)}>
                  <EditIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(cat.id)}>
                  <TrashIcon className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {searchQuery ? 'Tidak ada kategori yang cocok.' : 'Tidak ada kategori di sini.'}
        </div>
      )}
    </div>
  </div>
);

interface FinanceCategoryTableProps {
  searchQuery: string;
}

const FinanceCategoryTable: React.FC<FinanceCategoryTableProps> = ({ searchQuery }) => {
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadCategories();
  }, []);

  const { incomeCategories, expenseCategories } = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = searchQuery
      ? categories.filter(c => c.name.toLowerCase().includes(lowercasedQuery))
      : categories;

    return {
      incomeCategories: filtered.filter(c => c.type === 'income'),
      expenseCategories: filtered.filter(c => c.type === 'expense'),
    };
  }, [categories, searchQuery]);

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFinanceCategories();
      setCategories(data);
    } catch (err) {
      setError('Gagal memuat data kategori.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (category: FinanceCategory) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: "Menghapus kategori ini tidak dapat diurungkan.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result: { isConfirmed: boolean }) => {
      if (result.isConfirmed) {
        try {
          await deleteFinanceCategory(id);
          showToast('Kategori berhasil dihapus.', 'success');
          loadCategories();
        } catch (err) {
          setError('Gagal menghapus kategori.');
          showToast('Gagal menghapus kategori.', 'error');
        }
      }
    });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSaveSuccess = () => {
    handleModalClose();
    showToast(`Kategori berhasil ${editingCategory ? 'diperbarui' : 'ditambahkan'}.`, 'success');
    loadCategories();
  };

  if (isLoading) return <div>Memuat data kategori...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Daftar Kategori Keuangan</h3>
        <Button onClick={handleAddClick}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Tambah Kategori
        </Button>
      </div>
      {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CategoryList
          title="Kategori Pemasukan"
          categories={incomeCategories}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          searchQuery={searchQuery}
        />
        <CategoryList
          title="Kategori Pengeluaran"
          categories={expenseCategories}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          searchQuery={searchQuery}
        />
      </div>

      {isModalOpen && (
        <Modal title={editingCategory ? 'Edit Kategori' : 'Tambah Kategori'} onClose={handleModalClose}>
          <FinanceCategoryForm
            category={editingCategory}
            onSaveSuccess={handleSaveSuccess}
            onCancel={handleModalClose}
          />
        </Modal>
      )}
    </div>
  );
};

export default FinanceCategoryTable;