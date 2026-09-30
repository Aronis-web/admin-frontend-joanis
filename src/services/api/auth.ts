import { apiClient } from './client';
import type { User } from '@/types/auth';

export interface LoginRequest {
  email: string;
  password: string;
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

  logout: async (): Promise<void> => {
    return apiClient.post<void>('/auth/logout');
  },

  refreshToken: async (): Promise<RefreshTokenResponse> => {
    return apiClient.post<RefreshTokenResponse>('/auth/refresh');
  },

  getCurrentUser: async (): Promise<User> => {
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

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    // El backend (ChangePasswordDto) espera { currentPassword, newPassword }.
    return apiClient.post<void>('/auth/change-password', {
      currentPassword: oldPassword,
      newPassword,
    });
  },
};

export default authApi;
