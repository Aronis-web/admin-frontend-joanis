import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CampaignPreSale,
  CampaignPreSalesResponse,
  QueryCampaignPreSalesParams,
  CampaignPreSaleStatus,
} from '@/types/campaign-pre-sales';
import { campaignPreSalesService } from '@/services/api';
import { logger } from '@/utils/logger';

// ============================================
// Query Keys
// ============================================

export const campaignPreSaleKeys = {
  all: ['campaign-pre-sales'] as const,
  lists: () => [...campaignPreSaleKeys.all, 'list'] as const,
  list: (params?: QueryCampaignPreSalesParams) => [...campaignPreSaleKeys.lists(), params] as const,
  byClosureBatch: (closureBatchId: string) =>
    [...campaignPreSaleKeys.all, 'closure-batch', closureBatchId] as const,
  details: () => [...campaignPreSaleKeys.all, 'detail'] as const,
  detail: (id: string) => [...campaignPreSaleKeys.details(), id] as const,
};

// ============================================
// Queries
// ============================================

/**
 * Listar pre-ventas con paginación, filtros y buscador.
 */
export const useCampaignPreSales = (params?: QueryCampaignPreSalesParams) => {
  return useQuery({
    queryKey: campaignPreSaleKeys.list(params),
    queryFn: (): Promise<CampaignPreSalesResponse> => campaignPreSalesService.getPreSales(params),
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Consultar la pre-venta asociada a un cierre parcial v2.
 */
export const useCampaignPreSaleByClosureBatch = (closureBatchId: string) => {
  return useQuery({
    queryKey: campaignPreSaleKeys.byClosureBatch(closureBatchId),
    queryFn: (): Promise<CampaignPreSale> =>
      campaignPreSalesService.getPreSaleByClosureBatch(closureBatchId),
    enabled: !!closureBatchId,
    staleTime: 3 * 60 * 1000,
  });
};

/**
 * Detalle de una pre-venta (con items).
 */
export const useCampaignPreSale = (id: string) => {
  return useQuery({
    queryKey: campaignPreSaleKeys.detail(id),
    queryFn: (): Promise<CampaignPreSale> => campaignPreSalesService.getPreSale(id),
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  });
};

// ============================================
// Mutations
// ============================================

/**
 * Crear pre-venta desde un cierre parcial v2 (idempotente).
 */
export const useCreateCampaignPreSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ closureBatchId, notes }: { closureBatchId: string; notes?: string }) =>
      campaignPreSalesService.createPreSale(closureBatchId, notes),
    onSuccess: (newPreSale) => {
      // Refrescar listado y la consulta por cierre (idempotencia).
      queryClient.invalidateQueries({ queryKey: campaignPreSaleKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: campaignPreSaleKeys.byClosureBatch(newPreSale.closureBatchId),
      });
      queryClient.setQueryData(campaignPreSaleKeys.detail(newPreSale.id), newPreSale);
      logger.info('Pre-venta creada', { id: newPreSale.id });
    },
  });
};

/**
 * Cambiar estado de una pre-venta (DRAFT → CONFIRMED / CANCELLED).
 */
export const useUpdateCampaignPreSaleStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: Exclude<CampaignPreSaleStatus, CampaignPreSaleStatus.DRAFT>;
    }) => campaignPreSalesService.updatePreSaleStatus(id, status),
    onSuccess: (updatedPreSale, variables) => {
      queryClient.setQueryData(campaignPreSaleKeys.detail(variables.id), updatedPreSale);
      queryClient.invalidateQueries({ queryKey: campaignPreSaleKeys.lists() });
      logger.info('Estado de pre-venta actualizado', { id: variables.id });
    },
  });
};
