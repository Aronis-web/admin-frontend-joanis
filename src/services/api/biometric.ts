import { apiClient } from './client';

export interface BiometricProfile {
  id: string;
  entity_type: string;
  entity_id: string;
  is_active: boolean;
  registration_quality: string | number;
  registration_frames_count: number;
  liveness_score_at_registration: string | number;
  registered_at: string;
  created_at: string;
  updated_at: string | null;
  hasEmbeddings?: boolean;
  embeddingsCount?: number;
  embedding_version?: string;
  version?: number;
}

export interface ListProfilesResponse {
  success: boolean;
  profiles: BiometricProfile[];
  total: number;
  limit: number;
  offset: number;
}

export interface RegisterBiometricRequest {
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}

export interface RegisterBiometricResponse {
  success: boolean;
  biometricProfileId: string;
  qualityScore: number;
  livenessScore: number;
  message: string;
}

export interface RegisterFromVideoRequest {
  entityType: 'user';
  userId: string;
  metadata?: Record<string, any>;
}

export interface RegisterFromVideoResponse {
  success: boolean;
  entityId: string;
  biometricProfileId: string;
  qualityScore: number;
  livenessScore: number;
  framesExtracted: number;
  framesUsed: number;
  videoDurationSeconds: number;
  processingTimeMs: number;
  message: string;
}

export interface VerifyBiometricRequest {
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}

export interface VerifyBiometricResponse {
  success: boolean;
  verified: boolean;
  livenessScore: number;
  similarityScore: number;
  confidence: number;
  message: string;
  failureReason?: string;
}

export interface IdentifyBiometricRequest {
  entityType: string;
  metadata?: Record<string, any>;
}

export interface IdentifyBiometricResponse {
  success: boolean;
  identified: boolean;
  entityId?: string;
  livenessScore: number;
  similarityScore?: number;
  confidence: number;
  message: string;
  failureReason?: string;
}

export interface BiometricLog {
  id: string;
  profileId: string;
  operationType: 'register' | 'verify' | 'identify' | 'liveness_check';
  verificationSuccess: boolean;
  livenessScore: number;
  similarityScore: number;
  confidenceScore: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export const biometricApi = {
  /**
   * Registrar un nuevo perfil biométrico
   * POST /api/biometric-verification/register
   */
  async registerBiometric(
    frames: string[],
    request: RegisterBiometricRequest
  ): Promise<RegisterBiometricResponse> {
    const formData = new FormData();

    // Agregar frames como archivos en formato React Native
    frames.forEach((frameBase64, index) => {
      // React Native FormData espera objetos con uri, type, y name
      const file = {
        uri: frameBase64, // URI base64 completa con prefijo data:image/jpeg;base64,
        type: 'image/jpeg',
        name: `frame-${index}.jpg`,
      } as any;

      formData.append('frames', file);
    });

    // Agregar datos del request
    formData.append('entityType', request.entityType);
    formData.append('entityId', request.entityId);

    // Metadata como campos individuales (el backend espera un objeto, no JSON string)
    if (request.metadata) {
      Object.entries(request.metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(`metadata[${key}]`, String(value));
        }
      });
    }

