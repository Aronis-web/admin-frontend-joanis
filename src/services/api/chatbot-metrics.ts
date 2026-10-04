import { apiClient } from './client';
import type {
  ChatbotDashboard,
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

  /** Tablero de ventas WhatsApp. `GET /chatbot/metrics/dashboard`. */
  async getDashboard(params?: ChatbotMetricsParams): Promise<ChatbotDashboard> {
    return apiClient.get<ChatbotDashboard>(`${this.basePath}/dashboard`, { params });
  }

  /** Uso / consumo de tokens. `GET /chatbot/metrics/usage`. */
  async getUsage(params?: ChatbotMetricsParams): Promise<ChatbotUsageMetrics> {
    return apiClient.get<ChatbotUsageMetrics>(`${this.basePath}/usage`, { params });
  }
}

export const chatbotMetricsApi = new ChatbotMetricsService();
