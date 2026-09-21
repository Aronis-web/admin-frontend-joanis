import { apiClient } from './client';
import type {
  ChatbotFunnelMetrics,
  ChatbotMetricsParams,
  ChatbotUsageMetrics,
} from '@/types/chatbot';

/**
 * Chatbot · Métricas API Service
 *
 * Base path: `/chatbot/metrics`.
 */
class ChatbotMetricsService {
  private readonly basePath = '/chatbot/metrics';

  /** Embudo de compra. `GET /chatbot/metrics/funnel`. */
  async getFunnel(params?: ChatbotMetricsParams): Promise<ChatbotFunnelMetrics> {
    return apiClient.get<ChatbotFunnelMetrics>(`${this.basePath}/funnel`, { params });
  }

  /** Uso / consumo de tokens. `GET /chatbot/metrics/usage`. */
  async getUsage(params?: ChatbotMetricsParams): Promise<ChatbotUsageMetrics> {
    return apiClient.get<ChatbotUsageMetrics>(`${this.basePath}/usage`, { params });
  }
}

export const chatbotMetricsApi = new ChatbotMetricsService();
