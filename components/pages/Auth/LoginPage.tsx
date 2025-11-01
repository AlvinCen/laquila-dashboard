import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Label } from '../../ui/Label';
import * as api from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await login(username, password, true); // Set remember to true for persistent login
    // If login fails, we want to allow another attempt.
    setIsLoading(false);
  };

  const handleLoadData = async () => {
    if (!window.confirm("Apakah Anda yakin ingin memuat data contoh? Ini akan menghapus semua data yang ada.")) {
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.resetMockData();
      showToast(result.message, 'success');
      window.location.reload();
    } catch (e: any) {
      showToast(e.message || 'Gagal memuat data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm("PERINGATAN: Apakah Anda yakin ingin menghapus semua data transaksi? Tindakan ini tidak dapat diurungkan.")) {
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.clearMockData();
      showToast(result.message, 'success');
      window.location.reload();
    } catch (e: any) {
      showToast(e.message || 'Gagal menghapus data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-2xl font-bold text-center">Laquila Dashboard</h1>
          <p className="text-sm text-muted-foreground text-center">Silakan login untuk melanjutkan</p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="e.g., admin"
                autoComplete="username"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="e.g., 1234"
                autoComplete="current-password"
              />
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t mt-4 space-y-1">
                <p className="font-semibold">Akun untuk Development:</p>
                <p>Admin: <span className="font-mono bg-gray-200 px-1 rounded">admin</span> / <span className="font-mono bg-gray-200 px-1 rounded">1234</span></p>
                <p>Staff: <span className="font-mono bg-gray-200 px-1 rounded">staff</span> / <span className="font-mono bg-gray-200 px-1 rounded">1234</span></p>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Memproses...' : 'Login'}
            </Button>
            <div className="text-xs text-muted-foreground pt-4 border-t text-center w-full space-y-2">
                <p className="font-semibold">Aksi Data (Untuk Developer)</p>
                <div className="flex justify-center space-x-2">
                    <Button type="button" variant="secondary" size="sm" onClick={handleLoadData} disabled={isLoading}>
                        Muat Data Contoh
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={handleClearData} disabled={isLoading}>
                        Hapus Semua Data
                    </Button>
                </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;