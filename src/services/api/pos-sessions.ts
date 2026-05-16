import { apiClient } from './client';
import {
  PosSessionManagementDetailResponse,
  PosSessionsManagementFilters,
  PosSessionsManagementResponse,
} from '@/types/pos-sessions';

export const posSessionsApi = {
  getManagementList: async (
    params: PosSessionsManagementFilters = {}
  ): Promise<PosSessionsManagementResponse> => {
    return apiClient.get<PosSessionsManagementResponse>('/pos/sessions/management/list', {
      params,
    });
  },

  getManagementDetail: async (id: string): Promise<PosSessionManagementDetailResponse> => {
    try {
      return await apiClient.get<PosSessionManagementDetailResponse>(`/admin/collections/sessions/management/${id}/details`);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404 || status === 501) {
        return apiClient.get<PosSessionManagementDetailResponse>(`/pos/sessions/management/${id}/details`);
      }
      throw error;
    }
  },
};

export default posSessionsApi;
