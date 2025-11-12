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
};

export default filesApi;
