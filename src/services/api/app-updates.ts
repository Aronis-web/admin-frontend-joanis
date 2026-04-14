/**
 * Servicio API para verificar y descargar actualizaciones de la app
 */
import apiClient from './client';

// ============================================
// TYPES
// ============================================

export type Platform = 'android' | 'windows' | 'ios' | 'web';
export type AppId = 'erp-aio' | 'caja-frontend';

export interface CheckUpdateResponse {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  versionCode?: number;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  changelog?: string;
  isMandatory?: boolean;
  releaseDate?: string;
  message?: string;
}

export interface AppRelease {
  id: string;
  appId: string;
  platform: Platform;
  version: string;
  versionCode: number;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  changelog?: string;
  isMandatory: boolean;
  minSupportedVersion?: string;
  isActive: boolean;
  releaseDate: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API SERVICE
// ============================================

export const appUpdatesApi = {
  /**
   * Verificar si hay actualizaciones disponibles
   */
  checkForUpdates: async (
    appId: AppId,
    platform: Platform,
    currentVersion: string
  ): Promise<CheckUpdateResponse> => {
    const response = await apiClient.get<CheckUpdateResponse>('/app-updates/check', {
      params: {
        appId,
        platform,
        currentVersion,
      },
    });
    return response;
  },

  /**
   * Obtener información de la última versión
   */
  getLatestRelease: async (appId: AppId, platform: Platform): Promise<AppRelease> => {
    return apiClient.get<AppRelease>(`/app-updates/latest/${appId}/${platform}`);
  },

  /**
   * Obtener URL de descarga directa
   * Nota: El endpoint de descarga NO usa el prefijo /api
   */
  getDownloadUrl: (appId: AppId, platform: Platform, version: string): string => {
    let baseUrl = apiClient.defaults?.baseURL || '';
    // Remover el sufijo /api si existe, ya que el endpoint de descarga no lo usa
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.slice(0, -4);
    }
    return `${baseUrl}/app-updates/download/${appId}/${platform}/${version}`;
  },

  /**
   * Listar todas las versiones de una app
   */
  listReleases: async (appId: AppId, platform?: Platform): Promise<AppRelease[]> => {
    const params = platform ? { platform } : {};
    return apiClient.get<AppRelease[]>(`/app-updates/releases/${appId}`, { params });
  },
};

export default appUpdatesApi;
