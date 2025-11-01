import React, { useCallback, useMemo } from 'react';
import { SalesOrderItem, Product } from '../../../types';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { TrashIcon } from '../../icons/TrashIcon';
import { Label } from '../../ui/Label';

interface SalesOrderItemRowProps {
  item: SalesOrderItem;
  products: Product[];
  onItemChange: (item: SalesOrderItem) => void;
  onRemoveItem: (id: string) => void;
}

const SalesOrderItemRow: React.FC<SalesOrderItemRowProps> = ({ item, products, onItemChange, onRemoveItem }) => {

    const updateItem = useCallback((field: keyof SalesOrderItem, value: any) => {
        const updatedItem = { ...item, [field]: value };

        if (field === 'qty' || field === 'basePrice') {
            updatedItem.jumlah = (updatedItem.qty || 0) * (updatedItem.basePrice || 0);
        }
        onItemChange(updatedItem);
    }, [item, onItemChange]);


    const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const productId = e.target.value;
        const selectedProduct = products.find(p => p.id === productId);
        
        if (selectedProduct) {
            onItemChange({
                ...item,
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                basePrice: selectedProduct.basePrice,
                jumlah: (item.qty || 1) * selectedProduct.basePrice,
                // also update deprecated fields for compatibility if needed elsewhere
                kodeProduk: selectedProduct.sku || '',
                namaProduk: selectedProduct.name,
                hargaDasar: selectedProduct.basePrice,
            });
        }
    };
    
    const formattedSubtotal = useMemo(() => {
        return new Intl.NumberFormat('id-ID').format(item.jumlah);
    }, [item.jumlah]);
    
    const warnaOptions = ["Hitam","Putih","Abu-abu","Merah","Biru","Hijau","Kuning","Cokelat","Cream","Silver","Gold"];

    return (
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-x-2 gap-y-3 sm:gap-2 p-3 border rounded-lg items-end sm:items-center bg-gray-50">
           <div className="col-span-6 sm:col-span-5">
                <Label htmlFor={`product-${item.id}`} className="sm:hidden text-xs">Produk</Label>
                <Select id={`product-${item.id}`} value={item.productId || ''} onChange={handleProductSelect}>
                    <option value="" disabled>Pilih Produk...</option>
                    {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                </Select>
           </div>
           <div className="col-span-2 sm:col-span-1">
                <Label htmlFor={`qty-${item.id}`} className="sm:hidden text-xs">Qty</Label>
                <Input 
                    id={`qty-${item.id}`}
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItem('qty', parseInt(e.target.value, 10) || 1)}
                    className="text-center"
                    placeholder="Qty"
                />
           </div>
           <div className="col-span-4 sm:col-span-2">
                <Label htmlFor={`color-${item.id}`} className="sm:hidden text-xs">Warna</Label>
                <Input 
                    id={`color-${item.id}`}
                    value={item.warna}
                    onChange={(e) => updateItem('warna', e.target.value)}
                    placeholder="Warna"
                    list="warna-options"
                />
                <datalist id="warna-options">
                    {warnaOptions.map(warna => <option key={warna} value={warna} />)}
                </datalist>
           </div>
            <div className="col-span-4 sm:col-span-3 text-right font-medium">
                <span className="sm:hidden text-xs text-muted-foreground">Subtotal: </span>
                <span>{formattedSubtotal}</span>
            </div>
           <div className="col-span-2 sm:col-span-1 text-right">
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveItem(item.id)}>
                    <TrashIcon className="h-4 w-4 text-destructive" />
                </Button>
           </div>
        </div>
    );
};

export default SalesOrderItemRow;