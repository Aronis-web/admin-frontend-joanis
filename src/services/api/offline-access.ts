import { apiClient } from './client';

// ============================================
// ACCESO OFFLINE DE CAJAS
// La caja solicita, el admin aprueba y la caja retira su token directamente.
// El admin nunca ve el token.
// ============================================

export type OfflineAccessStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED';

export interface OfflineAccessRequest {
  cashRegisterId: string;
  cashRegisterCode: string;
  cashRegisterName: string | null;
  siteId: string | null;
  siteName: string | null;
  requestId: string;
  status: OfflineAccessStatus;
  deviceLabel: string | null;
  requestedBy: string;
  requestedByName: string | null;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  deliveredAt: string | null;
  hasDeviceToken: boolean;
}

export const offlineAccessApi = {
  approve: async (cashRegisterId: string, requestId: string) => {
    return apiClient.post(`/pos/offline-access/requests/${cashRegisterId}/approve`, {
      requestId,
    });
  },

  reject: async (cashRegisterId: string, requestId: string) => {
    return apiClient.post(`/pos/offline-access/requests/${cashRegisterId}/reject`, {
      requestId,
    });
  },
};
