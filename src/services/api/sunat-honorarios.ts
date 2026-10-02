import { apiClient } from './client';
import type {
  GetSunatHonorariosParams,
  SunatHonorariosListResponse,
  SunatHonorariosRun,
  SunatHonorariosRunsListResponse,
  SunatHonorariosSummary,
} from '@/types/sunatHonorarios';

/**
 * Honorarios 4ta (RxH). Base path: `/sunat-honorarios`.
 * Ingesta por upload (.txt del Registro de Retenciones o Excel).
 */
class SunatHonorariosService {
  private readonly basePath = '/sunat-honorarios';

  async getInvoices(params?: GetSunatHonorariosParams): Promise<SunatHonorariosListResponse> {
    return apiClient.get<SunatHonorariosListResponse>(`${this.basePath}/invoices`, { params });
  }

  async getSummary(periodo?: string): Promise<SunatHonorariosSummary> {
    return apiClient.get<SunatHonorariosSummary>(`${this.basePath}/invoices/summary`, {
      params: periodo ? { periodo } : undefined,
    });
  }

  async importFile(
    file: { uri: string; name: string; type: string },
    periodo?: string
  ): Promise<SunatHonorariosRun> {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    if (periodo) formData.append('periodo', periodo);
    return apiClient.post<SunatHonorariosRun>(`${this.basePath}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async getRuns(params?: {
    limit?: number;
    offset?: number;
  }): Promise<SunatHonorariosRunsListResponse> {
    return apiClient.get<SunatHonorariosRunsListResponse>(`${this.basePath}/runs`, { params });
  }

  async getRun(id: string): Promise<SunatHonorariosRun> {
    return apiClient.get<SunatHonorariosRun>(`${this.basePath}/runs/${id}`);
  }
}

export const sunatHonorariosApi = new SunatHonorariosService();
export const sunatHonorariosService = sunatHonorariosApi;
