/**
 * Helpers cross-platform para preparar imágenes que se envían por FormData.
 *
 * - En web/Electron `FormData` requiere un `Blob`/`File` real.
 * - En nativo se usa el objeto `{ uri, type, name }` que entiende el FormData de
 *   React Native, apoyándonos en `expo-file-system` para descargar/escribir.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/** Payload aceptado por FormData en ambas plataformas. */
export type UploadFile = File | { uri: string; type: string; name: string };

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteChars = atob(base64);
  const byteNumbers = new Array<number>(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

/**
 * Decodifica un `data:` URL a Blob sin usar `fetch`. Necesario porque el CSP
 * (`connect-src`) bloquea `fetch('data:...')` en producción web.
 */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) throw new Error('data URL inválido');
  const header = dataUrl.substring(5, commaIdx); // quita "data:"
  const payload = dataUrl.substring(commaIdx + 1);
  const isBase64 = /;base64/i.test(header);
  const mimeType = header.replace(/;base64/i, '') || 'application/octet-stream';
  if (isBase64) {
    return base64ToBlob(payload, mimeType);
  }
  const decoded = decodeURIComponent(payload);
  return new Blob([decoded], { type: mimeType });
};

/** Opciones comunes de preparación de imágenes para subir. */
export interface UploadFileOptions {
  /** Si es `true`, recorta la imagen a un cuadrado 1:1 centrado antes de subir. */
  square?: boolean;
}

/**
 * Convierte una URL (remota, `data:` o `blob:`) en un archivo listo para subir.
 */
export const uploadFileFromUrl = async (
  url: string,
  name: string,
  type = 'image/jpeg',
  options?: UploadFileOptions
): Promise<UploadFile> => {
  // Recorte 1:1 previo (si se pidió). En web devuelve un data-url; en nativo una
  // uri local recortada. Si algo falla, devuelve la url original sin romper.
  const sourceUrl = options?.square ? await ensureSquareImageUri(url) : url;

  if (Platform.OS === 'web') {
    // `data:` URLs se decodifican en memoria: `fetch('data:...')` está
    // bloqueado por el CSP (`connect-src`) en producción web.
    if (sourceUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(sourceUrl);
      return new File([blob], name, { type: blob.type || type });
    }
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error('No se pudo obtener la imagen');
    }
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type || type });
  }

  // Nativo: descargamos solo si es remota; una uri local se usa tal cual.
  if (sourceUrl.startsWith('http')) {
    const fileUri = `${FileSystem.cacheDirectory}${name}`;
    const result = await FileSystem.downloadAsync(sourceUrl, fileUri, { cache: true });
    if (result.status !== 200) {
      throw new Error('No se pudo descargar la imagen');
    }
    return { uri: result.uri, type, name };
  }
  return { uri: sourceUrl, type, name };
};

/** Recorta a un cuadrado 1:1 centrado en web usando un `<canvas>`. */
const cropSquareWeb = (uri: string): Promise<string> =>
  new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const side = Math.min(img.width, img.height);
        if (!side) {
          resolve(uri);
          return;
        }
        const offsetX = (img.width - side) / 2;
        const offsetY = (img.height - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(uri);
          return;
        }
        ctx.drawImage(img, offsetX, offsetY, side, side, 0, 0, side, side);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        // Canvas "tainted" por CORS u otro error: subimos la imagen original.
        resolve(uri);
      }
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });

/**
 * Recorta una imagen a un cuadrado 1:1 centrado.
 *
 * - En web/Electron usa un `<canvas>`.
 * - En nativo usa `expo-image-manipulator`. Primero re-encoda la imagen sin
 *   operaciones para "hornear" la orientación EXIF; así las dimensiones y el
 *   sistema de coordenadas del recorte coinciden (en Android, medir con
 *   `Image.getSize` y recortar con el manipulador se desalineaba y el recorte
 *   dejaba solo una porción de la foto). Si algo falla, devuelve la uri
 *   original sin romper el flujo.
 */
export const ensureSquareImageUri = async (uri: string): Promise<string> => {
  if (Platform.OS === 'web') {
    return cropSquareWeb(uri);
  }
  try {
    // Paso 1: normalizar orientación y obtener dimensiones canónicas en px.
    const normalized = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const { width, height, uri: normalizedUri } = normalized;
    const side = Math.min(width, height);
    if (!side || width === height) {
      return normalizedUri || uri;
    }
    const originX = Math.round((width - side) / 2);
    const originY = Math.round((height - side) / 2);
    // Paso 2: recorte cuadrado centrado sobre la imagen ya normalizada.
    const result = await ImageManipulator.manipulateAsync(
      normalizedUri,
      [{ crop: { originX, originY, width: side, height: side } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri || normalizedUri || uri;
  } catch {
    return uri;
  }
};

/**
 * Convierte base64 (sin prefijo `data:`) en un archivo listo para subir.
 */
export const uploadFileFromBase64 = async (
  base64: string,
  name: string,
  mimeType = 'image/jpeg',
  options?: UploadFileOptions
): Promise<UploadFile> => {
  if (Platform.OS === 'web') {
    const blob = base64ToBlob(base64, mimeType);
    if (!options?.square) {
      return new File([blob], name, { type: mimeType });
    }
    const objectUrl = URL.createObjectURL(blob);
    try {
      const squareUri = await cropSquareWeb(objectUrl);
      // `cropSquareWeb` devuelve un `data:` URL (canvas.toDataURL) o la uri
      // original si falla. Decodificamos sin `fetch` para respetar el CSP.
      const squareBlob = squareUri.startsWith('data:') ? dataUrlToBlob(squareUri) : blob;
      return new File([squareBlob], name, { type: squareBlob.type || mimeType });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const fileUri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const finalUri = options?.square ? await ensureSquareImageUri(fileUri) : fileUri;
  return { uri: finalUri, type: mimeType, name };
};
