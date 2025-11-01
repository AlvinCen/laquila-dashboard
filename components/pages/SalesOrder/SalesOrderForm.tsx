import React, { useState, useEffect, useCallback } from 'react';
import { SalesOrder, SalesOrderInput, SalesOrderItemInput, Product, SalesOrderItem } from '../../../types';
import { saveSalesOrder, fetchProducts } from '../../../services/api';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { PlusIcon } from '../../icons/PlusIcon';
import SalesOrderItemRow from './SalesOrderItemRow';
import { formatCurrency, toDateTimeLocal } from '../../../utils/formatters';
import { printMultiKelengkapan } from '../../../utils/print-thermal';
import { useToast } from '../../../contexts/ToastContext';

interface SalesOrderFormProps {
  order: SalesOrder | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

// FIX: Introduced a dedicated `SalesOrderFormState` type to clearly define the form's state structure, resolving a TypeScript ambiguity between `SalesOrderItem` (used for client-side rendering with a unique ID) and `SalesOrderItemInput` (used for the API payload). This eliminates multiple type errors related to mismatched `items` arrays.
type SalesOrderFormState = Partial<Omit<SalesOrderInput, 'items'>> & {
    items: SalesOrderItem[];
};

const SalesOrderForm: React.FC<SalesOrderFormProps> = ({ order, onSaveSuccess, onCancel }) => {
    const [formData, setFormData] = useState<SalesOrderFormState>({
        noIdPesanan: '',
        tglPesan: toDateTimeLocal(new Date().toISOString()),
        tglKirim: toDateTimeLocal(new Date().toISOString()),
        marketplace: 'WhatsApp',
        cargo: '',
        namaPelanggan: '',
        kota: '',
        alamat: '',
        noHp: '',
        items: [],
        orderStatus: 'Confirmed',
    });
    console.log(formData)
    const [products, setProducts] = useState<Product[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { showToast } = useToast();
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchProducts().then(setProducts);

        if (order) {
            setFormData({
                ...order,
                items: order.items || [],
                tglPesan: toDateTimeLocal(order.createdAt),
                tglKirim: toDateTimeLocal(order.tglKirim || order.createdAt),
            });
            setInvoiceNumber(order.invoiceNumber);
            setTotal(order.total);
        } else {
            // For new orders, we don't have an invoice number yet.
            // The server will assign it. We'll show a placeholder.
            setInvoiceNumber('Akan dibuat otomatis');
        }
    }, [order]);

