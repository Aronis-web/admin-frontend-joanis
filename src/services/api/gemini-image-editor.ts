import { config } from '@/utils/config';
import { apiClient } from './client';

export interface GeminiEditImageRequest {
  file: string; // URI of the image file
  prompt: string; // Editing instructions
}

export interface GeminiEditImageResponse {
  success: boolean;
  editedImageBase64: string;
  mimeType: string;
  prompt: string;
}

/**
 * Gemini Image Editor API
 * Provides AI-powered image editing using Gemini
 */
export const geminiImageEditorApi = {
  /**
   * Edit an image using Gemini AI with natural language instructions
   * @param imageUri - Local URI of the image to edit
   * @param prompt - Natural language editing instructions
   * @param filename - Optional filename for the image
   * @returns Promise with the edited image in base64 format
   */
  async editImage(
    imageUri: string,
    prompt: string,
    filename?: string
  ): Promise<GeminiEditImageResponse> {
    try {
      console.log('🎨 [Gemini] Editing image with prompt:', prompt);

      // Create FormData for multipart upload
      const formData = new FormData();

      // Add the image file
      const imageFile = {
        uri: imageUri,
        type: 'image/jpeg', // Default to JPEG, can be adjusted
        name: filename || `image_${Date.now()}.jpg`,
      } as any;

      formData.append('file', imageFile);
      formData.append('prompt', prompt);

      // Use apiClient to automatically include required headers (X-App-Id, Authorization, etc.)
      const response = await apiClient.post<GeminiEditImageResponse>(
        '/gemini-image-editor/edit',
        formData,
        {
          headers: {
            // Don't set Content-Type - apiClient will handle it for FormData
            Accept: 'application/json',
          },
        }
      );

      console.log('✅ [Gemini] Image edited successfully');
      console.log('📊 [Gemini] Response:', {
        success: response.data.success,
        mimeType: response.data.mimeType,
        prompt: response.data.prompt,
        imageSize: response.data.editedImageBase64?.length || 0,
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ [Gemini] Error editing image:', error);
      const errorMessage = error.response?.data?.message || error.message || 'No se pudo editar la imagen con Gemini';
      throw new Error(errorMessage);
    }
  },

  /**
   * Convert base64 image to data URI for display
   * @param base64 - Base64 encoded image
   * @param mimeType - MIME type of the image
   * @returns Data URI string
   */
  getDataUri(base64: string, mimeType: string): string {
    return `data:${mimeType};base64,${base64}`;
  },

  /**
   * Save base64 image to local file system (for React Native)
   * @param base64 - Base64 encoded image
   * @param mimeType - MIME type of the image
   * @param filename - Filename to save as
   * @returns Local file URI
   */
  async saveBase64ToFile(
    base64: string,
    mimeType: string,
    filename: string
  ): Promise<string> {
    try {
      // Dynamically import FileSystem
      const FileSystem = await import('expo-file-system');

      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      // Write base64 to file
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('💾 [Gemini] Saved edited image to:', fileUri);
      return fileUri;
    } catch (error: any) {
      console.error('❌ [Gemini] Error saving base64 to file:', error);
      throw new Error('No se pudo guardar la imagen editada');
    }
  },
};

export default geminiImageEditorApi;
