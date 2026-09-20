import { apiClient } from './client';
import type {
  ChatbotCrateProduct,
  UpdateCrateProductBody,
  UpsertCrateProductBody,
} from '@/types/chatbot';

/**
 * Chatbot · Catálogo "Venta por cajón" API Service
 *
 * Base path: `/chatbot/crate`.
 */
class ChatbotCrateService {
  private readonly basePath = '/chatbot/crate';

  /** GET /chatbot/crate */
  async list(): Promise<ChatbotCrateProduct[]> {
    return apiClient.get<ChatbotCrateProduct[]>(this.basePath);
  }

  /** POST /chatbot/crate */
  async create(body: UpsertCrateProductBody): Promise<ChatbotCrateProduct> {
    return apiClient.post<ChatbotCrateProduct>(this.basePath, body);
  }

  /** PATCH /chatbot/crate/:id */
  async update(id: string, body: UpdateCrateProductBody): Promise<ChatbotCrateProduct> {
    return apiClient.patch<ChatbotCrateProduct>(`${this.basePath}/${id}`, body);
  }

  /** DELETE /chatbot/crate/:id */
  async remove(id: string): Promise<void> {
    await apiClient.delete<void>(`${this.basePath}/${id}`);
  }
}

export const chatbotCrateApi = new ChatbotCrateService();
