import { apiClient } from './client';
import {
  PhotoCampaign,
  CreatePhotoCampaignRequest,
  UpdatePhotoCampaignRequest,
  LinkCampaignResult,
  PhotoCampaignLink,
  PhotoCampaignProductItem,
  AddPhotoCampaignProductRequest,
  UpdatePhotoCampaignProductRequest,
  ProductPhotoAsset,
  PhotoGroup,
  UploadProductPhotoRequest,
  GenerateAdDesignRequest,
  GenerateAdDesignResponse,
  PhotoCampaignWhatsappContact,
  SendPhotoCampaignWhatsappRequest,
  SendPhotoCampaignWhatsappResponse,
  SmartDesignStatus,
  SmartPriceApplyRequest,
  SmartPriceStatus,
  CampaignVideo,
  CampaignVideoListItem,
  CreateCampaignVideoRequest,
} from '@/types/photo-campaigns';

class PhotoCampaignsApi {
  private readonly basePath = '/admin/photo-campaigns';
  private readonly geminiEditorPath = '/admin/gemini-image-editor/edit';

  getCampaigns(): Promise<PhotoCampaign[]> {
    return apiClient.get<PhotoCampaign[]>(this.basePath);
  }

  getCampaignById(id: string): Promise<PhotoCampaign> {
    return apiClient.get<PhotoCampaign>(`${this.basePath}/${id}`);
  }

  createCampaign(payload: CreatePhotoCampaignRequest): Promise<PhotoCampaign> {
    return apiClient.post<PhotoCampaign>(this.basePath, payload);
  }

  updateCampaign(id: string, payload: UpdatePhotoCampaignRequest): Promise<PhotoCampaign> {
    return apiClient.patch<PhotoCampaign>(`${this.basePath}/${id}`, payload);
  }

  activateCampaign(id: string): Promise<{ id: string; status: string }> {
    return apiClient.post<{ id: string; status: string }>(`${this.basePath}/${id}/activate`, {});
  }

  closeCampaign(id: string): Promise<{ id: string; status: string }> {
    return apiClient.post<{ id: string; status: string }>(`${this.basePath}/${id}/close`, {});
  }

  deleteCampaign(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  // ============================================
  // Campañas regulares anexadas (vínculos)
  // ============================================

  /** Anexa (vincula) una campaña regular y sincroniza sus productos. */
  linkCampaign(photoCampaignId: string, campaignId: string): Promise<LinkCampaignResult> {
    return apiClient.post<LinkCampaignResult>(`${this.basePath}/${photoCampaignId}/campaigns`, {
      campaignId,
    });
  }

  /** Lista las campañas regulares anexadas a una campaña de fotos. */
  getLinkedCampaigns(photoCampaignId: string): Promise<PhotoCampaignLink[]> {
    return apiClient.get<PhotoCampaignLink[]>(`${this.basePath}/${photoCampaignId}/campaigns`);
  }

  /** Desvincula una campaña regular de la campaña de fotos. */
  unlinkCampaign(photoCampaignId: string, campaignId: string): Promise<LinkCampaignResult> {
    return apiClient.delete<LinkCampaignResult>(
      `${this.basePath}/${photoCampaignId}/campaigns/${campaignId}`
    );
  }

  /** Vista inversa: campañas de fotos donde está anexada una campaña regular. */
  getPhotoCampaignsByCampaign(campaignId: string): Promise<PhotoCampaign[]> {
    return apiClient.get<PhotoCampaign[]>(`${this.basePath}/by-campaign/${campaignId}`);
  }

  getCampaignProducts(campaignId: string): Promise<PhotoCampaignProductItem[]> {
    return apiClient.get<PhotoCampaignProductItem[]>(`${this.basePath}/${campaignId}/products`);
  }

  addCampaignProduct(
    campaignId: string,
    payload: AddPhotoCampaignProductRequest
  ): Promise<PhotoCampaignProductItem> {
    return apiClient.post<PhotoCampaignProductItem>(
      `${this.basePath}/${campaignId}/products`,
      payload
    );
  }

  updateCampaignProduct(
    campaignId: string,
    itemId: string,
    payload: UpdatePhotoCampaignProductRequest
  ): Promise<PhotoCampaignProductItem> {
    return apiClient.patch<PhotoCampaignProductItem>(
      `${this.basePath}/${campaignId}/products/${itemId}`,
      payload
    );
  }

  removeCampaignProduct(campaignId: string, itemId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${campaignId}/products/${itemId}`);
  }

  getProductPhotos(productId: string): Promise<ProductPhotoAsset[]> {
    return apiClient.get<ProductPhotoAsset[]>(`${this.basePath}/products/${productId}/photos`);
  }

  /** Lista las fotos agrupadas por reference (cada grupo con su design y price). */
  getProductPhotoGroups(productId: string): Promise<PhotoGroup[]> {
    return apiClient.get<PhotoGroup[]>(`${this.basePath}/products/${productId}/photo-groups`);
  }

  uploadProductPhoto(
    productId: string,
    payload: UploadProductPhotoRequest
  ): Promise<ProductPhotoAsset> {
    const formData = new FormData();
    formData.append('photoType', payload.photoType);

    if (payload.photoCampaignId) {
      formData.append('photoCampaignId', payload.photoCampaignId);
    }

    if (payload.parentAssetId) {
      formData.append('parentAssetId', payload.parentAssetId);
    }

    if (payload.label) {
      formData.append('label', payload.label);
    }

    if (payload.sortOrder !== undefined && payload.sortOrder !== null) {
      formData.append('sortOrder', String(payload.sortOrder));
    }

    formData.append('file', payload.file as any);

    return apiClient.post<ProductPhotoAsset>(
      `${this.basePath}/products/${productId}/photos`,
      formData
    );
  }

  /** Elimina (desactiva) una foto. Si es un reference, elimina en cascada su design y price. */
  deleteProductPhoto(productId: string, assetId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/products/${productId}/photos/${assetId}`);
  }

