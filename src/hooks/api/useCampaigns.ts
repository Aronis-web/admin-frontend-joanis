import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  QueryCampaignsParams,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  AddParticipantRequest,
  UpdateParticipantRequest,
  AddProductRequest,
  UpdateProductRequest,
  SetCustomDistributionRequest,
  GenerateDistributionRequest,
  DistributionPreviewRequest,
  Campaign,
} from '@/types/campaigns';
import { campaignsService } from '@/services/api/campaigns';
import { logger } from '@/utils/logger';

// Query keys para campaigns
export const campaignKeys = {
  all: ['campaigns'] as const,
  lists: () => [...campaignKeys.all, 'list'] as const,
  list: (params?: QueryCampaignsParams) => [...campaignKeys.lists(), params] as const,
  details: () => [...campaignKeys.all, 'detail'] as const,
  detail: (id: string) => [...campaignKeys.details(), id] as const,
  participants: (campaignId: string) => [...campaignKeys.all, 'participants', campaignId] as const,
  products: (campaignId: string) => [...campaignKeys.all, 'products', campaignId] as const,
  distributions: (campaignId: string) =>
    [...campaignKeys.all, 'distributions', campaignId] as const,
  totals: (campaignId: string) => [...campaignKeys.all, 'totals', campaignId] as const,
  productsDetail: (campaignId: string) =>
    [...campaignKeys.all, 'products-detail', campaignId] as const,
  productFull: (campaignId: string, productId: string) =>
    [...campaignKeys.all, 'product-full', campaignId, productId] as const,
};

/**
 * Hook para obtener lista de campañas con filtros
 */
export const useCampaigns = (params?: QueryCampaignsParams) => {
  return useQuery({
    queryKey: campaignKeys.list(params),
    queryFn: () => campaignsService.getCampaigns(params),
    staleTime: 3 * 60 * 1000, // 3 minutos
  });
};

/**
 * Hook para obtener detalle de una campaña
 */
export const useCampaign = (id: string, enabled = true) => {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => campaignsService.getCampaign(id),
    enabled: enabled && !!id,
    staleTime: 2 * 60 * 1000, // 2 minutos (campañas cambian frecuentemente)
  });
};

/**
 * Hook para obtener los productos de una campaña con todos los datos
 * pre-agregados (stock del site, costo, precios por perfil, proveedor,
 * fotos). Usa el endpoint compacto `/admin/campaigns/:id/products-detail`.
 */
export const useCampaignProductsDetail = (campaignId: string, enabled = true) => {
  return useQuery({
    queryKey: campaignKeys.productsDetail(campaignId),
    queryFn: () => campaignsService.getProductsDetail(campaignId),
    enabled: enabled && !!campaignId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook para obtener el detalle completo de un producto de campaña usando el
 * endpoint rico `/admin/campaigns/:campaignId/products/:productId/full`.
 *
 * `productId` es el `product_id` del catálogo, no el `campaignProduct.id`.
 * Trae precios, proveedor, fotos, stock por sede, ingresos y reparto por
 * participante en un solo request.
 */
export const useCampaignProductFull = (campaignId: string, productId: string, enabled = true) => {
  return useQuery({
    queryKey: campaignKeys.productFull(campaignId, productId),
    queryFn: () => campaignsService.getProductFull(campaignId, productId),
    enabled: enabled && !!campaignId && !!productId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook para obtener totales de participantes de una campaña
 */
export const useCampaignParticipantTotals = (campaignId: string, enabled = true) => {
  return useQuery({
    queryKey: campaignKeys.totals(campaignId),
    queryFn: () => campaignsService.getParticipantTotals(campaignId),
    enabled: enabled && !!campaignId,
    staleTime: 1 * 60 * 1000, // 1 minuto
  });
};

/**
 * Hook para crear una campaña
 */
export const useCreateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation<Campaign, Error, CreateCampaignRequest>({
    mutationFn: (data: CreateCampaignRequest) => campaignsService.createCampaign(data),
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.setQueryData(campaignKeys.detail(newCampaign.id), newCampaign);
      logger.info('Campaña creada exitosamente', { campaignId: newCampaign.id });
    },
  });
};

/**
 * Hook para actualizar una campaña
 */
export const useUpdateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampaignRequest }) =>
      campaignsService.updateCampaign(id, data),
    onSuccess: (updatedCampaign, variables) => {
      queryClient.setQueryData(campaignKeys.detail(variables.id), updatedCampaign);
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      logger.info('Campaña actualizada', { campaignId: variables.id });
    },
  });
};

/**
 * Hook para activar una campaña
 */
