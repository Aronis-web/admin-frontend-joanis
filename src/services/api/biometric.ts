import { apiClient } from './client';

export interface BiometricProfile {
  id: string;
  entityType: string;
  entityId: string;
  isActive: boolean;
  registrationQuality: number;
  createdAt: string;
  updatedAt: string;
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

    // Metadata como JSON string (según documentación del backend)
    if (request.metadata) {
      formData.append('metadata', JSON.stringify(request.metadata));
    }

    return apiClient.post<RegisterBiometricResponse>(
      '/biometric-verification/register',
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

    // Metadata como JSON string
    if (request.metadata) {
      formData.append('metadata', JSON.stringify(request.metadata));
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

    // Metadata como JSON string
    if (request.metadata) {
      formData.append('metadata', JSON.stringify(request.metadata));
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
   * Health check del módulo
   * GET /api/biometric-verification/health
   */
  async healthCheck(): Promise<{ success: boolean; status: string }> {
    return apiClient.get<{ success: boolean; status: string }>('/biometric-verification/health');
  },
};

export default biometricApi;
