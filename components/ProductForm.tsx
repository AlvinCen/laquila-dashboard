import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductInput } from '../types';
import { addProduct, updateProduct } from '../services/api';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import { UploadIcon } from './icons/UploadIcon';
import { XIcon } from './icons/XIcon';
import { useToast } from '../contexts/ToastContext';
import { printKelengkapanProduct } from '../utils/print-thermal';

interface ProductFormProps {
  product: Product | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSaveSuccess, onCancel }) => {
  // FIX: Use `name`, `sku`, `basePrice` to match the `ProductInput` type and backend schema.
  // The state type is now more specific to what the form actually handles.
  const [formData, setFormData] = useState<Pick<ProductInput, 'name' | 'sku' | 'basePrice' | 'kelengkapanImage' | 'kelengkapanMime'>>({
    name: '',
    sku: '',
    basePrice: 0,
    kelengkapanImage: undefined,
    kelengkapanMime: undefined,
  });
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);


  useEffect(() => {
    if (product) {
      // FIX: Populate state with correct properties, using fallbacks for deprecated ones.
      setFormData({
        name: product.name || product.namaProduk || '',
        sku: product.sku || product.kodeProduk || '',
        basePrice: product.basePrice ?? product.hargaDasar ?? 0,
        kelengkapanImage: product.kelengkapanImage,
        kelengkapanMime: product.kelengkapanMime,
      });
      if (product.kelengkapanImage) {
        setFilePreview(product.kelengkapanImage);
      }
    } else {
        // Reset form for new product entry
        setFormData({
            name: '',
            sku: '',
            basePrice: 0,
            kelengkapanImage: undefined,
            kelengkapanMime: undefined,
        });
    }
  }, [product]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const processFile = (file: File | null | undefined) => {
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) { // 2MB limit
          showToast('Ukuran file maksimal adalah 2MB.', 'error');
          if (fileInputRef.current) {
              fileInputRef.current.value = '';
          }
          return;
      }
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          showToast('Hanya file gambar atau PDF yang diizinkan.', 'error');
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          setFormData(prev => ({
              ...prev,
              kelengkapanImage: reader.result as string,
              kelengkapanMime: file.type,
          }));
          setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      processFile(e.target.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  
  const handleRemoveFile = () => {
    setFormData(prev => ({ ...prev, kelengkapanImage: undefined, kelengkapanMime: undefined }));
    setFilePreview(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handlePrint = () => {
    if (!formData.kelengkapanImage) {
        showToast('Tidak ada gambar kelengkapan untuk dicetak.', 'error');
        return;
    }
    setIsPrinting(true);
    showToast(`Mempersiapkan print 100x150mm...`, 'info');
    try {
        printKelengkapanProduct('100x150', {
            productName: formData.name,
            sku: formData.sku || '',
            kelengkapanImage: formData.kelengkapanImage,
            kelengkapanMime: formData.kelengkapanMime,
        });
        setTimeout(() => setIsPrinting(false), 2000);
    } catch(e) {
        console.error("Print failed:", e);
        showToast('Gagal mempersiapkan print.', 'error');
        setIsPrinting(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (product?.id) {
        await updateProduct(product.id, formData as ProductInput);
      } else {
        await addProduct(formData as ProductInput);
      }
      onSaveSuccess();
    } catch (err) {
      setError('Gagal menyimpan produk. Coba lagi nanti.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sku">Kode Produk</Label>
          <Input id="sku" name="sku" value={formData.sku || ''} onChange={handleChange} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="name">Nama Produk</Label>
          <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
        </div>
         <div className="grid gap-1.5">
          <Label htmlFor="basePrice">Harga Dasar</Label>
          <Input id="basePrice" name="basePrice" type="number" step="0.01" value={formData.basePrice || 0} onChange={handleNumberChange} required />
        </div>
      </div>
      
      <div className="border-t pt-4">
        <h4 className="font-medium mb-2">Kelengkapan Produk (untuk Print)</h4>
        {filePreview ? (
            <div className="relative group p-2 border rounded-lg">
                {formData.kelengkapanMime?.startsWith('image/') ? (
                    <img src={filePreview} alt="Preview Kelengkapan" className="max-h-48 rounded-md mx-auto" />
                ) : formData.kelengkapanMime === 'application/pdf' ? (
                     <div className="text-center p-4 bg-gray-100 rounded-md">
                        <p className="font-medium">PDF Ter-upload</p>
                        <a href={filePreview} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Lihat PDF</a>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">File ter-upload: {formData.kelengkapanMime}</p>
                )}
                <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon" 
                    onClick={handleRemoveFile}
                    className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <XIcon className="h-4 w-4" />
                </Button>
            </div>
        ) : (
             <div className="flex items-center justify-center w-full">
                <label 
                    htmlFor="kelengkapan-upload" 
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        isDragging ? 'bg-primary/10 border-primary' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center pointer-events-none">
                        <UploadIcon className="w-8 h-8 mb-2 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Klik untuk upload</span> atau seret file ke sini
                        </p>
                        <p className="text-xs text-gray-500">Gambar atau PDF (Max 2MB)</p>
                    </div>
                    <Input id="kelengkapan-upload" ref={fileInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                </label>
            </div> 
        )}
        {filePreview && (
          <div className="mt-4 flex space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrint}
              disabled={!formData.kelengkapanImage || isPrinting}
            >
              {isPrinting ? 'Printing...' : 'Print Kelengkapan (100x150mm)'}
            </Button>
          </div>
        )}
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

export default ProductForm;
