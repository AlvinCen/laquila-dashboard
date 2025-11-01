
import React, { useState, useEffect, useCallback } from 'react';
// FIX: Use the primary Product type instead of the deprecated SalesProduct.
import { SalesItem, Product } from '../../../types';
import { fetchProducts } from '../../../services/api';
import { Button } from '../../ui/Button';
import { PlusIcon } from '../../icons/PlusIcon';
import InvoiceItemRow from './InvoiceItemRow';

interface InvoiceItemsTableProps {
  items: SalesItem[];
  onItemsChange: (items: SalesItem[]) => void;
}

const InvoiceItemsTable: React.FC<InvoiceItemsTableProps> = ({ items, onItemsChange }) => {
  // FIX: Use the primary Product type.
  const [products, setProducts] = useState<Product[]>([]);
  
  useEffect(() => {
    // FIX: Corrected API call to fetchProducts which takes no arguments.
    fetchProducts().then(setProducts);
  }, []);

  const handleAddItem = () => {
    const newItem: SalesItem = {
      id: `item-${Date.now()}`,
      idx: items.length + 1,
      productCode: '',
      productName: '',
      price: 0,
      qty: 1,
      color: '',
      subtotal: 0,
    };
    onItemsChange([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    const updatedItems = items.filter(item => item.id !== id).map((item, index) => ({...item, idx: index+1}));
    onItemsChange(updatedItems);
  };
  
  const handleItemChange = useCallback((updatedItem: SalesItem) => {
    const updatedItems = items.map(item =>
      item.id === updatedItem.id ? updatedItem : item
    );
    onItemsChange(updatedItems);
  }, [items, onItemsChange]);

  return (
    <div>
        <h3 className="text-lg font-medium mb-2">Item Penjualan</h3>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 w-12">No</th>
                        <th className="px-4 py-3">Kode/Nama Produk</th>
                        <th className="px-4 py-3 w-40">Harga</th>
                        <th className="px-4 py-3 w-24">Qty</th>
                        <th className="px-4 py-3 w-32">Warna</th>
                        <th className="px-4 py-3 w-48 text-right">Subtotal</th>
                        <th className="px-4 py-3 w-12"></th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <InvoiceItemRow
                            key={item.id}
                            item={item}
                            index={index}
                            products={products}
                            onItemChange={handleItemChange}
                            onRemoveItem={handleRemoveItem}
                        />
                    ))}
                </tbody>
            </table>
        </div>
      <Button variant="outline" onClick={handleAddItem} className="mt-4">
        <PlusIcon className="h-4 w-4 mr-2" />
        Tambah Item (P{items.length + 1})
      </Button>
    </div>
  );
};

export default InvoiceItemsTable;
