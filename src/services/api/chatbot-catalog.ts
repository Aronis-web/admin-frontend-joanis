import { apiClient } from './client';
import type {
  CreateSellableProductBody,
  SellableProduct,
  UpdateSellableProductBody,
} from '@/types/chatbot';

/**
 * Chatbot · Catálogo vendible (whitelist) API Service
 *
 * Base path: `/chatbot/catalog`.
 */
class ChatbotCatalogService {
  private readonly basePath = '/chatbot/catalog';

  async list(): Promise<SellableProduct[]> {
    return apiClient.get<SellableProduct[]>(this.basePath);
  }

  async create(body: CreateSellableProductBody): Promise<SellableProduct> {
    return apiClient.post<SellableProduct>(this.basePath, body);
  }

  async update(id: string, body: UpdateSellableProductBody): Promise<SellableProduct> {
    return apiClient.patch<SellableProduct>(`${this.basePath}/${id}`, body);
  }

  /** Elimina varias entradas a la vez. `POST /chatbot/catalog/bulk-delete`. */
  async removeMany(ids: string[]): Promise<{ deleted: number }> {
    return apiClient.post<{ deleted: number }>(`${this.basePath}/bulk-delete`, { ids });
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete<void>(`${this.basePath}/${id}`);
  }
}

export const chatbotCatalogApi = new ChatbotCatalogService();
