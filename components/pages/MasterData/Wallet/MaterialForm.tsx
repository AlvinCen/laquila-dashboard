import React, { useState, useEffect } from 'react';
// FIX: Import the full `Wallet` type which includes the `id` property.
import { WalletInput, Wallet } from '../../../../types';
import { addWallet, updateWallet } from '../../../../services/api';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Button } from '../../../ui/Button';

interface WalletFormProps {
  // FIX: Use the `Wallet` type for the prop to allow checking for `id`.
  wallet: Wallet | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const WalletForm: React.FC<WalletFormProps> = ({ wallet, onSaveSuccess, onCancel }) => {
  const [formData, setFormData] = useState<WalletInput>({
    name: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wallet) {
      setFormData(wallet);
    }
  }, [wallet]);

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
      if (wallet?.id) {
        await updateWallet(wallet.id, formData);
      } else {
        await addWallet(formData);
      }
      onSaveSuccess();
    } catch (err) {
      setError('Gagal menyimpan wallet.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nama Wallet</Label>
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

export default WalletForm;
