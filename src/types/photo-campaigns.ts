export type PhotoCampaignStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type PhotoType = 'reference' | 'design' | 'price';

export interface PhotoCampaignProductRef {
  id: string;
  title: string;
  sku: string;
}

export interface PhotoCampaignProductItem {
  id: string;
  photoCampaignId: string;
  productId: string;
  notes?: string;
  sortOrder?: number;
  addedBy?: string;
  addedAt?: string;
  updatedAt?: string;
  product?: PhotoCampaignProductRef;
}

export interface PhotoCampaign {
  id: string;
  code: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: PhotoCampaignStatus;
  companyId: string;
  siteId?: string;
  createdBy?: string;
  notes?: string;
  products?: PhotoCampaignProductItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePhotoCampaignRequest {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface UpdatePhotoCampaignRequest {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface LinkCampaignRequest {
  campaignId: string;
}

export interface LinkCampaignResult {
  /** true si se creó un vínculo nuevo, false si ya existía. */
  linked?: boolean;
  /** productos agregados en esta sincronización. */
  added: number;
  /** productos source=campaign retirados en esta sincronización. */
  removed: number;
  /** total de productos provenientes de campañas vinculadas. */
  totalSynced: number;
}

export interface PhotoCampaignLink {
  id: string;
  photoCampaignId: string;
  campaignId: string;
  addedBy?: string;
  createdAt: string;
  campaign?: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
}

export interface AddPhotoCampaignProductRequest {
  productId: string;
  notes?: string;
  sortOrder?: number;
}

export interface UpdatePhotoCampaignProductRequest {
  notes?: string;
  sortOrder?: number;
}

export interface ProductPhotoAsset {
  id: string;
  productId: string;
  photoCampaignId?: string;
  photoType: PhotoType;
  /** Reference (grupo) al que pertenece el design/price. null en reference y grupo por defecto. */
  parentAssetId?: string | null;
  /** Nombre opcional del grupo (solo reference). */
  label?: string | null;
  /** Orden del grupo (solo reference). */
  sortOrder?: number;
  filePath: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Grupo de fotos anclado a un reference. Cada grupo trae su reference y, anidados,
 * su design y price (o null si aún no se subieron). Un grupo con `parentAssetId: null`
 * corresponde al grupo por defecto histórico.
 */
export interface PhotoGroup {
  parentAssetId: string | null;
  label?: string | null;
  sortOrder?: number;
  reference: ProductPhotoAsset | null;
  design: ProductPhotoAsset | null;
  price: ProductPhotoAsset | null;
}

export interface UploadProductPhotoRequest {
  photoType: PhotoType;
  file: any;
  photoCampaignId?: string;
  /** Reference (grupo) al que se adjunta el design/price. Omitir para reference. */
  parentAssetId?: string;
  /** Nombre del grupo (solo reference). */
  label?: string;
  /** Orden del grupo (solo reference). */
  sortOrder?: number;
}

export type AdDesignTemplate = 'promo' | 'premium' | 'minimal';

export interface GenerateAdDesignRequest {
  file: any;
  name: string;
  sku: string;
  price: string;
  template?: AdDesignTemplate;
  photoCampaignId?: string;
  /** Reference (grupo) al que se adjunta el design generado. */
  parentAssetId?: string;
}

export interface GenerateAdDesignResponse {
  success?: boolean;
  asset?: ProductPhotoAsset;
  imageUrl?: string;
  url?: string;
  fileUrl?: string;
  [key: string]: any;
}

export interface PhotoCampaignWhatsappContact {
  id: string;
  name?: string;
  phone?: string;
  [key: string]: any;
}

export interface SendPhotoCampaignWhatsappRequest {
  contactId: string;
  sendAll?: boolean;
  photoAssetIds?: string[];
  photoTypes?: PhotoType[];
  caption?: string;
}

export interface SendPhotoCampaignWhatsappResponse {
  success?: boolean;
  message?: string;
  sentCount?: number;
  [key: string]: any;
}

// ============================================
// Smart Design (generación automática con IA)
// ============================================

export type SmartDesignItemStatus = 'pending' | 'processing' | 'done' | 'error';

export interface SmartDesignCounts {
  pending: number;
  processing: number;
  done: number;
  error: number;
  total: number;
}

export interface SmartDesignItem {
  itemId: string;
  productId: string;
  status: SmartDesignItemStatus;
  error?: string | null;
  assetId?: string | null;
  generatedAt?: string | null;
}

export interface SmartDesignStatus {
  enabled: boolean;
  triggeredAt?: string | null;
  counts: SmartDesignCounts;
  items: SmartDesignItem[];
}

// ============================================
// Smart Price (aplicación masiva de precio por backend)
// ============================================

export type SmartPriceTemplate = 'premium' | 'promo' | 'remate' | 'minimal';

export interface SmartPriceApplyRequest {
  template?: SmartPriceTemplate;
}

export interface SmartPriceItem {
  itemId: string;
  productId: string;
  groups: number;
  priced: number;
}

export interface SmartPriceStatus {
  total: number;
  withPrice: number;
  withoutPrice: number;
  items: SmartPriceItem[];
}
