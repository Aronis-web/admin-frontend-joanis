import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { photoCampaignsApi } from '@/services/api';
import type {
  CampaignVideo,
  CampaignVideoListItem,
  CampaignVideoStatus,
  CreateCampaignVideoRequest,
} from '@/types/photo-campaigns';
import { logger } from '@/utils/logger';

/**
 * Query keys para el flujo de videos publicitarios IA de una campaña de fotos.
 */
export const campaignVideoKeys = {
  all: ['photo-campaigns', 'videos'] as const,
  list: (photoCampaignId: string) => [...campaignVideoKeys.all, 'list', photoCampaignId] as const,
  detail: (videoId: string) => [...campaignVideoKeys.all, 'detail', videoId] as const,
};

/** Estados terminales: el video ya no cambia y el polling debe detenerse. */
const TERMINAL_STATUSES: ReadonlySet<CampaignVideoStatus> = new Set<CampaignVideoStatus>([
  'done',
  'error',
]);

const isTerminal = (status?: CampaignVideoStatus): boolean =>
  !!status && TERMINAL_STATUSES.has(status);

/**
 * Lista de videos de una campaña. Se refresca al abrir el modal; refetchea en
 * background mientras haya algún video no terminal (para actualizar chips de
 * estado y el downloadUrl cuando queden listos).
 */
export const useCampaignVideos = (photoCampaignId: string | undefined, enabled = true) => {
  return useQuery<CampaignVideoListItem[]>({
    queryKey: campaignVideoKeys.list(photoCampaignId || ''),
    queryFn: () => photoCampaignsApi.getCampaignVideos(photoCampaignId as string),
    enabled: enabled && !!photoCampaignId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data as CampaignVideoListItem[] | undefined;
      if (!data || data.length === 0) return false;
      const busy = data.some((video) => !isTerminal(video.status));
      return busy ? 5000 : false;
    },
  });
};

/**
 * Detalle del video con polling. Sondea cada 4s mientras el estado sea
 * `pending | generating | assembling` y se detiene en `done | error`.
 */
export const useCampaignVideoDetail = (videoId: string | undefined, enabled = true) => {
  return useQuery<CampaignVideo>({
    queryKey: campaignVideoKeys.detail(videoId || ''),
    queryFn: () => photoCampaignsApi.getCampaignVideo(videoId as string),
    enabled: enabled && !!videoId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data as CampaignVideo | undefined;
      if (!data) return false;
      return isTerminal(data.status) ? false : 4000;
    },
  });
};

/**
 * Crea un video. Cachea el detalle devuelto e invalida la lista para que el
 * nuevo video aparezca en el listado.
 */
export const useCreateCampaignVideo = (photoCampaignId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCampaignVideoRequest) => {
      if (!photoCampaignId) throw new Error('photoCampaignId requerido');
      return photoCampaignsApi.createCampaignVideo(photoCampaignId, payload);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(campaignVideoKeys.detail(data.id), data);
      if (photoCampaignId) {
        void queryClient.invalidateQueries({
          queryKey: campaignVideoKeys.list(photoCampaignId),
        });
      }
    },
    onError: (error) => {
      logger.error('[CAMPAIGN_VIDEO] Error creando video', error);
    },
  });
};

/**
 * Regenera una sección concreta. Actualiza el detalle en caché con la respuesta
 * (video vuelve a `generating`) para que el polling continúe.
 */
export const useRegenerateVideoSection = (videoId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sectionId: string) => {
      if (!videoId) throw new Error('videoId requerido');
      return photoCampaignsApi.regenerateVideoSection(videoId, sectionId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(campaignVideoKeys.detail(data.id), data);
    },
    onError: (error) => {
      logger.error('[CAMPAIGN_VIDEO] Error regenerando sección', error);
    },
  });
};

/**
 * Re-ensambla el mp4 final sin regenerar los clips (requiere todas las secciones
 * en done). Actualiza el detalle en caché (video pasa a `assembling`).
 */
export const useReassembleCampaignVideo = (videoId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!videoId) throw new Error('videoId requerido');
      return photoCampaignsApi.reassembleCampaignVideo(videoId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(campaignVideoKeys.detail(data.id), data);
    },
    onError: (error) => {
      logger.error('[CAMPAIGN_VIDEO] Error re-armando video', error);
    },
  });
};

/**
 * Elimina un video y refresca el listado de la campaña.
 */
export const useDeleteCampaignVideo = (photoCampaignId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: string) => {
      await photoCampaignsApi.deleteCampaignVideo(videoId);
      return videoId;
    },
    onSuccess: (videoId) => {
      queryClient.removeQueries({ queryKey: campaignVideoKeys.detail(videoId) });
      if (photoCampaignId) {
        void queryClient.invalidateQueries({
          queryKey: campaignVideoKeys.list(photoCampaignId),
        });
      }
    },
    onError: (error) => {
      logger.error('[CAMPAIGN_VIDEO] Error eliminando video', error);
    },
  });
};
