import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';
import { PermissionCheck, Permission } from '@/types/auth';

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  roles?: Role[];
  permissions?: string[];
}

interface AuthState extends PermissionCheck {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setTokenExpiresAt: (expiresAt: number | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  initAuth: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  clearInvalidAuth: () => Promise<void>;
  isTokenExpired: () => boolean;
  shouldRefreshToken: () => boolean;

  // Permission checking methods
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (roleCode: string) => boolean;
  hasAnyRole: (roleCodes: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  tokenExpiresAt: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: (token) => {
    if (token === undefined) {
      console.warn('Attempted to set undefined token - ignoring');
      return;
    }
    set({ token });
  },

  setRefreshToken: (refreshToken) => {
    if (refreshToken === undefined) {
      console.warn('Attempted to set undefined refresh token - ignoring');
      return;
    }
    set({ refreshToken });
  },

  setTokenExpiresAt: (expiresAt) => {
    if (expiresAt === undefined) {
      console.warn('Attempted to set undefined token expires at - ignoring');
      return;
    }
    set({ tokenExpiresAt: expiresAt });
  },

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });

      const response = await authService.login(email, password);

      // Validate user data
      if (!response.user || !response.user.id) {
        throw new Error('Invalid user data received from server');
      }

      // Store in AsyncStorage
      await AsyncStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
      await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(response.user));
      await AsyncStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);

      const expiresAt = response.accessTokenExpiresIn
        ? Date.now() + (response.accessTokenExpiresIn * 1000)
        : null;

      if (expiresAt) {
        await AsyncStorage.setItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
      }

      set({
        user: response.user,
        token: response.accessToken,
        refreshToken: response.refreshToken,
        tokenExpiresAt: expiresAt,
        isAuthenticated: true,
        error: null,
        isLoading: false,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
      await get().clearInvalidAuth();
    } catch (error) {
      // Continue with local logout even if server call fails
      await get().clearInvalidAuth();
    }
  },

  updateUser: (userData) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, ...userData };
      set({ user: updatedUser });
      // Only save to AsyncStorage if we have a valid user object
      if (updatedUser && typeof updatedUser === 'object') {
        AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      }
    }
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  initAuth: async () => {
    try {
      set({ isLoading: true });
      const token = await AsyncStorage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      const refreshToken = await AsyncStorage.getItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      const userJson = await AsyncStorage.getItem(config.STORAGE_KEYS.USER);
      const tokenExpiresAtStr = await AsyncStorage.getItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);

      if (token && userJson) {
        const user = JSON.parse(userJson);
        const tokenExpiresAt = tokenExpiresAtStr ? parseInt(tokenExpiresAtStr, 10) : null;

        // Validate user data
        if (!user || !user.id || user.id === 'temp-id') {
          await AsyncStorage.removeItem(config.STORAGE_KEYS.AUTH_TOKEN);
          await AsyncStorage.removeItem(config.STORAGE_KEYS.REFRESH_TOKEN);
          await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);
          await AsyncStorage.removeItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
          set({ user: null, token: null, refreshToken: null, tokenExpiresAt: null, isAuthenticated: false });
          return;
        }

        // Check if token is expired
        if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
          // Token is expired, try to refresh
          if (refreshToken) {
            try {
              const refreshed = await get().refreshAccessToken();
              if (!refreshed) {
                // Refresh failed, clear auth
                await get().clearInvalidAuth();
                return;
              }
            } catch (error) {
              await get().clearInvalidAuth();
              return;
            }
          } else {
            // No refresh token, clear auth
            await get().clearInvalidAuth();
            return;
          }
        }

        set({ user, token, refreshToken, tokenExpiresAt, isAuthenticated: true });
      }
    } catch (error) {
      set({ error: 'Failed to initialize authentication' });
      // Clear potentially corrupted data
      await AsyncStorage.removeItem(config.STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
      set({ user: null, token: null, refreshToken: null, tokenExpiresAt: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshAccessToken: async () => {
    try {
      await authService.refreshToken();
      const newToken = authService.getAccessToken();

      if (newToken) {
        // Update store with new token from authService
        set({ token: newToken });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  },

  // Function to clear invalid auth data
  clearInvalidAuth: async () => {
    try {
      await AsyncStorage.removeItem(config.STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
      set({ user: null, token: null, refreshToken: null, tokenExpiresAt: null, isAuthenticated: false, error: null });
    } catch (error) {
      // Error clearing auth data - continuing anyway
    }
  },

  // Check if token is expired
  isTokenExpired: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) return false;
    return Date.now() >= tokenExpiresAt;
  },

  // Check if token should be refreshed (within 5 minutes of expiration)
  shouldRefreshToken: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) return false;
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() >= (tokenExpiresAt - fiveMinutes);
  },

  // Permission checking methods
  hasPermission: (permission: Permission) => {
    const { user } = get();
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  },

  hasAnyPermission: (permissions: Permission[]) => {
    const { user } = get();
    if (!user || !user.permissions) return false;
    return permissions.some(permission => user.permissions!.includes(permission));
  },

  hasAllPermissions: (permissions: Permission[]) => {
    const { user } = get();
    if (!user || !user.permissions) return false;
    return permissions.every(permission => user.permissions!.includes(permission));
  },

  hasRole: (roleCode: string) => {
    const { user } = get();
    if (!user || !user.roles) return false;
    return user.roles.some(role => role.code === roleCode);
  },

  hasAnyRole: (roleCodes: string[]) => {
    const { user } = get();
    if (!user || !user.roles) return false;
    return roleCodes.some(roleCode => user.roles!.some(role => role.code === roleCode));
  },
}));
