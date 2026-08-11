import { create } from 'zustand';

import { photoCampaignsApi } from '@/services/api';
import { uploadFileFromBase64, uploadFileFromUrl } from '@/utils/imageFile';
import { logger } from '@/utils/logger';
import Alert from '@/utils/alert';
import type { AdDesignTemplate } from '@/types/photo-campaigns';

export type PhotoGenerationKind = 'design' | 'price';

/** Timeout duro para requests de red que no tienen timeout propio (fetch/FormData). */
const GENERATION_TIMEOUT_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 45_000;

/**
 * Envuelve una promesa con un timeout. Si vence, rechaza para que el `finally`
 * del flujo resetee el estado y nunca se quede "Generando" indefinidamente.
 */
const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} tardó demasiado. Revisa tu conexión e intenta de nuevo.`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

interface GenerateDesignParams {
  productId: string;
  photoCampaignId?: string;
  referenceUrl: string;
  prompt: string;
  /** Reference (grupo) al que se adjunta el design generado. */
  parentAssetId?: string;
}

interface GeneratePriceParams {
  productId: string;
  photoCampaignId?: string;
  designUrl: string;
  designMimeType?: string;
  name: string;
  sku: string;
  price: string;
  template: AdDesignTemplate;
  /** Reference (grupo) al que se adjunta el price generado. */
  parentAssetId?: string;
}

/** Llave compuesta producto+grupo para llevar flags de generación por grupo. */
const groupKey = (productId: string, parentAssetId?: string | null): string =>
  `${productId}::${parentAssetId || 'default'}`;

interface PhotoGenerationState {
  /** Flags de generación en curso, por grupo (producto::parentAssetId). */
  generating: Record<string, { design?: boolean; price?: boolean }>;
  /** Se incrementa cuando termina una tarea de un producto (para recargar). */
  completedVersion: Record<string, number>;
  isGenerating: (
    productId: string,
    kind: PhotoGenerationKind,
    parentAssetId?: string | null
  ) => boolean;
  generateDesign: (params: GenerateDesignParams) => Promise<void>;
  generatePrice: (params: GeneratePriceParams) => Promise<void>;
}

export const usePhotoGenerationStore = create<PhotoGenerationState>((set, get) => {
  const setFlag = (
    productId: string,
    parentAssetId: string | undefined,
    kind: PhotoGenerationKind,
    value: boolean
  ) => {
    const key = groupKey(productId, parentAssetId);
    set((state) => ({
      generating: {
        ...state.generating,
        [key]: { ...(state.generating[key] || {}), [kind]: value },
      },
    }));
  };

  const bumpCompleted = (productId: string) => {
    set((state) => ({
      completedVersion: {
        ...state.completedVersion,
        [productId]: (state.completedVersion[productId] || 0) + 1,
      },
    }));
  };

  return {
    generating: {},
    completedVersion: {},

    isGenerating: (productId, kind, parentAssetId) =>
      Boolean(get().generating[groupKey(productId, parentAssetId)]?.[kind]),

    generateDesign: async ({ productId, photoCampaignId, referenceUrl, prompt, parentAssetId }) => {
      if (get().isGenerating(productId, 'design', parentAssetId)) {
        return;
      }
      setFlag(productId, parentAssetId, 'design', true);
      try {
        const referenceFile = await withTimeout(
          uploadFileFromUrl(referenceUrl, `reference-${productId}.jpg`, 'image/jpeg'),
          DOWNLOAD_TIMEOUT_MS,
          'La descarga de la referencia'
        );

        const response = await withTimeout(
          photoCampaignsApi.editImageWithGemini(referenceFile, prompt.trim()),
          GENERATION_TIMEOUT_MS,
          'La generación con IA'
        );

        const generatedUrl =
          response?.imageUrl ||
          response?.url ||
          (response as any)?.data?.imageUrl ||
          (response as any)?.data?.url ||
          (response as any)?.result?.imageUrl ||
          (response as any)?.result?.url;

        const generatedBase64 =
          response?.editedImageBase64 ||
          (response as any)?.data?.editedImageBase64 ||
          (response as any)?.result?.editedImageBase64;

        const generatedMimeType =
          response?.mimeType ||
          (response as any)?.data?.mimeType ||
          (response as any)?.result?.mimeType ||
          'image/png';

        const extension = generatedMimeType.includes('png') ? 'png' : 'jpg';
        const fileName = `design-${productId}.${extension}`;

        let designFile;
        if (generatedBase64) {
          designFile = await uploadFileFromBase64(generatedBase64, fileName, generatedMimeType, {
            square: true,
          });
        } else if (generatedUrl) {
          designFile = await withTimeout(
            uploadFileFromUrl(generatedUrl, fileName, generatedMimeType, { square: true }),
            DOWNLOAD_TIMEOUT_MS,
            'La descarga del diseño'
          );
        } else {
          logger.warn('[PHOTO_CAMPAIGNS][GEMINI] No valid image in response');
          Alert.alert('Error', 'Gemini no devolvió una imagen válida.');
          return;
        }

        await withTimeout(
          photoCampaignsApi.uploadProductPhoto(productId, {
            photoType: 'design',
            file: designFile,
            photoCampaignId,
            parentAssetId,
          }),
          DOWNLOAD_TIMEOUT_MS,
          'El guardado del diseño'
        );
      } catch (error: any) {
        logger.error('[PHOTO_CAMPAIGNS][GEMINI] Background generation error', error);
        Alert.alert('Error', error?.message || 'No se pudo generar la foto de diseño.');
      } finally {
        setFlag(productId, parentAssetId, 'design', false);
        bumpCompleted(productId);
      }
    },

    generatePrice: async ({
      productId,
      photoCampaignId,
      designUrl,
      designMimeType,
      name,
      sku,
      price,
      template,
      parentAssetId,
    }) => {
      if (get().isGenerating(productId, 'price', parentAssetId)) {
        return;
      }
      setFlag(productId, parentAssetId, 'price', true);
      try {
        const baseFile = await withTimeout(
          uploadFileFromUrl(
            designUrl,
            `design-price-${productId}.jpg`,
            designMimeType || 'image/jpeg',
            { square: true }
          ),
          DOWNLOAD_TIMEOUT_MS,
          'La descarga del diseño'
        );

        const response = await withTimeout(
          photoCampaignsApi.generateAdDesign(productId, {
            file: baseFile,
            name: name.trim(),
            sku: sku.trim(),
            price: price.trim(),
            template,
            photoCampaignId,
            parentAssetId,
          }),
          GENERATION_TIMEOUT_MS,
          'La generación del diseño con precio'
        );

        const generatedUrl =
          response?.asset?.fileUrl ||
          response?.imageUrl ||
          response?.fileUrl ||
          response?.url ||
          (response as any)?.data?.asset?.fileUrl ||
          (response as any)?.data?.imageUrl ||
          (response as any)?.data?.fileUrl ||
          (response as any)?.data?.url;

        if (!generatedUrl) {
          Alert.alert('Error', 'No se pudo generar el diseño con precio.');
          return;
        }

        const priceFile = await withTimeout(
          uploadFileFromUrl(generatedUrl, `price-${productId}.png`, 'image/png', { square: true }),
          DOWNLOAD_TIMEOUT_MS,
          'La descarga del diseño con precio'
        );

        await withTimeout(
          photoCampaignsApi.uploadProductPhoto(productId, {
            photoType: 'price',
            file: priceFile,
            photoCampaignId,
            parentAssetId,
          }),
          DOWNLOAD_TIMEOUT_MS,
          'El guardado de la foto con precio'
        );

        // El endpoint ad-design persiste en tipo design; restauramos el diseño
        // original para no dejar cambios en esa foto.
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          await withTimeout(
            photoCampaignsApi.uploadProductPhoto(productId, {
              photoType: 'design',
              file: baseFile,
              photoCampaignId,
              parentAssetId,
            }),
            DOWNLOAD_TIMEOUT_MS,
            'La restauración del diseño'
          );
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 700));
          }
        }
      } catch (error: any) {
        logger.error('[PHOTO_CAMPAIGNS][AD_DESIGN] Background generation error', error);
        Alert.alert('Error', error?.message || 'No se pudo guardar la foto con precio.');
      } finally {
        setFlag(productId, parentAssetId, 'price', false);
        bumpCompleted(productId);
      }
    },
  };
});
