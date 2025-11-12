import { apiClient } from './client';
import { User } from '@/store/auth';

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
    return apiClient.post<AuthResponse>('/auth/login', credentials);
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
    return apiClient.get<User>('/auth/me');
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
