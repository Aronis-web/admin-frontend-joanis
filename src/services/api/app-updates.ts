/**
 * Servicio API para verificar y descargar actualizaciones de la app
 */
import apiClient from './client';
import { config } from '@/utils/config';
import { DocumentPickerAsset } from '@/utils/filePicker';

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
    let baseUrl = config.API_URL || '';
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

  /**
   * Subir nueva versión de APK/EXE
   * POST /api/app-updates/releases/{appId}/{platform}/{version}/upload
   * Si la versión no existe, la crea automáticamente
   */
  uploadRelease: async (
    appId: AppId,
    platform: Platform,
    version: string,
    file: DocumentPickerAsset,
    onProgress?: (progress: number) => void
  ): Promise<AppRelease> => {
    const formData = new FormData();

    // Create the file object for FormData
    const fileUri = file.uri;
    const fileName = file.name || `app-${version}.${platform === 'android' ? 'apk' : 'exe'}`;
    const mimeType = file.mimeType || 'application/octet-stream';

    // Append file to FormData
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    // Simulate progress since we can't track real progress with fetch
    if (onProgress) {
      onProgress(10);
    }

    try {
      if (onProgress) {
        onProgress(30);
      }

      const response = await apiClient.post<AppRelease>(
        `/app-updates/releases/${appId}/${platform}/${version}/upload`,
        formData
      );

      if (onProgress) {
        onProgress(100);
      }

      return response;
    } catch (error) {
      if (onProgress) {
        onProgress(0);
      }
      throw error;
    }
  },
};

export default appUpdatesApi;
