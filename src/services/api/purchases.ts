import { apiClient } from './client';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import {
  Purchase,
  PurchasesResponse,
  CreatePurchaseRequest,
  UpdatePurchaseRequest,
  QueryPurchasesParams,
  PurchaseProduct,
  PurchaseProductPresentationHistory,
  AddProductRequest,
  UpdateProductRequest,
  ValidateProductRequest,
  RejectProductRequest,
  AssignDebtRequest,
  PurchaseSummaryResponse,
  ValidationStatusResponse,
  PurchaseStatusHistory,
  OcrScanResponse,
  PurchaseTotalSumResponse,
  PurchaseValidationProgressResponse,
} from '@/types/purchases';

/**
 * Purchases API Service
 */
class PurchasesService {
  private readonly basePath = '/admin/purchases';

  // ============================================
  // Purchases CRUD
  // ============================================

  /**
   * Get all purchases with optional filters
   */
  async getPurchases(params?: QueryPurchasesParams): Promise<PurchasesResponse> {
    return apiClient.get<PurchasesResponse>(this.basePath, { params });
  }

  /**
   * Get a single purchase by ID
   */
  async getPurchase(id: string): Promise<Purchase> {
    return apiClient.get<Purchase>(`${this.basePath}/${id}`);
  }

  /**
   * Create a new purchase
   */
  async createPurchase(data: CreatePurchaseRequest): Promise<Purchase> {
    return apiClient.post<Purchase>(this.basePath, data);
  }

  /**
   * Update a purchase (only in DRAFT status)
   */
  async updatePurchase(id: string, data: UpdatePurchaseRequest): Promise<Purchase> {
    return apiClient.patch<Purchase>(`${this.basePath}/${id}`, data);
  }

