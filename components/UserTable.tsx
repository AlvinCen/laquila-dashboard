import React, { useState, useEffect, useMemo } from 'react';
import { User, Wallet, FinanceCategory } from '../types';
import { fetchUsers, deleteUser, fetchWallets, fetchFinanceCategories } from '../services/api';
import { Button } from './ui/Button';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { Modal } from './ui/Modal';
import UserForm from './UserForm';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardContent } from './ui/Card';

declare var Swal: any;

const UserTable: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { showToast } = useToast();
  const { currentUser } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [userData, walletData, categoryData] = await Promise.all([
        fetchUsers(),
        fetchWallets(),
        fetchFinanceCategories()
      ]);
      setUsers(userData);
      setWallets(walletData);
      setCategories(categoryData);
    } catch (err) {
      setError('Gagal memuat data pengguna.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (user: User) => {
    if (user.id === currentUser?.id) {
        showToast('Anda tidak dapat menghapus akun Anda sendiri.', 'error');
        return;
    }
    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: `Anda akan menghapus pengguna "${user.username}". Tindakan ini tidak dapat diurungkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result: { isConfirmed: boolean }) => {
      if (result.isConfirmed) {
        try {
          await deleteUser(user.id);
          showToast('Pengguna berhasil dihapus.', 'success');
          loadData();
        } catch (err: any) {
          setError(err.message || 'Gagal menghapus pengguna.');
          showToast(err.message || 'Gagal menghapus pengguna.', 'error');
        }
      }
    });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };
  
  const handleSaveSuccess = () => {
    handleModalClose();
    showToast(`Pengguna berhasil ${editingUser ? 'diperbarui' : 'ditambahkan'}.`, 'success');
    loadData();
  };

  if (isLoading) return <div>Memuat data pengguna...</div>;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Manajemen User</h2>
              <p className="text-sm text-muted-foreground">
                Tambah, edit, dan atur izin untuk pengguna.
              </p>
            </div>
            <Button onClick={handleAddClick}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Tambah User
            </Button>
        </div>
      </CardHeader>
      <CardContent>
      {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Akses Wallet</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-900">
            {users.map((user) => (
              <tr key={user.id} className="border-b bg-white hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{user.username}</td>
                <td className="px-4 py-2 capitalize">{user.role}</td>
                <td className="px-4 py-2 capitalize">
                  {user.allowedWalletIds === 'all' ? 'Semua' : `${user.allowedWalletIds.length} Wallet`}
                </td>
                <td className="px-4 py-2 text-center">
                    <div className="flex justify-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(user)}>
                            <EditIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(user)}>
                            <TrashIcon className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
          <Modal title={editingUser ? 'Edit Pengguna' : 'Tambah Pengguna'} onClose={handleModalClose} size="lg">
              <UserForm 
                user={editingUser}
                wallets={wallets}
                onSaveSuccess={handleSaveSuccess}
                onCancel={handleModalClose}
              />
          </Modal>
      )}
    </CardContent>
    </Card>
  );
};

export default UserTable;
