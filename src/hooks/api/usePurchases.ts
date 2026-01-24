import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesService } from '@/services/api';
import {
  Purchase,
  PurchasesResponse,
  CreatePurchaseRequest,
  UpdatePurchaseRequest,
  QueryPurchasesParams,
  AddProductRequest,
  UpdateProductRequest,
  ValidateProductRequest,
  RejectProductRequest,
  AssignDebtRequest,
  PurchaseProduct,
  PurchaseSummaryResponse,
  ValidationStatusResponse,
  PurchaseStatusHistory,
  OcrScanResponse,
  PurchaseTotalSumResponse,
  PurchaseProductPresentationHistory,
} from '@/types/purchases';

// ============================================
// Query Keys Factory
// ============================================
export const purchaseKeys = {
  all: ['purchases'] as const,
  lists: () => [...purchaseKeys.all, 'list'] as const,
  list: (params?: QueryPurchasesParams) => [...purchaseKeys.lists(), params] as const,
  details: () => [...purchaseKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseKeys.details(), id] as const,
  summary: (id: string) => [...purchaseKeys.all, 'summary', id] as const,
  history: (id: string) => [...purchaseKeys.all, 'history', id] as const,
  validationStatus: (id: string) => [...purchaseKeys.all, 'validation-status', id] as const,
  totalSum: (id: string) => [...purchaseKeys.all, 'total-sum', id] as const,
  products: (purchaseId: string) => [...purchaseKeys.all, 'products', purchaseId] as const,
  presentationHistory: (purchaseId: string, productId: string) =>
    [...purchaseKeys.all, 'presentation-history', purchaseId, productId] as const,
};

// ============================================
// Queries
// ============================================

/**
 * Get all purchases with optional filters
 */
export const usePurchases = (params?: QueryPurchasesParams) => {
  return useQuery({
    queryKey: purchaseKeys.list(params),
    queryFn: () => purchasesService.getPurchases(params),
  });
};

/**
 * Get a single purchase by ID
 */
export const usePurchase = (id: string) => {
  return useQuery({
    queryKey: purchaseKeys.detail(id),
    queryFn: () => purchasesService.getPurchase(id),
    enabled: !!id,
  });
};

/**
 * Get purchase summary
 */
export const usePurchaseSummary = (id: string) => {
  return useQuery({
    queryKey: purchaseKeys.summary(id),
    queryFn: () => purchasesService.getPurchaseSummary(id),
    enabled: !!id,
  });
};

/**
 * Get purchase status history
 */
export const usePurchaseHistory = (id: string) => {
  return useQuery({
    queryKey: purchaseKeys.history(id),
    queryFn: () => purchasesService.getPurchaseHistory(id),
    enabled: !!id,
  });
};

/**
 * Get validation status
 */
export const useValidationStatus = (id: string) => {
  return useQuery({
    queryKey: purchaseKeys.validationStatus(id),
    queryFn: () => purchasesService.getValidationStatus(id),
    enabled: !!id,
  });
};

/**
 * Get purchase total sum
 */
export const usePurchaseTotalSum = (id: string) => {
  return useQuery({
    queryKey: purchaseKeys.totalSum(id),
    queryFn: () => purchasesService.getPurchaseTotalSum(id),
    enabled: !!id,
  });
};

/**
 * Get all products for a purchase
 */
export const usePurchaseProducts = (
  purchaseId: string,
  params?: { includeProductStatus?: string }
) => {
  return useQuery({
    queryKey: purchaseKeys.products(purchaseId),
    queryFn: () => purchasesService.getPurchaseProducts(purchaseId, params),
    enabled: !!purchaseId,
  });
};

/**
 * Get presentation history for a purchase product
 */
export const usePresentationHistory = (purchaseId: string, productId: string) => {
  return useQuery({
    queryKey: purchaseKeys.presentationHistory(purchaseId, productId),
    queryFn: () => purchasesService.getPresentationHistory(purchaseId, productId),
    enabled: !!purchaseId && !!productId,
  });
};

// ============================================
// Mutations
// ============================================

/**
 * Create a new purchase
 */
export const useCreatePurchase = () => {
  const queryClient = useQueryClient();

  return useMutation<Purchase, Error, CreatePurchaseRequest>({
    mutationFn: (data) => purchasesService.createPurchase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
    },
  });
};

/**
 * Update a purchase
 */
export const useUpdatePurchase = () => {
  const queryClient = useQueryClient();

  return useMutation<Purchase, Error, { id: string; data: UpdatePurchaseRequest }>({
    mutationFn: ({ id, data }) => purchasesService.updatePurchase(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
    },
  });
};