  /**
   * Cancel a purchase
   */
  async cancelPurchase(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  /**
   * Close a purchase
   */
  async closePurchase(id: string): Promise<Purchase> {
    return apiClient.post<Purchase>(`${this.basePath}/${id}/close`);
  }

  /**
   * Get purchase summary
   */
  async getPurchaseSummary(id: string): Promise<PurchaseSummaryResponse> {
    return apiClient.get<PurchaseSummaryResponse>(`${this.basePath}/${id}/summary`);
  }

  /**
   * Get purchase status history
   */
  async getPurchaseHistory(id: string): Promise<PurchaseStatusHistory[]> {
    return apiClient.get<PurchaseStatusHistory[]>(`${this.basePath}/${id}/history`);
  }

  /**
   * Get validation status
   */
  async getValidationStatus(id: string): Promise<ValidationStatusResponse> {
    return apiClient.get<ValidationStatusResponse>(`${this.basePath}/${id}/validation-status`);
  }

  /**
   * Get purchase total sum (validated and unvalidated)
   */
  async getPurchaseTotalSum(id: string): Promise<PurchaseTotalSumResponse> {
    return apiClient.get<PurchaseTotalSumResponse>(`${this.basePath}/${id}/total-sum`);
  }

  /**
   * Get purchase validation progress
   */
  async getPurchaseValidationProgress(id: string): Promise<PurchaseValidationProgressResponse> {
    return apiClient.get<PurchaseValidationProgressResponse>(`${this.basePath}/${id}/validation-progress`);
  }

  // ============================================
  // Purchase Products
  // ============================================

  /**
   * Get all products for a purchase
   */
  async getPurchaseProducts(
    purchaseId: string,
    params?: { includeProductStatus?: string }
  ): Promise<PurchaseProduct[]> {
    return apiClient.get<PurchaseProduct[]>(`${this.basePath}/${purchaseId}/products`, { params });
  }

  /**
   * Add a product to a purchase
   */
  async addProduct(purchaseId: string, data: AddProductRequest): Promise<PurchaseProduct> {
    return apiClient.post<PurchaseProduct>(`${this.basePath}/${purchaseId}/products`, data);
  }

  /**
   * Update a purchase product (only PRELIMINARY status)
   */
  async updateProduct(
    purchaseId: string,
    productId: string,
    data: UpdateProductRequest
  ): Promise<PurchaseProduct> {
    return apiClient.patch<PurchaseProduct>(
      `${this.basePath}/${purchaseId}/products/${productId}`,
      data
    );
  }

  /**
   * Delete a purchase product (only PRELIMINARY status)
   */
  async deleteProduct(purchaseId: string, productId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${purchaseId}/products/${productId}`);
  }

  /**
   * Start validation of a product
   */
  async startValidation(purchaseId: string, productId: string): Promise<PurchaseProduct> {
    return apiClient.post<PurchaseProduct>(
      `${this.basePath}/${purchaseId}/products/${productId}/start-validation`
    );
  }

  /**
   * Validate product data
   */
  async validateProduct(
    purchaseId: string,
    productId: string,
    data: ValidateProductRequest
  ): Promise<PurchaseProduct> {
    return apiClient.patch<PurchaseProduct>(
      `${this.basePath}/${purchaseId}/products/${productId}/validate`,
      data
    );
  }

  /**
   * Close validation and activate product
   */
  async closeValidation(purchaseId: string, productId: string): Promise<PurchaseProduct> {
    return apiClient.post<PurchaseProduct>(
      `${this.basePath}/${purchaseId}/products/${productId}/close-validation`
    );
  }

  /**
   * Reject a product
   */
  async rejectProduct(
    purchaseId: string,
    productId: string,
    data: RejectProductRequest
  ): Promise<PurchaseProduct> {
    return apiClient.post<PurchaseProduct>(
      `${this.basePath}/${purchaseId}/products/${productId}/reject`,
      data
    );
  }

  /**
   * Assign debt to legal entity
   */
  async assignDebt(
    purchaseId: string,
    productId: string,
    data: AssignDebtRequest
  ): Promise<PurchaseProduct> {
    return apiClient.post<PurchaseProduct>(
      `${this.basePath}/${purchaseId}/products/${productId}/assign-debt`,
      data
    );
  }

  /**
   * Get presentation history for a purchase product
   */
  async getPresentationHistory(
    purchaseId: string,
    productId: string
  ): Promise<PurchaseProductPresentationHistory[]> {
    return apiClient.get<PurchaseProductPresentationHistory[]>(
      `${this.basePath}/${purchaseId}/products/${productId}/presentation-history`
    );
  }

  // ============================================
  // OCR Scanner
  // ============================================

  /**
   * Scan document with OCR using FormData (supports images and PDFs)
   */
  /**
   * Scan multiple documents using batch OCR (OPTIMIZED - 60-80% faster)
   * Processes up to 10 files in a single API call
   * React Native compatible - uses fetch internally for proper FormData handling
   */
  async scanDocuments(
    files: Array<{ uri: string; filename: string; mimeType: string }>,
    observaciones?: string
  ): Promise<OcrScanResponse> {
    const formData = new FormData();

    // Append all files - React Native format
    // Each file must have: uri, type, and name
    files.forEach((file) => {
      formData.append('files', {
        uri: file.uri,
        type: file.mimeType,
        name: file.filename,
      } as any);
    });

    // Append observations if provided
    if (observaciones && observaciones.trim()) {
      formData.append('observaciones', observaciones);
    }

    // ApiClient will automatically use fetch for FormData
    // DO NOT set Content-Type - fetch will handle it with proper boundary
    return apiClient.post<OcrScanResponse>(`${this.basePath}/ocr/scan`, formData);
  }

  /**
   * Scan documents sequentially (fallback for when batch processing times out)
   * Processes files one at a time with progress callback
   */
  async scanDocumentsSequentially(
    files: Array<{ uri: string; filename: string; mimeType: string }>,
    observaciones?: string,
    onProgress?: (current: number, total: number, filename: string) => void
  ): Promise<OcrScanResponse> {
    const allItems: any[] = [];
    let totalEstimado = 0;
    let archivosProcessados = 0;
    const observacionesArray: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Notify progress
      if (onProgress) {
        onProgress(i + 1, files.length, file.filename);
      }

      try {
        // Scan single file
        const formData = new FormData();
        formData.append('files', {
          uri: file.uri,
          type: file.mimeType,
          name: file.filename,
        } as any);

        if (observaciones && observaciones.trim()) {
          formData.append('observaciones', observaciones);
        }

        const response = await apiClient.post<OcrScanResponse>(
          `${this.basePath}/ocr/scan`,
          formData
        );

        // Accumulate results
        if (response.items && Array.isArray(response.items)) {
          allItems.push(...response.items);
        }

        totalEstimado += response.total_estimado || 0;
        archivosProcessados++;

        if (response.observaciones) {
          observacionesArray.push(response.observaciones);
        }
      } catch (error) {
        console.error(`Error scanning file ${file.filename}:`, error);
        // Continue with next file instead of failing completely
        observacionesArray.push(`Error procesando ${file.filename}`);
      }
    }

    // Return combined response
    return {
      items: allItems,
      total_estimado: totalEstimado,
      archivos_procesados: archivosProcessados,
      observaciones: observacionesArray.length > 0 ? observacionesArray.join('; ') : undefined,
    } as OcrScanResponse;
  }

  /**
   * Scan a single document (for backward compatibility)
   * @deprecated Use scanDocuments instead for better performance
   */
  async scanDocument(uri: string, filename: string, mimeType: string): Promise<OcrScanResponse> {
    // Use the new batch endpoint with a single file
    return this.scanDocuments([{ uri, filename, mimeType }]);
  }

  // ============================================
  // Reports
  // ============================================

  /**
   * Download purchase report PDF
   * Returns a blob that can be used to download/view the PDF
   * @param purchaseId - ID of the purchase
   */
  async downloadPurchaseReportPdf(purchaseId: string): Promise<Blob> {
    // Get fresh token and context
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();

    // REMOVED: Proactive token refresh to prevent race conditions
    // Token refresh will happen automatically on 401 errors via apiClient interceptor

    const token = authStore.token;
    const userId = authStore.user?.id;
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      Authorization: `Bearer ${token}`,
    };

    if (userId) {
      headers['X-User-Id'] = userId;
    }
    if (companyId) {
      headers['X-Company-Id'] = companyId;
    }
    if (siteId) {
      headers['X-Site-Id'] = siteId;
    }

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    urlParams.append('t', timestamp.toString());

    const url = `${config.API_URL}${this.basePath}/${purchaseId}/report/pdf?${urlParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.blob();
  }
}

// Export service instance
export const purchasesService = new PurchasesService();
