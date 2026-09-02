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

// ============================================
// Videos publicitarios IA (a partir de una campaña de fotos)
// ============================================

/** Estado global del video. */
export type CampaignVideoStatus = 'pending' | 'generating' | 'assembling' | 'done' | 'error';

/** Estado de una sección individual del video. */
export type CampaignVideoSectionStatus = 'pending' | 'processing' | 'done' | 'error';

/** Tipo de sección: intro, un producto o cierre. */
export type CampaignVideoSectionKind = 'intro' | 'product' | 'outro';

/** Relación de aspecto soportada por el generador. */
export type CampaignVideoAspectRatio = '9:16' | '1:1' | '4:5' | '16:9';

export interface CampaignVideoConfig {
  voiceId?: string | null;
  musicPath?: string | null;
  musicVolume?: number;
  sectionDurationSec?: number;
  tone?: string | null;
  /** Dirección de arte global aplicada a las escenas generadas. */
  artDirection?: string | null;
  /** Si la IA compone una escena premium por sección antes de animar. */
  sceneGeneration?: boolean;
}

export interface CampaignVideoSection {
  id: string;
  sortOrder: number;
  kind: CampaignVideoSectionKind;
  productId?: string | null;
  photoAssetId?: string | null;
  /** Guion de la voz en off. */
  scriptText?: string | null;
  /** Precio en pantalla (solo secciones de producto). */
  priceLabel?: string | null;
  /** Prompt de cámara/movimiento (Kling). */
  motionPrompt?: string | null;
  /** Prompt de composición de la escena premium (Gemini). */
  editPrompt?: string | null;
  status: CampaignVideoSectionStatus;
  error?: string | null;
  /**
   * URL de preview (image/jpeg) de la escena que Gemini compuso y envió a Kling.
   * null hasta que el archivo exista.
   */
  sceneUrl?: string | null;
  /**
   * URL del clip crudo (.mp4) generado por Kling para esta toma (sin precio
   * superpuesto). null si la sección está en error o aún processing sin clip
   * descargado. Stream `video/mp4` con soporte Range/206.
   */
  clipUrl?: string | null;
  /**
   * URL de la voz en off (.mp3) de esta sección. null si el archivo aún no
   * existe. Stream `audio/mpeg`.
   */
  voiceUrl?: string | null;
}

/** Detalle completo del video (respuesta de creación / polling). */
export interface CampaignVideo {
  id: string;
  photoCampaignId: string;
  status: CampaignVideoStatus;
  aspectRatio: CampaignVideoAspectRatio;
  config: CampaignVideoConfig;
  /** null hasta que esté 'done'. */
  durationSeconds?: number | null;
  /** Bytes, null hasta 'done'. */
  finalFileSize?: number | null;
  error?: string | null;
  /** null si el video aún no está 'done'. */
  downloadUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  sections: CampaignVideoSection[];
}

/** Item de listado de videos de una campaña. */
export interface CampaignVideoListItem {
  id: string;
  status: CampaignVideoStatus;
  aspectRatio: CampaignVideoAspectRatio;
  durationSeconds?: number | null;
  createdAt: string;
  downloadUrl?: string | null;
}

/** Body para crear un video (POST /:id/videos). */
export interface CreateCampaignVideoRequest {
  /**
   * UUIDs de productos, en orden de prioridad de aparición. Min 1. La IA elige
   * la foto de referencia de cada producto (ya no se envían photoAssetIds).
   */
  productIds: string[];
  aspectRatio?: CampaignVideoAspectRatio;
  /** voice_id de ElevenLabs. */
  voiceId?: string | null;
  /** Ruta relativa (Z:) de música. */
  musicPath?: string | null;
  /** Tono del guion (ej. "energico", "elegante"). */
  tone?: string;
  /** Segundos por clip de producto. Entre 3 y 10. */
  sectionDurationSec?: number;
}
