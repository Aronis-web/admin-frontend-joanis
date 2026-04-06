import { apiClient } from './client';
import { config } from '@/utils/config';
import * as FileSystem from 'expo-file-system/legacy';

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

export interface BalanceOperationFile {
  id: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number | string;
  mimeType: string;
  fileCategory: string;
  description?: string | null;
  uploadedBy: string;
  createdAt: string;
  deletedAt?: string | null;
  signedUrl?: string;
}

export const filesApi = {
  uploadFile: async (file: File | Blob, folder = 'uploads'): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    // Don't set Content-Type manually - let axios set it with the boundary
    return apiClient.post<UploadResponse>('/files/upload', formData);
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
   * Upload product image using FormData (recommended)
   * POST /files/upload/product-image/multipart
   * Saves to: catalog/productos/imagenes/{productId}/{filename}
   */
  uploadProductImage: async (
    fileUri: string,
    productId: string,
    filename: string,
    mimeType: string = 'image/jpeg'
  ): Promise<{ success: boolean; url: string; path: string; productId: string }> => {
    const formData = new FormData();

    // En React Native, el archivo se envía como un objeto con uri, type y name
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: filename,
    } as any);
    formData.append('productId', productId);

    // No especificar Content-Type - Axios lo establecerá automáticamente con el boundary correcto
    return apiClient.post<{ success: boolean; url: string; path: string; productId: string }>(
      '/files/upload/product-image/multipart',
      formData
    );
  },

  /**
   * Upload product image using base64 (legacy, kept for compatibility)
   * POST /files/upload/product-image
   * Saves to: catalog/productos/imagenes/{productId}/{filename}
   */
  uploadProductImageBase64: async (
    base64File: string,
    productId: string,
    filename: string
  ): Promise<{ success: boolean; url: string; path: string; productId: string }> => {
    return apiClient.post<{ success: boolean; url: string; path: string; productId: string }>(
      '/files/upload/product-image',
      {
        base64: base64File,
        productId,
        filename,
      }
    );
  },

  /**
   * Upload multiple product images using FormData (recommended)
   * POST /files/upload/multiple
   */
  uploadMultipleProductImages: async (
    files: Array<{ uri: string; filename: string; mimeType?: string }>,
    category: string,
    subfolder: string
  ): Promise<{
    success: boolean;
    count: number;
    files: Array<{ url: string; path: string; filename: string }>;
  }> => {
    const formData = new FormData();

    files.forEach((file, index) => {
      formData.append(`files`, {
        uri: file.uri,
        type: file.mimeType || 'image/jpeg',
        name: file.filename,
      } as any);
    });

    formData.append('category', category);
    formData.append('subfolder', subfolder);

    // Don't set Content-Type manually - let axios set it with the boundary
    return apiClient.post<{
      success: boolean;
      count: number;
      files: Array<{ url: string; path: string; filename: string }>;
    }>('/files/upload/multiple', formData);
  },

  /**
   * Upload multiple product images using base64 (legacy, kept for compatibility)
   * POST /files/upload/multiple
   */
  uploadMultipleProductImagesBase64: async (
    files: Array<{ base64: string; filename: string }>,
    category: string,
    subfolder: string
  ): Promise<{
    success: boolean;
    count: number;
    files: Array<{ url: string; path: string; filename: string }>;
  }> => {
    return apiClient.post<{
      success: boolean;
      count: number;
      files: Array<{ url: string; path: string; filename: string }>;
    }>('/files/upload/multiple', {
      files,
      category,
      subfolder,
    });
  },

  /**
   * Upload file by category using FormData (recommended)
   * POST /files/upload/category/multipart
   */
  uploadByCategory: async (
    fileUri: string,
    filename: string,
    category: string,
    subfolder?: string,
    mimeType: string = 'image/jpeg'
  ): Promise<{ success: boolean; url: string; path: string; category: string }> => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: filename,
    } as any);
    formData.append('filename', filename);
    formData.append('category', category);
    if (subfolder) {
      formData.append('subfolder', subfolder);
    }

    // Don't set Content-Type manually - let axios set it with the boundary
    return apiClient.post<{ success: boolean; url: string; path: string; category: string }>(
      '/files/upload/category/multipart',
      formData
    );
  },

  /**
   * Upload file by category using base64 (legacy, kept for compatibility)
   * POST /files/upload/category
   */
  uploadByCategoryBase64: async (
    base64File: string,
    filename: string,
    category: string,
    subfolder?: string
  ): Promise<{ success: boolean; url: string; path: string; category: string }> => {
    return apiClient.post<{ success: boolean; url: string; path: string; category: string }>(
      '/files/upload/category',
      {
        base64: base64File,
        filename,
        category,
        subfolder,
      }
    );
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
    const url = subfolder ? `/files/list/${category}/${subfolder}` : `/files/list/${category}`;
    return apiClient.get<string[]>(url);
  },

  /**
   * Get product images
   * GET /files/products/{productId}/images
   */
  getProductImages: async (
    productId: string
  ): Promise<{
    success: boolean;
    productId: string;
    count: number;
    images: Array<{
      filename: string;
      url: string;
      path: string;
    }>;
  }> => {
    return apiClient.get(`/files/products/${productId}/images`);
  },

  /**
   * Delete product image
   * DELETE /files/public/catalog/productos/imagenes/{productId}/{filename}
   */
  deleteProductImage: async (productId: string, filename: string): Promise<void> => {
    const path = `catalog/productos/imagenes/${productId}/${filename}`;
    return apiClient.delete<void>(`/files/public/${encodeURIComponent(path)}`);
  },

  /**
   * Get signed URL for private file
   * GET /files/signed-url?fileId={fileId}
   * Returns a complete signed URL with JWT token
   */
  getPrivateFileUrl: async (fileId: string): Promise<string> => {
    // Normalize path separators
    const normalizedPath = fileId.replace(/\\/g, '/');

    console.log('🔗 Requesting signed URL for fileId:', normalizedPath);

    // Request a signed URL from the backend
    const response = await apiClient.get<{
      success: boolean;
      fileId: string;
      signedUrl: string;
      token: string;
      url: string;
    }>(`/files/signed-url`, {
      params: { fileId: normalizedPath },
    });

    console.log('📦 Signed URL response:', {
      hasData: !!response,
      response: response,
      url: (response as any).url,
      signedUrl: (response as any).signedUrl,
    });

    // The interceptor returns data at root level
    const responseData: any = response;

    // Return the complete signed URL (url or signedUrl field)
    const signedUrl = responseData?.url || responseData?.signedUrl;

    if (!signedUrl) {
      console.error('❌ No signed URL in response:', response);
      throw new Error('No se pudo obtener la URL firmada del servidor');
    }

    console.log('✅ Returning signed URL:', signedUrl);
    return signedUrl;
  },

  /**
   * Upload balance operation files using base64
   * POST /balance-files/upload/multiple
   * Saves to: balances/documentos/{operationId}/{filename}
   */
  uploadBalanceOperationFiles: async (
    files: Array<{ uri: string; filename: string; mimeType: string }>,
    operationId: string,
    descriptions?: string[]
  ): Promise<{
    success: boolean;
    count: number;
    files: Array<{
      id: string;
      fileName: string;
      originalName: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
      fileCategory: string;
      description?: string;
      uploadedBy: string;
      createdAt: string;
    }>;
  }> => {
    console.log('📎 Converting files to base64...');
    console.log('📎 Operation ID:', operationId);
    console.log('📎 Files to upload:', files.length);

    // Convert files to base64 format expected by backend
    const filesData = await Promise.all(
      files.map(async (file, index) => {
        try {
          console.log(`📎 Processing file ${index + 1}/${files.length}: ${file.filename}`);

          // Get file info to get the size
          const fileInfo = await FileSystem.getInfoAsync(file.uri);
          const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

          console.log(`📎 File info:`, { exists: fileInfo.exists, size: fileSize });

          // Read file as base64
          const base64Data = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log(
            `✅ File ${index + 1}/${files.length} converted: ${file.filename} (${fileSize} bytes, base64 length: ${base64Data.length})`
          );

          return {
            base64: base64Data,
            filename: file.filename,
            originalName: file.filename,
            mimeType: file.mimeType,
            fileSize: fileSize,
            description: descriptions && descriptions[index] ? descriptions[index] : undefined,
          };
        } catch (error) {
          console.error(`❌ Error converting file ${file.filename}:`, error);
          throw new Error(`No se pudo leer el archivo ${file.filename}`);
        }
      })
    );

    console.log(`📤 Uploading ${filesData.length} file(s) to backend...`);
    console.log(`📤 Request payload:`, {
      operationId,
      category: 'balances/documentos',
      filesCount: filesData.length,
      fileNames: filesData.map((f) => f.filename),
    });

    try {
      const response = await apiClient.post('/balance-files/upload/multiple', {
        operationId,
        category: 'balances/documentos',
        files: filesData,
      });

      console.log('✅ Upload successful:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Upload failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.config?.headers,
      });
      throw error;
    }
  },

  /**
   * Get files for a balance operation
   * GET /balance-files/operation/{operationId}
   */
  getBalanceOperationFiles: async (operationId: string): Promise<BalanceOperationFile[]> => {
    console.log('📥 Fetching files for operation:', operationId);

    try {
      const response: any = await apiClient.get(`/balance-files/operation/${operationId}`);
      console.log('✅ Files fetched:', response);

      // Backend returns { success, operationId, count, files }
      // We need to extract the files array
      if (response && response.files) {
        console.log('✅ Extracted files array:', response.files);
        return response.files;
      }

      console.log('⚠️ No files found in response');
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching files:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  },

  /**
   * Upload supplier debt transaction file
   * Uses the generic category upload endpoint which returns path (not UUID)
   * The backend accepts path as attachmentFileId for supplier debts
   */
  uploadSupplierDebtFile: async (
    fileUriOrFile: string | File,
    filename: string,
    supplierId: string,
    mimeType: string = 'image/jpeg',
    isWebFile: boolean = false
  ): Promise<{ success: boolean; url: string; path: string; category: string }> => {
    console.log('📎 Uploading supplier debt file...');
    console.log('📎 Supplier ID:', supplierId);
    console.log('📎 Filename:', filename);
    console.log('📎 Is web file:', isWebFile);

    const formData = new FormData();

    if (isWebFile && fileUriOrFile instanceof File) {
      // Web: Use File object directly
      console.log('📎 Using File object for web upload');
      formData.append('file', fileUriOrFile);
    } else {
      // Mobile: Use uri, type, name object
      formData.append('file', {
        uri: fileUriOrFile as string,
        type: mimeType,
        name: filename,
      } as any);
    }

    formData.append('filename', filename);
    formData.append('category', 'supplier-debts');
    formData.append('subfolder', supplierId);

    try {
      const response = await apiClient.post<{ success: boolean; url: string; path: string; category: string }>(
        '/files/upload/category/multipart',
        formData
      );

      console.log('✅ File uploaded successfully:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Upload failed:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  },
};

export default filesApi;
