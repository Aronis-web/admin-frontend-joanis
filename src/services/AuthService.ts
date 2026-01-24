import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import secureStorage from '@/utils/secureStorage';
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  User,
  AuthError,
  AuthErrorData,
} from '@/types/auth';

/**
 * AuthService - Handles all authentication operations
 * Based on the authentication guide provided
 */
class AuthService {
  private readonly appId = config.APP_ID;
  private readonly baseUrl = config.API_URL;
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor() {
    this.restoreAuth();
  }

  /**
   * Login with email and password
   * POST /auth/login
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Id': this.appId,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createAuthError(response.status, errorData.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();

      // If user doesn't have permissions, fetch them
      if (data.user && (!data.user.permissions || data.user.permissions.length === 0)) {
        try {
          console.log('Fetching user permissions after login...');
          const permissionsResponse = await fetch(
            `${this.baseUrl}/iam/users/${data.user.id}/effective-permissions`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.accessToken}`,
                'X-App-Id': this.appId,
              },
            }
          );

          if (permissionsResponse.ok) {
            const permissions = await permissionsResponse.json();
            if (Array.isArray(permissions)) {
              data.user.permissions = permissions;
              console.log('User permissions loaded:', permissions.length, 'permissions');
            }
          } else {
            console.warn('Failed to fetch permissions:', permissionsResponse.status);
            data.user.permissions = [];
          }
        } catch (permError) {
          console.warn('Error fetching permissions during login:', permError);
          data.user.permissions = [];
        }
      }

      // Store tokens and user data
      await this.storeAuthData(data);

      return data;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw this.createAuthError(0, 'Network error during login');
    }
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      const headers: Record<string, string> = {
        'X-App-Id': this.appId,
      };

      // For mobile, send refresh token in body
      // For web, it would be sent automatically in cookie
      if (this.refreshTokenValue) {
        headers['Content-Type'] = 'application/json';
      }

      const body = this.refreshTokenValue
        ? JSON.stringify({ refreshToken: this.refreshTokenValue })
        : undefined;

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createAuthError(response.status, errorData.message || 'Token refresh failed');
      }

      const data: RefreshTokenResponse = await response.json();

      // Update stored tokens
      await this.updateTokens(data);

      return data;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw this.createAuthError(0, 'Network error during token refresh');
    }
  }

  /**
   * Logout user
   * POST /auth/logout
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint (best effort)
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'X-App-Id': this.appId,
        },
      });
    } catch (error) {
      // Continue with local logout even if server call fails
      console.warn('Logout endpoint call failed:', error);
    } finally {
      // Clear local storage
      await this.clearAuthData();
    }
  }

  /**
   * Make authenticated request to protected endpoint
   */
  async makeAuthenticatedRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          'X-App-Id': this.appId,
          ...options.headers,
        },
      });

      if (response.status === 401) {
        // Token expired, try to refresh
        try {
          await this.refreshToken();
          // Retry the request with new token
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.accessToken}`,
              'X-App-Id': this.appId,
              ...options.headers,
            },
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            throw this.createAuthError(retryResponse.status, errorData.message || 'Request failed');
          }

          return await retryResponse.json();
        } catch (refreshError) {
          // Refresh failed, clear auth and throw error
          await this.clearAuthData();
          throw this.createAuthError(401, 'Authentication failed');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createAuthError(response.status, errorData.message || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw this.createAuthError(0, 'Network error during request');
    }
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Manually set access token (for syncing with auth store)
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
    console.log('🔐 AuthService: Token manually set, length:', token?.length);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken && !this.isTokenExpired();
  }

  /**
   * Check if token should be refreshed
   */
  shouldRefreshToken(): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() >= this.tokenExpiresAt - fiveMinutes;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }
    return Date.now() >= this.tokenExpiresAt;
  }

  /**
   * Store authentication data
   */
  private async storeAuthData(data: LoginResponse): Promise<void> {
    this.accessToken = data.accessToken;
    this.refreshTokenValue = data.refreshToken;
    this.tokenExpiresAt = data.accessTokenExpiresIn
      ? Date.now() + data.accessTokenExpiresIn * 1000
      : null;

    console.log('🔐 AuthService: Storing auth data, token length:', this.accessToken?.length);

    try {
      // Store sensitive data in secure storage (encrypted)
      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, data.accessToken);
      await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      if (this.tokenExpiresAt) {
        await secureStorage.setItem(
          config.STORAGE_KEYS.TOKEN_EXPIRES_AT,
          this.tokenExpiresAt.toString()
        );
      }

      // Store non-sensitive user data in AsyncStorage
      await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(data.user));
    } catch (error) {
      console.error('Failed to store auth data:', error);
    }
  }

  /**
   * Update tokens after refresh
   */
  private async updateTokens(data: RefreshTokenResponse): Promise<void> {
    this.accessToken = data.accessToken;
    this.refreshTokenValue = data.refreshToken;
    this.tokenExpiresAt = data.accessTokenExpiresIn
      ? Date.now() + data.accessTokenExpiresIn * 1000
      : null;

    try {
      // Store sensitive data in secure storage (encrypted)
      await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, data.accessToken);
      if (data.refreshToken) {
        await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      }
      if (this.tokenExpiresAt) {
        await secureStorage.setItem(
          config.STORAGE_KEYS.TOKEN_EXPIRES_AT,
          this.tokenExpiresAt.toString()
        );
      }
    } catch (error) {
      console.error('Failed to update tokens:', error);
    }
  }

  /**
   * Clear authentication data
   */
  private async clearAuthData(): Promise<void> {
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.tokenExpiresAt = null;

    try {
      // Clear sensitive data from secure storage
      await secureStorage.deleteItem(config.STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      await secureStorage.deleteItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);

      // Clear non-sensitive data from AsyncStorage
      await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  }

  /**
   * Restore authentication from storage
   */
  private async restoreAuth(): Promise<void> {
    try {
      // Restore sensitive data from secure storage
      const token = await secureStorage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      const refreshToken = await secureStorage.getItem(config.STORAGE_KEYS.REFRESH_TOKEN);
      const tokenExpiresAtStr = await secureStorage.getItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);

      console.log('🔐 AuthService: Restoring auth from storage, has token:', !!token);

      if (token) {
        this.accessToken = token;
        this.refreshTokenValue = refreshToken;
        this.tokenExpiresAt = tokenExpiresAtStr ? parseInt(tokenExpiresAtStr, 10) : null;

        console.log('🔐 AuthService: Token restored, length:', this.accessToken?.length);

        // Check if token is expired and refresh if needed
        if (this.isTokenExpired() && this.refreshTokenValue) {
          try {
            console.log('🔐 AuthService: Token expired, attempting refresh...');
            await this.refreshToken();
          } catch (error) {
            // Refresh failed, clear auth
            console.error('🔐 AuthService: Token refresh failed, clearing auth:', error);
            await this.clearAuthData();
          }
        }
      } else {
        console.log('🔐 AuthService: No token found in storage');
      }
    } catch (error) {
      console.error('Failed to restore auth:', error);
      await this.clearAuthData();
    }
  }

  /**
   * Create standardized auth error
   */
  private createAuthError(status: number, message: string): AuthError {
    let code: AuthErrorData['code'] = 'SERVER_ERROR';

    switch (status) {
      case 400:
        code = 'INVALID_CREDENTIALS';
        break;
      case 401:
        code = message.toLowerCase().includes('expired') ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        break;
      case 403:
        code = 'FORBIDDEN';
        break;
      case 0:
        code = 'NETWORK_ERROR';
        break;
    }

    return new AuthError(code, message, status);
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
