import { apiClient } from './client';
import { config } from '@/utils/config';
import { downloadWithAuth } from '@/utils/downloadWithAuth';
import type {
  ChatConversation,
  ChatMessage,
  GetChatMessagesParams,
  GetConversationsParams,
  HandoffBody,
  PagedMessages,
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

  /**
   * Devuelve la página más reciente (o previa vía `before`) de mensajes.
   *
   * El backend retorna `{ items, hasMore, nextCursor }` en orden cronológico
   * ascendente. Se acepta también el shape legacy `ChatMessage[]` por
   * compatibilidad con builds antiguos del backend.
   */
  async getMessages(id: string, params?: GetChatMessagesParams): Promise<PagedMessages> {
    const res = await apiClient.get<PagedMessages | ChatMessage[]>(
      `${this.basePath}/${id}/messages`,
      { params }
    );
    if (Array.isArray(res)) {
      return { items: res, hasMore: false, nextCursor: null };
    }
    return res;
  }

  /**
   * Descarga la imagen de un mensaje (voucher o foto de producto) usando
   * fetch autenticado y devuelve un object URL apto para <Image source={{uri}}>.
   *
   * El caller es responsable de liberar la URL con `URL.revokeObjectURL(url)`.
   */
  async getMessageMediaObjectUrl(conversationId: string, messageId: string): Promise<string> {
    const url = `${config.API_URL}${this.basePath}/${conversationId}/messages/${messageId}/media`;
    const blob = await downloadWithAuth(url);
    return URL.createObjectURL(blob);
  }

  async handoff(id: string, body: HandoffBody): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>(`${this.basePath}/${id}/handoff`, body);
  }

  async reply(id: string, body: SendReplyBody): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>(`${this.basePath}/${id}/reply`, body);
  }
}

export const chatbotConversationsApi = new ChatbotConversationsService();
