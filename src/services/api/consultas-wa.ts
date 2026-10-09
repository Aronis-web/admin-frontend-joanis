import { apiClient } from './client';
import type {
  ConsultaWaContact,
  ConsultaWaOptions,
  ConsultaWaQrResponse,
  ConsultaWaQuery,
  ConsultaWaSessionStatus,
  CreateConsultaWaContactDto,
  UpdateConsultaWaContactDto,
} from '@/types/consultas-wa';

/**
 * WhatsApp de Consultas · API Service
 *
 * Sesión del número de consultas (`consultas_wa.sesion.gestionar`) y números
 * autorizados para consultar (`consultas_wa.contactos.gestionar`).
 *
 * Base path: `/consultas-wa`.
 */
class ConsultasWaService {
  private readonly basePath = '/consultas-wa';

  // ---------- Sesión ----------

  async getStatus(): Promise<ConsultaWaSessionStatus> {
    return apiClient.get<ConsultaWaSessionStatus>(`${this.basePath}/session/status`);
  }

  async getQr(): Promise<ConsultaWaQrResponse> {
    return apiClient.get<ConsultaWaQrResponse>(`${this.basePath}/session/qr`);
  }

  async start(): Promise<ConsultaWaSessionStatus> {
    return apiClient.post<ConsultaWaSessionStatus>(`${this.basePath}/session/start`, {});
  }

  async logout(): Promise<ConsultaWaSessionStatus> {
    return apiClient.post<ConsultaWaSessionStatus>(`${this.basePath}/session/logout`, {});
  }

  // ---------- Números autorizados ----------

  async getOptions(): Promise<ConsultaWaOptions> {
    return apiClient.get<ConsultaWaOptions>(`${this.basePath}/options`);
  }

  async getContacts(): Promise<ConsultaWaContact[]> {
    return apiClient.get<ConsultaWaContact[]>(`${this.basePath}/contacts`);
  }

  async createContact(dto: CreateConsultaWaContactDto): Promise<ConsultaWaContact> {
    return apiClient.post<ConsultaWaContact>(`${this.basePath}/contacts`, dto);
  }

  async resendCode(id: string): Promise<ConsultaWaContact> {
    return apiClient.post<ConsultaWaContact>(`${this.basePath}/contacts/${id}/resend-code`, {});
  }

  async updateContact(id: string, dto: UpdateConsultaWaContactDto): Promise<ConsultaWaContact> {
    return apiClient.patch<ConsultaWaContact>(`${this.basePath}/contacts/${id}`, dto);
  }

  async disableContact(id: string): Promise<ConsultaWaContact> {
    return apiClient.post<ConsultaWaContact>(`${this.basePath}/contacts/${id}/disable`, {});
  }

  async enableContact(id: string): Promise<ConsultaWaContact> {
    return apiClient.post<ConsultaWaContact>(`${this.basePath}/contacts/${id}/enable`, {});
  }

  // ---------- Historial ----------

  async getQueries(limit = 30): Promise<ConsultaWaQuery[]> {
    return apiClient.get<ConsultaWaQuery[]>(`${this.basePath}/queries`, { params: { limit } });
  }
}

export const consultasWaApi = new ConsultasWaService();
