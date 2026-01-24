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
  distributions: (campaignId: string) => [...campaignKeys.all, 'distributions', campaignId] as const,
  totals: (campaignId: string) => [...campaignKeys.all, 'totals', campaignId] as const,
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
      campaignsService.removeParticipant(campaignId, participantId),
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
      campaignsService.removeProduct(campaignId, productId),
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
    mutationFn: ({ campaignId, data }: { campaignId: string; data: GenerateDistributionRequest }) =>
      campaignsService.generateDistribution(campaignId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(variables.campaignId) });
      queryClient.invalidateQueries({
        queryKey: campaignKeys.distributions(variables.campaignId),
      });
      logger.info('Distribución generada', { campaignId: variables.campaignId });
    },
  });
};

/**
 * Hook para obtener preview de distribución
 */
export const useDistributionPreview = () => {
  return useMutation({
    mutationFn: ({ campaignId, data }: { campaignId: string; data: DistributionPreviewRequest }) =>
      campaignsService.getDistributionPreview(campaignId, data),
  });
};
