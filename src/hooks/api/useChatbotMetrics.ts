import { useQuery } from '@tanstack/react-query';
import { chatbotMetricsApi } from '@/services/api';
import type {
  ChatbotFunnelMetrics,
  ChatbotMetricsParams,
  ChatbotUsageMetrics,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotMetricsKeys = {
  all: ['chatbot-metrics'] as const,
  funnel: (params?: ChatbotMetricsParams) => [...chatbotMetricsKeys.all, 'funnel', params] as const,
  usage: (params?: ChatbotMetricsParams) => [...chatbotMetricsKeys.all, 'usage', params] as const,
};

const METRICS_STALE_TIME = 60 * 1000;

// ============================================
// Queries
// ============================================

export const useChatbotFunnel = (
  params?: ChatbotMetricsParams,
  options?: { enabled?: boolean }
) => {
  return useQuery<ChatbotFunnelMetrics>({
    queryKey: chatbotMetricsKeys.funnel(params),
    queryFn: () => chatbotMetricsApi.getFunnel(params),
    staleTime: METRICS_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

export const useChatbotUsage = (params?: ChatbotMetricsParams, options?: { enabled?: boolean }) => {
  return useQuery<ChatbotUsageMetrics>({
    queryKey: chatbotMetricsKeys.usage(params),
    queryFn: () => chatbotMetricsApi.getUsage(params),
    staleTime: METRICS_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};
