import React, { useState, useEffect } from 'react';
import { PlatformInput } from '../types';
import { addPlatform, updatePlatform } from '../services/api';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';

interface PlatformFormProps {
  platform: PlatformInput | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const PlatformForm: React.FC<PlatformFormProps> = ({ platform, onSaveSuccess, onCancel }) => {
  const [formData, setFormData] = useState<PlatformInput>({
    name: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (platform) {
      setFormData(platform);
    }
  }, [platform]);

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
      if (platform?.id) {
        await updatePlatform(platform.id, formData);
      } else {
        await addPlatform(formData);
      }
      onSaveSuccess();
    } catch (err) {
      setError('Gagal menyimpan platform.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nama Platform</Label>
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

export default PlatformForm;