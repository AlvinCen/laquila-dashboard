
import React from 'react';
import { MasterProduct } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { formatCurrency } from '../utils/formatters';

interface ImportPreviewModalProps {
  products: Omit<MasterProduct, 'id'>[];
  onConfirm: () => void;
  onClose: () => void;
  isImporting: boolean;
}

const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({ products, onConfirm, onClose, isImporting }) => {
  return (
    <Modal title={`Pratinjau Impor Data (${products.length} item)`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pastikan data di bawah ini sudah benar sebelum melanjutkan. Data yang ada akan ditambahkan, bukan diganti.
        </p>
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2">No</th>
                <th className="px-4 py-2">Kode Produk</th>
                <th className="px-4 py-2">Nama Produk</th>
                <th className="px-4 py-2 text-right">Total HPP</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {products.map((p, index) => (
                <tr key={index} className="border-b bg-white hover:bg-gray-50">
                  <td className="px-4 py-2">{p.no}</td>
                  <td className="px-4 py-2 font-medium">{p.kodeProduk}</td>
                  <td className="px-4 py-2">{p.namaProduk}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(p.totalHpp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isImporting}>
            Batal
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isImporting}>
            {isImporting ? 'Mengimpor...' : 'Konfirmasi & Impor'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ImportPreviewModal;
