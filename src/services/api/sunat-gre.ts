import { apiClient } from './client';
import type {
  GetSunatGreParams,
  SunatGreDetail,
  SunatGreListResponse,
  SunatGreRun,
  SunatGreRunsListResponse,
} from '@/types/sunatGre';

/**
 * GRE (Guias de Remision Electronicas). Base path: `/sunat-gre`.
 */
class SunatGreService {
  private readonly basePath = '/sunat-gre';

  async getInvoices(params?: GetSunatGreParams): Promise<SunatGreListResponse> {
    return apiClient.get<SunatGreListResponse>(`${this.basePath}/invoices`, { params });
  }

  async getInvoice(id: string): Promise<SunatGreDetail> {
    return apiClient.get<SunatGreDetail>(`${this.basePath}/invoices/${id}`);
  }

  async importFile(file: { uri: string; name: string; type: string }): Promise<SunatGreRun> {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    return apiClient.post<SunatGreRun>(`${this.basePath}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async getRuns(params?: { limit?: number; offset?: number }): Promise<SunatGreRunsListResponse> {
    return apiClient.get<SunatGreRunsListResponse>(`${this.basePath}/runs`, { params });
  }

  async getRun(id: string): Promise<SunatGreRun> {
    return apiClient.get<SunatGreRun>(`${this.basePath}/runs/${id}`);
  }
}

export const sunatGreApi = new SunatGreService();
export const sunatGreService = sunatGreApi;
