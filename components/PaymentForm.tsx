import React, { useState, useMemo } from 'react';
import { SalesInvoice, PaymentMethod, Payment } from '../types';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { formatCurrency } from '../utils/formatters';

interface PaymentFormProps {
  invoice: SalesInvoice;
  availablePaymentMethods: PaymentMethod[];
  onSavePayment: (invoiceId: string, payment: Omit<Payment, 'id' | 'date'>) => void;
  onClose: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ invoice, availablePaymentMethods, onSavePayment, onClose }) => {
  const [amount, setAmount] = useState<number>(0);
  const [displayAmount, setDisplayAmount] = useState('');
  const [method, setMethod] = useState<string>(availablePaymentMethods[0]?.name || '');
  const [error, setError] = useState<string | null>(null);

  const totalPaid = useMemo(() => {
    return invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  }, [invoice.payments]);

  const amountDue = useMemo(() => {
    return invoice.grandTotal - totalPaid;
  }, [invoice.grandTotal, totalPaid]);

  const showPaymentMethod = !['Shopee', 'TikTok Shop'].includes(invoice.platform);
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const numericString = rawValue.replace(/[^0-9]/g, '');

      if (numericString === '') {
          setAmount(0);
          setDisplayAmount('');
          return;
      }

      const numericValue = parseInt(numericString, 10);
      setAmount(numericValue);
      setDisplayAmount(new Intl.NumberFormat('id-ID').format(numericValue));
  };


  const handleSave = () => {
    setError(null);
    if (amount <= 0) {
      setError('Nominal pembayaran harus lebih dari 0.');
      return;
    }
    if (amount > amountDue) {
      setError(`Nominal tidak boleh melebihi sisa tagihan (${formatCurrency(amountDue)}).`);
      return;
    }
    if (showPaymentMethod && !method) {
        setError('Metode pembayaran harus dipilih.');
        return;
    }
    
    onSavePayment(invoice.id!, {
      amount: amount,
      method: showPaymentMethod ? method : undefined,
    });
  };

  return (
    <Modal title={`Pembayaran untuk Invoice ${invoice.invoiceNumber}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-md text-sm">
          <div>
            <p className="font-medium">Total Tagihan</p>
            <p>{formatCurrency(invoice.grandTotal)}</p>
          </div>
          <div>
            <p className="font-medium">Sudah Dibayar</p>
            <p>{formatCurrency(totalPaid)}</p>
          </div>
          <div>
            <p className="font-medium text-red-600">Sisa Tagihan</p>
            <p className="font-bold text-red-600">{formatCurrency(amountDue)}</p>
          </div>
        </div>
        
        <div className="grid gap-1.5">
          <Label htmlFor="amount">Nominal Pembayaran</Label>
          <Input 
            id="amount" 
            type="text" 
            value={displayAmount}
            onChange={handleAmountChange}
            placeholder="Masukkan nominal"
          />
        </div>

        {showPaymentMethod && (
           <div className="grid gap-1.5">
            <Label htmlFor="method">Metode Pembayaran</Label>
            <Select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
            >
                {availablePaymentMethods.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                ))}
            </Select>
          </div>
        )}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="button" onClick={handleSave}>
            Simpan Pembayaran
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PaymentForm;