/**
 * Cancel a purchase
 */
export const useCancelPurchase = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => purchasesService.cancelPurchase(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
    },
  });
};

/**
 * Close a purchase
 */
export const useClosePurchase = () => {
  const queryClient = useQueryClient();

  return useMutation<Purchase, Error, string>({
    mutationFn: (id) => purchasesService.closePurchase(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.summary(id) });
    },
  });
};

/**
 * Add a product to a purchase
 */
export const useAddPurchaseProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<PurchaseProduct, Error, { purchaseId: string; data: AddProductRequest }>({
    mutationFn: ({ purchaseId, data }) => purchasesService.addProduct(purchaseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.products(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.summary(variables.purchaseId) });
    },
  });
};

/**
 * Update a purchase product
 */
export const useUpdatePurchaseProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseProduct,
    Error,
    { purchaseId: string; productId: string; data: UpdateProductRequest }
  >({
    mutationFn: ({ purchaseId, productId, data }) =>
      purchasesService.updateProduct(purchaseId, productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.products(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.summary(variables.purchaseId) });
    },
  });
};

/**
 * Delete a purchase product
 */
export const useDeletePurchaseProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { purchaseId: string; productId: string }>({
    mutationFn: ({ purchaseId, productId }) =>
      purchasesService.deleteProduct(purchaseId, productId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.products(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.summary(variables.purchaseId) });
    },
  });
};

/**
 * Start validation of a product
 */
export const useStartValidation = () => {
  const queryClient = useQueryClient();

  return useMutation<PurchaseProduct, Error, { purchaseId: string; productId: string }>({
    mutationFn: ({ purchaseId, productId }) =>
      purchasesService.startValidation(purchaseId, productId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.products(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.purchaseId) });
      queryClient.invalidateQueries({
        queryKey: purchaseKeys.validationStatus(variables.purchaseId),
      });
    },
  });
};

/**
 * Validate product data
 */
export const useValidateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseProduct,
    Error,
    { purchaseId: string; productId: string; data: ValidateProductRequest }
  >({
    mutationFn: ({ purchaseId, productId, data }) =>
      purchasesService.validateProduct(purchaseId, productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.products(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.purchaseId) });
      queryClient.invalidateQueries({
        queryKey: purchaseKeys.validationStatus(variables.purchaseId),
      });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.summary(variables.purchaseId) });
    },
  });
};

/**
 * Close validation and activate product
 */
export const useCloseValidation = () => {
  const queryClient = useQueryClient();

  return useMutation<PurchaseProduct, Error, { purchaseId: string; productId: string }>({
    mutationFn: ({ purchaseId, productId }) =>
      purchasesService.closeValidation(purchaseId, productId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.products(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.purchaseId) });
      queryClient.invalidateQueries({
        queryKey: purchaseKeys.validationStatus(variables.purchaseId),
      });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.summary(variables.purchaseId) });
    },
  });
};

/**
 * Reject a product
 */
export const useRejectProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseProduct,
    Error,
    { purchaseId: string; productId: string; data: RejectProductRequest }
  >({
    mutationFn: ({ purchaseId, productId, data }) =>
      purchasesService.rejectProduct(purchaseId, productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.products(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.purchaseId) });
      queryClient.invalidateQueries({
        queryKey: purchaseKeys.validationStatus(variables.purchaseId),
      });
    },
  });
};

/**
 * Assign debt to legal entity
 */
export const useAssignDebt = () => {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseProduct,
    Error,
    { purchaseId: string; productId: string; data: AssignDebtRequest }
  >({
    mutationFn: ({ purchaseId, productId, data }) =>
      purchasesService.assignDebt(purchaseId, productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.products(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.purchaseId) });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.summary(variables.purchaseId) });
    },
  });
};

/**
 * Scan documents with OCR
 */
export const useScanDocuments = () => {
  return useMutation<
    OcrScanResponse,
    Error,
    { files: Array<{ uri: string; filename: string; mimeType: string }>; observaciones?: string }
  >({
    mutationFn: ({ files, observaciones }) =>
      purchasesService.scanDocuments(files, observaciones),
  });
};

/**
 * Scan documents sequentially with OCR
 */
export const useScanDocumentsSequentially = () => {
  return useMutation<
    OcrScanResponse,
    Error,
    {
      files: Array<{ uri: string; filename: string; mimeType: string }>;
      observaciones?: string;
      onProgress?: (current: number, total: number, filename: string) => void;
    }
  >({
    mutationFn: ({ files, observaciones, onProgress }) =>
      purchasesService.scanDocumentsSequentially(files, observaciones, onProgress),
  });
};
