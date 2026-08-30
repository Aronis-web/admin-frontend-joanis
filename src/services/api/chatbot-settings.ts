import { apiClient } from './client';
import type { BotSettings, UpdateBotSettingsBody } from '@/types/chatbot';

/**
 * Chatbot · Configuración (personalidad + FAQ) API Service
 *
 * Base path: `/chatbot/settings`.
 */
class ChatbotSettingsService {
  private readonly basePath = '/chatbot/settings';

  async get(): Promise<BotSettings> {
    return apiClient.get<BotSettings>(this.basePath);
  }

  async update(body: UpdateBotSettingsBody): Promise<BotSettings> {
    return apiClient.put<BotSettings>(this.basePath, body);
  }
}

export const chatbotSettingsApi = new ChatbotSettingsService();
