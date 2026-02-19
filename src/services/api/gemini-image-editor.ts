import { config } from '@/utils/config';

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

      // Make the request
      const response = await fetch(`${config.API_URL}/gemini-image-editor/edit`, {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type - let the browser set it with boundary
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Error al editar imagen: ${response.status} ${response.statusText}`
        );
      }

      const data: GeminiEditImageResponse = await response.json();

      console.log('✅ [Gemini] Image edited successfully');
      console.log('📊 [Gemini] Response:', {
        success: data.success,
        mimeType: data.mimeType,
        prompt: data.prompt,
        imageSize: data.editedImageBase64?.length || 0,
      });

      return data;
    } catch (error: any) {
      console.error('❌ [Gemini] Error editing image:', error);
      throw new Error(error.message || 'No se pudo editar la imagen con Gemini');
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
