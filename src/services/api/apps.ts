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
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions?: AppPermission[];
  scopes?: Scope[];
}

export interface Scope {
  id: string;
  appId: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  level?: 'COMPANY' | 'SITE' | 'WAREHOUSE' | 'AREA';
  canRead: boolean;
  canWrite: boolean;
  createdAt: string;
  updatedAt?: string;
  // Relaciones opcionales
  warehouse?: {
    id: string;
    name: string;
    siteId: string;
    createdAt?: string;
  };
  area?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface AppPermission {
  appId: string;
  permissionKey: string;
  description?: string;
  createdAt?: string;
}

export interface UserAppRole {
  userId: string;
  appId: string;
  roleId: string;
  assignedAt: string;
}

export interface AppUser {
  userId: string;
  username: string;
  email: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  assignedAt: string;
}

export interface UserRole {
  appId: string;
  appCode: string;
  appName: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  assignedAt: string;
}

// DTOs para crear/actualizar
export interface CreateAppDto {
  code: string;
  name: string;
  appType: AppType;
  description?: string;
  isActive?: boolean;
}

export interface UpdateAppDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateScopeDto {
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  level?: 'COMPANY' | 'SITE' | 'WAREHOUSE' | 'AREA';
  canRead?: boolean;
  canWrite?: boolean;
}

export interface CreateAppPermissionsDto {
  appId?: string; // Opcional para cuando se envía en la URL, pero el backend lo requiere en el body
  permissionKeys: string[];
}

export interface AssignUserRoleDto {
  userId: string;
  appId: string;
  roleId: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
}

export interface UpdateUserRoleDto {
  roleId?: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
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
  async getAppScopes(appId: string): Promise<Scope[]> {
    return apiClient.get<Scope[]>(`/apps/${appId}/scopes`);
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
  async getAppPermissions(appId: string): Promise<AppPermission[]> {
    return apiClient.get<AppPermission[]>(`/apps/${appId}/permissions`);
  },

  /**
   * 🆕 Definir permisos de una app (reemplaza los existentes)
   */
  async setAppPermissions(appId: string, permissionData: CreateAppPermissionsDto): Promise<{ created: AppPermission[] }> {
    // Incluir appId en el body como lo requiere el backend
    const requestData = {
      ...permissionData,
      appId,
    };
    return apiClient.post<{ created: AppPermission[] }>(`/apps/${appId}/permissions`, requestData);
  },
};

/**
 * API para gestión de Roles de Usuario en Apps
 */
export const userAppRolesApi = {
  /**
   * 📋 Ver roles de un usuario en todas las apps
   */
  async getUserRoles(userId: string, params?: { companyId?: string }): Promise<UserRole[]> {
    const queryParams = new URLSearchParams();
    if (params?.companyId) {
      queryParams.append('companyId', params.companyId);
    }
    const queryString = queryParams.toString();
    const url = `/apps/users/${userId}/roles${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<UserRole[]>(url);
  },

  /**
   * 📋 Listar usuarios de una app
   */
  async getAppUsers(appId: string): Promise<AppUser[]> {
    return apiClient.get<AppUser[]>(`/apps/${appId}/users`);
  },

  /**
   * 🆕 Asignar rol a usuario en una app con scope
   */
  async assignUserRole(roleData: AssignUserRoleDto): Promise<UserAppRole> {
    return apiClient.post<UserAppRole>('/apps/user-role', roleData);
  },

  /**
   * ✏️ Actualizar rol/scope de usuario en una app
   */
  async updateUserRole(userId: string, appId: string, updateData: UpdateUserRoleDto): Promise<UserAppRole> {
    return apiClient.patch<UserAppRole>(`/apps/users/${userId}/apps/${appId}`, updateData);
  },

  /**
   * 🗑️ Remover acceso de usuario a una app
   */
  async removeUserRole(userId: string, appId: string, params?: { companyId?: string; siteId?: string; warehouseId?: string }): Promise<void> {
    const queryParams = new URLSearchParams();
    if (params?.companyId) queryParams.append('companyId', params.companyId);
    if (params?.siteId) queryParams.append('siteId', params.siteId);
    if (params?.warehouseId) queryParams.append('warehouseId', params.warehouseId);
    const queryString = queryParams.toString();
    const url = `/apps/users/${userId}/apps/${appId}${queryString ? `?${queryString}` : ''}`;
    return apiClient.delete<void>(url);
  },
};

export default appsApi;
