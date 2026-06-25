/**
 * Servicio API para gestión de versiones de apps cliente (APK / EXE / IPA)
 *
 * Endpoints servidos por svc-admin bajo `/api/app-updates/*`.
 * Para failover de lectura/descarga (app POS), están duplicados en svc-pos bajo
 * `/api/pos/app-updates/*` — usar `usePosMirror: true` en los métodos públicos.
 */
import apiClient from './client';
import { config } from '@/utils/config';
import { DocumentPickerAsset } from '@/utils/filePicker';

// ============================================
// TYPES
// ============================================

export type Platform = 'android' | 'windows' | 'ios' | 'web';

/**
 * Identificador de app. Es un string libre — agregar una app nueva no requiere
 * migración en backend. Estos son los appIds sugeridos / usados actualmente.
 */
export type AppId =
  | 'erp-aio'
  | 'caja-frontend'
  | 'admin'
  | 'pos'
  | 'biometric-reader'
  | (string & {});

export const APP_IDS = {
  ERP_AIO: 'erp-aio',
  CAJA_FRONTEND: 'caja-frontend',
  ADMIN: 'admin',
  POS: 'pos',
  BIOMETRIC_READER: 'biometric-reader',
} as const;

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
  downloadUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  changelog?: string | null;
  isMandatory: boolean;
  minSupportedVersion?: string | null;
  isActive: boolean;
  releaseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReleaseDto {
  appId: string;
  platform: Platform;
  version: string;
  versionCode?: number;
  changelog?: string;
  isMandatory?: boolean;
  minSupportedVersion?: string;
  releaseDate?: string;
}

export interface UpdateReleaseDto {
  changelog?: string;
  isMandatory?: boolean;
  isActive?: boolean;
  minSupportedVersion?: string;
}

export interface DeleteReleaseResponse {
  deleted: boolean;
  id: string;
  fileRemoved: boolean;
}

export interface ReadOptions {
  /**
   * Si es true, usa el mirror público servido por svc-pos
   * (`/api/pos/app-updates/*`). Útil para que la app POS siga
   * pudiendo verificar/descargar updates si svc-admin está caído.
   */
  usePosMirror?: boolean;
}

// ============================================
// HELPERS
// ============================================

const ADMIN_PREFIX = '/app-updates';
const POS_PREFIX = '/pos/app-updates';

const readPrefix = (opts?: ReadOptions): string =>
  opts?.usePosMirror ? POS_PREFIX : ADMIN_PREFIX;

// ============================================
// API SERVICE
// ============================================

export const appUpdatesApi = {
  /**
   * GET /check — Verificar si hay actualización disponible
   */
  checkForUpdates: async (
    appId: AppId,
    platform: Platform,
    currentVersion: string,
    opts?: ReadOptions
  ): Promise<CheckUpdateResponse> => {
    return apiClient.get<CheckUpdateResponse>(`${readPrefix(opts)}/check`, {
      params: { appId, platform, currentVersion },
    });
  },

  /**
   * GET /latest — Última versión activa de cada (appId, platform)
   */
  getLatestAll: async (opts?: ReadOptions): Promise<AppRelease[]> => {
    return apiClient.get<AppRelease[]>(`${readPrefix(opts)}/latest`);
  },

  /**
   * GET /latest/:appId/:platform — Última versión activa de una app
   */
  getLatestRelease: async (
    appId: AppId,
    platform: Platform,
    opts?: ReadOptions
  ): Promise<AppRelease> => {
    return apiClient.get<AppRelease>(`${readPrefix(opts)}/latest/${appId}/${platform}`);
  },

  /**
   * GET /releases/:appId — Listar todas las versiones (activas + inactivas) de una app,
   * ordenadas por versionCode DESC.
   */
  listReleases: async (
    appId: AppId,
    platform?: Platform,
    opts?: ReadOptions
  ): Promise<AppRelease[]> => {
    const params = platform ? { platform } : undefined;
    return apiClient.get<AppRelease[]>(`${readPrefix(opts)}/releases/${appId}`, { params });
  },

  /**
   * Construye la URL absoluta del endpoint público de descarga.
   * Útil para `<a href>` en web o pasar a DownloadResumable en nativo.
   */
  getDownloadUrl: (
    appId: AppId,
    platform: Platform,
    version: string,
    opts?: ReadOptions
  ): string => {
    const baseUrl = (config.API_URL || '').replace(/\/$/, '');
    return `${baseUrl}${readPrefix(opts)}/download/${appId}/${platform}/${version}`;
  },

  /**
   * POST /releases — Crear release solo con metadatos (sin archivo).
   * Requiere permiso `app_releases.upload`.
   */
  createRelease: async (dto: CreateReleaseDto): Promise<AppRelease> => {
    return apiClient.post<AppRelease>(`${ADMIN_PREFIX}/releases`, dto);
  },

  /**
   * POST /releases/:appId/:platform/:version/upload — Subir APK/EXE/IPA.
   * Si la versión no existe, la crea automáticamente. Requiere `app_releases.upload`.
   */
  uploadRelease: async (
    appId: AppId,
    platform: Platform,
    version: string,
    file: DocumentPickerAsset,
    onProgress?: (progress: number) => void
  ): Promise<AppRelease> => {
    const formData = new FormData();

    const fileUri = file.uri;
    const fileName = file.name || `app-${version}.${platform === 'android' ? 'apk' : 'exe'}`;
    const mimeType = file.mimeType || 'application/octet-stream';

    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    if (onProgress) onProgress(10);

    try {
      if (onProgress) onProgress(30);

      const response = await apiClient.post<AppRelease>(
        `${ADMIN_PREFIX}/releases/${appId}/${platform}/${version}/upload`,
        formData
      );

      if (onProgress) onProgress(100);

      return response;
    } catch (error) {
      if (onProgress) onProgress(0);
      throw error;
    }
  },

  /**
   * PATCH /releases/:id — Editar metadatos del release (changelog / flags).
   * No reemplaza el archivo. Requiere `app_releases.upload`.
   */
  updateRelease: async (id: string, dto: UpdateReleaseDto): Promise<AppRelease> => {
    return apiClient.patch<AppRelease>(`${ADMIN_PREFIX}/releases/${id}`, dto);
  },

  /**
   * PATCH /releases/:id/deactivate — Soft delete (isActive=false).
   * Conserva el archivo y el registro. Requiere `app_releases.delete`.
   */
  deactivateRelease: async (id: string): Promise<AppRelease> => {
    return apiClient.patch<AppRelease>(`${ADMIN_PREFIX}/releases/${id}/deactivate`);
  },

  /**
   * DELETE /releases/:id — Hard delete: borra el registro y el archivo físico.
   * Operación irreversible. Requiere `app_releases.delete`.
   */
  deleteRelease: async (id: string): Promise<DeleteReleaseResponse> => {
    return apiClient.delete<DeleteReleaseResponse>(`${ADMIN_PREFIX}/releases/${id}`);
  },
};

export default appUpdatesApi;
