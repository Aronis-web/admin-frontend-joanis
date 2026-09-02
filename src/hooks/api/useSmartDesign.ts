import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { photoCampaignsApi } from '@/services/api';
import type {
  SmartDesignStatus,
  SmartPriceStatus,
  SmartPriceTemplate,
} from '@/types/photo-campaigns';
import { logger } from '@/utils/logger';

/**
 * Query keys para el flujo Smart Design (generación automática de diseños con IA).
 */
export const smartDesignKeys = {
  all: ['photo-campaigns', 'smart-design'] as const,
  status: (photoCampaignId: string) => [...smartDesignKeys.all, 'status', photoCampaignId] as const,
};

/**
 * Hook con polling automático del estado del flujo Smart Design.
 *
 * - Sólo se activa cuando hay `photoCampaignId` y el consumidor lo habilita.
 * - Mientras haya items `pending` o `processing`, refetchea cada 4 segundos.
 * - Cuando ya no hay trabajo pendiente, deja de hacer polling.
 */
export const useSmartDesignStatus = (photoCampaignId: string | undefined, enabled = true) => {
  return useQuery<SmartDesignStatus>({
    queryKey: smartDesignKeys.status(photoCampaignId || ''),
    queryFn: () => photoCampaignsApi.getSmartDesignStatus(photoCampaignId as string),
    enabled: enabled && !!photoCampaignId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data as SmartDesignStatus | undefined;
      if (!data || !data.enabled) return false;
      const busy = (data.counts?.pending || 0) + (data.counts?.processing || 0) > 0;
      return busy ? 4000 : false;
    },
  });
};

/**
 * Activa el modo de generación automática. Idempotente: si ya estaba activo,
 * el backend devuelve el estado actual sin reprocesar.
 */
export const useEnableSmartDesign = (photoCampaignId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!photoCampaignId) throw new Error('photoCampaignId requerido');
      return photoCampaignsApi.enableSmartDesign(photoCampaignId);
    },
    onSuccess: (data) => {
      if (!photoCampaignId) return;
      queryClient.setQueryData(smartDesignKeys.status(photoCampaignId), data);
    },
    onError: (error) => {
      logger.error('[SMART_DESIGN] Error activando modo automático', error);
    },
  });
};

/**
 * Reinicia y reprocesa toda la campaña. Reemplaza el estado actual con el
 * devuelto por el backend para que el polling continúe correctamente.
 */
/**
 * Query keys para Smart Price (aplicación masiva de precio en el backend).
 */
export const smartPriceKeys = {
  all: ['photo-campaigns', 'smart-price'] as const,
  status: (photoCampaignId: string) => [...smartPriceKeys.all, 'status', photoCampaignId] as const,
};

/**
 * Polling del estado de Smart Price. Como el endpoint aplica sobre productos
 * sin foto de precio, se hace polling con un pequeño intervalo mientras haya
 * productos pendientes (`withoutPrice > 0`) y una mutation reciente indique
 * que se disparó el proceso.
 *
 * Cuando `enabled` es false o `withoutPrice === 0`, deja de refetchear.
 */
export const useSmartPriceStatus = (photoCampaignId: string | undefined, enabled = true) => {
  return useQuery<SmartPriceStatus>({
    queryKey: smartPriceKeys.status(photoCampaignId || ''),
    queryFn: () => photoCampaignsApi.getSmartPriceStatus(photoCampaignId as string),
    enabled: enabled && !!photoCampaignId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data as SmartPriceStatus | undefined;
      if (!data) return false;
      return data.withoutPrice > 0 ? 4000 : false;
    },
  });
};

/**
 * Dispara la aplicación masiva de precio. Al completar, invalida el estado
 * para que arranque el polling automáticamente.
 */
export const useApplySmartPrice = (photoCampaignId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template?: SmartPriceTemplate) => {
      if (!photoCampaignId) throw new Error('photoCampaignId requerido');
      return photoCampaignsApi.applySmartPrice(photoCampaignId, template ? { template } : {});
    },
    onSuccess: () => {
      if (!photoCampaignId) return;
      void queryClient.invalidateQueries({ queryKey: smartPriceKeys.status(photoCampaignId) });
    },
    onError: (error) => {
      logger.error('[SMART_PRICE] Error aplicando precio masivo', error);
    },
  });
};

export const useRerunSmartDesign = (photoCampaignId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!photoCampaignId) throw new Error('photoCampaignId requerido');
      return photoCampaignsApi.rerunSmartDesign(photoCampaignId);
    },
    onSuccess: (data) => {
      if (!photoCampaignId) return;
      queryClient.setQueryData(smartDesignKeys.status(photoCampaignId), data);
    },
    onError: (error) => {
      logger.error('[SMART_DESIGN] Error re-editando campaña', error);
    },
  });
};
