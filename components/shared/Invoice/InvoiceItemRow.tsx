
import React, { useCallback, useState, useEffect } from 'react';
// FIX: Use the primary Product type instead of the deprecated SalesProduct.
import { SalesItem, Product } from '../../../types';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { TrashIcon } from '../../icons/TrashIcon';
import { Select } from '../../ui/Select';
import { formatCurrency } from '../../../utils/formatters';

interface InvoiceItemRowProps {
  item: SalesItem;
  index: number;
  // FIX: Use the primary Product type.
  products: Product[];
  onItemChange: (item: SalesItem) => void;
  onRemoveItem: (id: string) => void;
}

// Helper to format numbers for display in the input, preserving decimals
const formatNumberForInput = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4
    }).format(num);
};

const InvoiceItemRow: React.FC<InvoiceItemRowProps> = ({ item, index, products, onItemChange, onRemoveItem }) => {
  const [displayPrice, setDisplayPrice] = useState('');
  const warnaOptions = ['Merah', 'Biru', 'Hijau', 'Kuning', 'Hitam', 'Putih', 'Abu-abu'];

  useEffect(() => {
    // When price from props changes (e.g., product selected), update the formatted display price
    if (item.price > 0) {
        setDisplayPrice(formatNumberForInput(item.price));
    } else {
        setDisplayPrice('');
    }
  }, [item.price]);

  const updateItem = useCallback((field: keyof SalesItem, value: any) => {
    const updatedItem = { ...item, [field]: value };

    if (field === 'qty' || field === 'price') {
      updatedItem.subtotal = (updatedItem.qty || 0) * (updatedItem.price || 0);
    }
    
    onItemChange(updatedItem);
  }, [item, onItemChange]);

  const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productCode = e.target.value;
    // FIX: Use properties from the Product type (`kodeProduk`, `namaProduk`, `hargaDasar`).
    const selectedProduct = products.find(p => p.kodeProduk === productCode);
    
    if (selectedProduct) {
        const updatedItem = { 
            ...item, 
            productCode: selectedProduct.kodeProduk,
            productName: selectedProduct.namaProduk,
            price: selectedProduct.hargaDasar,
            subtotal: item.qty * selectedProduct.hargaDasar
        };
        onItemChange(updatedItem);
    } else {
        const updatedItem = {
            ...item,
            productCode: '',
            productName: '',
            price: 0,
            subtotal: 0
        };
        onItemChange(updatedItem);
    }
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = parseInt(e.target.value, 10);
    updateItem('qty', Math.max(1, qty || 1));
  };
  
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setDisplayPrice(rawValue); // Allow user to type freely with separators
    
    // Parse the number (strip separators) and update the parent state for calculation
    const sanitizedValue = rawValue.replace(/\./g, '').replace(',', '.');
    const numericValue = parseFloat(sanitizedValue);
    
    if (!isNaN(numericValue)) {
        updateItem('price', numericValue);
    } else {
        updateItem('price', 0);
    }
  };
  
  const handlePriceBlur = () => {
    // On blur, re-format the price for a clean display, based on the actual numeric value
    if (item.price > 0) {
        setDisplayPrice(formatNumberForInput(item.price));
    } else {
        setDisplayPrice('');
    }
  };

  return (
    <tr className="border-b">
      <td className="px-4 py-2 text-center text-muted-foreground">P{index + 1}</td>
      <td className="px-4 py-2">
        <Select
            value={item.productCode}
            onChange={handleProductSelect}
            className="w-full"
        >
            <option value="" disabled>Pilih produk...</option>
            {products.map(p => (
                // FIX: Use properties from the Product type (`kodeProduk`, `namaProduk`).
                <option key={p.id} value={p.kodeProduk}>
                    {p.namaProduk} ({p.kodeProduk})
                </option>
            ))}
        </Select>
        <p className="text-xs text-muted-foreground mt-1">{item.productName || ' '}</p>
      </td>
      <td className="px-4 py-2">
        <Input
          type="text"
          value={displayPrice}
          onChange={handlePriceChange}
          onBlur={handlePriceBlur}
          placeholder="0"
          className="text-right"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          value={item.qty}
          onChange={handleQtyChange}
          className="text-center"
          min="1"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={item.color}
          onChange={(e) => updateItem('color', e.target.value)}
          placeholder="e.g., Hitam"
          list="warna-options"
        />
        <datalist id="warna-options">
            {warnaOptions.map(warna => <option key={warna} value={warna} />)}
        </datalist>
      </td>
      <td className="px-4 py-2 text-right font-medium">
        {formatCurrency(item.subtotal)}
      </td>
      <td className="px-4 py-2 text-center">
        <Button variant="ghost" size="sm" onClick={() => onRemoveItem(item.id)}>
          <TrashIcon className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
};

export default InvoiceItemRow;