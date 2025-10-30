import React, { useState, useEffect, useMemo } from 'react';
import { CashFlowEntry, CashFlowEntryInput, Wallet, FinanceCategory } from '../types';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { toDateTimeLocal } from '../utils/formatters';

interface CashFlowEntryFormProps {
    entryToEdit?: CashFlowEntry | null; // For editing
    createType?: 'income' | 'expense' | 'transfer' | null; // For creating
    wallets: Wallet[];
    financeCategories: FinanceCategory[];
    onSave: (data: CashFlowEntryInput) => Promise<void>;
    onCancel: () => void;
}

const toDateInput = (v?: string) => {
    if (!v) return '';
    const d = new Date(v);
    const tz = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tz * 60000);
    return local.toISOString().slice(0, 10);
};


const CashFlowEntryForm: React.FC<CashFlowEntryFormProps> = ({
    entryToEdit,
    createType,
    wallets,
    financeCategories,
    onSave,
    onCancel
}) => {
    const [formData, setFormData] = useState<Partial<CashFlowEntryInput>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { incomeCategories, expenseCategories } = useMemo(() => ({
        incomeCategories: financeCategories.filter(c => c.type === 'income'),
        expenseCategories: financeCategories.filter(c => c.type === 'expense'),
    }), [financeCategories]);

    useEffect(() => {
        const getInitialState = (): Partial<CashFlowEntryInput> => {
            if (entryToEdit) {
                let categoryId = entryToEdit.kategori;
                if (entryToEdit.type !== 'transfer' && entryToEdit.kategori) {
                    const matchedCategory = financeCategories.find(c => c.name === entryToEdit.kategori);
                    categoryId = matchedCategory ? matchedCategory.id : '';
                }
                return { ...entryToEdit, tanggal: toDateTimeLocal(entryToEdit.tanggal), kategori: categoryId };
            }

            if (createType) {
                const defaultWalletId = wallets[0]?.id || '';
                const defaultToWalletId = wallets.length > 1 ? wallets[1].id : defaultWalletId;
                const defaultIncomeCat = incomeCategories[0]?.id || '';
                const defaultExpenseCat = expenseCategories[0]?.id || '';

                return {
                    type: createType,
                    jumlah: 0,
                    tanggal: toDateTimeLocal(new Date().toISOString()),
                    deskripsi: '',
                    walletId: defaultWalletId,
                    toWalletId: defaultToWalletId,
                    kategori: createType === 'income' ? defaultIncomeCat : (createType === 'expense' ? defaultExpenseCat : undefined),
                };
            }
            return {};
        };
        setFormData(getInitialState());
    }, [entryToEdit, createType, wallets, financeCategories, incomeCategories, expenseCategories]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const parsedValue = name === 'jumlah' ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: parsedValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.jumlah || formData.jumlah <= 0) {
            setError('Jumlah harus lebih dari 0.');
            return;
        }
        if (formData.type !== 'transfer' && !formData.kategori) {
            setError('Kategori harus dipilih.');
            return;
        }
        if (formData.type === 'transfer' && formData.walletId === formData.toWalletId) {
            setError('Wallet sumber dan tujuan tidak boleh sama.');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(formData as CashFlowEntryInput);
        } catch (err) {
            setError('Gagal menyimpan perubahan. Coba lagi nanti.');
            setIsSaving(false); // only stop saving on error, success will unmount
        }
    };

    const formType = entryToEdit?.type || createType;

    const renderIncomeExpenseFields = () => (
        <>
            <div className="grid gap-1.5">
                <Label htmlFor="kategori">Kategori</Label>
                <Select id="kategori" name="kategori" value={formData.kategori || ''} onChange={handleChange} required>
                    <option value="" disabled>Pilih Kategori...</option>
                    {formType === 'income' ?
                        incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>) :
                        expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    }
                </Select>
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="walletId">Wallet</Label>
                <Select id="walletId" name="walletId" value={formData.walletId || ''} onChange={handleChange} required>
                    <option value="" disabled>Pilih Wallet...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
            </div>
        </>
    );

    const renderTransferFields = () => (
        <>
            <div className="grid gap-1.5">
                <Label htmlFor="walletId">Sumber Wallet</Label>
                <Select id="walletId" name="walletId" value={formData.walletId || ''} onChange={handleChange} required>
                    <option value="" disabled>Pilih Wallet Sumber...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="toWalletId">Tujuan Wallet</Label>
                <Select id="toWalletId" name="toWalletId" value={formData.toWalletId || ''} onChange={handleChange} required>
                    <option value="" disabled>Pilih Wallet Tujuan...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
            </div>
        </>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
                <Label htmlFor="jumlah">Jumlah</Label>
                <Input id="jumlah" name="jumlah" type="number" value={formData.jumlah || ''} onChange={handleChange} required min="1" />
            </div>

            {formType === 'transfer' ? renderTransferFields() : renderIncomeExpenseFields()}

            <div className="grid gap-1.5">
                <Label htmlFor="tanggal">Tanggal Transaksi</Label>
                <Input id="tanggal" name="tanggal" type="date" value={toDateInput(formData.tanggal) || ''} onChange={handleChange} required />
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="deskripsi">Deskripsi (Opsional)</Label>
                <Input id="deskripsi" name="deskripsi" value={formData.deskripsi || ''} onChange={handleChange} />
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </Button>
            </div>
        </form>
    );
};

export default CashFlowEntryForm;