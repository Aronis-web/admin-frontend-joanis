/**
 * Cross-platform helper para seleccionar un archivo (o varios) que luego se
 * subirán al Drive con progreso. Devuelve estructuras normalizadas listas
 * para pasar a `driveApi.uploadTo*`.
 *
 * - Web: usa expo-document-picker (que internamente usa <input type=file>).
 * - Nativo (Android/iOS): expo-document-picker con `copyToCacheDirectory`.
 */

import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export interface PickedFile {
  /** Nombre del archivo con extensión. */
  name: string;
  /** MIME estimado por el picker (puede ser undefined). */
  mimeType: string | undefined;
  /** Tamaño en bytes si el picker lo reporta. */
  size?: number;
  /**
   * Payload listo para FormData. En web es Blob/File, en nativo un objeto
   * { uri, name, type } que RN convierte a multipart correctamente.
   */
  payload: File | Blob | { uri: string; name: string; type: string };
}

export const pickFilesForUpload = async ({
  multiple = false,
}: { multiple?: boolean } = {}): Promise<PickedFile[]> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple,
    copyToCacheDirectory: Platform.OS !== 'web',
  });

  if (result.canceled) return [];

  const assets = result.assets ?? [];
  const picked: PickedFile[] = [];

  for (const asset of assets) {
    const name = asset.name || 'archivo';
    const mimeType = asset.mimeType || undefined;
    const size = typeof asset.size === 'number' ? asset.size : undefined;

    if (Platform.OS === 'web') {
      // En web expo-document-picker expone `file: File` (undocumented pero real)
      const maybeFile = (asset as unknown as { file?: File }).file;
      if (maybeFile) {
        picked.push({ name, mimeType, size, payload: maybeFile });
        continue;
      }
      // Fallback: fetch al uri (blob:) para obtener el Blob
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      picked.push({ name, mimeType, size, payload: blob });
    } else {
      picked.push({
        name,
        mimeType,
        size,
        payload: {
          uri: asset.uri,
          name,
          type: mimeType || 'application/octet-stream',
        },
      });
    }
  }

  return picked;
};