    return apiClient.post<RegisterBiometricResponse>(
      '/biometric-verification/register',
      formData
    );
  },

  /**
   * Registrar perfil biométrico desde video
   * POST /api/biometric-verification/register-from-video
   */
  async registerFromVideo(
    video: { uri: string; type: string; name: string },
    request: RegisterFromVideoRequest
  ): Promise<RegisterFromVideoResponse> {
    const formData = new FormData();

    // Determinar el tipo MIME correcto basado en la extensión
    let mimeType = video.type;
    if (video.uri.endsWith('.mp4')) {
      mimeType = 'video/mp4';
    } else if (video.uri.endsWith('.webm')) {
      mimeType = 'video/webm';
    } else if (video.uri.endsWith('.mov')) {
      mimeType = 'video/quicktime';
    }

    // Agregar video como archivo (formato React Native)
    const videoFile = {
      uri: video.uri,
      type: mimeType,
      name: video.name || 'registro.mp4',
    } as any;

    console.log('📹 Video file to upload:', {
      uri: video.uri,
      type: mimeType,
      name: videoFile.name,
    });

    formData.append('video', videoFile);

    // Agregar datos del request
    formData.append('entityType', request.entityType);
    formData.append('userId', request.userId);

    // Metadata como JSON si existe
    if (request.metadata) {
      formData.append('metadata', JSON.stringify(request.metadata));
    }

    console.log('📤 Sending FormData with video to register-from-video endpoint');

    return apiClient.post<RegisterFromVideoResponse>(
      '/biometric-verification/register-from-video',
      formData
    );
  },

  /**
   * Verificar identidad contra un perfil específico (1:1)
   * POST /api/biometric-verification/verify
   */
  async verifyBiometric(
    frames: string[],
    request: VerifyBiometricRequest
  ): Promise<VerifyBiometricResponse> {
    const formData = new FormData();

    // Convertir base64 a blobs y agregar como archivos
    frames.forEach((frameBase64, index) => {
      const file = {
        uri: frameBase64,
        type: 'image/jpeg',
        name: `frame-${index}.jpg`,
      } as any;
      formData.append('frames', file);
    });

    // Agregar datos del request
    formData.append('entityType', request.entityType);
    formData.append('entityId', request.entityId);

    // Metadata como campos individuales
    if (request.metadata) {
      Object.entries(request.metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(`metadata[${key}]`, String(value));
        }
      });
    }

    return apiClient.post<VerifyBiometricResponse>('/biometric-verification/verify', formData);
  },

  /**
   * Identificar persona buscando en todos los perfiles (1:N)
   * POST /api/biometric-verification/identify
   */
  async identifyBiometric(
    frames: string[],
    request: IdentifyBiometricRequest
  ): Promise<IdentifyBiometricResponse> {
    const formData = new FormData();

    // Convertir base64 a blobs y agregar como archivos
    frames.forEach((frameBase64, index) => {
      const file = {
        uri: frameBase64,
        type: 'image/jpeg',
        name: `frame-${index}.jpg`,
      } as any;
      formData.append('frames', file);
    });

    // Agregar datos del request
    formData.append('entityType', request.entityType);

    // Metadata como campos individuales
    if (request.metadata) {
      Object.entries(request.metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(`metadata[${key}]`, String(value));
        }
      });
    }

    return apiClient.post<IdentifyBiometricResponse>('/biometric-verification/identify', formData);
  },

  /**
   * Obtener perfil biométrico
   * GET /api/biometric-verification/profile/:entityType/:entityId
   */
  async getBiometricProfile(entityType: string, entityId: string): Promise<BiometricProfile> {
    return apiClient.get<BiometricProfile>(
      `/biometric-verification/profile/${entityType}/${entityId}`
    );
  },

  /**
   * Obtener logs de verificaciones
   * GET /api/biometric-verification/logs/:entityType/:entityId
   */
  async getBiometricLogs(
    entityType: string,
    entityId: string,
    params?: {
      useCase?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<BiometricLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.useCase) queryParams.append('useCase', params.useCase);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const queryString = queryParams.toString();
    const url = `/biometric-verification/logs/${entityType}/${entityId}${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<BiometricLog[]>(url);
  },

  /**
   * Desactivar perfil biométrico
   * POST /api/biometric-verification/deactivate/:id
   */
  async deactivateBiometricProfile(profileId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(
      `/biometric-verification/deactivate/${profileId}`
    );
  },

  /**
   * Eliminar perfil biométrico
   * POST /api/biometric-verification/delete/:id
   */
  async deleteBiometricProfile(profileId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(`/biometric-verification/delete/${profileId}`);
  },

  /**
   * Listar perfiles biométricos
   * GET /api/biometric-verification/profiles
   */
  async listProfiles(params?: {
    entityType?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ListProfilesResponse> {
    const queryParams = new URLSearchParams();
    if (params?.entityType) queryParams.append('entityType', params.entityType);
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const queryString = queryParams.toString();
    const url = `/biometric-verification/profiles${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<ListProfilesResponse>(url);
  },

  /**
   * Health check del módulo
   * GET /api/biometric-verification/health
   */
  async healthCheck(): Promise<{ success: boolean; status: string }> {
    return apiClient.get<{ success: boolean; status: string }>('/biometric-verification/health');
  },
};

export default biometricApi;
