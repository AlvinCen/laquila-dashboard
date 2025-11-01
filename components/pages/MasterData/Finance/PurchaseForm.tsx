import React, { useState, useEffect } from 'react';
// FIX: Import the full `FinanceCategory` type which includes the `id` property.
import { FinanceCategoryInput, FinanceCategory } from '../../../../types';
import { addFinanceCategory, updateFinanceCategory } from '../../../../services/api';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Button } from '../../../ui/Button';
import { Select } from '../../../ui/Select';

interface FinanceCategoryFormProps {
  // FIX: Use the `FinanceCategory` type for the prop to allow checking for `id`.
  category: FinanceCategory | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const FinanceCategoryForm: React.FC<FinanceCategoryFormProps> = ({ category, onSaveSuccess, onCancel }) => {
  const [formData, setFormData] = useState<FinanceCategoryInput>({
    name: '',
    type: 'income',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setFormData(category);
    }
  }, [category]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (category?.id) {
        await updateFinanceCategory(category.id, formData);
      } else {
        await addFinanceCategory(formData);
      }
      onSaveSuccess();
    } catch (err) {
      setError('Gagal menyimpan data kategori.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nama Kategori</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="type">Tipe Kategori</Label>
        <Select id="type" name="type" value={formData.type} onChange={handleChange} required>
            <option value="income">Pemasukan (Income)</option>
            <option value="expense">Pengeluaran (Expense)</option>
        </Select>
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

export default FinanceCategoryForm;
