import React, { useState, useEffect, useCallback } from 'react';
import { SalesInvoice, SalesItem, Customer, Platform, Ekspedisi, PaymentMethod, Payment } from '../../../../types';
import { saveSalesInvoice, fetchCustomers, fetchPlatforms, fetchEkspedisi, fetchPaymentMethods } from '../../../../services/api';
import { Card, CardHeader, CardContent, CardFooter } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import InvoiceHeader from './InvoiceHeader';
import InvoiceItemsTable from './InvoiceItemsTable';
import { formatCurrency } from '../../../../utils/formatters';
import { Label } from '../../../ui/Label';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { useToast } from '../../../../contexts/ToastContext';

const initialInvoiceState: SalesInvoice = {
  id: undefined,
  invoiceNumber: `INV-${Date.now()}`,
  orderDate: new Date().toISOString().split('T')[0],
  platform: '',
  receiptNumber: '',
  ekspedisi: '',
  customerId: '',
  customerName: '',
  customerAddress: '',
  customerPhone: '',
  items: [],
  biayaLainnya: 0,
  ongkosKirim: 0,
  grandTotal: 0,
  status: 'Pending',
  payments: [],
};

interface SalesInvoiceFormProps {
    invoiceToEdit?: SalesInvoice | null;
    onSaveSuccess: () => void;
    onCancel: () => void;
}

