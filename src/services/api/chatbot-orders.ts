import { apiClient } from './client';
import type {
  ChatbotOrder,
  ExtendChatbotOrderBody,
  ExtendChatbotOrderResponse,
  GetChatbotOrdersParams,
  RejectChatbotOrderBody,
  ValidateChatbotOrderResponse,
} from '@/types/chatbot';

/**
 * Chatbot · Pedidos API Service
 *
 * Base path: `/chatbot/orders`.
 */
class ChatbotOrdersService {
  private readonly basePath = '/chatbot/orders';

  async list(params?: GetChatbotOrdersParams): Promise<ChatbotOrder[]> {
    return apiClient.get<ChatbotOrder[]>(this.basePath, { params });
  }

  async validate(id: string): Promise<ValidateChatbotOrderResponse> {
    return apiClient.post<ValidateChatbotOrderResponse>(`${this.basePath}/${id}/validate`, {});
  }

  async reject(id: string, body?: RejectChatbotOrderBody): Promise<ChatbotOrder> {
    return apiClient.post<ChatbotOrder>(`${this.basePath}/${id}/reject`, body ?? {});
  }

  async extendHold(id: string, body?: ExtendChatbotOrderBody): Promise<ExtendChatbotOrderResponse> {
    return apiClient.post<ExtendChatbotOrderResponse>(
      `${this.basePath}/${id}/extend-hold`,
      body ?? {}
    );
  }
}

export const chatbotOrdersApi = new ChatbotOrdersService();
