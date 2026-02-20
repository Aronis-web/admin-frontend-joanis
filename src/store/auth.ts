import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { config } from '@/utils/config';
import secureStorage from '@/utils/secureStorage';
import { authService } from '@/services/AuthService';
import { PermissionCheck, Permission } from '@/types/auth';
import type { User, Role } from '@/types/auth';
import { Company } from '@/types/companies';
import { setSentryUser, clearSentryUser } from '@/config/sentry';

export interface CurrentCompany {
  id: string;
  name: string;
  alias?: string;
  ruc?: string;
  isActive: boolean;
}

export interface CurrentSite {
  id: string;
  code: string;
  name: string;
  companyId: string;
}

interface AuthState extends PermissionCheck {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  currentCompany: CurrentCompany | null;
  currentSite: CurrentSite | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setTokenExpiresAt: (expiresAt: number | null) => void;
  setCurrentCompany: (company: CurrentCompany | null) => void;
  setCurrentSite: (site: CurrentSite | null) => void;
  login: (user: User, accessToken: string) => Promise<void>;
  loginWithCredentials: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  initAuth: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  clearInvalidAuth: (showSessionExpiredMessage?: boolean) => Promise<void>;
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
  currentCompany: null,
  currentSite: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setCurrentCompany: (company) => {
    console.log('🔧 setCurrentCompany called with:', company);
    set({ currentCompany: company });
    console.log('✅ Store updated with currentCompany');
  },

  setCurrentSite: (site) => {
    console.log('🔧 setCurrentSite called with:', site);
    set({ currentSite: site });
    console.log('✅ Store updated with currentSite');
  },

  setToken: (token) => {
    if (token === undefined) {
      console.warn('Attempted to set undefined token - ignoring');
      return;
    }
    set({ token });
    // Sync with AuthService
    authService.setAccessToken(token);
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

  login: async (user, accessToken) => {
    try {
      console.log(
        '🔐 Store login called with user:',
        user?.id,
        'token length:',
        accessToken?.length
      );

      // Validate user data
      if (!user || !user.id) {
        console.error('❌ Store validation failed - user:', user);
        throw new Error('Invalid user data');
      }

      // Ensure permissions array exists (even if empty)
      if (!user.permissions) {
        user.permissions = [];
      }

      // Ensure roles array exists (even if empty)
      if (!user.roles) {
        user.roles = [];
      }

      console.log('💾 Storing user in secure storage...');
      // Store sensitive data in secure storage (encrypted)
      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, accessToken);
      // Store non-sensitive user data in AsyncStorage
      await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(user));

      // Sync with AuthService
      authService.setAccessToken(accessToken);

      console.log('✅ Setting auth state...');
      set({
        user: user as any,
        token: accessToken,
        isAuthenticated: true,
        error: null,
      });

      // Set Sentry user context
      setSentryUser({
        id: user.id,
        email: user.email,
        username: user.name,
      });

      console.log('✅ Login completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      console.error('❌ Login error in store:', errorMessage, error);
      throw error;
    }
  },

  loginWithCredentials: async (email, password, rememberMe = false) => {
    try {
      set({ isLoading: true, error: null });

      const response = await authService.login(email, password);

      // Validate user data
      if (!response.user || !response.user.id) {
        throw new Error('Invalid user data received from server');
      }

      // Ensure permissions array exists (even if empty)
      if (!response.user.permissions) {
        response.user.permissions = [];
      }

      // Ensure roles array exists (even if empty)
      if (!response.user.roles) {
        response.user.roles = [];
      }

      console.log('Login successful - User permissions:', response.user.permissions);
      console.log('Login successful - User roles:', response.user.roles);
      console.log('🔐 Remember Me:', rememberMe);

      // Clear any previous company/site selection
      await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_COMPANY);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_SITE);

      // Store sensitive data in secure storage (encrypted)
      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
      await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
      await secureStorage.setItem(config.STORAGE_KEYS.REMEMBER_ME, rememberMe ? 'true' : 'false');

      // Calculate token expiration
      // If rememberMe is true, extend the session to 30 days
      // Otherwise, use the server-provided expiration
      let expiresAt: number | null = null;
      if (rememberMe) {
        // 30 days in milliseconds
        expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
        console.log('🔐 Extended session enabled: 30 days');
      } else if (response.accessTokenExpiresIn) {
        expiresAt = Date.now() + response.accessTokenExpiresIn * 1000;
      }

