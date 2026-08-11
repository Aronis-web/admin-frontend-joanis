import { apiClient } from './client';
import { config } from '@/utils/config';
import { downloadWithAuth } from '@/utils/downloadWithAuth';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import type {
  ApiEnvelope,
  CreateDriveFolderDto,
  CreateDriveShareDto,
  CreateDriveSpaceDto,
  DriveAffectedResponse,
  DriveChildrenParams,
  DriveNode,
  DriveNodeWithBreadcrumb,
  DrivePermanentDeleteResponse,
  DriveShare,
  DriveSharedWithMeItem,
  DriveSpace,
  DriveSpaceUsage,
  DriveVersion,
  MoveDriveNodeDto,
  RenameDriveNodeDto,
  UpdateDriveSpaceDto,
} from '@/types/drive';

/** Desempaca el envoltorio { success, data } del backend, devolviendo `data`. */
const unwrap = <T>(res: ApiEnvelope<T>): T => res.data;

// ============================================================================
// Progreso de subida
// ============================================================================

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0..1 */
  ratio: number;
}

export interface UploadOptions {
  onProgress?: (p: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Sube un archivo con multipart/form-data via XHR (para reportar progreso real).
 * Usamos XHR porque `fetch` no expone upload progress cross-platform, y axios
 * tiene inconsistencias en RN/web con boundaries. Este helper replica los
 * mismos headers que `apiClient` (auth + tenant + app).
 */
const uploadFile = <T>(
  path: string,
  file: Blob | File | { uri: string; name: string; type: string },
  filename: string | undefined,
  { onProgress, signal }: UploadOptions = {}
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();
    const token = authStore.token;
    if (!token) {
      reject(new Error('No authentication token available'));
      return;
    }

    const form = new FormData();
    // En React Native el archivo es un objeto { uri, name, type }
    // En web es un Blob/File — FormData ya lo maneja
    if (
      file &&
      typeof file === 'object' &&
      'uri' in file &&
      typeof (file as { uri?: unknown }).uri === 'string'
    ) {
      form.append('file', file as unknown as Blob);
    } else if (file instanceof Blob) {
      form.append('file', file, filename ?? (file as File).name ?? 'archivo');
    } else {
      form.append('file', file as unknown as Blob, filename);
    }

    const url = `${config.API_URL}${path}`;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('X-App-Id', config.APP_ID);
    xhr.setRequestHeader('X-App-Version', config.APP_VERSION);
    if (authStore.user?.id) xhr.setRequestHeader('X-User-Id', authStore.user.id);
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;
    const warehouseId = tenantStore.selectedWarehouse?.id;
    if (companyId) xhr.setRequestHeader('X-Company-Id', companyId);
    if (siteId) xhr.setRequestHeader('X-Site-Id', siteId);
    if (warehouseId) xhr.setRequestHeader('X-Warehouse-Id', warehouseId);

    // NO seteamos Content-Type: el browser/RN pondrá el boundary correcto.

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        onProgress({
          loaded: evt.loaded,
          total: evt.total,
          ratio: evt.total > 0 ? evt.loaded / evt.total : 0,
        });
      };
    }

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.onload = () => {
      const status = xhr.status;
      let parsed: unknown;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = xhr.responseText;
      }
      if (status >= 200 && status < 300) {
        // El backend envuelve en { success, data }
        const envelope = parsed as ApiEnvelope<T> | null;
        if (envelope && typeof envelope === 'object' && 'data' in envelope) {
          resolve(envelope.data);
        } else {
          resolve(parsed as T);
        }
      } else {
        const err = new Error(
          (parsed && typeof parsed === 'object' && 'message' in parsed
            ? String((parsed as { message: unknown }).message)
            : `HTTP ${status}`) || `HTTP ${status}`
        ) as Error & { status?: number; body?: unknown };
        err.status = status;
        err.body = parsed;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Network error durante la subida'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));

    xhr.send(form as unknown as Document);
  });
};

