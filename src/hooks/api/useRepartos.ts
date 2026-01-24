import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repartosService } from '@/services/api';
import {
  Reparto,
  RepartosResponse,
  CreateRepartoRequest,
  UpdateRepartoRequest,
  QueryRepartosParams,
  ValidarSalidaRequest,
  ValidacionSalida,
  RepartoStatus,
  RepartoProgressResponse,
} from '@/types/repartos';

// ============================================
// Query Keys
// ============================================

export const repartoKeys = {
  all: ['repartos'] as const,
  lists: () => [...repartoKeys.all, 'list'] as const,
  list: (params?: QueryRepartosParams) => [...repartoKeys.lists(), params] as const,
  byCampaign: (campaignId: string) => [...repartoKeys.all, 'campaign', campaignId] as const,
  details: () => [...repartoKeys.all, 'detail'] as const,
  detail: (id: string) => [...repartoKeys.details(), id] as const,
  progress: (id: string) => [...repartoKeys.all, 'progress', id] as const,
  validation: (repartoProductoId: string) =>
    [...repartoKeys.all, 'validation', repartoProductoId] as const,
  availableStock: (stockItemId: string) =>
    [...repartoKeys.all, 'available-stock', stockItemId] as const,
};

// ============================================
// Repartos CRUD Hooks
// ============================================

/**
 * Get all repartos with optional filters
 */
export const useRepartos = (params?: QueryRepartosParams) => {
  return useQuery({
    queryKey: repartoKeys.list(params),
    queryFn: () => repartosService.getRepartos(params),
  });
};

/**
 * Get repartos by campaign ID
 */
export const useRepartosByCampaign = (campaignId: string) => {
  return useQuery({
    queryKey: repartoKeys.byCampaign(campaignId),
    queryFn: () => repartosService.getRepartosByCampaign(campaignId),
    enabled: !!campaignId,
  });
};

/**
 * Get a single reparto by ID
 */
export const useReparto = (id: string) => {
  return useQuery({
    queryKey: repartoKeys.detail(id),
    queryFn: () => repartosService.getReparto(id),
    enabled: !!id,
  });
};

/**
 * Create a new reparto
 */
export const useCreateReparto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRepartoRequest) => repartosService.createReparto(data),
    onSuccess: (newReparto) => {
      queryClient.invalidateQueries({ queryKey: repartoKeys.lists() });
      if (newReparto.campaignId) {
        queryClient.invalidateQueries({
          queryKey: repartoKeys.byCampaign(newReparto.campaignId),
        });
      }
    },
  });
};

/**
 * Update a reparto
 */
export const useUpdateReparto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRepartoRequest }) =>
      repartosService.updateReparto(id, data),
    onSuccess: (updatedReparto, variables) => {
      queryClient.invalidateQueries({ queryKey: repartoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: repartoKeys.detail(variables.id) });
      if (updatedReparto.campaignId) {
        queryClient.invalidateQueries({
          queryKey: repartoKeys.byCampaign(updatedReparto.campaignId),
        });
      }
    },
  });
};

/**
 * Update reparto status
 */
export const useUpdateRepartoStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RepartoStatus }) =>
      repartosService.updateRepartoStatus(id, status),
    onSuccess: (updatedReparto, variables) => {
      queryClient.invalidateQueries({ queryKey: repartoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: repartoKeys.detail(variables.id) });
      if (updatedReparto.campaignId) {
        queryClient.invalidateQueries({
          queryKey: repartoKeys.byCampaign(updatedReparto.campaignId),
        });
      }
    },
  });
};

/**
 * Cancel a reparto (liberates stock automatically)
 */
export const useCancelReparto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      repartosService.cancelReparto(id, reason),
    onSuccess: (cancelledReparto, variables) => {
      queryClient.invalidateQueries({ queryKey: repartoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: repartoKeys.detail(variables.id) });
      if (cancelledReparto.campaignId) {
        queryClient.invalidateQueries({
          queryKey: repartoKeys.byCampaign(cancelledReparto.campaignId),
        });
      }
      // Invalidate stock queries since stock was liberated
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
};

/**
 * Delete a reparto (only PENDING or CANCELLED, liberates stock)
 */
export const useDeleteReparto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => repartosService.deleteReparto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repartoKeys.lists() });
      // Invalidate stock queries since stock was liberated
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
};

// ============================================
// Validaciones de Salida Hooks
// ============================================

/**
 * Get validation details for a reparto producto
 */
export const useValidacion = (repartoProductoId: string) => {
  return useQuery({
    queryKey: repartoKeys.validation(repartoProductoId),
    queryFn: () => repartosService.getValidacion(repartoProductoId),
    enabled: !!repartoProductoId,
  });
};

/**
 * Validate product exit (validar salida)
 * IMPORTANT: This reduces real stock and releases reservation
 */
export const useValidarSalida = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      repartoProductoId,
      data,
    }: {
      repartoProductoId: string;
      data: ValidarSalidaRequest;
    }) => repartosService.validarSalida(repartoProductoId, data),
    onSuccess: (_, variables) => {
      // Invalidate validation for this specific product
      queryClient.invalidateQueries({
        queryKey: repartoKeys.validation(variables.repartoProductoId),
      });
      // Invalidate all repartos since validation affects progress
      queryClient.invalidateQueries({ queryKey: repartoKeys.all });
      // Invalidate stock queries since real stock was reduced
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
};

// ============================================
// Stock Management Hooks
// ============================================

/**
 * Get available stock for a stock item
 */
export const useAvailableStock = (stockItemId: string) => {
  return useQuery({
    queryKey: repartoKeys.availableStock(stockItemId),
    queryFn: () => repartosService.getAvailableStock(stockItemId),
    enabled: !!stockItemId,
  });
};

// ============================================
// Progress and Reports Hooks
// ============================================

/**
 * Get reparto progress (assembly progress by participant)
 * Shows validation progress for products
 */
export const useRepartoProgress = (repartoId: string) => {
  return useQuery({
    queryKey: repartoKeys.progress(repartoId),
    queryFn: () => repartosService.getRepartoProgress(repartoId),
    enabled: !!repartoId,
  });
};

/**
 * Export totals report PDF for a reparto
 * Note: This is not a query hook since it returns a Blob for download
 * Use this directly in your component with async/await
 */
export const exportRepartoTotalsReport = async (repartoId: string, participantId?: string) => {
  return repartosService.exportRepartoTotalsReport(repartoId, participantId);
};

/**
 * Export PDF for a specific reparto
 * Note: This is not a query hook since it returns a Blob for download
 * Use this directly in your component with async/await
 */
export const exportRepartoPdf = async (repartoId: string) => {
  return repartosService.exportRepartoPdf(repartoId);
};

/**
 * Export all distribution sheets for a campaign as a single PDF
 * Note: This is not a query hook since it returns a Blob for download
 * Use this directly in your component with async/await
 */
export const exportCampaignDistributionSheets = async (
  campaignId: string,
  selectedProductIds?: string[]
) => {
  return repartosService.exportCampaignDistributionSheets(campaignId, selectedProductIds);
};
