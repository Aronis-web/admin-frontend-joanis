// Authentication types based on the API guide

export interface Role {
  id: string;
  code: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  roles: Role[];
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken?: string; // Optional for web (cookie-based), required for mobile
}

export interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export interface AuthError {
  code: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'NETWORK_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER_ERROR';
  message: string;
  status?: number;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Permission checking utilities
export type Permission = string;

export interface PermissionCheck {
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (roleCode: string) => boolean;
  hasAnyRole: (roleCodes: string[]) => boolean;
}

// API Response types
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request headers for authenticated requests
export interface AuthHeaders {
  'Content-Type': 'application/json';
  'Authorization': `Bearer ${string}`;
  'X-App-Id': string;
}