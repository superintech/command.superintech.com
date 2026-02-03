import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, usersApi, User } from './api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  fetchPermissions: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(email, password);
          if (response.success && response.data) {
            set({
              user: response.data.user,
              accessToken: response.data.accessToken,
              refreshToken: response.data.refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            // Fetch permissions after login
            get().fetchPermissions();
            return true;
          }
          set({ isLoading: false, error: 'Login failed' });
          return false;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ isLoading: false, error: message });
          return false;
        }
      },

      logout: async () => {
        const { refreshToken, accessToken } = get();
        try {
          if (refreshToken && accessToken) {
            await authApi.logout(refreshToken, accessToken);
          }
        } catch {
          // Ignore logout errors
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      fetchPermissions: async () => {
        const { accessToken } = get();
        if (!accessToken) return;
        try {
          const response = await usersApi.getMyPermissions(accessToken);
          if (response.success && response.data) {
            set({ permissions: response.data });
          }
        } catch (err) {
          console.error('Failed to fetch permissions:', err);
        }
      },

      hasPermission: (permission: string) => {
        const { user, permissions } = get();
        // Admin has all permissions
        if (user?.role === 'ADMIN') return true;
        return permissions.includes(permission);
      },

      hasAnyPermission: (requiredPermissions: string[]) => {
        const { user, permissions } = get();
        // Admin has all permissions
        if (user?.role === 'ADMIN') return true;
        return requiredPermissions.some(p => permissions.includes(p));
      },

      refreshAuth: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          set({ isAuthenticated: false, isLoading: false });
          return false;
        }

        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Refresh timeout')), 10000);
        });

        try {
          const response = await Promise.race([
            authApi.refresh(refreshToken),
            timeoutPromise,
          ]) as Awaited<ReturnType<typeof authApi.refresh>>;

          if (response && response.success && response.data) {
            // Fetch user data with new token
            const userResponse = await authApi.me(response.data.accessToken);
            if (userResponse.success && userResponse.data) {
              set({
                user: userResponse.data,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                isAuthenticated: true,
                isLoading: false,
              });
              // Fetch permissions after refresh
              get().fetchPermissions();
              return true;
            }
          }
          set({ isAuthenticated: false, isLoading: false });
          return false;
        } catch {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        }
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Verify auth on rehydration
          if (state.refreshToken) {
            state.refreshAuth();
          } else {
            state.setLoading(false);
          }
        }
      },
    }
  )
);
