import { apiClient } from './client';

export interface UploadResponse {
  url: string;
  key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
}

export const filesApi = {
  uploadFile: async (file: File | Blob, folder = 'uploads'): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return apiClient.post<UploadResponse>('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  uploadImage: async (image: File | Blob): Promise<UploadResponse> => {
    return filesApi.uploadFile(image, 'images');
  },

  getSignedUrl: async (key: string, expiresIn = 3600): Promise<SignedUrlResponse> => {
    return apiClient.get<SignedUrlResponse>('/files/signed-url', {
      params: { key, expiresIn },
    });
  },

  deleteFile: async (key: string): Promise<void> => {
    return apiClient.delete<void>(`/files/${key}`);
  },

  uploadAvatar: async (image: File | Blob): Promise<UploadResponse> => {
    return filesApi.uploadFile(image, 'avatars');
  },

  /**
   * Upload product image using base64
   * POST /files/upload/product/image
   * Saves to: productos/imagenes/{productId}/{filename}
   */
  uploadProductImage: async (
    base64File: string,
    productId: string,
    filename: string
  ): Promise<{ success: boolean; path: string; filename: string }> => {
    return apiClient.post<{ success: boolean; path: string; filename: string }>('/files/upload/product/image', {
      base64: base64File,
      productId,
      filename,
    });
  },

  /**
   * Upload multiple product images using base64
   * POST /files/upload/multiple
   */
  uploadMultipleProductImages: async (
    files: Array<{ base64: string; filename: string }>,
    category: string,
    subfolder: string
  ): Promise<{ count: number; files: UploadResponse[] }> => {
    return apiClient.post<{ count: number; files: UploadResponse[] }>('/files/upload/multiple', {
      files,
      category,
      subfolder,
    });
  },

  /**
   * Delete a public file
   * DELETE /files/public/:path
   */
  deletePublicFile: async (path: string): Promise<void> => {
    return apiClient.delete<void>(`/files/public/${encodeURIComponent(path)}`);
  },

  /**
   * List files by category
   * GET /files/list/:category/:subfolder?
   */
  listFilesByCategory: async (category: string, subfolder?: string): Promise<string[]> => {
    const url = subfolder
      ? `/files/list/${category}/${subfolder}`
      : `/files/list/${category}`;
    return apiClient.get<string[]>(url);
  },
};

export default filesApi;