      if (expiresAt) {
        await secureStorage.setItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
      }

      // Store non-sensitive user data in AsyncStorage
      await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(response.user));

      // IMPORTANT: Sync token with AuthService so API requests include Authorization header
      // AuthService already has the token from the login call, but we ensure it's synced
      authService.setAccessToken(response.accessToken);
      console.log('🔐 Token synced with AuthService after login');

      set({
        user: response.user as any,
        token: response.accessToken,
        refreshToken: response.refreshToken,
        tokenExpiresAt: expiresAt,
        isAuthenticated: true,
        error: null,
        isLoading: false,
        currentCompany: null,
        currentSite: null,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      console.error('Login error:', errorMessage);
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
    // Clear company and site selection
    set({ currentCompany: null, currentSite: null });
    await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_COMPANY);
    await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_SITE);

    // Clear Sentry user context
    clearSentryUser();
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
      console.log('🔐 Starting auth initialization...');

      // Restore sensitive data from secure storage
      const token = await secureStorage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      const refreshToken = await secureStorage.getItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      const tokenExpiresAtStr = await secureStorage.getItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);

      // Restore non-sensitive data from AsyncStorage
      const userJson = await AsyncStorage.getItem(config.STORAGE_KEYS.USER);
      const companyJson = await AsyncStorage.getItem(config.STORAGE_KEYS.CURRENT_COMPANY);
      const siteJson = await AsyncStorage.getItem(config.STORAGE_KEYS.CURRENT_SITE);

      console.log('📦 Loaded data from storage:', {
        hasToken: !!token,
        hasRefreshToken: !!refreshToken,
        hasUser: !!userJson,
        hasCompany: !!companyJson,
        hasSite: !!siteJson,
      });

      if (token && userJson) {
        let user;
        try {
          user = JSON.parse(userJson);
        } catch (parseError) {
          console.error('❌ Failed to parse user JSON:', parseError);
          await get().clearInvalidAuth();
          return;
        }

        const tokenExpiresAt = tokenExpiresAtStr ? parseInt(tokenExpiresAtStr, 10) : null;

        // Validate user data
        if (!user || !user.id || user.id === 'temp-id') {
          console.warn('⚠️ Invalid user data, clearing auth');
          await get().clearInvalidAuth();
          return;
        }

        // Check if token is expired
        let currentToken = token;
        let tokenWasRefreshed = false;
        if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
          console.log('⏰ Token expired, attempting refresh...');
          // Token is expired, try to refresh
          if (refreshToken) {
            try {
              const refreshed = await get().refreshAccessToken();
              if (!refreshed) {
                // Refresh failed, clear auth and show message
                console.warn('⚠️ Token refresh failed, clearing auth');
                await get().clearInvalidAuth(true);
                return;
              }
              console.log('✅ Token refreshed successfully');
              tokenWasRefreshed = true;
              // Get the new token from authService after refresh
              const newToken = authService.getAccessToken();
              if (newToken) {
                currentToken = newToken;
              } else {
                console.error('❌ No token available after refresh');
                await get().clearInvalidAuth(true);
                return;
              }
            } catch (error) {
              console.error('❌ Token refresh error:', error);
              await get().clearInvalidAuth(true);
              return;
            }
          } else {
            // No refresh token, clear auth
            console.warn('⚠️ No refresh token, clearing auth');
            await get().clearInvalidAuth();
            return;
          }
        }

        // Load company and site if available
        let currentCompany = null;
        let currentSite = null;

        try {
          currentCompany = companyJson ? JSON.parse(companyJson) : null;
          currentSite = siteJson ? JSON.parse(siteJson) : null;
        } catch (parseError) {
          console.error('❌ Failed to parse company/site JSON:', parseError);
          // Continue without company/site
        }

        // IMPORTANT: Sync token with AuthService so API requests use the correct token
        // Only sync if token was NOT refreshed (refresh already syncs with authService)
        if (!tokenWasRefreshed) {
          authService.setAccessToken(currentToken);
          console.log('🔐 Token synced with AuthService after init');
        } else {
          console.log('🔐 Token already synced with AuthService after refresh');
        }

        set({
          user,
          token: currentToken,
          refreshToken,
          tokenExpiresAt,
          isAuthenticated: true,
          currentCompany,
          currentSite,
        });
        console.log('✅ Auth initialized successfully');
      } else {
        console.log('ℹ️ No stored auth data found');
      }
    } catch (error) {
      console.error('❌ Auth initialization error:', error);
      set({ error: 'Failed to initialize authentication' });
      // Clear potentially corrupted data
      await get().clearInvalidAuth();
    } finally {
      set({ isLoading: false });
      console.log('🏁 Auth initialization completed');
    }
  },

  refreshAccessToken: async () => {
    try {
      const refreshResponse = await authService.refreshToken();
      const newToken = authService.getAccessToken();

      if (newToken) {
        // Check if "Remember Me" is enabled
        const rememberMeStr = await secureStorage.getItem(config.STORAGE_KEYS.REMEMBER_ME);
        const rememberMe = rememberMeStr === 'true';

        // Calculate new expiration time
        let expiresAt: number | null = null;
        if (rememberMe) {
          // If "Remember Me" is enabled, extend session to 30 days from now
          expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
          console.log('🔐 Token refreshed with extended session (30 days)');
        } else if (refreshResponse.accessTokenExpiresIn) {
          // Use server-provided expiration
          expiresAt = Date.now() + refreshResponse.accessTokenExpiresIn * 1000;
          console.log('🔐 Token refreshed with standard expiration');
        }

        // Update expiration in storage
        if (expiresAt) {
          await secureStorage.setItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
        }

        // Update store with new token and expiration
        set({
          token: newToken,
          tokenExpiresAt: expiresAt,
        });
        console.log('✅ Token refreshed and synced with store');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  },

  // Function to clear invalid auth data
  clearInvalidAuth: async (showSessionExpiredMessage = false) => {
    try {
      // Show friendly message if session expired
      if (showSessionExpiredMessage) {
        // Use setTimeout to ensure Alert is shown after navigation completes
        setTimeout(() => {
          Alert.alert(
            'Sesión Expirada',
            'Tu sesión ha expirado por seguridad. Por favor, inicia sesión nuevamente.',
            [{ text: 'Entendido', style: 'default' }]
          );
        }, 500);
      }

      // Clear sensitive data from secure storage
      await secureStorage.deleteItem(config.STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
      await secureStorage.deleteItem(config.STORAGE_KEYS.REMEMBER_ME);

      // Clear non-sensitive data from AsyncStorage
      await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_COMPANY);
      await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_SITE);
      set({
        user: null,
        token: null,
        refreshToken: null,
        tokenExpiresAt: null,
        isAuthenticated: false,
        error: null,
        currentCompany: null,
        currentSite: null,
      });
      // Clear AuthService token
      authService.setAccessToken(null);
    } catch (error) {
      // Error clearing auth data - continuing anyway
    }
  },

  // Check if token is expired
  isTokenExpired: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) {
      return false;
    }
    return Date.now() >= tokenExpiresAt;
  },

  // Check if token should be refreshed (within 5 minutes of expiration)
  shouldRefreshToken: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) {
      return false;
    }
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() >= tokenExpiresAt - fiveMinutes;
  },

  // Permission checking methods
  hasPermission: (permission: Permission) => {
    const { user } = get();
    if (!user || !user.permissions) {
      return false;
    }
    return user.permissions.includes(permission);
  },

  hasAnyPermission: (permissions: Permission[]) => {
    const { user } = get();
    if (!user || !user.permissions) {
      return false;
    }
    return permissions.some((permission) => user.permissions!.includes(permission));
  },

  hasAllPermissions: (permissions: Permission[]) => {
    const { user } = get();
    if (!user || !user.permissions) {
      return false;
    }
    return permissions.every((permission) => user.permissions!.includes(permission));
  },

  hasRole: (roleCode: string) => {
    const { user } = get();
    if (!user || !user.roles) {
      return false;
    }
    return user.roles.some((role) => role.code === roleCode);
  },

  hasAnyRole: (roleCodes: string[]) => {
    const { user } = get();
    if (!user || !user.roles) {
      return false;
    }
    return roleCodes.some((roleCode) => user.roles!.some((role) => role.code === roleCode));
  },
}));
