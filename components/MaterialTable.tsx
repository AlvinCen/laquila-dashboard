import React, { useState, useEffect, useMemo } from 'react';
import { Wallet } from '../types';
import { fetchWallets, deleteWallet } from '../services/api';
import { Button } from './ui/Button';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { Modal } from './ui/Modal';
import WalletForm from './MaterialForm';
import { useToast } from '../contexts/ToastContext';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { ChevronsUpDownIcon } from './icons/ChevronsUpDownIcon';

declare var Swal: any;

interface WalletTableProps {
  searchQuery: string;
}

const WalletTable: React.FC<WalletTableProps> = ({ searchQuery }) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Wallet; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
  const { showToast } = useToast();

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWallets();
      setWallets(data);
    } catch (err) {
      setError('Gagal memuat data wallet.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredWallets = useMemo(() => {
    if (!searchQuery) return wallets;
    const lowercasedQuery = searchQuery.toLowerCase();
    return wallets.filter(w => w.name.toLowerCase().includes(lowercasedQuery));
  }, [wallets, searchQuery]);

  const requestSort = (key: keyof Wallet) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedWallets = useMemo(() => {
    let sortableItems = [...filteredWallets];
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            return sortConfig.direction === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
    }
    return sortableItems;
  }, [filteredWallets, sortConfig]);

  const handleAddClick = () => {
    setEditingWallet(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: "Anda tidak akan dapat mengembalikan wallet ini!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result: { isConfirmed: boolean }) => {
      if (result.isConfirmed) {
        try {
          await deleteWallet(id);
          showToast('Wallet berhasil dihapus.', 'success');
          loadWallets();
        } catch (err) {
          setError('Gagal menghapus wallet.');
          showToast('Gagal menghapus wallet.', 'error');
        }
      }
    });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingWallet(null);
  };

  const handleSaveSuccess = () => {
    handleModalClose();
    showToast(`Wallet berhasil ${editingWallet ? 'diperbarui' : 'ditambahkan'}.`, 'success');
    loadWallets();
  };

  const SortableHeader: React.FC<{ sortKey: keyof Wallet; children: React.ReactNode; className?: string }> = ({ sortKey, children, className }) => {
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


  if (isLoading) return <div>Memuat data wallet...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Daftar Wallet</h3>
        <Button onClick={handleAddClick}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Tambah Wallet
        </Button>
      </div>
       {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50">
            <tr>
              <SortableHeader sortKey="name">Nama Wallet</SortableHeader>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-900">
            {sortedWallets.length > 0 ? (
              sortedWallets.map((w) => (
                <tr key={w.id} className="border-b bg-white hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{w.name}</td>
                  <td className="px-4 py-2 text-center">
                      <div className="flex justify-center space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditClick(w)}>
                              <EditIcon className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(w.id)}>
                              <TrashIcon className="h-4 w-4 text-destructive" />
                          </Button>
                      </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'Tidak ada wallet yang cocok.' : 'Belum ada wallet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <Modal title={editingWallet ? 'Edit Wallet' : 'Tambah Wallet'} onClose={handleModalClose}>
          <WalletForm
            wallet={editingWallet}
            onSaveSuccess={handleSaveSuccess}
            onCancel={handleModalClose}
          />
        </Modal>
      )}
    </div>
  );
};

export default WalletTable;