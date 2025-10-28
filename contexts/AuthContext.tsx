import React, { createContext, useState, useContext, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { User, Module, Action, Wallet } from '../types';
import * as api from '../services/api';
import { useToast } from './ToastContext';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<boolean>;
  logout: () => void;
  hasPermission: (module: Module, action: Action) => boolean;
  canAccessWallet: (walletId: string) => boolean;
  filterWallets: (wallets: Wallet[]) => Wallet[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { user } = await api.checkSession();
        setCurrentUser(user);
      } catch (error) {
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean): Promise<boolean> => {
    try {
      const { user } = await api.login(username, password, remember);
      setCurrentUser(user);
      showToast(`Selamat datang, ${user.username}!`, 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Login gagal.', 'error');
      return false;
    }
  }, [showToast]);

  const logout = useCallback(async () => {
    try {
        await api.logout();
        setCurrentUser(null);
    } catch (error: any) {
        showToast(error.message || 'Gagal logout.', 'error');
    }
  }, [showToast]);

  const hasPermission = useCallback((module: Module, action: Action): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    
    const modulePermissions = currentUser.permissions[module];
    
    // FIX: An empty array `[]` is truthy in JS, causing the previous check to fail.
    // This new check ensures the permission array exists AND is not empty before proceeding.
    if (Array.isArray(modulePermissions) && modulePermissions.length > 0) {
      return modulePermissions.includes(action);
    }
    
    return false;
  }, [currentUser]);
  
  const canAccessWallet = useCallback((walletId: string): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin' || currentUser.allowedWalletIds === 'all') return true;
      return currentUser.allowedWalletIds.includes(walletId);
  }, [currentUser]);
  
  const filterWallets = useCallback((wallets: Wallet[]): Wallet[] => {
      if (!currentUser || currentUser.role === 'admin' || currentUser.allowedWalletIds === 'all') {
          return wallets;
      }
      return wallets.filter(w => currentUser.allowedWalletIds.includes(w.id));
  }, [currentUser]);


  const value = useMemo(() => ({
    currentUser,
    isAuthenticated: !!currentUser,
    login,
    logout,
    hasPermission,
    canAccessWallet,
    filterWallets,
  }), [currentUser, login, logout, hasPermission, canAccessWallet, filterWallets]);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-secondary">
            <p className="text-lg text-muted-foreground">Memuat sesi...</p>
        </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};