import { apiClient } from './client';
import type { BotSettings, BotTerms, BotTermsBody, UpdateBotSettingsBody } from '@/types/chatbot';

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

  /** Términos y condiciones actuales. `GET /chatbot/settings/terms`. */
  async getTerms(): Promise<BotTerms> {
    const res = await apiClient.get<BotTerms | { html: string | null }>(`${this.basePath}/terms`);
    return { html: res?.html ?? null, updatedAt: (res as BotTerms)?.updatedAt ?? null };
  }

  /**
   * Actualiza los T&C. `PUT /chatbot/settings/terms`.
   * Enviar `html: null` restaura el default del sistema.
   */
  async updateTerms(body: BotTermsBody): Promise<BotTerms> {
    return apiClient.put<BotTerms>(`${this.basePath}/terms`, body);
  }
}

export const chatbotSettingsApi = new ChatbotSettingsService();