    useEffect(() => {
        const newTotal = formData.items?.reduce((sum, item) => sum + (item.basePrice * item.qty), 0) ?? 0;
        setTotal(newTotal);
    }, [formData.items]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // FIX: Changed updatedItem type to SalesOrderItem to include the client-side 'id' for correct item updates.
    const handleItemChange = useCallback((updatedItem: SalesOrderItem) => {
        setFormData(prev => {
            // FIX: Add explicit type to `item` to resolve inference issue.
            const newItems = (prev.items || []).map((item: SalesOrderItem) => item.id === updatedItem.id ? updatedItem : item);
            return {...prev, items: newItems};
        });
    }, []);

    const handleAddItem = () => {
        const newItem: SalesOrderItem = {
            id: `item-${Date.now()}`,
            orderId: '', // Not needed on client
            productId: null,
            productName: '',
            basePrice: 0,
            qty: 1,
            warna: '',
            jumlah: 0,
        };
        setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const handleRemoveItem = (id: string) => {
        // FIX: Add explicit type to `item` to resolve inference issue.
        setFormData(prev => ({ ...prev, items: (prev.items || []).filter((item: SalesOrderItem) => item.id !== id) }));
    };

    const handleSubmit = async (e: React.FormEvent | React.MouseEvent, printAfterSave = false) => {
        e.preventDefault();
        if (!formData.namaPelanggan) {
            setError('Nama pelanggan wajib diisi.');
            return;
        }
        if (!formData.items || formData.items.length === 0) {
            setError('Sales order harus memiliki minimal satu item produk.');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const payload: SalesOrderInput = {
                noIdPesanan: formData.noIdPesanan,
                tglPesan: formData.tglPesan!,
                tglKirim: formData.tglKirim,
                marketplace: formData.marketplace!,
                cargo: formData.cargo,
                namaPelanggan: formData.namaPelanggan!,
                kota: formData.kota,
                alamat: formData.alamat,
                noHp: formData.noHp,
                orderStatus: formData.orderStatus!,
                items: formData.items.map(({ id, orderId, jumlah, ...rest}) => rest),
                // Pass id if we are editing
                id: order ? order.id : undefined,
            };

            const savedOrder = await saveSalesOrder(payload);
            
            if (printAfterSave) {
                showToast('Order tersimpan. Mempersiapkan data print...', 'info');
                setTimeout(() => {
                    try {
                        const itemsToPrint = savedOrder.items
                            .map(item => {
                                const product = products.find(p => p.id === item.productId);
                                if (product) { // simplified check, as kelengkapanImage is not in DB
                                    return {
                                        productName: item.productName,
                                        sku: product.sku || '',
                                        color: item.warna,
                                        qty: item.qty,
                                        // kelengkapanImage and mime are not available from DB, this feature needs adjustment
                                        // For now, we'll assume it might be stored elsewhere or this feature is on hold
                                    };
                                }
                                return null;
                            })
                            .filter((item): item is NonNullable<typeof item> => item !== null);

                        if (itemsToPrint.length > 0) {
                            // This function needs to be adapted as kelengkapanImage is not on the server
                            // For now, it will just not print the image.
                            printMultiKelengkapan('100x150', `Kelengkapan Invoice: ${savedOrder.invoiceNumber}`, itemsToPrint);
                        } else {
                            showToast('Order tersimpan, namun tidak ada item yang memiliki kelengkapan untuk dicetak.', 'error');
                        }
                    } catch (printError) {
                        console.error("Printing failed after save:", printError);
                        showToast('Gagal mempersiapkan print.', 'error');
                    }
                }, 100);
            }
            onSaveSuccess();
        } catch (err: any) {
            setError(err.message || 'Gagal menyimpan sales order. Coba lagi nanti.');
        } finally {
            if (printAfterSave) {
                setTimeout(() => setIsSaving(false), 500);
            } else {
                setIsSaving(false);
            }
        }
    };
    
    const marketplaceOptions = ['Shopee', 'Tokopedia', 'TikTok Shop', 'WhatsApp', 'Lainnya'];
    const cargoOptions = ["JNE","J&T","SiCepat","TIKI","POS","Wahana","Anteraja","Ninja","Lion Parcel","Grab Express","GoSend","Lalamove","Paxel","SAP","IDL","SCS"];

    return (
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {/* Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-6">
                <div className="grid gap-1.5">
                    <Label htmlFor="noInvoice">No Invoice</Label>
                    <Input id="noInvoice" name="noInvoice" value={invoiceNumber} disabled />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="tglPesan">Tanggal Pesan</Label>
                    <Input id="tglPesan" name="tglPesan" type="datetime-local" value={formData.tglPesan} onChange={handleChange} required />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="tglKirim">Tanggal Kirim</Label>
                    <Input id="tglKirim" name="tglKirim" type="datetime-local" value={formData.tglKirim} onChange={handleChange} />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="marketplace">Marketplace</Label>
                    <Select id="marketplace" name="marketplace" value={formData.marketplace} onChange={handleChange}>
                        {marketplaceOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </Select>
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="noIdPesanan">No ID Pesanan</Label>
                    <Input id="noIdPesanan" name="noIdPesanan" value={formData.noIdPesanan} onChange={handleChange} />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="cargo">Cargo (Opsional)</Label>
                    <Input 
                        id="cargo" 
                        name="cargo" 
                        value={formData.cargo || ''} 
                        onChange={handleChange} 
                        list="cargo-options"
                    />
                     <datalist id="cargo-options">
                        {cargoOptions.map(cargo => <option key={cargo} value={cargo} />)}
                    </datalist>
                </div>
            </div>

            {/* Customer & Items */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4 lg:col-span-1">
                    <h3 className="font-medium">Informasi Pelanggan</h3>
                    <div className="grid gap-1.5">
                        <Label htmlFor="namaPelanggan">Nama Pelanggan</Label>
                        <Input id="namaPelanggan" name="namaPelanggan" value={formData.namaPelanggan} onChange={handleChange} required />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="kota">Kota</Label>
                        <Input id="kota" name="kota" value={formData.kota} onChange={handleChange} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="alamat">Alamat</Label>
                        <Input id="alamat" name="alamat" value={formData.alamat} onChange={handleChange} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="noHp">No HP</Label>
                        <Input id="noHp" name="noHp" value={formData.noHp} onChange={handleChange} />
                    </div>
                </div>

                <div className="space-y-4 lg:col-span-2">
                    <h3 className="font-medium">Item Pesanan</h3>
                    <div className="space-y-2">
                        {(formData.items || []).map((item) => (
                            <SalesOrderItemRow 
                                key={item.id}
                                item={item}
                                products={products}
                                onItemChange={handleItemChange}
                                onRemoveItem={handleRemoveItem}
                            />
                        ))}
                    </div>
                    <Button type="button" variant="outline" onClick={handleAddItem}>
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Tambah Item
                    </Button>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center border-t pt-6">
                 <div className="grid gap-1.5">
                    <Label htmlFor="orderStatus">Status Order</Label>
                    <Select id="orderStatus" name="orderStatus" value={formData.orderStatus} onChange={handleChange}>
                        <option value="Confirmed">Payment</option>
                    </Select>
                </div>
                <div className="text-right">
                    <p className="text-muted-foreground">Total Sales Order</p>
                    <p className="text-2xl font-bold">{formatCurrency(total)}</p>
                </div>
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            
            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Batal</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button type="button" onClick={(e) => handleSubmit(e, true)} disabled={isSaving}>
                    {isSaving ? 'Menyimpan & Printing...' : 'Simpan + Print Kelengkapan'}
                </Button>
            </div>
        </form>
    );
};

export default SalesOrderForm;