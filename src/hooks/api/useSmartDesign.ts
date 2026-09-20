import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { photoCampaignsApi } from '@/services/api';
import type {
  SmartDesignStatus,
  SmartPriceStatus,
  SmartPriceTemplate,
} from '@/types/photo-campaigns';
import { logger } from '@/utils/logger';

/**
 * Número de consultas consecutivas (con un refetch cada 4s) sin que el progreso
 * del trabajo en background cambie, tras el cual lo consideramos estancado.
 *
 * El backend NO expone un flag "running" en los endpoints de estado: solo
 * devuelve contadores (`pending`, `processing`, `withPrice`, `withoutPrice`).
 * Si un job se cuelga o no llega a arrancar, esos contadores se quedan
 * clavados y la UI mostraría "Generando..." / "Aplicando precio..." para
 * siempre. Al detectar estancamiento, limpiamos la señal de "ocupado" para
 * que la UI deje de cargar indefinidamente.
 */
const DESIGN_STALL_REFETCHES = 20; // ~80 segundos (Smart Design genera varias imágenes por producto)
const PRICE_STALL_REFETCHES = 15; // ~60 segundos

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
  const queryClient = useQueryClient();
  const stallRef = useRef({ value: -1, unchanged: 0 });

  const query = useQuery<SmartDesignStatus>({
    queryKey: smartDesignKeys.status(photoCampaignId || ''),
    queryFn: () => photoCampaignsApi.getSmartDesignStatus(photoCampaignId as string),
    enabled: enabled && !!photoCampaignId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      const data = q.state.data as SmartDesignStatus | undefined;
      if (!data || !data.enabled) return false;
      const busy = (data.counts?.pending || 0) + (data.counts?.processing || 0) > 0;
      return busy ? 4000 : false;
    },
  });

  // Detección de estancamiento. Si el trabajo pendiente (pending + processing)
  // deja de reducirse durante varias consultas, el job quedó colgado. Ponemos
  // los contadores a 0 en caché para que la UI deje de mostrar "Generando...".
  useEffect(() => {
    const data = query.data;
    if (!data || !data.enabled) {
      stallRef.current = { value: -1, unchanged: 0 };
      return;
    }
    const remaining = (data.counts?.pending || 0) + (data.counts?.processing || 0);
    if (remaining <= 0) {
      stallRef.current = { value: -1, unchanged: 0 };
      return;
    }
    const prev = stallRef.current;
    const unchanged = remaining === prev.value ? prev.unchanged + 1 : 0;
    stallRef.current = { value: remaining, unchanged };
    if (unchanged >= DESIGN_STALL_REFETCHES) {
      stallRef.current = { value: -1, unchanged: 0 };
      queryClient.setQueryData(smartDesignKeys.status(photoCampaignId || ''), {
        ...data,
        counts: { ...data.counts, pending: 0, processing: 0 },
      });
    }
  }, [query.data, queryClient, photoCampaignId]);

  return query;
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
 *
 * - `status`: estado servidor (total/withPrice/withoutPrice/items).
 * - `active`: bandera local (client-only) que indica que se disparó una
 *   aplicación desde esta sesión y sigue en curso. Es necesaria porque el
 *   endpoint de estado NO informa si hay un job corriendo: `withoutPrice > 0`
 *   es simplemente el estado inicial (nada tiene precio todavía), así que no
 *   sirve por sí solo para saber si estamos "ocupados".
 */
export const smartPriceKeys = {
  all: ['photo-campaigns', 'smart-price'] as const,
  status: (photoCampaignId: string) => [...smartPriceKeys.all, 'status', photoCampaignId] as const,
  active: (photoCampaignId: string) => [...smartPriceKeys.all, 'active', photoCampaignId] as const,
};

/**
 * Lectura reactiva de la bandera "hay una aplicación en curso" para esta
 * campaña. Es un valor client-only en la caché de React Query, compartido
 * entre el modal (que dispara) y la pantalla (que muestra el banner).
 */
export const useSmartPriceActive = (photoCampaignId: string | undefined): boolean => {
  const { data } = useQuery<boolean>({
    queryKey: smartPriceKeys.active(photoCampaignId || ''),
    queryFn: () => false,
    enabled: false,
    initialData: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? false;
};

/**
 * Polling del estado de Smart Price. Solo hace polling cuando se disparó una
 * aplicación desde esta sesión (bandera `active`) y aún quedan productos sin
 * precio. Cuando `withoutPrice` llega a 0, apaga la bandera y detiene el
 * polling. Si nunca se disparó nada, no hace polling ni marca "ocupado".
 */
export const useSmartPriceStatus = (photoCampaignId: string | undefined, enabled = true) => {
  const queryClient = useQueryClient();
  const stallRef = useRef({ value: -1, unchanged: 0 });

  const query = useQuery<SmartPriceStatus>({
    queryKey: smartPriceKeys.status(photoCampaignId || ''),
    queryFn: () => photoCampaignsApi.getSmartPriceStatus(photoCampaignId as string),
    enabled: enabled && !!photoCampaignId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      if (!photoCampaignId) return false;
      const active = queryClient.getQueryData<boolean>(smartPriceKeys.active(photoCampaignId));
      if (!active) return false;
      const data = q.state.data as SmartPriceStatus | undefined;
      if (data && data.withoutPrice === 0) {
        // Trabajo terminado: apagamos la bandera y dejamos de refetchear.
        queryClient.setQueryData(smartPriceKeys.active(photoCampaignId), false);
        return false;
      }
      return 4000;
    },
  });

  // Detección de estancamiento. Si la aplicación masiva está "activa" pero
  // `withPrice` no avanza durante varias consultas, el job quedó colgado (o
  // nunca arrancó). Apagamos `active` para que la UI deje de mostrar
  // "Aplicando precio..." de forma indefinida.
  useEffect(() => {
    if (!photoCampaignId) {
      return;
    }
    const active = queryClient.getQueryData<boolean>(smartPriceKeys.active(photoCampaignId));
    const data = query.data;
    if (!active || !data) {
      stallRef.current = { value: -1, unchanged: 0 };
      return;
    }
    const withPrice = data.withPrice ?? 0;
    const prev = stallRef.current;
    const unchanged = withPrice === prev.value ? prev.unchanged + 1 : 0;
    stallRef.current = { value: withPrice, unchanged };
    if (unchanged >= PRICE_STALL_REFETCHES) {
      stallRef.current = { value: -1, unchanged: 0 };
      queryClient.setQueryData(smartPriceKeys.active(photoCampaignId), false);
    }
  }, [query.data, queryClient, photoCampaignId]);

  return query;
};

/**
 * Dispara la aplicación masiva de precio. Marca la campaña como "activa" para
 * que arranque el polling y el banner, e invalida el estado para refrescar.
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
      queryClient.setQueryData(smartPriceKeys.active(photoCampaignId), true);
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
