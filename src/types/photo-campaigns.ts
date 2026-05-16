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
  filePath: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UploadProductPhotoRequest {
  photoType: PhotoType;
  file: any;
  photoCampaignId?: string;
}

export type AdDesignTemplate = 'promo' | 'premium' | 'minimal';

export interface GenerateAdDesignRequest {
  file: any;
  name: string;
  sku: string;
  price: string;
  template?: AdDesignTemplate;
  photoCampaignId?: string;
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
