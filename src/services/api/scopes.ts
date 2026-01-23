import { apiClient } from './client';

/**
 * API para gestión de Scopes (ámbitos de acceso)
 *
 * Basado en la documentación técnica del módulo Scopes:
 * - Gestión de Scopes (CRUD)
 * - Verificación de Acceso
 * - Obtención de Scopes de Usuarios
 * - Estadísticas
 * - Gestión de Caché
 * - Métricas
 */

// ==================== TYPES ====================

/**
 * Niveles de Scope
 */
export type ScopeLevel = 'COMPANY' | 'SITE' | 'WAREHOUSE' | 'AREA';

/**
 * Tipo de acceso
 */
export type AccessType = 'GLOBAL' | 'SPECIFIC' | 'NONE';

/**
 * Scope básico
 */
export interface Scope {
  id: string;
  appId: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  level: ScopeLevel;
  canRead: boolean;
  canWrite: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Scope con información jerárquica resuelta
 */
export interface ResolvedScope extends Scope {
  path: string;
  company_name?: string;
  site_name?: string;
  warehouse_name?: string;
  area_name?: string;
  company?: {
    id: string;
    name: string;
  };
  site?: {
    id: string;
    name: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  area?: {
    id: string;
    name: string;
  };
}

/**
 * DTO para crear un Scope
 */
export interface CreateScopeDto {
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  level?: ScopeLevel;
  canRead?: boolean;
  canWrite?: boolean;
}

/**
 * DTO para actualizar un Scope
 */
export interface UpdateScopeDto {
  canRead?: boolean;
  canWrite?: boolean;
}

/**
 * Parámetros para listar scopes
 */
export interface GetScopesParams {
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  level?: ScopeLevel;
  page?: number;
  limit?: number;
}

/**
 * Respuesta paginada de scopes
 */
export interface ScopesPaginatedResponse {
  items: Scope[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Target scope para verificación de acceso
 */
export interface TargetScope {
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  canRead?: boolean;
  canWrite?: boolean;
}

/**
 * Respuesta de verificación de acceso
 */
export interface CheckAccessResponse {
  hasAccess: boolean;
  accessType: AccessType;
  canRead: boolean;
  canWrite: boolean;
  scope?: {
    id: string;
    companyId?: string;
    siteId?: string;
    warehouseId?: string;
    areaId?: string;
    canRead: boolean;
    canWrite: boolean;
  };
}

/**
 * Estadísticas de scopes de una app
 */
export interface AppScopeStats {
  totalScopes: number;
  globalScopes: number;
  companyScopes: number;
  siteScopes: number;
  warehouseScopes: number;
  areaScopes: number;
  readWriteScopes: number;
  readOnlyScopes: number;
}

/**
 * Estadísticas del caché
 */
export interface CacheStats {
  size: number;
  ttl: number;
  keys: string[];
}

/**
 * Métricas del sistema de scopes
 */
export interface ScopesMetrics {
  cacheHits: number;
  cacheMisses: number;
  accessChecks: number;
  accessGranted: number;
  accessDenied: number;
  scopesCreated: number;
  scopesUpdated: number;
  scopesDeleted: number;
  cacheHitRate: number;
  denialRate: number;
}

/**
 * Scope de usuario
 */
export interface UserScope {
  id: string;
  userId: string;
  appId: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  level: ScopeLevel;
  canRead: boolean;
  canWrite: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO para asignar scope a usuario
 */
export interface AssignUserScopeDto {
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  level: ScopeLevel;
  canRead: boolean;
  canWrite: boolean;
}

/**
 * DTO para actualizar scope de usuario
 */
export interface UpdateUserScopeDto {
  canRead?: boolean;
  canWrite?: boolean;
}

/**
 * Respuesta paginada de user scopes
 */
export interface UserScopesPaginatedResponse {
  items: UserScope[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== API ====================

/**
 * API de gestión de Scopes
 */
export const scopesApi = {
  // ==================== GESTIÓN DE SCOPES ====================

  /**
   * 📋 Listar scopes de una app con filtros y paginación
   *
   * Endpoint: GET /scopes/apps/:appId
   *
   * @param appId - ID de la aplicación
   * @param params - Parámetros de filtro y paginación
   * @returns Lista paginada de scopes
   */
  async getAppScopes(appId: string, params?: GetScopesParams): Promise<ScopesPaginatedResponse> {
    const queryParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const queryString = queryParams.toString();
    const url = `/scopes/apps/${appId}${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<ScopesPaginatedResponse>(url);
  },

  /**
   * 🆕 Crear un scope para una app
   *
   * Endpoint: POST /scopes/apps/:appId
   *
   * @param appId - ID de la aplicación
   * @param scopeData - Datos del scope a crear
   * @returns Scope creado
   */
  async createScope(appId: string, scopeData: CreateScopeDto): Promise<Scope> {
    return apiClient.post<Scope>(`/scopes/apps/${appId}`, scopeData);
  },

  /**
   * 🔍 Obtener un scope por ID
   *
   * Endpoint: GET /scopes/:id
   *
   * @param scopeId - ID del scope
   * @returns Scope con información jerárquica
   */
  async getScopeById(scopeId: string): Promise<ResolvedScope> {
    return apiClient.get<ResolvedScope>(`/scopes/${scopeId}`);
  },

  /**
   * ✏️ Actualizar un scope existente
   *
   * Endpoint: PUT /scopes/:id
   *
   * @param scopeId - ID del scope
   * @param updates - Campos a actualizar
   * @returns Scope actualizado
   */
  async updateScope(scopeId: string, updates: UpdateScopeDto): Promise<Scope> {
    return apiClient.put<Scope>(`/scopes/${scopeId}`, updates);
  },

  /**
   * 🗑️ Eliminar un scope
   *
   * Endpoint: DELETE /scopes/:id
   *
   * @param scopeId - ID del scope
   */
  async deleteScope(scopeId: string): Promise<void> {
    return apiClient.delete<void>(`/scopes/${scopeId}`);
  },

  // ==================== VERIFICACIÓN DE ACCESO ====================

  /**
   * 🔍 Verificar si un usuario tiene acceso a un scope específico
   *
   * Endpoint: POST /scopes/check-access
   *
   * @param userId - ID del usuario
   * @param appId - ID de la aplicación
   * @param targetScope - Scope objetivo a verificar
   * @returns Información de acceso
   */
  async checkAccess(
    userId: string,
    appId: string,
    targetScope: TargetScope
  ): Promise<CheckAccessResponse> {
    return apiClient.post<CheckAccessResponse>('/scopes/check-access', {
      userId,
      appId,
      targetScope,
    });
  },

  // ==================== OBTENCIÓN DE SCOPES DE USUARIOS ====================

  /**
   * 📋 Obtener scopes resueltos de un usuario en una app
   *
   * Endpoint: GET /scopes/users/:userId/apps/:appId/resolved
   *
   * @param userId - ID del usuario
   * @param appId - ID de la aplicación
   * @returns Lista de scopes resueltos con información jerárquica
   */
  async getUserResolvedScopes(userId: string, appId: string): Promise<ResolvedScope[]> {
    return apiClient.get<ResolvedScope[]>(
      `/scopes/users/${userId}/apps/${appId}/resolved`
    );
  },

  // ==================== ESTADÍSTICAS ====================

  /**
   * 📊 Obtener estadísticas de scopes de una app
   *
   * Endpoint: GET /scopes/apps/:appId/stats
   *
   * @param appId - ID de la aplicación
   * @returns Estadísticas de scopes
   */
  async getAppScopeStats(appId: string): Promise<AppScopeStats> {
    return apiClient.get<AppScopeStats>(`/scopes/apps/${appId}/stats`);
  },

  // ==================== GESTIÓN DE CACHÉ ====================

  /**
   * 🗑️ Invalidar caché de usuario en una app
   *
   * Endpoint: DELETE /scopes/cache/users/:userId/apps/:appId
   *
   * @param userId - ID del usuario
   * @param appId - ID de la aplicación
   */
  async invalidateUserCache(userId: string, appId: string): Promise<void> {
    return apiClient.delete<void>(
      `/scopes/cache/users/${userId}/apps/${appId}`
    );
  },

  /**
   * 🗑️ Invalidar todo el caché de una app
   *
   * Endpoint: DELETE /scopes/cache/apps/:appId
   *
   * @param appId - ID de la aplicación
   */
  async invalidateAppCache(appId: string): Promise<void> {
    return apiClient.delete<void>(`/scopes/cache/apps/${appId}`);
  },

  /**
   * 📊 Obtener estadísticas del caché
   *
   * Endpoint: GET /scopes/cache/stats
   *
   * @returns Estadísticas del caché
   */
  async getCacheStats(): Promise<CacheStats> {
    return apiClient.get<CacheStats>('/scopes/cache/stats');
  },

  /**
   * 🗑️ Limpiar todo el caché
   *
   * Endpoint: DELETE /scopes/cache
   */
  async clearCache(): Promise<void> {
    return apiClient.delete<void>('/scopes/cache');
  },

  // ==================== MÉTRICAS ====================

  /**
   * 📊 Obtener métricas del sistema de scopes
   *
   * Endpoint: GET /scopes/metrics
   *
   * @returns Métricas de uso
   */
  async getMetrics(): Promise<ScopesMetrics> {
    return apiClient.get<ScopesMetrics>('/scopes/metrics');
  },

  /**
   * 🗑️ Reiniciar todas las métricas
   *
   * Endpoint: DELETE /scopes/metrics
   */
  async resetMetrics(): Promise<void> {
    return apiClient.delete<void>('/scopes/metrics');
  },

  // ==================== MÉTODOS DE CONVENIENCIA ====================

  /**
   * 🔍 Verificar acceso a nivel empresa
   */
  async checkCompanyAccess(
    userId: string,
    appId: string,
    companyId: string
  ): Promise<CheckAccessResponse> {
    return this.checkAccess(userId, appId, { companyId });
  },

  /**
   * 🔍 Verificar acceso a nivel sede
   */
  async checkSiteAccess(
    userId: string,
    appId: string,
    companyId: string,
    siteId: string
  ): Promise<CheckAccessResponse> {
    return this.checkAccess(userId, appId, { companyId, siteId });
  },

  /**
   * 🔍 Verificar acceso a nivel almacén
   */
  async checkWarehouseAccess(
    userId: string,
    appId: string,
    companyId: string,
    siteId: string,
    warehouseId: string
  ): Promise<CheckAccessResponse> {
    return this.checkAccess(userId, appId, { companyId, siteId, warehouseId });
  },

  /**
   * 🔍 Verificar acceso a nivel área
   */
  async checkAreaAccess(
    userId: string,
    appId: string,
    companyId: string,
    siteId: string,
    warehouseId: string,
    areaId: string
  ): Promise<CheckAccessResponse> {
    return this.checkAccess(userId, appId, {
      companyId,
      siteId,
      warehouseId,
      areaId,
    });
  },

  /**
   * 📊 Obtener el nivel de acceso más alto de un usuario
   */
  async getHighestAccessLevel(
    userId: string,
    appId: string
  ): Promise<ResolvedScope | null> {
    try {
      const scopes = await this.getUserResolvedScopes(userId, appId);

      if (scopes.length === 0) {
        return null;
      }

      // Ordenar por nivel de acceso (COMPANY > SITE > WAREHOUSE > AREA)
      const levelPriority: Record<ScopeLevel, number> = {
        'COMPANY': 0,
        'SITE': 1,
        'WAREHOUSE': 2,
        'AREA': 3,
      };

      const sortedScopes = scopes.sort((a, b) => {
        return levelPriority[a.level] - levelPriority[b.level];
      });

      return sortedScopes[0];
    } catch (error) {
      console.error('Error getting highest access level:', error);
      return null;
    }
  },

  // ==================== GESTIÓN DE SCOPES DE USUARIOS ====================

  /**
   * 🆕 Asignar un scope a un usuario en una app
   *
   * Endpoint: POST /scopes/users/:userId/apps/:appId
   *
   * @param userId - ID del usuario
   * @param appId - ID de la aplicación
   * @param scopeData - Datos del scope a asignar
   * @returns Scope de usuario creado
   */
  async assignUserScope(
    userId: string,
    appId: string,
    scopeData: AssignUserScopeDto
  ): Promise<UserScope> {
    return apiClient.post<UserScope>(
      `/scopes/users/${userId}/apps/${appId}`,
      scopeData
    );
  },

  /**
   * 📋 Obtener scopes de un usuario en una app
   *
   * Endpoint: GET /scopes/users/:userId/apps/:appId
   *
   * @param userId - ID del usuario
   * @param appId - ID de la aplicación
   * @param params - Parámetros de paginación
   * @returns Lista paginada de scopes de usuario
   */
  async getUserScopes(
    userId: string,
    appId: string,
    params?: { page?: number; limit?: number }
  ): Promise<UserScopesPaginatedResponse> {
    const queryParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const queryString = queryParams.toString();
    const url = `/scopes/users/${userId}/apps/${appId}${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<UserScopesPaginatedResponse>(url);
  },

  /**
   * ✏️ Actualizar un scope de usuario
   *
   * Endpoint: PUT /scopes/users/:userScopeId
   *
   * @param userScopeId - ID del scope de usuario
   * @param updates - Campos a actualizar
   * @returns Scope de usuario actualizado
   */
  async updateUserScope(
    userScopeId: string,
    updates: UpdateUserScopeDto
  ): Promise<UserScope> {
    return apiClient.put<UserScope>(
      `/scopes/users/${userScopeId}`,
      updates
    );
  },

  /**
   * 🗑️ Revocar un scope de usuario
   *
   * Endpoint: DELETE /scopes/users/:userScopeId
   *
   * @param userScopeId - ID del scope de usuario
   */
  async revokeUserScope(userScopeId: string): Promise<void> {
    return apiClient.delete<void>(`/scopes/users/${userScopeId}`);
  },
};

export default scopesApi;
