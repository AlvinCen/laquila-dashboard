

import React from 'react';
import { SalesInvoice } from '../../../../types';
import { deleteSalesInvoice } from '../../../../services/api';
import { Button } from '../../../ui/Button';
import { PlusIcon } from '../../../icons/PlusIcon';
import { EditIcon } from '../../../icons/EditIcon';
import { TrashIcon } from '../../../icons/TrashIcon';
import { DollarSignIcon } from '../../../icons/DollarSignIcon';
import { Card, CardHeader, CardContent } from '../../../ui/Card';
import { formatCurrency } from '../../../../utils/formatters';
import { CheckCircleIcon } from '../../../icons/CheckCircleIcon';
import { useToast } from '../../../../contexts/ToastContext';

interface SalesInvoiceTableProps {
  invoices: SalesInvoice[];
  isLoading: boolean;
  error: string | null;
  onCreateNew: () => void;
  onEdit: (invoice: SalesInvoice) => void;
  onPay: (invoice: SalesInvoice) => void;
  onComplete: (invoiceId: string) => void;
  onDeleteSuccess: () => void;
}

const SalesInvoiceTable: React.FC<SalesInvoiceTableProps> = ({ invoices, isLoading, error, onCreateNew, onEdit, onPay, onComplete, onDeleteSuccess }) => {
  const { showToast } = useToast();

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus invoice ini?')) {
      try {
        await deleteSalesInvoice(id);
        showToast('Invoice berhasil dihapus.', 'success');
        onDeleteSuccess();
      } catch (err) {
        showToast('Gagal menghapus invoice.', 'error');
      }
    }
  };
  
  const statusBadge = (status: SalesInvoice['status']) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full inline-block';
    switch (status) {
        case 'Paid':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>Paid</span>;
        case 'Partial':
            return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Partial</span>;
        case 'Pending':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Pending</span>;
        case 'Complete':
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Complete</span>;
        default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Unknown</span>;
    }
  }

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <div>
            <h2 className="text-xl font-semibold">Daftar Invoice Penjualan</h2>
            <p className="text-sm text-muted-foreground">Kelola semua transaksi penjualan Anda.</p>
        </div>
        <Button onClick={onCreateNew}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Buat Invoice Baru
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm font-medium text-destructive mb-4">{error}</p>}
        {isLoading ? (
          <p>Memuat data invoice...</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-900 font-medium uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">No. Invoice</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pembayaran</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-gray-900">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada invoice.</td>
                  </tr>
                ) : (
                  invoices.map((invoice) => {
                    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
                    return (
                        <tr key={invoice.id} className="border-b bg-white hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{invoice.invoiceNumber}</td>
                          <td className="px-4 py-2">{invoice.orderDate}</td>
                          <td className="px-4 py-2">{invoice.customerName}</td>
                          <td className="px-4 py-2">{invoice.platform}</td>
                          <td className="px-4 py-2 text-right font-bold">{formatCurrency(invoice.grandTotal)}</td>
                          <td className="px-4 py-2 text-right font-bold text-green-600">{formatCurrency(totalPaid)}</td>
                          <td className="px-4 py-2 text-center">{statusBadge(invoice.status)}</td>
                          <td className="px-4 py-2 text-center">
                            {invoice.status !== 'Complete' ? (
                                <div className="flex justify-center space-x-1">
                                    {invoice.status === 'Paid' ? (
                                        <Button variant="ghost" size="sm" onClick={() => onComplete(invoice.id!)} title="Selesaikan">
                                            <CheckCircleIcon className="h-4 w-4 text-gray-600" />
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => onPay(invoice)} title="Bayar">
                                            <DollarSignIcon className="h-4 w-4 text-green-600" />
                                        </Button>
                                    )}
                                  <Button variant="ghost" size="sm" onClick={() => onEdit(invoice)} title="Edit">
                                    <EditIcon className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(invoice.id!)} title="Hapus">
                                    <TrashIcon className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesInvoiceTable;
