import { apiClient } from './client';

// Enum para tipos de apps
export enum AppType {
  SALES = 'SALES',
  POS = 'POS',
  ADMIN = 'ADMIN',
  INTERNAL = 'INTERNAL',
}

// Interfaces principales
export interface App {
  id: string;
  code: string;
  name: string;
  appType: AppType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Scope {
  id: string;
  name: string;
  description?: string;
  appId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppPermission {
  id: string;
  key: string;
  name: string;
  description?: string;
  appId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserAppRole {
  id: string;
  userId: string;
  appId: string;
  roleId: string;
  createdAt: string;
  updatedAt: string;
}

// DTOs para crear/actualizar
export interface CreateAppDto {
  code: string;
  name: string;
  appType: AppType;
  isActive?: boolean;
}

export interface UpdateAppDto {
  name?: string;
  appType?: AppType;
  isActive?: boolean;
}

export interface CreateScopeDto {
  name: string;
  description?: string;
}

export interface CreateAppPermissionDto {
  key: string;
  name: string;
  description?: string;
}

export interface AssignUserRoleDto {
  userId: string;
  appId: string;
  roleId: string;
}

// Respuestas paginadas
export interface AppsResponse {
  data: App[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ScopesResponse {
  data: Scope[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PermissionsResponse {
  data: AppPermission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Parámetros de consulta
export interface GetAppsParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
  appType?: AppType;
  isActive?: boolean;
}

export interface GetScopesParams {
  page?: number;
  limit?: number;
}

export interface GetPermissionsParams {
  page?: number;
  limit?: number;
}

/**
 * API para gestión de Apps
 */
export const appsApi = {
  /**
   * 📋 Listar todas las apps con filtros opcionales
   */
  async getApps(params: GetAppsParams = {}): Promise<AppsResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      appType,
      isActive,
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

    if (appType) {
      queryParams.append('appType', appType);
    }

    if (isActive !== undefined) {
      queryParams.append('isActive', isActive.toString());
    }

    const queryString = queryParams.toString();
    const url = `/apps${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<any>(url);

    // Si la respuesta es un array simple (sin paginación), crear estructura de paginación
    if (Array.isArray(response)) {
      return {
        data: response,
        pagination: {
          page: 1,
          limit: response.length,
          total: response.length,
          totalPages: 1,
        },
      };
    }

    // Si la respuesta tiene data pero no pagination, crear paginación por defecto
    if (response.data && !response.pagination) {
      return {
        data: response.data,
        pagination: {
          page: 1,
          limit: response.data.length,
          total: response.data.length,
          totalPages: 1,
        },
      };
    }

    // Si la respuesta ya tiene la estructura correcta
    return response as AppsResponse;
  },

  /**
   * 🔍 Obtener app por ID
   */
  async getAppById(id: string): Promise<App> {
    return apiClient.get<App>(`/apps/${id}`);
  },

  /**
   * 🔍 Obtener app por código
   */
  async getAppByCode(code: string): Promise<App> {
    return apiClient.get<App>(`/apps/code/${code}`);
  },

  /**
   * 🆕 Crear una nueva app
   */
  async createApp(appData: CreateAppDto): Promise<App> {
    return apiClient.post<App>('/apps', appData);
  },

  /**
   * ✏️ Actualizar una app existente
   */
  async updateApp(id: string, appData: UpdateAppDto): Promise<App> {
    return apiClient.patch<App>(`/apps/${id}`, appData);
  },

  /**
   * 🗑️ Eliminar una app
   */
  async deleteApp(id: string): Promise<void> {
    return apiClient.delete<void>(`/apps/${id}`);
  },
};

/**
 * API para gestión de Scopes (ámbitos de acceso)
 */
export const scopesApi = {
  /**
   * 📋 Listar scopes de una app
   */
  async getAppScopes(appId: string, params: GetScopesParams = {}): Promise<ScopesResponse> {
    const { page = 1, limit = 20 } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const queryString = queryParams.toString();
    const url = `/apps/${appId}/scopes${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<ScopesResponse>(url);
  },

  /**
   * 🆕 Crear scope para una app
   */
  async createScope(appId: string, scopeData: CreateScopeDto): Promise<Scope> {
    return apiClient.post<Scope>(`/apps/${appId}/scopes`, scopeData);
  },

  /**
   * 🗑️ Eliminar un scope
   */
  async deleteScope(scopeId: string): Promise<void> {
    return apiClient.delete<void>(`/apps/scopes/${scopeId}`);
  },
};

/**
 * API para gestión de Permisos de Apps
 */
export const appPermissionsApi = {
  /**
   * 📋 Listar permisos de una app
   */
  async getAppPermissions(appId: string, params: GetPermissionsParams = {}): Promise<PermissionsResponse> {
    const { page = 1, limit = 20 } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const queryString = queryParams.toString();
    const url = `/apps/${appId}/permissions${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PermissionsResponse>(url);
  },

  /**
   * 🆕 Configurar permisos de una app
   */
  async createPermission(appId: string, permissionData: CreateAppPermissionDto): Promise<AppPermission> {
    return apiClient.post<AppPermission>(`/apps/${appId}/permissions`, permissionData);
  },
};

/**
 * API para gestión de Roles de Usuario en Apps
 */
export const userAppRolesApi = {
  /**
   * 📋 Ver roles de un usuario
   */
  async getUserRoles(userId: string): Promise<UserAppRole[]> {
    return apiClient.get<UserAppRole[]>(`/apps/users/${userId}/roles`);
  },

  /**
   * 🆕 Asignar rol a usuario en una app
   */
  async assignUserRole(roleData: AssignUserRoleDto): Promise<UserAppRole> {
    return apiClient.post<UserAppRole>('/apps/user-role', roleData);
  },

  /**
   * 🗑️ Remover rol de usuario
   */
  async removeUserRole(userId: string, appId: string): Promise<void> {
    return apiClient.delete<void>(`/apps/users/${userId}/apps/${appId}`);
  },
};

export default appsApi;
