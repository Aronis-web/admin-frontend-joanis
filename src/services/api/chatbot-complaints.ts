import { apiClient } from './client';

export type ComplaintStatus = 'PENDIENTE' | 'RESPONDIDO';

/** Hoja del Libro de Reclamaciones (formato DS 011-2011-PCM). */
export interface ComplaintSheet {
  id: string;
  code: string;
  kind: 'RECLAMO' | 'QUEJA';
  fullName: string;
  documentType: string;
  documentNumber: string;
  address: string;
  phone: string | null;
  email: string;
  isMinor: boolean;
  guardianName: string | null;
  goodType: 'PRODUCTO' | 'SERVICIO';
  amountCents: number | null;
  goodDescription: string;
  orderRef: string | null;
  detail: string;
  consumerRequest: string;
  status: ComplaintStatus;
  response: string | null;
  respondedAt: string | null;
  copySentAt: string | null;
  createdAt: string;
  /** Fecha limite de respuesta (15 dias habiles). */
  dueDate: string;
}

/**
 * Libro de Reclamaciones API Service
 *
 * Base path: `/chatbot/complaints`.
 */
class ChatbotComplaintsService {
  private readonly basePath = '/chatbot/complaints';

  async list(status?: ComplaintStatus): Promise<ComplaintSheet[]> {
    return apiClient.get<ComplaintSheet[]>(this.basePath, { params: status ? { status } : {} });
  }

  async respond(id: string, response: string): Promise<ComplaintSheet> {
    return apiClient.put<ComplaintSheet>(`${this.basePath}/${id}/respond`, { response });
  }
}

export const chatbotComplaintsApi = new ChatbotComplaintsService();
