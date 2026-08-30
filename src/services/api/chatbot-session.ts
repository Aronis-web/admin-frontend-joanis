import { apiClient } from './client';
import type { BotStatus, WaQrResponse, WaSessionStatus } from '@/types/chatbot';

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

  // ============================================
  // Bot on/off (respuesta automática del asistente)
  // Base path: /chatbot/bot
  // ============================================
  async getBotStatus(): Promise<BotStatus> {
    return apiClient.get<BotStatus>('/chatbot/bot/status');
  }

  async enableBot(): Promise<{ active: true }> {
    return apiClient.post<{ active: true }>('/chatbot/bot/enable', {});
  }

  async disableBot(): Promise<{ active: false }> {
    return apiClient.post<{ active: false }>('/chatbot/bot/disable', {});
  }

  async toggleBot(active: boolean): Promise<{ active: boolean }> {
    return apiClient.post<{ active: boolean }>('/chatbot/bot/toggle', { active });
  }
}

export const chatbotSessionApi = new ChatbotSessionService();
