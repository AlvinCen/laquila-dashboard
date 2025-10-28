
import React, { useState, useEffect } from 'react';
import { PaymentMethod } from '../types';
import { fetchPaymentMethods, deletePaymentMethod } from '../services/api';
import { Button } from './ui/Button';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { Modal } from './ui/Modal';
import PaymentMethodForm from './PaymentMethodForm';

const PaymentMethodTable: React.FC = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    loadMethods();
  }, []);

  const loadMethods = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPaymentMethods();
      setMethods(data);
    } catch (err) {
      setError('Gagal memuat data metode pembayaran.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingMethod(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (method: PaymentMethod) => {
    setEditingMethod(method);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus metode pembayaran ini?')) {
      try {
        await deletePaymentMethod(id);
        loadMethods();
      } catch (err) {
        setError('Gagal menghapus metode pembayaran.');
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingMethod(null);
  };

  const handleSaveSuccess = () => {
    handleModalClose();
    loadMethods();
  };

  if (isLoading) return <div>Memuat data...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Metode Pembayaran</h3>
        <Button onClick={handleAddClick}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Tambah Metode
        </Button>
      </div>
       {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-3">Nama Metode</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-900">
            {methods.map((m) => (
              <tr key={m.id} className="border-b bg-white hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{m.name}</td>
                <td className="px-4 py-2 text-center">
                    <div className="flex justify-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(m)}>
                            <EditIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(m.id)}>
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
        <Modal title={editingMethod ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran'} onClose={handleModalClose}>
          <PaymentMethodForm
            method={editingMethod}
            onSaveSuccess={handleSaveSuccess}
            onCancel={handleModalClose}
          />
        </Modal>
      )}
    </div>
  );
};

export default PaymentMethodTable;