  generateAdDesign(
    productId: string,
    payload: GenerateAdDesignRequest
  ): Promise<GenerateAdDesignResponse> {
    const formData = new FormData();
    formData.append('file', payload.file as any);
    formData.append('name', payload.name);
    formData.append('sku', payload.sku);
    formData.append('price', payload.price);

    if (payload.template) {
      formData.append('template', payload.template);
    }

    if (payload.photoCampaignId) {
      formData.append('photoCampaignId', payload.photoCampaignId);
    }

    if (payload.parentAssetId) {
      formData.append('parentAssetId', payload.parentAssetId);
    }

    return apiClient.post<GenerateAdDesignResponse>(
      `${this.basePath}/products/${productId}/ad-design`,
      formData
    );
  }

  getCampaignWhatsappContacts(campaignId: string): Promise<PhotoCampaignWhatsappContact[]> {
    return apiClient.get<PhotoCampaignWhatsappContact[]>(`${this.basePath}/${campaignId}/contacts`);
  }

  sendCampaignPhotosWhatsapp(
    campaignId: string,
    payload: SendPhotoCampaignWhatsappRequest
  ): Promise<SendPhotoCampaignWhatsappResponse> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const allowedPhotoTypes = new Set(['reference', 'design', 'price']);

    const rawPhotoAssetIds = (payload as any).photoAssetIds;
    const rawPhotoTypes = (payload as any).photoTypes;

    const normalizedPhotoAssetIds = Array.from(
      new Set(
        (rawPhotoAssetIds instanceof Set
          ? Array.from(rawPhotoAssetIds)
          : Array.isArray(rawPhotoAssetIds)
            ? rawPhotoAssetIds
            : rawPhotoAssetIds
              ? [rawPhotoAssetIds]
              : []
        )
          .filter(Boolean)
          .map((value) => String(value))
          .filter((value) => uuidRegex.test(value))
      )
    );

    const normalizedPhotoTypes = Array.from(
      new Set(
        (rawPhotoTypes instanceof Set
          ? Array.from(rawPhotoTypes)
          : Array.isArray(rawPhotoTypes)
            ? rawPhotoTypes
            : rawPhotoTypes
              ? [rawPhotoTypes]
              : []
        )
          .filter(Boolean)
          .map((value) => String(value))
          .filter((value) => allowedPhotoTypes.has(value))
      )
    ) as any;

    const sendAll = Boolean(payload.sendAll);

    const normalizedPayload: any = {
      contactId: payload.contactId,
      sendAll,
      caption: payload.caption,
    };

    if (!sendAll) {
      normalizedPayload.photoAssetIds = normalizedPhotoAssetIds;
    }

    if (normalizedPhotoTypes.length > 0) {
      normalizedPayload.photoTypes = normalizedPhotoTypes;
    }

    console.log('🧪 [PHOTO_CAMPAIGNS][WHATSAPP] payload', {
      contactId: normalizedPayload.contactId,
      sendAll: normalizedPayload.sendAll,
      hasPhotoAssetIds: Array.isArray(normalizedPayload.photoAssetIds),
      photoAssetIdsLength: normalizedPayload.photoAssetIds?.length || 0,
      hasPhotoTypes: Array.isArray(normalizedPayload.photoTypes),
      photoTypesLength: normalizedPayload.photoTypes?.length || 0,
      samplePhotoType: normalizedPayload.photoTypes?.[0],
    });

