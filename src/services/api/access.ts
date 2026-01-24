import { apiClient } from './client';
import { scopesApi, CheckAccessResponse, ResolvedScope } from './scopes';

/**
 * API para validación de acceso y scopes
 *
 * Implementa los endpoints de validación mencionados en la documentación:
 * - POST /scopes/check-access - Verificar si un usuario tiene acceso a un scope específico
 * - GET /scopes/users/:userId/apps/:appId/resolved - Listar scopes accesibles de un usuario
 *
 * Esta API ahora utiliza el módulo de scopes como base.
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
  canRead?: boolean;
  canWrite?: boolean;
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
   * Endpoint: POST /scopes/check-access
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
  async checkScope(params: CheckScopeParams): Promise<CheckAccessResponse> {
    const {
      userId,
      appId,
      companyId,
      siteId,
      warehouseId,
      areaId,
      canRead = true,
      canWrite = false,
    } = params;

    return scopesApi.checkAccess(userId, appId, {
      companyId,
      siteId,
      warehouseId,
      areaId,
      canRead,
      canWrite,
    });
  },

  /**
   * 📋 Listar todos los scopes accesibles de un usuario en una app
   *
   * Endpoint: GET /scopes/users/:userId/apps/:appId/resolved
   *
   * Ejemplo de uso:
   * ```typescript
   * const scopes = await accessApi.getUserScopes('user-123', 'app-admin');
   * console.log('Scopes del usuario:', scopes.scopes);
   * ```
   */
  async getUserScopes(userId: string, appId: string): Promise<UserScopesResponse> {
    const resolvedScopes = await scopesApi.getUserResolvedScopes(userId, appId);

    // Convertir ResolvedScope a UserAccessibleScope
    const scopes: UserAccessibleScope[] = resolvedScopes.map((scope) => ({
      companyId: scope.companyId,
      siteId: scope.siteId,
      warehouseId: scope.warehouseId,
      areaId: scope.areaId,
      level: scope.level as any,
      canRead: scope.canRead,
      canWrite: scope.canWrite,
    }));

    return {
      userId,
      appId,
      scopes,
    };
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
      const levelPriority: Record<string, number> = {
        GLOBAL: 0,
        COMPANY: 1,
        SITE: 2,
        WAREHOUSE: 3,
        AREA: 4,
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
