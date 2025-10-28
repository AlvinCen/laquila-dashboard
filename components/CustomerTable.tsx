
import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { fetchCustomers, deleteCustomer } from '../services/api';
import { Button } from './ui/Button';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { Modal } from './ui/Modal';
import CustomerForm from './CustomerForm';

const CustomerTable: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (err) {
      setError('Gagal memuat data pelanggan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus pelanggan ini?')) {
      try {
        await deleteCustomer(id);
        loadCustomers();
      } catch (err) {
        setError('Gagal menghapus pelanggan.');
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleSaveSuccess = () => {
    handleModalClose();
    loadCustomers();
  };

  if (isLoading) return <div>Memuat data pelanggan...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Daftar Pelanggan</h3>
        <Button onClick={handleAddClick}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Tambah Pelanggan
        </Button>
      </div>
       {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-3">Nama Pelanggan</th>
              <th className="px-4 py-3">Alamat</th>
              <th className="px-4 py-3">No. HP</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-900">
            {customers.map((c) => (
              <tr key={c.id} className="border-b bg-white hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2">{c.address}</td>
                <td className="px-4 py-2">{c.phone}</td>
                <td className="px-4 py-2 text-center">
                    <div className="flex justify-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(c)}>
                            <EditIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(c.id)}>
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
        <Modal title={editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan'} onClose={handleModalClose}>
          <CustomerForm
            customer={editingCustomer}
            onSaveSuccess={handleSaveSuccess}
            onCancel={handleModalClose}
          />
        </Modal>
      )}
    </div>
  );
};

export default CustomerTable;