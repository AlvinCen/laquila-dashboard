import React, { useState, useEffect } from 'react';
import { CustomerInput } from '../types';
import { addCustomer, updateCustomer } from '../services/api';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';

interface CustomerFormProps {
  customer: CustomerInput | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onSaveSuccess, onCancel }) => {
  const [formData, setFormData] = useState<CustomerInput>({
    name: '',
    address: '',
    phone: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setFormData(customer);
    }
  }, [customer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (customer?.id) {
        await updateCustomer(customer.id, formData);
      } else {
        await addCustomer(formData);
      }
      onSaveSuccess();
    } catch (err) {
      setError('Gagal menyimpan pelanggan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nama Pelanggan</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
       <div className="grid gap-1.5">
        <Label htmlFor="address">Alamat</Label>
        <Input id="address" name="address" value={formData.address} onChange={handleChange} />
      </div>
       <div className="grid gap-1.5">
        <Label htmlFor="phone">No. HP</Label>
        <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
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

export default CustomerForm;