    return apiClient.post<SendPhotoCampaignWhatsappResponse>(
      `${this.basePath}/${campaignId}/send-whatsapp`,
      normalizedPayload
    );
  }

  // ============================================
  // Smart Design (generación automática de diseño con IA)
  // ============================================

  /**
   * Activa el modo de generación automática de diseños con IA para la campaña.
   * Idempotente: si ya estaba activo, devuelve el estado actual sin reprocesar.
   */
  enableSmartDesign(photoCampaignId: string): Promise<SmartDesignStatus> {
    return apiClient.post<SmartDesignStatus>(
      `${this.basePath}/${photoCampaignId}/smart-design/enable`,
      {}
    );
  }

  /**
   * Reinicia y reprocesa todos los productos de la campaña (aunque estén done).
   */
  rerunSmartDesign(photoCampaignId: string): Promise<SmartDesignStatus> {
    return apiClient.post<SmartDesignStatus>(
      `${this.basePath}/${photoCampaignId}/smart-design/rerun`,
      {}
    );
  }

  /**
   * Estado / progreso para hacer polling mientras haya items pending o processing.
   */
  getSmartDesignStatus(photoCampaignId: string): Promise<SmartDesignStatus> {
    return apiClient.get<SmartDesignStatus>(
      `${this.basePath}/${photoCampaignId}/smart-design/status`
    );
  }

  // ============================================
  // Smart Price (aplicación masiva de precio en el backend)
  // ============================================

  /**
   * Dispara en background la aplicación de precio para todos los productos de
   * la campaña. Retorna 202 Accepted; el progreso se consulta con `getSmartPriceStatus`.
   */
  applySmartPrice(photoCampaignId: string, payload: SmartPriceApplyRequest = {}): Promise<unknown> {
    return apiClient.post<unknown>(
      `${this.basePath}/${photoCampaignId}/smart-price/apply`,
      payload
    );
  }

  /** Estado / progreso de Smart Price (total, withPrice, withoutPrice, items). */
  getSmartPriceStatus(photoCampaignId: string): Promise<SmartPriceStatus> {
    return apiClient.get<SmartPriceStatus>(
      `${this.basePath}/${photoCampaignId}/smart-price/status`
    );
  }

  // ============================================
  // Videos publicitarios IA (pipeline asíncrono)
  // ============================================

  /**
   * Crea un video a partir de las fotos de la campaña en orden de prioridad.
   * Devuelve el detalle ya en `status = generating` con las secciones creadas.
   * El front debe empezar a hacer polling con `getCampaignVideo`.
   */
  createCampaignVideo(
    campaignId: string,
    payload: CreateCampaignVideoRequest
  ): Promise<CampaignVideo> {
    return apiClient.post<CampaignVideo>(`${this.basePath}/${campaignId}/videos`, payload);
  }

  /** Lista los videos de una campaña (orden por createdAt DESC). */
  getCampaignVideos(campaignId: string): Promise<CampaignVideoListItem[]> {
    return apiClient.get<CampaignVideoListItem[]>(`${this.basePath}/${campaignId}/videos`);
  }

  /** Detalle completo del video (endpoint de polling). */
  getCampaignVideo(videoId: string): Promise<CampaignVideo> {
    return apiClient.get<CampaignVideo>(`${this.basePath}/videos/${videoId}`);
  }

  /**
   * Descarga el clip crudo (.mp4 de Kling) de una sección como Blob.
   * Usa `apiClient` para adjuntar auth + tenant y evitar el bloqueo de CSP
   * (media-src solo permite 'self' y blob:).
   */
  getSectionClip(videoId: string, sectionId: string): Promise<Blob> {
    return apiClient.get<Blob>(`${this.basePath}/videos/${videoId}/sections/${sectionId}/clip`, {
      responseType: 'blob',
    });
  }

  /** Descarga la voz en off (.mp3) de una sección como Blob. */
  getSectionVoice(videoId: string, sectionId: string): Promise<Blob> {
    return apiClient.get<Blob>(`${this.basePath}/videos/${videoId}/sections/${sectionId}/voice`, {
      responseType: 'blob',
    });
  }

  /** Reintenta solo una sección (nuevo clip + voz). */
  regenerateVideoSection(videoId: string, sectionId: string): Promise<CampaignVideo> {
    return apiClient.post<CampaignVideo>(
      `${this.basePath}/videos/${videoId}/sections/${sectionId}/regenerate`,
      {}
    );
  }

  /** Re-ensambla el mp4 final sin regenerar los clips (requiere todas las secciones en done). */
  reassembleCampaignVideo(videoId: string): Promise<CampaignVideo> {
    return apiClient.post<CampaignVideo>(`${this.basePath}/videos/${videoId}/reassemble`, {});
  }

  /** Elimina el video y (en cascada) sus secciones. */
  deleteCampaignVideo(videoId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/videos/${videoId}`);
  }

  async editImageWithGemini(
    file: any,
    prompt: string
  ): Promise<{
    imageUrl?: string;
    url?: string;
    editedImageBase64?: string;
    mimeType?: string;
    [key: string]: any;
  }> {
    const formData = new FormData();
    formData.append('file', file as any);
    formData.append('prompt', prompt);

    console.log('🧪 [PHOTO_CAMPAIGNS][GEMINI] Request', {
      endpoint: this.geminiEditorPath,
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      promptLength: prompt?.length || 0,
    });

    const response = await apiClient.post<{
      imageUrl?: string;
      url?: string;
      editedImageBase64?: string;
      mimeType?: string;
      [key: string]: any;
    }>(this.geminiEditorPath, formData);

    console.log('🧪 [PHOTO_CAMPAIGNS][GEMINI] Raw response', response);

    return response;
  }
}

export const photoCampaignsApi = new PhotoCampaignsApi();
