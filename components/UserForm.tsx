import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserInput, Wallet, Role, Module, Action, PermissionsMap } from '../types';
import { saveUser } from '../services/api';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Checkbox } from './ui/Checkbox';

interface UserFormProps {
  user: User | null;
  wallets: Wallet[];
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const initialFormState: UserInput = {
  username: '',
  password: '',
  role: 'staff',
  permissions: {},
  allowedWalletIds: [],
};

// FIX: Added 'order-analytic' to the list of configurable modules for staff roles.
const allModules: Module[] = ['master-data', 'sales-order', 'settlement', 'cash-flow', 'growth-insight', 'order-analytic'];
// FIX: Added 'order-analytic' module to satisfy the Record<Module, Action[]> type and included 'export' for 'master-data'.
const allActions: Record<Module, Action[]> = {
  'master-data': ['create', 'read', 'update', 'delete', 'export'],
  'sales-order': ['create', 'read', 'update', 'cancel'],
  'settlement': ['read', 'settle'],
  'cash-flow': ['create', 'read', 'update', 'delete', 'export'],
  'growth-insight': ['read', 'export'],
  'order-analytic': ['read'],
  'user-management': [], // This is admin-only, not assignable
};


const UserForm: React.FC<UserFormProps> = ({ user, wallets, onSaveSuccess, onCancel }) => {
  const [formData, setFormData] = useState<UserInput>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const { totalPermissions, allPermissionsMap } = useMemo(() => {
    const allPerms: PermissionsMap = {};
    let total = 0;
    for (const module of allModules) {
        allPerms[module] = allActions[module];
        total += allActions[module].length;
    }
    return { totalPermissions: total, allPermissionsMap: allPerms };
  }, []);

  const selectedPermissionsCount = useMemo(() => {
    if (!formData.permissions) return 0;
    // FIX: Add an `Array.isArray` check to safely access the `.length` property on `actions`, resolving a TypeScript error where `actions` was inferred as `unknown`.
    // FIX: Refactored to filter out non-array values before reducing, which is cleaner and safer than checking the type inside the reduce callback. This resolves the error where `actions` was inferred as `unknown`.
    return Object.values(formData.permissions)
      .filter(Array.isArray)
      .reduce((acc, actions) => acc + actions.length, 0);
  }, [formData.permissions]);

  const isAllSelected = selectedPermissionsCount === totalPermissions;
  const isSomeSelected = selectedPermissionsCount > 0 && !isAllSelected;

  useEffect(() => {
    if (selectAllRef.current) {
        selectAllRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    if (user) {
      setFormData({ ...user, password: '' }); // Don't pre-fill password
    } else {
      setFormData(initialFormState);
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRole = e.target.value as Role;
      setFormData(prev => ({
          ...prev,
          role: newRole,
          permissions: newRole === 'admin' ? {} : prev.permissions,
          allowedWalletIds: newRole === 'admin' ? 'all' : [],
      }))
  }

  const handlePermissionChange = (module: Module, action: Action) => {
    setFormData(prev => {
        const newPermissions: PermissionsMap = { ...prev.permissions };
        const moduleActions = newPermissions[module] || [];
        if (moduleActions.includes(action)) {
            newPermissions[module] = moduleActions.filter(a => a !== action);
        } else {
            newPermissions[module] = [...moduleActions, action];
        }
        return { ...prev, permissions: newPermissions };
    });
  };
  
  const handleSelectAllChange = () => {
    if (isAllSelected) {
        setFormData(prev => ({ ...prev, permissions: {} }));
    } else {
        setFormData(prev => ({ ...prev, permissions: allPermissionsMap }));
    }
  };

  const handleWalletAccessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      // FIX: Explicitly type the `option` parameter as `HTMLOptionElement` to resolve a TypeScript error where it was inferred as `unknown`.
      const selectedOptions = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
      if (selectedOptions.includes('all')) {
          setFormData(prev => ({...prev, allowedWalletIds: 'all'}));
      } else {
          setFormData(prev => ({...prev, allowedWalletIds: selectedOptions}));
      }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    if (!user && !formData.password) {
        setError('Password wajib diisi untuk pengguna baru.');
        setIsSaving(false);
        return;
    }

    try {
      await saveUser(formData);
      onSaveSuccess();
    } catch (err: unknown) {
      let message = 'Gagal menyimpan pengguna.';
      if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" name="username" value={formData.username} onChange={handleChange} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder={user ? 'Kosongkan jika tidak ganti' : ''} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="role">Role</Label>
          <Select id="role" name="role" value={formData.role} onChange={handleRoleChange} required>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </Select>
        </div>
      </div>
      
      {formData.role === 'staff' && (
          <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-lg">Izin Akses Staff</h3>
              <div className="grid gap-1.5">
                  <Label>Akses Wallet</Label>
                  <Select 
                      multiple 
                      value={formData.allowedWalletIds === 'all' ? ['all'] : formData.allowedWalletIds}
                      onChange={handleWalletAccessChange}
                      className="h-24"
                  >
                      <option value="all">Semua Wallet</option>
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
              </div>
              <div>
                  <div className="flex justify-between items-center">
                      <Label>Izin Modul</Label>
                      <div className="flex items-center gap-2">
                           <Checkbox
                                id="select-all-permissions"
                                ref={selectAllRef}
                                checked={isAllSelected}
                                onCheckedChange={handleSelectAllChange}
                           />
                           <Label htmlFor="select-all-permissions" className="font-normal cursor-pointer">Pilih Semua</Label>
                      </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border p-4 rounded-md mt-1">
                      {allModules.map(module => (
                          <div key={module}>
                              <h4 className="font-semibold capitalize mb-2">{module.replace('-', ' ')}</h4>
                              <div className="space-y-2">
                                  {allActions[module].map(action => (
                                      <div key={action} className="flex items-center gap-2">
                                          <Checkbox
                                              id={`${module}-${action}`}
                                              checked={formData.permissions[module]?.includes(action) || false}
                                              onCheckedChange={() => handlePermissionChange(module, action)}
                                          />
                                          <Label htmlFor={`${module}-${action}`} className="capitalize font-normal cursor-pointer">{action}</Label>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
      
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Menyimpan...' : 'Simpan Pengguna'}
        </Button>
      </div>
    </form>
  );
};

export default UserForm;
