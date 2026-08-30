import { apiClient } from './client';
import type {
  ChatConversation,
  ChatMessage,
  GetChatMessagesParams,
  GetConversationsParams,
  HandoffBody,
  SendReplyBody,
} from '@/types/chatbot';

/**
 * Chatbot · Conversaciones API Service
 *
 * Base path: `/chatbot/conversations`.
 */
class ChatbotConversationsService {
  private readonly basePath = '/chatbot/conversations';

  async list(params?: GetConversationsParams): Promise<ChatConversation[]> {
    return apiClient.get<ChatConversation[]>(this.basePath, { params });
  }

  async getMessages(id: string, params?: GetChatMessagesParams): Promise<ChatMessage[]> {
    return apiClient.get<ChatMessage[]>(`${this.basePath}/${id}/messages`, { params });
  }

  async handoff(id: string, body: HandoffBody): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>(`${this.basePath}/${id}/handoff`, body);
  }

  async reply(id: string, body: SendReplyBody): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>(`${this.basePath}/${id}/reply`, body);
  }
}

export const chatbotConversationsApi = new ChatbotConversationsService();
