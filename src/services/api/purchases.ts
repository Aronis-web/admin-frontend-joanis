import { apiClient } from './client';
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

  // ============================================
  // Purchase Products
  // ============================================

  /**
   * Get all products for a purchase
   */
  async getPurchaseProducts(purchaseId: string): Promise<PurchaseProduct[]> {
    return apiClient.get<PurchaseProduct[]>(`${this.basePath}/${purchaseId}/products`);
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
   * Scan document with OCR (read-only, doesn't add products)
   */
  async scanDocument(imageBase64: string): Promise<OcrScanResponse> {
    return apiClient.post<OcrScanResponse>(`${this.basePath}/ocr/scan`, {
      imageBase64,
    });
  }
}

// Export service instance
export const purchasesService = new PurchasesService();
