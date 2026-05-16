import { apiClient } from './client';
import {
  PhotoCampaign,
  CreatePhotoCampaignRequest,
  UpdatePhotoCampaignRequest,
  PhotoCampaignProductItem,
  AddPhotoCampaignProductRequest,
  UpdatePhotoCampaignProductRequest,
  ProductPhotoAsset,
  UploadProductPhotoRequest,
  GenerateAdDesignRequest,
  GenerateAdDesignResponse,
  PhotoCampaignWhatsappContact,
  SendPhotoCampaignWhatsappRequest,
  SendPhotoCampaignWhatsappResponse,
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

  getCampaignProducts(campaignId: string): Promise<PhotoCampaignProductItem[]> {
    return apiClient.get<PhotoCampaignProductItem[]>(`${this.basePath}/${campaignId}/products`);
  }

  addCampaignProduct(
    campaignId: string,
    payload: AddPhotoCampaignProductRequest
  ): Promise<PhotoCampaignProductItem> {
    return apiClient.post<PhotoCampaignProductItem>(`${this.basePath}/${campaignId}/products`, payload);
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

  uploadProductPhoto(
    productId: string,
    payload: UploadProductPhotoRequest
  ): Promise<ProductPhotoAsset> {
    const formData = new FormData();
    formData.append('photoType', payload.photoType);

    if (payload.photoCampaignId) {
      formData.append('photoCampaignId', payload.photoCampaignId);
    }

    formData.append('file', payload.file as any);

    return apiClient.post<ProductPhotoAsset>(`${this.basePath}/products/${productId}/photos`, formData);
  }

  generateAdDesign(productId: string, payload: GenerateAdDesignRequest): Promise<GenerateAdDesignResponse> {
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

  async editImageWithGemini(
    file: any,
    prompt: string
  ): Promise<{ imageUrl?: string; url?: string; editedImageBase64?: string; mimeType?: string; [key: string]: any }> {
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
