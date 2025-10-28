import React from 'react';
import { SalesInvoice, Customer, Platform, Ekspedisi } from '../types';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';

interface InvoiceHeaderProps {
  invoice: Omit<SalesInvoice, 'items' | 'grandTotal'>;
  customers: Customer[];
  platforms: Platform[];
  ekspedisiList: Ekspedisi[];
  onHeaderChange: (field: keyof Omit<SalesInvoice, 'id' | 'items' | 'grandTotal'>, value: string | SalesInvoice['status']) => void;
  onCustomerSelect: (customer: Customer | null) => void;
}

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({ invoice, customers, platforms, ekspedisiList, onHeaderChange, onCustomerSelect }) => {
  
  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const customerId = e.target.value;
    const selectedCustomer = customers.find(c => c.id === customerId) || null;
    onCustomerSelect(selectedCustomer);
  };
    
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
            <Input label="No. Invoice" value={invoice.invoiceNumber} disabled />
            <Input 
                label="Tanggal Pesan" 
                type="date" 
                value={invoice.orderDate}
                onChange={(e) => onHeaderChange('orderDate', e.target.value)}
            />
            {invoice.id && (
                <div>
                    <Label htmlFor="status">Status Invoice</Label>
                    <Select
                        id="status"
                        value={invoice.status}
                        onChange={(e) => onHeaderChange('status', e.target.value as SalesInvoice['status'])}
                    >
                        <option value="Pending">Pending</option>
                        <option value="Partial">Partial</option>
                        <option value="Paid">Paid</option>
                        <option value="Complete">Complete</option>
                    </Select>
                </div>
            )}
        </div>
        {/* Middle Column */}
        <div className="space-y-4">
            <div className="grid gap-1.5">
                <Label htmlFor="platform">Platform</Label>
                <Select
                    id="platform"
                    value={invoice.platform}
                    onChange={(e) => onHeaderChange('platform', e.target.value)}
                >
                    <option value="" disabled>Pilih platform...</option>
                    {platforms.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                </Select>
            </div>
            <Input 
                label="No. Resi" 
                value={invoice.receiptNumber}
                onChange={(e) => onHeaderChange('receiptNumber', e.target.value)}
            />
            <div className="grid gap-1.5">
                <Label htmlFor="ekspedisi">Ekspedisi</Label>
                <Select
                    id="ekspedisi"
                    value={invoice.ekspedisi}
                    onChange={(e) => onHeaderChange('ekspedisi', e.target.value)}
                >
                    <option value="" disabled>Pilih ekspedisi...</option>
                    {ekspedisiList.map(e => (
                        <option key={e.id} value={e.name}>{e.name}</option>
                    ))}
                </Select>
            </div>
        </div>
        {/* Right Column - Customer Info */}
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
            <div className="grid w-full items-center gap-1.5">
                <label className="text-sm font-medium">Cari Pelanggan</label>
                <input
                    list="customer-list"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    placeholder="Pilih pelanggan terdaftar..."
                    onChange={handleCustomerChange}
                    value={invoice.customerId}
                />
                <datalist id="customer-list">
                    {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </datalist>
            </div>
            <Input 
                label="Nama Pelanggan" 
                value={invoice.customerName}
                onChange={(e) => onHeaderChange('customerName', e.target.value)}
            />
            <Input 
                label="Alamat" 
                value={invoice.customerAddress}
                onChange={(e) => onHeaderChange('customerAddress', e.target.value)}
            />
            <Input 
                label="No. HP" 
                value={invoice.customerPhone}
                onChange={(e) => onHeaderChange('customerPhone', e.target.value)}
            />
        </div>
    </div>
  );
};

export default InvoiceHeader;