export const useActivateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation<Campaign, Error, string>({
    mutationFn: (id: string) => campaignsService.activateCampaign(id),
    onSuccess: (campaign) => {
      queryClient.setQueryData(campaignKeys.detail(campaign.id), campaign);
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      logger.info('Campaña activada', { campaignId: campaign.id });
    },
  });
};

/**
 * Hook para cerrar una campaña
 */
export const useCloseCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation<Campaign, Error, string>({
    mutationFn: (id: string) => campaignsService.closeCampaign(id),
    onSuccess: (campaign) => {
      queryClient.setQueryData(campaignKeys.detail(campaign.id), campaign);
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      logger.info('Campaña cerrada', { campaignId: campaign.id });
    },
  });
};

/**
 * Hook para cancelar una campaña
 */
export const useCancelCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation<Campaign, Error, string>({
    mutationFn: (id: string) => campaignsService.cancelCampaign(id),
    onSuccess: (campaign) => {
      queryClient.setQueryData(campaignKeys.detail(campaign.id), campaign);
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      logger.info('Campaña cancelada', { campaignId: campaign.id });
    },
  });
};

/**
 * Hook para agregar participante a una campaña
 */
export const useAddCampaignParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, data }: { campaignId: string; data: AddParticipantRequest }) =>
      campaignsService.addParticipant(campaignId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.participants(variables.campaignId) });
      logger.info('Participante agregado', { campaignId: variables.campaignId });
    },
  });
};

/**
 * Hook para actualizar participante de una campaña
 */
export const useUpdateCampaignParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      participantId,
      data,
    }: {
      campaignId: string;
      participantId: string;
      data: UpdateParticipantRequest;
    }) => campaignsService.updateParticipant(campaignId, participantId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.participants(variables.campaignId) });
      logger.info('Participante actualizado', { campaignId: variables.campaignId });
    },
  });
};

/**
 * Hook para eliminar participante de una campaña
 */
export const useRemoveCampaignParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, participantId }: { campaignId: string; participantId: string }) =>
      campaignsService.deleteParticipant(campaignId, participantId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.participants(variables.campaignId) });
      logger.info('Participante eliminado', { campaignId: variables.campaignId });
    },
  });
};

/**
 * Hook para agregar producto a una campaña
 */
export const useAddCampaignProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, data }: { campaignId: string; data: AddProductRequest }) =>
      campaignsService.addProduct(campaignId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.products(variables.campaignId) });
      logger.info('Producto agregado a campaña', { campaignId: variables.campaignId });
    },
  });
};

/**
 * Hook para actualizar producto de una campaña
 */
export const useUpdateCampaignProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      productId,
      data,
    }: {
      campaignId: string;
      productId: string;
      data: UpdateProductRequest;
    }) => campaignsService.updateProduct(campaignId, productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.products(variables.campaignId) });
      logger.info('Producto actualizado en campaña', { campaignId: variables.campaignId });
    },
  });
};

/**
 * Hook para eliminar producto de una campaña
 */
export const useRemoveCampaignProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, productId }: { campaignId: string; productId: string }) =>
      campaignsService.deleteProduct(campaignId, productId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.products(variables.campaignId) });
      logger.info('Producto eliminado de campaña', { campaignId: variables.campaignId });
    },
  });
};

/**
 * Hook para establecer distribución personalizada
 */
export const useSetCustomDistribution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      productId,
      data,
    }: {
      campaignId: string;
      productId: string;
      data: SetCustomDistributionRequest;
    }) => campaignsService.setCustomDistribution(campaignId, productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({
        queryKey: campaignKeys.distributions(variables.campaignId),
      });
      logger.info('Distribución personalizada establecida', { campaignId: variables.campaignId });
    },
  });
};

/**
 * Hook para generar distribución automática
 */
export const useGenerateDistribution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      productId,
      data,
    }: {
      campaignId: string;
      productId: string;
      data: GenerateDistributionRequest;
    }) => campaignsService.generateDistribution(campaignId, productId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({
        queryKey: campaignKeys.distributions(variables.campaignId),
      });
      logger.info('Distribución generada', {
        campaignId: variables.campaignId,
        productId: variables.productId,
      });
    },
  });
};

/**
 * Hook para obtener preview de distribución
 */
export const useDistributionPreview = () => {
  return useMutation({
    mutationFn: ({
      campaignId,
      productId,
      data,
    }: {
      campaignId: string;
      productId: string;
      data?: DistributionPreviewRequest;
    }) => campaignsService.getDistributionPreview(campaignId, productId, data),
  });
};
