import { apiClient } from './client';
import type { User } from '@/types/auth';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);

    // If user doesn't have permissions array, fetch them
    if (response.user && (!response.user.permissions || response.user.permissions.length === 0)) {
      try {
        // Import userPermissionsApi to get effective permissions
        const { userPermissionsApi } = await import('./roles');
        const effectivePermissions = await userPermissionsApi.getUserEffectivePermissions(
          response.user.id
        );

        // Add permissions to user object
        response.user.permissions = effectivePermissions;
      } catch (error) {
        console.warn('Failed to fetch user permissions during login:', error);
        // Set empty array to avoid undefined
        response.user.permissions = [];
      }
    }

    return response;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>('/auth/register', data);
  },

  logout: async (): Promise<void> => {
    return apiClient.post<void>('/auth/logout');
  },

  refreshToken: async (): Promise<RefreshTokenResponse> => {
    return apiClient.post<RefreshTokenResponse>('/auth/refresh');
  },

  getCurrentUser: async (): Promise<User> => {
    console.log('Testing /auth/me endpoint with current token...');
    const user = await apiClient.get<User>('/auth/me');

    // If user doesn't have permissions array, fetch them
    if (user && (!user.permissions || user.permissions.length === 0)) {
      try {
        // Import userPermissionsApi to get effective permissions
        const { userPermissionsApi } = await import('./roles');
        const effectivePermissions = await userPermissionsApi.getUserEffectivePermissions(user.id);

        // Add permissions to user object
        user.permissions = effectivePermissions;
      } catch (error) {
        console.warn('Failed to fetch user permissions for current user:', error);
        // Set empty array to avoid undefined
        user.permissions = [];
      }
    }

    return user;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    return apiClient.put<User>('/auth/profile', data);
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    return apiClient.post<void>('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  },

  resetPassword: async (email: string): Promise<void> => {
    return apiClient.post<void>('/auth/reset-password', { email });
  },

  verifyEmail: async (token: string): Promise<void> => {
    return apiClient.post<void>('/auth/verify-email', { token });
  },
};

export default authApi;
