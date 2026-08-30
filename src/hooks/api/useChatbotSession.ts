import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotSessionApi } from '@/services/api';
import type { WaQrResponse, WaSessionStatus } from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotSessionKeys = {
  all: ['chatbot-session'] as const,
  status: () => [...chatbotSessionKeys.all, 'status'] as const,
  qr: () => [...chatbotSessionKeys.all, 'qr'] as const,
};

// ============================================
// Queries
// ============================================

/**
 * Consulta el estado de la sesión WhatsApp.
 * Mientras no esté `CONNECTED`, se refresca cada 2.5s vía `refetchInterval`.
 */
export const useWaStatus = (options?: { enabled?: boolean }) => {
  return useQuery<WaSessionStatus>({
    queryKey: chatbotSessionKeys.status(),
    queryFn: () => chatbotSessionApi.getStatus(),
    refetchInterval: (query) => {
      const data = query.state.data as WaSessionStatus | undefined;
      return data?.status === 'CONNECTED' ? false : 2500;
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
    enabled: options?.enabled ?? true,
  });
};

/**
 * Obtiene el QR de login. Sólo debe habilitarse cuando `status === 'QR'`.
 */
export const useWaQr = (options?: { enabled?: boolean }) => {
  return useQuery<WaQrResponse>({
    queryKey: chatbotSessionKeys.qr(),
    queryFn: () => chatbotSessionApi.getQr(),
    refetchInterval: 3000,
    refetchOnWindowFocus: false,
    staleTime: 0,
    enabled: options?.enabled ?? true,
  });
};

// ============================================
// Mutations
// ============================================

export const useStartWaSession = () => {
  const queryClient = useQueryClient();
  return useMutation<WaSessionStatus, Error, void>({
    mutationFn: () => chatbotSessionApi.start(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotSessionKeys.status() });
      queryClient.invalidateQueries({ queryKey: chatbotSessionKeys.qr() });
    },
  });
};

export const useLogoutWaSession = () => {
  const queryClient = useQueryClient();
  return useMutation<WaSessionStatus, Error, void>({
    mutationFn: () => chatbotSessionApi.logout(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotSessionKeys.status() });
      queryClient.invalidateQueries({ queryKey: chatbotSessionKeys.qr() });
    },
  });
};
