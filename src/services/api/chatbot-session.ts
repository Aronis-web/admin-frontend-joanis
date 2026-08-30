import { apiClient } from './client';
import type { WaQrResponse, WaSessionStatus } from '@/types/chatbot';

/**
 * Chatbot · Sesión WhatsApp API Service
 *
 * Base path: `/chatbot/whatsapp`.
 */
class ChatbotSessionService {
  private readonly basePath = '/chatbot/whatsapp';

  async getStatus(): Promise<WaSessionStatus> {
    return apiClient.get<WaSessionStatus>(`${this.basePath}/status`);
  }

  async getQr(): Promise<WaQrResponse> {
    return apiClient.get<WaQrResponse>(`${this.basePath}/qr`);
  }

  async start(): Promise<WaSessionStatus> {
    return apiClient.post<WaSessionStatus>(`${this.basePath}/start`, {});
  }

  async logout(): Promise<WaSessionStatus> {
    return apiClient.post<WaSessionStatus>(`${this.basePath}/logout`, {});
  }
}

export const chatbotSessionApi = new ChatbotSessionService();
