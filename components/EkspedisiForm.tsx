import React, { useState, useEffect } from 'react';
import { EkspedisiInput } from '../types';
import { addEkspedisi, updateEkspedisi } from '../services/api';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';

interface EkspedisiFormProps {
  ekspedisi: EkspedisiInput | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const EkspedisiForm: React.FC<EkspedisiFormProps> = ({ ekspedisi, onSaveSuccess, onCancel }) => {
  const [formData, setFormData] = useState<EkspedisiInput>({
    name: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ekspedisi) {
      setFormData(ekspedisi);
    }
  }, [ekspedisi]);

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
      if (ekspedisi?.id) {
        await updateEkspedisi(ekspedisi.id, formData);
      } else {
        await addEkspedisi(formData);
      }
      onSaveSuccess();
    } catch (err) {
      setError('Gagal menyimpan ekspedisi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nama Ekspedisi</Label>
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

export default EkspedisiForm;