/**
 * File Download Helper - Utilidades para descargar archivos en móvil
 * Usa la API legacy de expo-file-system que es más estable en producción
 */

import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface SaveAndShareOptions {
  blob: Blob;
  fileName: string;
  mimeType: string;
  dialogTitle?: string;
  UTI?: string;
  webDownloadName?: string;
}

/**
 * Convierte un Blob a base64
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Remove the data URL prefix to get just the base64 data
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Guarda un blob como archivo y lo comparte (para móvil)
 * Para web, crea un link de descarga
 */
export const saveAndShareFile = async (options: SaveAndShareOptions): Promise<void> => {
  const { blob, fileName, mimeType, dialogTitle, UTI, webDownloadName } = options;

  if (Platform.OS === 'web') {
    // For web, create a download link using blob URL
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = webDownloadName || fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } else {
    // For mobile (iOS/Android), use legacy expo-file-system API
    console.log('📱 Using mobile download method (legacy API)');

    // Convert blob to base64
    const base64Data = await blobToBase64(blob);

    // Save to cache directory using legacy API
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    console.log('💾 Saving file to:', fileUri);

    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('✅ File saved successfully');

    // Share the file - user can choose to save to Downloads from share menu
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      console.log('📤 Sharing file...');
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: dialogTitle || 'Compartir archivo',
        UTI: UTI || mimeType,
      });
    } else {
      Alert.alert('Éxito', `Archivo guardado en: ${fileUri}`);
    }
  }
};

/**
 * Helper específico para PDFs
 */
export const saveAndSharePdf = async (
  blob: Blob,
  fileName: string,
  dialogTitle?: string
): Promise<void> => {
  return saveAndShareFile({
    blob,
    fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
    mimeType: 'application/pdf',
    dialogTitle,
    UTI: 'com.adobe.pdf',
  });
};

/**
 * Helper específico para Excel
 */
export const saveAndShareExcel = async (
  blob: Blob,
  fileName: string,
  dialogTitle?: string
): Promise<void> => {
  return saveAndShareFile({
    blob,
    fileName: fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
};

export default {
  saveAndShareFile,
  saveAndSharePdf,
  saveAndShareExcel,
  blobToBase64,
};
