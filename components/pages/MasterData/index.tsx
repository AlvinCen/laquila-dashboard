
import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../../ui/Card';
import ProductTable from './Produk/ProductTable';
import WalletTable from './Wallet/MaterialTable';
import FinanceCategoryTable from './Finance/PurchaseTable';
import { Input } from '../../ui/Input';

type Tab = 'produk' | 'wallet' | 'finance';

const MasterData: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('produk');
  const [searchQuery, setSearchQuery] = useState('');

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchQuery(''); // Reset search when tab changes
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'produk':
        return <ProductTable searchQuery={searchQuery} />;
      case 'wallet':
        return <WalletTable searchQuery={searchQuery} />;
      case 'finance':
        return <FinanceCategoryTable searchQuery={searchQuery} />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tab: Tab; label: string }> = ({ tab, label }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => handleTabChange(tab)}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-1 sm:flex-initial ${
          isActive
            ? 'bg-primary text-primary-foreground shadow'
            : 'text-muted-foreground hover:bg-accent'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Kelola data inti bisnis Anda: produk, wallet, dan kategori keuangan.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center">
          <div className="flex-grow w-full sm:w-auto">
             <Input
                type="search"
                placeholder="Cari di data master..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
          </div>
          <nav className="flex space-x-2 p-1 bg-muted rounded-lg w-full sm:w-auto justify-center" aria-label="Tabs">
            <TabButton tab="produk" label="Produk" />
            <TabButton tab="wallet" label="Wallet" />
            <TabButton tab="finance" label="Kategori Keuangan" />
          </nav>
        </div>
        <div>
          {renderTabContent()}
        </div>
      </CardContent>
    </Card>
  );
};

export default MasterData;
