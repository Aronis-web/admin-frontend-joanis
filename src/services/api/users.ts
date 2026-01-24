import { apiClient } from './client';

export interface User {
  id: string;
  username?: string;
  name?: string;
  email: string;
  phone?: string;
  avatar?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  roles?: Array<{ id: string; name: string }>;
  permissions?: Array<{ key: string; name: string }>;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive';

  // Worker Profile Fields
  document_type?: 'DNI' | 'CE' | 'PASAPORTE';
  document_number?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'OTRO';
  nationality?: string;
  marital_status?: 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'CONVIVIENTE';
  address?: string;
  ubigeo?: string;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  photo_url?: string;
  epp_size?: string;
}

export interface UsersResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Backend response structure (what the API actually returns)
interface BackendUsersResponse {
  users: User[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Backend CreateUserDto structure
export interface CreateUserRequest {
  username: string; // Required - unique
  email: string; // Required - unique, email format
  password: string; // Required - minimum 6 characters
  first_name?: string; // Optional
  last_name?: string; // Optional
  is_active?: boolean; // Optional - default: true
  roleIds?: string[]; // Optional - Array of role UUIDs
  roleCodes?: string[]; // Optional - Array of role codes (e.g., ['ADMIN', 'USER'])

  // Worker Profile Fields (all optional)
  document_type?: 'DNI' | 'CE' | 'PASAPORTE';
  document_number?: string;
  birth_date?: string; // ISO 8601 format (YYYY-MM-DD)
  gender?: 'M' | 'F' | 'OTRO';
  nationality?: string;
  marital_status?: 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'CONVIVIENTE';
  address?: string;
  ubigeo?: string;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  photo_url?: string;
  epp_size?: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  roleIds?: string[]; // Optional - Array of role UUIDs (replaces all existing roles)
  roleCodes?: string[]; // Optional - Array of role codes (replaces all existing roles)
  password?: string; // Optional - For changing password

  // Worker Profile Fields (all optional)
  document_type?: 'DNI' | 'CE' | 'PASAPORTE';
  document_number?: string;
  birth_date?: string; // ISO 8601 format (YYYY-MM-DD)
  gender?: 'M' | 'F' | 'OTRO';
  nationality?: string;
  marital_status?: 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'CONVIVIENTE';
  address?: string;
  ubigeo?: string;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  photo_url?: string;
  epp_size?: string;
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
  status?: 'active' | 'inactive';
  roleId?: string;
}

export const usersApi = {
  /**
   * Get users with pagination and filtering
   */
  async getUsers(params: GetUsersParams = {}): Promise<UsersResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      search,
      status,
      roleId,
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    if (search) {
      queryParams.append('search', search);
    }

    if (status) {
      queryParams.append('status', status);
    }

    if (roleId) {
      queryParams.append('roleId', roleId);
    }

    const queryString = queryParams.toString();
    const url = `/users${queryString ? `?${queryString}` : ''}`;

    // Get the backend response and transform it to match our expected structure
    const backendResponse = await apiClient.get<BackendUsersResponse>(url);

    return {
      data: backendResponse.users || [],
      pagination: {
        page: backendResponse.page,
        limit: backendResponse.limit,
        total: backendResponse.total,
        totalPages: backendResponse.totalPages,
      },
    };
  },

  /**
   * Get a single user by ID
   */
  async getUserById(id: string): Promise<User> {
    return apiClient.get<User>(`/users/${id}`);
  },

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    return apiClient.post<User>('/users', userData);
  },

  /**
   * Update an existing user
   */
  async updateUser(id: string, userData: UpdateUserRequest): Promise<User> {
    return apiClient.put<User>(`/users/${id}`, userData);
  },

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<void> {
    return apiClient.delete<void>(`/users/${id}`);
  },

  /**
   * Update user status (activate/deactivate)
   */
  async updateUserStatus(id: string, status: 'active' | 'inactive'): Promise<User> {
    return apiClient.patch<User>(`/users/${id}/status`, { status });
  },

  /**
   * Change user password
   */
  async changeUserPassword(id: string, newPassword: string): Promise<void> {
    return apiClient.post<void>(`/users/${id}/change-password`, {
      password: newPassword,
    });
  },

  /**
   * Get user roles
   */
  async getUserRoles(id: string): Promise<Array<{ id: string; name: string }>> {
    return apiClient.get<Array<{ id: string; name: string }>>(`/users/${id}/roles`);
  },

  /**
   * Assign roles to user
   */
  async assignUserRoles(id: string, roleIds: string[]): Promise<void> {
    return apiClient.post<void>(`/users/${id}/roles`, { roleIds });
  },

  /**
   * Remove roles from user
   */
  async removeUserRoles(id: string, roleIds: string[]): Promise<void> {
    return apiClient.delete<void>(`/users/${id}/roles`, { data: { roleIds } });
  },

  /**
   * Get user permissions
   */
  async getUserPermissions(id: string): Promise<Array<{ key: string; name: string }>> {
    return apiClient.get<Array<{ key: string; name: string }>>(`/users/${id}/permissions`);
  },

  /**
   * Get user effective permissions (including inherited from roles)
   */
  async getUserEffectivePermissions(id: string): Promise<Array<{ key: string; name: string }>> {
    return apiClient.get<Array<{ key: string; name: string }>>(
      `/users/${id}/effective-permissions`
    );
  },
};

export default usersApi;
