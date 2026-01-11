import { apiClient } from './client';

// Presentation entity (catálogo global)
export interface Presentation {
  id: string;
  code: string;
  name: string;
  description?: string;
  isBase: boolean;
  createdAt: string;
  updatedAt: string;
}

// Response interfaces
export interface PresentationsResponse {
  presentations: Presentation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Create/Update DTOs
export interface CreatePresentationDto {
  code: string;
  name: string;
  description?: string;
  isBase?: boolean;
}

export interface UpdatePresentationDto {
  code?: string;
  name?: string;
  description?: string;
  isBase?: boolean;
}

// Query params
export interface GetPresentationsParams {
  page?: number;
  limit?: number;
  isBase?: boolean;
  q?: string;
}

export const presentationsApi = {
  // Get all presentations - GET /admin/presentations
  getPresentations: async (params?: GetPresentationsParams): Promise<Presentation[]> => {
    return apiClient.get<Presentation[]>('/admin/presentations', { params });
  },

  // Get presentation by ID - GET /admin/presentations/:id
  getPresentationById: async (id: string): Promise<Presentation> => {
    return apiClient.get<Presentation>(`/admin/presentations/${id}`);
  },

  // Get presentation by code - GET /admin/presentations/code/:code
  getPresentationByCode: async (code: string): Promise<Presentation> => {
    return apiClient.get<Presentation>(`/admin/presentations/code/${code}`);
  },

  // Create presentation - POST /admin/presentations
  createPresentation: async (data: CreatePresentationDto): Promise<Presentation> => {
    return apiClient.post<Presentation>('/admin/presentations', data);
  },

  // Update presentation - PATCH /admin/presentations/:id
  updatePresentation: async (id: string, data: UpdatePresentationDto): Promise<Presentation> => {
    return apiClient.patch<Presentation>(`/admin/presentations/${id}`, data);
  },

  // Delete presentation - DELETE /admin/presentations/:id
  deletePresentation: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/admin/presentations/${id}`);
  },
};
