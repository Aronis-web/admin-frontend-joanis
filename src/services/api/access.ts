import { apiClient } from './client';

/**
 * API para validación de acceso y scopes
 *
 * Implementa los endpoints de validación mencionados en la documentación:
 * - GET /access/check-scope - Verificar si un usuario tiene acceso a un scope específico
 * - GET /access/users/:userId/scopes/:appId - Listar scopes accesibles de un usuario
 */

/**
 * Parámetros para verificar acceso a un scope
 */
export interface CheckScopeParams {
  userId: string;
  appId: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
}

/**
 * Respuesta de verificación de scope
 */
export interface CheckScopeResponse {
  hasAccess: boolean;
  message?: string;
  scope?: {
    companyId?: string;
    siteId?: string;
    warehouseId?: string;
    areaId?: string;
    level: 'GLOBAL' | 'COMPANY' | 'SITE' | 'WAREHOUSE' | 'AREA';
  };
}

/**
 * Scope accesible de un usuario
 */
export interface UserAccessibleScope {
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  level: 'GLOBAL' | 'COMPANY' | 'SITE' | 'WAREHOUSE' | 'AREA';
  canRead: boolean;
  canWrite: boolean;
}

/**
 * Respuesta de scopes de usuario
 */
export interface UserScopesResponse {
  userId: string;
  appId: string;
  scopes: UserAccessibleScope[];
}

/**
 * API de validación de acceso
 */
export const accessApi = {
  /**
   * 🔍 Verificar si un usuario tiene acceso a un scope específico
   *
   * Endpoint: GET /access/check-scope
   *
   * Ejemplo de uso:
   * ```typescript
   * const result = await accessApi.checkScope({
   *   userId: 'user-123',
   *   appId: 'app-caja',
   *   siteId: 'sede-lima'
   * });
   *
   * if (result.hasAccess) {
   *   console.log('Usuario tiene acceso');
   * }
   * ```
   */
  async checkScope(params: CheckScopeParams): Promise<CheckScopeResponse> {
    const queryParams = new URLSearchParams();

    // Agregar parámetros no nulos
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });

    const queryString = queryParams.toString();
    const url = `/access/check-scope${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<CheckScopeResponse>(url);
  },

  /**
   * 📋 Listar todos los scopes accesibles de un usuario en una app
   *
   * Endpoint: GET /access/users/:userId/scopes/:appId
   *
   * Ejemplo de uso:
   * ```typescript
   * const scopes = await accessApi.getUserScopes('user-123', 'app-admin');
   * console.log('Scopes del usuario:', scopes.scopes);
   * ```
   */
  async getUserScopes(userId: string, appId: string): Promise<UserScopesResponse> {
    return apiClient.get<UserScopesResponse>(`/access/users/${userId}/scopes/${appId}`);
  },

  /**
   * 🔍 Verificar acceso a una empresa específica
   *
   * Atajo para verificar acceso a nivel de empresa
   */
  async checkCompanyAccess(userId: string, appId: string, companyId: string): Promise<boolean> {
    try {
      const result = await this.checkScope({ userId, appId, companyId });
      return result.hasAccess;
    } catch (error) {
      console.error('Error checking company access:', error);
      return false;
    }
  },

  /**
   * 🔍 Verificar acceso a una sede específica
   *
   * Atajo para verificar acceso a nivel de sede
   */
  async checkSiteAccess(
    userId: string,
    appId: string,
    companyId: string,
    siteId: string
  ): Promise<boolean> {
    try {
      const result = await this.checkScope({ userId, appId, companyId, siteId });
      return result.hasAccess;
    } catch (error) {
      console.error('Error checking site access:', error);
      return false;
    }
  },

  /**
   * 🔍 Verificar acceso a un almacén específico
   *
   * Atajo para verificar acceso a nivel de almacén
   */
  async checkWarehouseAccess(
    userId: string,
    appId: string,
    companyId: string,
    siteId: string,
    warehouseId: string
  ): Promise<boolean> {
    try {
      const result = await this.checkScope({ userId, appId, companyId, siteId, warehouseId });
      return result.hasAccess;
    } catch (error) {
      console.error('Error checking warehouse access:', error);
      return false;
    }
  },

  /**
   * 🔍 Verificar acceso a un área específica
   *
   * Atajo para verificar acceso a nivel de área
   */
  async checkAreaAccess(
    userId: string,
    appId: string,
    companyId: string,
    siteId: string,
    warehouseId: string,
    areaId: string
  ): Promise<boolean> {
    try {
      const result = await this.checkScope({
        userId,
        appId,
        companyId,
        siteId,
        warehouseId,
        areaId,
      });
      return result.hasAccess;
    } catch (error) {
      console.error('Error checking area access:', error);
      return false;
    }
  },

  /**
   * 📊 Obtener el nivel de acceso más alto de un usuario en una app
   *
   * Retorna el scope más amplio que tiene el usuario
   */
  async getHighestAccessLevel(userId: string, appId: string): Promise<UserAccessibleScope | null> {
    try {
      const response = await this.getUserScopes(userId, appId);

      if (response.scopes.length === 0) {
        return null;
      }

      // Ordenar por nivel de acceso (GLOBAL > COMPANY > SITE > WAREHOUSE > AREA)
      const levelPriority = {
        'GLOBAL': 0,
        'COMPANY': 1,
        'SITE': 2,
        'WAREHOUSE': 3,
        'AREA': 4,
      };

      const sortedScopes = response.scopes.sort((a, b) => {
        return levelPriority[a.level] - levelPriority[b.level];
      });

      return sortedScopes[0];
    } catch (error) {
      console.error('Error getting highest access level:', error);
      return null;
    }
  },
};

export default accessApi;
