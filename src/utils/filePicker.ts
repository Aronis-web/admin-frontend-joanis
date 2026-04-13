/**
 * File and Image Picker utilities for cross-platform support
 * Provides alternatives for expo-document-picker and expo-image-picker in Electron/Web
 */

import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { isElectron } from './platform';

/**
 * Asset type for document picker
 */
export interface DocumentPickerAsset {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  file?: File; // Original File object for web uploads
}

/**
 * Result type for document picker
 */
export interface DocumentPickerResult {
  canceled: boolean;
  assets?: DocumentPickerAsset[];
}

/**
 * Result type for image picker
 */
export interface ImagePickerResult {
  canceled: boolean;
  assets?: Array<{
    uri: string;
    width?: number;
    height?: number;
    fileName?: string;
    fileSize?: number;
    type?: string;
    mimeType?: string;
  }>;
}

/**
 * Pick a document using native file input (for Electron/Web)
 * Preserves the original File object for FormData uploads
 */
const pickDocumentWeb = (acceptedTypes: string[]): Promise<DocumentPickerResult> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptedTypes.join(',');

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        resolve({ canceled: true });
        return;
      }

      // Create a blob URL for the file (more efficient than data URL)
      const blobUrl = URL.createObjectURL(file);

      resolve({
        canceled: false,
        assets: [{
          uri: blobUrl,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          file: file, // Preserve original File object for FormData uploads
        }],
      });
    };

    input.oncancel = () => {
      resolve({ canceled: true });
    };

    input.click();
  });
};

/**
 * Pick an image using native file input (for Electron/Web)
 */
const pickImageWeb = (options?: {
  allowsMultipleSelection?: boolean;
  quality?: number;
}): Promise<ImagePickerResult> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = options?.allowsMultipleSelection || false;

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;

      if (!files || files.length === 0) {
        resolve({ canceled: true });
        return;
      }

      const assets: ImagePickerResult['assets'] = [];

      // Process all selected files
      const processFile = (file: File): Promise<void> => {
        return new Promise((resolveFile) => {
          const reader = new FileReader();
          reader.onload = () => {
            // Create an image to get dimensions
            const img = new Image();
            img.onload = () => {
              assets.push({
                uri: reader.result as string,
                width: img.width,
                height: img.height,
                fileName: file.name,
                fileSize: file.size,
                type: 'image',
                mimeType: file.type,
              });
              resolveFile();
            };
            img.onerror = () => {
              resolveFile();
            };
            img.src = reader.result as string;
          };
          reader.onerror = () => {
            resolveFile();
          };
          reader.readAsDataURL(file);
        });
      };

      // Process all files
      const promises = Array.from(files).map(processFile);
      await Promise.all(promises);

      if (assets.length > 0) {
        resolve({ canceled: false, assets });
      } else {
        resolve({ canceled: true });
      }
    };

    input.oncancel = () => {
      resolve({ canceled: true });
    };

    input.click();
  });
};

/**
 * Launch camera using native media capture (for Electron/Web)
 * Note: This requires camera permissions in the browser
 */
const launchCameraWeb = (): Promise<ImagePickerResult> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use rear camera on mobile

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        resolve({ canceled: true });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          resolve({
            canceled: false,
            assets: [{
              uri: reader.result as string,
              width: img.width,
              height: img.height,
              fileName: file.name,
              fileSize: file.size,
              type: 'image',
              mimeType: file.type,
            }],
          });
        };
        img.onerror = () => {
          resolve({ canceled: true });
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        resolve({ canceled: true });
      };
      reader.readAsDataURL(file);
    };

    input.oncancel = () => {
      resolve({ canceled: true });
    };

    input.click();
  });
};

/**
 * Cross-platform document picker
 * Uses native HTML5 file input for Web/Electron, expo-document-picker for mobile
 */
export const getDocumentAsync = async (options?: {
  type?: string | string[];
  copyToCacheDirectory?: boolean;
  multiple?: boolean;
}): Promise<DocumentPickerResult> => {
  // Use web file picker for ALL web platforms (browser and Electron)
  if (Platform.OS === 'web') {
    console.log('🌐 Using Web/Electron document picker');

    // Convert MIME types to file extensions for accept attribute
    let acceptedTypes: string[] = [];
    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      acceptedTypes = types.map(type => {
        // Map common MIME types to extensions
        if (type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          return '.xlsx';
        }
        if (type === 'application/vnd.ms-excel') {
          return '.xls';
        }
        if (type === 'application/pdf') {
          return '.pdf';
        }
        if (type === 'application/zip' || type === 'application/x-zip-compressed' || type === 'application/x-zip') {
          return '.zip';
        }
        if (type === 'text/csv' || type === 'application/csv') {
          return '.csv';
        }
        if (type.startsWith('image/')) {
          return 'image/*';
        }
        return type;
      });
    } else {
      acceptedTypes = ['*/*'];
    }

    return pickDocumentWeb(acceptedTypes);
  } else {
    // Use expo-document-picker for mobile
    console.log('📱 Using expo-document-picker');
    return DocumentPicker.getDocumentAsync(options as any) as any;
  }
};

/**
 * Cross-platform image library picker
 * Uses native HTML5 file input for Web/Electron, expo-image-picker for mobile
 */
export const launchImageLibraryAsync = async (options?: {
  mediaTypes?: any;
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  allowsMultipleSelection?: boolean;
}): Promise<ImagePickerResult> => {
  // Use web file picker for ALL web platforms (browser and Electron)
  if (Platform.OS === 'web') {
    console.log('🌐 Using Web/Electron image picker');
    return pickImageWeb({
      allowsMultipleSelection: options?.allowsMultipleSelection,
      quality: options?.quality,
    });
  } else {
    // Use expo-image-picker for mobile
    console.log('📱 Using expo-image-picker');

    // Request permissions first
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return { canceled: true };
    }

    return ImagePicker.launchImageLibraryAsync(options as any) as any;
  }
};

/**
 * Cross-platform camera launcher
 * Uses native HTML5 media capture for Web/Electron, expo-image-picker for mobile
 */
export const launchCameraAsync = async (options?: {
  mediaTypes?: any;
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePickerResult> => {
  // Use web camera for ALL web platforms (browser and Electron)
  if (Platform.OS === 'web') {
    console.log('🌐 Using Web/Electron camera');
    return launchCameraWeb();
  } else {
    // Use expo-image-picker for mobile
    console.log('📱 Using expo-image-picker camera');

    // Request permissions first
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return { canceled: true };
    }

    return ImagePicker.launchCameraAsync(options as any) as any;
  }
};

/**
 * Request media library permissions
 * Always returns granted for Web/Electron (no permissions needed)
 */
export const requestMediaLibraryPermissionsAsync = async (): Promise<{ status: string }> => {
  if (Platform.OS === 'web') {
    // No permissions needed for web/Electron
    return { status: 'granted' };
  } else {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return { status: result.status };
  }
};

/**
 * Request camera permissions
 * Always returns granted for Web/Electron (browser will handle permissions)
 */
export const requestCameraPermissionsAsync = async (): Promise<{ status: string }> => {
  if (Platform.OS === 'web') {
    // Browser will handle camera permissions
    return { status: 'granted' };
  } else {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    return { status: result.status };
  }
};

/**
 * Media type options (compatible with expo-image-picker)
 */
export const MediaTypeOptions = {
  All: 'All',
  Videos: 'Videos',
  Images: 'Images',
};

export default {
  getDocumentAsync,
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  MediaTypeOptions,
};