/**
 * Descarga el contenido de un nodo como Blob usando el token de auth.
 * Aprovecha `downloadWithAuth` (soporta refresh automático al 401).
 */
const downloadNodeBlob = async (
  nodeId: string,
  opts: { disposition?: 'inline' | 'attachment'; range?: string } = {}
): Promise<Blob> => {
  const params = new URLSearchParams();
  if (opts.disposition) params.set('disposition', opts.disposition);
  const qs = params.toString();
  const url = `${config.API_URL}/drive/nodes/${nodeId}/content${qs ? `?${qs}` : ''}`;
  const requestInit: RequestInit = opts.range ? { headers: { Range: opts.range } } : {};
  return downloadWithAuth(url, requestInit);
};

// ============================================================================
// API
// ============================================================================

export const driveApi = {
  // -------------------- Espacios --------------------

  listSpaces: async (): Promise<DriveSpace[]> => {
    const res = await apiClient.get<ApiEnvelope<DriveSpace[]>>('/drive/spaces');
    return unwrap(res);
  },

  createSpace: async (dto: CreateDriveSpaceDto): Promise<DriveSpace> => {
    const res = await apiClient.post<ApiEnvelope<DriveSpace>>('/drive/spaces', dto);
    return unwrap(res);
  },

  updateSpace: async (id: string, dto: UpdateDriveSpaceDto): Promise<DriveSpace> => {
    const res = await apiClient.patch<ApiEnvelope<DriveSpace>>(`/drive/spaces/${id}`, dto);
    return unwrap(res);
  },

  getSpaceUsage: async (id: string): Promise<DriveSpaceUsage> => {
    const res = await apiClient.get<ApiEnvelope<DriveSpaceUsage>>(`/drive/spaces/${id}/usage`);
    return unwrap(res);
  },

  // -------------------- Navegación --------------------

  listSpaceChildren: async (
    spaceId: string,
    params: DriveChildrenParams = {}
  ): Promise<DriveNode[]> => {
    const res = await apiClient.get<ApiEnvelope<DriveNode[]>>(`/drive/spaces/${spaceId}/children`, {
      params: { includeTrashed: params.includeTrashed || undefined },
    });
    return unwrap(res);
  },

  listFolderChildren: async (
    folderId: string,
    params: DriveChildrenParams = {}
  ): Promise<DriveNode[]> => {
    const res = await apiClient.get<ApiEnvelope<DriveNode[]>>(
      `/drive/folders/${folderId}/children`,
      { params: { includeTrashed: params.includeTrashed || undefined } }
    );
    return unwrap(res);
  },

  getNode: async (nodeId: string): Promise<DriveNodeWithBreadcrumb> => {
    const res = await apiClient.get<ApiEnvelope<DriveNodeWithBreadcrumb>>(`/drive/nodes/${nodeId}`);
    return unwrap(res);
  },

  // -------------------- Carpetas --------------------

  createFolder: async (dto: CreateDriveFolderDto): Promise<DriveNode> => {
    const res = await apiClient.post<ApiEnvelope<DriveNode>>('/drive/folders', dto);
    return unwrap(res);
  },

  renameNode: async (nodeId: string, dto: RenameDriveNodeDto): Promise<DriveNode> => {
    const res = await apiClient.patch<ApiEnvelope<DriveNode>>(`/drive/nodes/${nodeId}/rename`, dto);
    return unwrap(res);
  },

  moveNode: async (nodeId: string, dto: MoveDriveNodeDto): Promise<DriveNode> => {
    const res = await apiClient.patch<ApiEnvelope<DriveNode>>(`/drive/nodes/${nodeId}/move`, dto);
    return unwrap(res);
  },

  // -------------------- Archivos: subida --------------------

  uploadToSpace: (
    spaceId: string,
    file: Blob | File | { uri: string; name: string; type: string },
    filename?: string,
    options?: UploadOptions
  ): Promise<DriveNode> =>
    uploadFile<DriveNode>(`/drive/spaces/${spaceId}/files`, file, filename, options),

  uploadToFolder: (
    folderId: string,
    file: Blob | File | { uri: string; name: string; type: string },
    filename?: string,
    options?: UploadOptions
  ): Promise<DriveNode> =>
    uploadFile<DriveNode>(`/drive/folders/${folderId}/files`, file, filename, options),

  uploadNewVersion: (
    nodeId: string,
    file: Blob | File | { uri: string; name: string; type: string },
    filename?: string,
    options?: UploadOptions
  ): Promise<DriveNode> =>
    uploadFile<DriveNode>(`/drive/nodes/${nodeId}/versions`, file, filename, options),

  // -------------------- Archivos: descarga / preview --------------------

  /** Descarga (o previsualiza) el contenido de un archivo como Blob. */
  downloadNode: (
    nodeId: string,
    opts?: { disposition?: 'inline' | 'attachment'; range?: string }
  ): Promise<Blob> => downloadNodeBlob(nodeId, opts),

  /** URL cruda del endpoint de contenido (sin token; usar solo con proxy). */
  getContentUrl: (nodeId: string, disposition: 'inline' | 'attachment' = 'inline'): string =>
    `${config.API_URL}/drive/nodes/${nodeId}/content?disposition=${disposition}`,

  // -------------------- Versiones --------------------

  listVersions: async (nodeId: string): Promise<DriveVersion[]> => {
    const res = await apiClient.get<ApiEnvelope<DriveVersion[]>>(`/drive/nodes/${nodeId}/versions`);
    return unwrap(res);
  },

  restoreVersion: async (nodeId: string, versionId: string): Promise<DriveNode> => {
    const res = await apiClient.post<ApiEnvelope<DriveNode>>(
      `/drive/nodes/${nodeId}/versions/${versionId}/restore`
    );
    return unwrap(res);
  },

  // -------------------- Papelera --------------------

  trashNode: async (nodeId: string): Promise<DriveAffectedResponse> => {
    const res = await apiClient.delete<ApiEnvelope<DriveAffectedResponse>>(
      `/drive/nodes/${nodeId}`
    );
    return unwrap(res);
  },

  listTrash: async (spaceId: string): Promise<DriveNode[]> => {
    const res = await apiClient.get<ApiEnvelope<DriveNode[]>>(`/drive/spaces/${spaceId}/trash`);
    return unwrap(res);
  },

  restoreNode: async (nodeId: string): Promise<DriveAffectedResponse> => {
    const res = await apiClient.post<ApiEnvelope<DriveAffectedResponse>>(
      `/drive/nodes/${nodeId}/restore`
    );
    return unwrap(res);
  },

  permanentDeleteNode: async (nodeId: string): Promise<DrivePermanentDeleteResponse> => {
    const res = await apiClient.delete<ApiEnvelope<DrivePermanentDeleteResponse>>(
      `/drive/nodes/${nodeId}/permanent`
    );
    return unwrap(res);
  },

  // -------------------- Compartir --------------------

  createShare: async (nodeId: string, dto: CreateDriveShareDto): Promise<DriveShare> => {
    const res = await apiClient.post<ApiEnvelope<DriveShare>>(`/drive/nodes/${nodeId}/shares`, dto);
    return unwrap(res);
  },

  listShares: async (nodeId: string): Promise<DriveShare[]> => {
    const res = await apiClient.get<ApiEnvelope<DriveShare[]>>(`/drive/nodes/${nodeId}/shares`);
    return unwrap(res);
  },

  revokeShare: async (shareId: string): Promise<{ revoked: boolean }> => {
    const res = await apiClient.delete<ApiEnvelope<{ revoked: boolean }>>(
      `/drive/shares/${shareId}`
    );
    return unwrap(res);
  },

  listSharedWithMe: async (): Promise<DriveSharedWithMeItem[]> => {
    const res = await apiClient.get<ApiEnvelope<DriveSharedWithMeItem[]>>('/drive/shared-with-me');
    return unwrap(res);
  },
};

export default driveApi;