const SalesInvoiceForm: React.FC<SalesInvoiceFormProps> = ({ invoiceToEdit, onSaveSuccess, onCancel }) => {
  const [invoice, setInvoice] = useState<SalesInvoice>(initialInvoiceState);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [ekspedisiList, setEkspedisiList] = useState<Ekspedisi[]>([]);
  
  const [displayBiayaLainnya, setDisplayBiayaLainnya] = useState('');
  const [displayOngkosKirim, setDisplayOngkosKirim] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { showToast } = useToast();
  const formTitle = invoiceToEdit ? `Edit Invoice ${invoiceToEdit.invoiceNumber}` : 'Buat Invoice Penjualan Baru';
  const formDescription = invoiceToEdit ? 'Perbarui detail di bawah ini.' : 'Isi detail di bawah untuk membuat transaksi penjualan.';
  
  useEffect(() => {
    fetchCustomers('').then(setCustomers);
    fetchPlatforms().then(setPlatforms);
    fetchEkspedisi().then(setEkspedisiList);
  }, []);

  useEffect(() => {
    if (invoiceToEdit) {
      setInvoice(invoiceToEdit);
      setDisplayBiayaLainnya(new Intl.NumberFormat('id-ID').format(invoiceToEdit.biayaLainnya || 0));
      setDisplayOngkosKirim(new Intl.NumberFormat('id-ID').format(invoiceToEdit.ongkosKirim || 0));
    } else {
      setInvoice(initialInvoiceState);
      setDisplayBiayaLainnya('');
      setDisplayOngkosKirim('');
    }
  }, [invoiceToEdit]);
  
  useEffect(() => {
    if (!invoiceToEdit && platforms.length > 0 && ekspedisiList.length > 0) {
      const defaultPlatform = platforms.find(p => p.name === 'Shopee');
      const defaultEkspedisi = ekspedisiList.find(e => e.name === 'J&T Express');

      setInvoice(prev => ({
        ...prev,
        platform: defaultPlatform ? defaultPlatform.name : (platforms[0]?.name || ''),
        ekspedisi: defaultEkspedisi ? defaultEkspedisi.name : (ekspedisiList[0]?.name || ''),
      }));
    }
  }, [platforms, ekspedisiList, invoiceToEdit]);

  useEffect(() => {
    const itemsTotal = invoice.items.reduce((sum, item) => sum + item.subtotal, 0);
    const grandTotal = itemsTotal + (invoice.biayaLainnya || 0) + (invoice.ongkosKirim || 0);
    setInvoice(prev => ({ ...prev, grandTotal }));
  }, [invoice.items, invoice.biayaLainnya, invoice.ongkosKirim]);

  const handleHeaderChange = useCallback((field: keyof Omit<SalesInvoice, 'id' | 'items' | 'grandTotal'>, value: string | SalesInvoice['status']) => {
    setInvoice(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCustomerSelect = useCallback((customer: Customer | null) => {
    setInvoice(prev => ({
      ...prev,
      customerId: customer?.id ?? '',
      customerName: customer?.name ?? '',
      customerAddress: customer?.address ?? '',
      customerPhone: customer?.phone ?? '',
    }));
  }, []);

  const handleItemsChange = useCallback((items: SalesItem[]) => {
    setInvoice(prev => ({ ...prev, items }));
  }, []);
  
  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'biayaLainnya' | 'ongkosKirim') => {
      const rawValue = e.target.value;
      const numericString = rawValue.replace(/[^0-9]/g, '');
      const displaySetter = field === 'biayaLainnya' ? setDisplayBiayaLainnya : setDisplayOngkosKirim;

      if (numericString === '') {
          setInvoice(prev => ({ ...prev, [field]: 0 }));
          displaySetter('');
          return;
      }

      const numericValue = parseInt(numericString, 10);
      setInvoice(prev => ({ ...prev, [field]: numericValue }));
      displaySetter(new Intl.NumberFormat('id-ID').format(numericValue));
  };


  const handleSave = async () => {
    setError(null);
    if (!invoice.customerId && !invoice.customerName) {
        setError('Pelanggan harus diisi.');
        return;
    }
    if (invoice.items.length === 0) {
        setError('Invoice harus memiliki setidaknya satu item produk.');
        return;
    }
    setIsSaving(true);
    
    try {
      const result = await saveSalesInvoice(invoice);
      if (result.success) {
        showToast(result.message, 'success');
        onSaveSuccess();
      } else {
        setError(result.message);
        showToast(result.message, 'error');
      }
    } catch (e) {
      const errorMessage = 'Gagal menyimpan invoice. Coba lagi nanti.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="max-w-6xl mx-auto">
      <CardHeader>
        <h2 className="text-xl font-semibold">{formTitle}</h2>
        <p className="text-sm text-muted-foreground">{formDescription}</p>
      </CardHeader>
      <CardContent className="space-y-8">
        <InvoiceHeader 
          invoice={invoice}
          customers={customers}
          platforms={platforms}
          ekspedisiList={ekspedisiList}
          onHeaderChange={handleHeaderChange}
          onCustomerSelect={handleCustomerSelect}
        />
        <InvoiceItemsTable 
          items={invoice.items}
          onItemsChange={handleItemsChange}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end pt-6 border-t">
            <div className="lg:col-span-2"></div>
            <div className="space-y-4">
                 <div>
                    <Label htmlFor="biayaLainnya">Biaya Lainnya</Label>
                    <Input
                        id="biayaLainnya"
                        type="text"
                        value={displayBiayaLainnya}
                        onChange={(e) => handleCostChange(e, 'biayaLainnya')}
                        placeholder="0"
                        className="text-right"
                    />
                </div>
                <div>
                    <Label htmlFor="ongkosKirim">Ongkos Kirim</Label>
                    <Input
                        id="ongkosKirim"
                        type="text"
                        value={displayOngkosKirim}
                        onChange={(e) => handleCostChange(e, 'ongkosKirim')}
                        placeholder="0"
                        className="text-right"
                    />
                </div>
            </div>
            <div className="text-right bg-gray-50 p-4 rounded-lg">
                <p className="text-muted-foreground">Grand Total</p>
                <p className="text-2xl font-bold">{formatCurrency(invoice.grandTotal)}</p>
            </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <div className="flex space-x-2">
            <Button variant="outline" onClick={onCancel}>Batal</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan Invoice'}
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default SalesInvoiceForm;
