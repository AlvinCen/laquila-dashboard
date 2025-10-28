import React from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';

const TransactionPage: React.FC = () => {
    return (
        <Card>
            <CardHeader>
                <h2 className="text-xl font-semibold">Riwayat Transaksi</h2>
            </CardHeader>
            <CardContent>
                <div className="text-center py-16">
                    <h3 className="text-lg font-medium">Fungsi Dipindahkan</h3>
                    <p className="text-muted-foreground">
                        Riwayat transaksi kini dapat diakses langsung di bagian bawah halaman "Cash Flow".
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};

export default TransactionPage;
