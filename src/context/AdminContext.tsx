import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchAdminUserIds, invalidateAdminCache } from '../lib/supabase';

interface AdminContextType {
  isAdmin: boolean;
  adminUserIds: string[];
  isAdminUser: (userId?: string | null) => boolean;
  refreshAdminState: () => Promise<void>;
  isLoadingAdmin: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [adminUserIds, setAdminUserIds] = useState<string[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);

  const loadAdminIds = useCallback(async (force = false) => {
    try {
      const ids = await fetchAdminUserIds(force);
      setAdminUserIds(ids);
    } catch (err) {
      console.warn('[AdminContext] Error loading admin user IDs:', err);
      setAdminUserIds([]);
    } finally {
      setIsLoadingAdmin(false);
    }
  }, []);

  useEffect(() => {
    loadAdminIds();
  }, [loadAdminIds]);

  const refreshAdminState = useCallback(async () => {
    invalidateAdminCache();
    await loadAdminIds(true);
  }, [loadAdminIds]);

  const isAdminUser = useCallback(
    (userId?: string | null): boolean => {
      if (!userId) return false;
      return adminUserIds.includes(userId);
    },
    [adminUserIds]
  );

  const isAdmin = Boolean(user?.id && adminUserIds.includes(user.id));

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        adminUserIds,
        isAdminUser,
        refreshAdminState,
        isLoadingAdmin,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
