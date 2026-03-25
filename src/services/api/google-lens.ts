import { apiClient } from './client';

export interface GoogleLensPrice {
  value: string;
  extracted_value: number;
  currency: string;
}

export interface GoogleLensResult {
  title: string;
  link: string;
  source: string;
  thumbnail: string;              // Imagen pequeña para preview (100-200px)
  image?: string;                 // Imagen mediana (mejor calidad)
  originalImage?: string;         // Imagen original (máxima calidad)
  price?: string | GoogleLensPrice;
  position?: number;
}

export interface GoogleLensKnowledgeGraph {
  title?: string;
  description?: string;
  [key: string]: any;
}

export interface ImageQualityAnalysis {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  sizeMB: number;
  megapixels: number;
  aspectRatio: string;
  quality: 'low' | 'medium' | 'high' | 'excellent';
  isGoodForSearch: boolean;
  isGoodForEcommerce: boolean;
  recommendations: string[];
}

export interface GoogleLensSearchResponse {
  success: boolean;
  imageQuality?: ImageQualityAnalysis;
  query: string;
  results: GoogleLensResult[];
  visualMatches: GoogleLensResult[];
  knowledgeGraph?: GoogleLensKnowledgeGraph;
  relatedSearches: string[];
}

export const googleLensApi = {
  /**
   * Search by uploading an image file
   */
  searchByUpload: async (fileUri: string, fileName: string): Promise<GoogleLensSearchResponse> => {
    const formData = new FormData();

    // Create a blob from the file URI (local file, no auth needed)
    const response = await fetch(fileUri);
    const blob = await response.blob();

    formData.append('file', blob, fileName);

    return apiClient.post<GoogleLensSearchResponse>('/google-lens/search-by-upload', formData);
  },

  /**
   * Search by providing an image URL
   */
  searchByUrl: async (imageUrl: string): Promise<GoogleLensSearchResponse> => {
    return apiClient.post<GoogleLensSearchResponse>('/google-lens/search-by-url', {
      imageUrl,
    });
  },

  /**
   * Download an image from a URL and return as local URI
   * In React Native, we can use the URL directly without downloading
   */
  downloadImage: async (imageUrl: string): Promise<string> => {
    // In React Native, we can use remote URLs directly in Image components
    // No need to download, just return the URL
    return imageUrl;
  },

  /**
   * Analyze quality of a single image by URL
   * POST /google-lens/analyze-quality-url
   */
  analyzeImageQuality: async (imageUrl: string): Promise<ImageQualityAnalysis> => {
    const result = await apiClient.post<{ success: boolean; imageQuality: ImageQualityAnalysis }>(
      '/google-lens/analyze-quality-url',
      { imageUrl }
    );

    return result.imageQuality;
  },
};

export default googleLensApi;
