import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsWhatsappApi } from '@/services/api';
import type { NotifWaQrResponse, NotifWaSessionStatus } from '@/types/notifications-whatsapp';

// ============================================
// Query Keys Factory
// ============================================
export const notificationsWhatsappKeys = {
  all: ['notifications-whatsapp'] as const,
  status: () => [...notificationsWhatsappKeys.all, 'status'] as const,
  qr: () => [...notificationsWhatsappKeys.all, 'qr'] as const,
};

// ============================================
// Queries
// ============================================

/**
 * Consulta el estado de la sesión de WhatsApp de notificaciones.
 * Mientras no esté `CONNECTED`, hace polling cada 2.5s.
 */
export const useNotifWaStatus = (options?: { enabled?: boolean }) => {
  return useQuery<NotifWaSessionStatus>({
    queryKey: notificationsWhatsappKeys.status(),
    queryFn: () => notificationsWhatsappApi.getStatus(),
    refetchInterval: (query) => {
      const data = query.state.data as NotifWaSessionStatus | undefined;
      return data?.status === 'CONNECTED' ? false : 2500;
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
    enabled: options?.enabled ?? true,
  });
};

/**
 * Obtiene el QR de vinculación. Sólo debe habilitarse cuando
 * `status === 'QR'`.
 */
export const useNotifWaQr = (options?: { enabled?: boolean }) => {
  return useQuery<NotifWaQrResponse>({
    queryKey: notificationsWhatsappKeys.qr(),
    queryFn: () => notificationsWhatsappApi.getQr(),
    refetchInterval: 2000,
    refetchOnWindowFocus: false,
    staleTime: 0,
    enabled: options?.enabled ?? true,
  });
};

// ============================================
// Mutations
// ============================================

export const useStartNotifWaSession = () => {
  const queryClient = useQueryClient();
  return useMutation<NotifWaSessionStatus, Error, void>({
    mutationFn: () => notificationsWhatsappApi.start(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsWhatsappKeys.status() });
      queryClient.invalidateQueries({ queryKey: notificationsWhatsappKeys.qr() });
    },
  });
};

export const useLogoutNotifWaSession = () => {
  const queryClient = useQueryClient();
  return useMutation<NotifWaSessionStatus, Error, void>({
    mutationFn: () => notificationsWhatsappApi.logout(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsWhatsappKeys.status() });
      queryClient.invalidateQueries({ queryKey: notificationsWhatsappKeys.qr() });
    },
  });
};
