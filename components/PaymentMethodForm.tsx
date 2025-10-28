import React, { useState, useEffect } from 'react';
import { PaymentMethodInput } from '../types';
import { addPaymentMethod, updatePaymentMethod } from '../services/api';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';

interface PaymentMethodFormProps {
  method: PaymentMethodInput | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const PaymentMethodForm: React.FC<PaymentMethodFormProps> = ({ method, onSaveSuccess, onCancel }) => {
  const [formData, setFormData] = useState<PaymentMethodInput>({
    name: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (method) {
      setFormData(method);
    }
  }, [method]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (method?.id) {
        await updatePaymentMethod(method.id, formData);
      } else {
        await addPaymentMethod(formData);
      }
      onSaveSuccess();
    } catch (err) {
      setError('Gagal menyimpan metode pembayaran.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nama Metode</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </form>
  );
};

export default PaymentMethodForm;