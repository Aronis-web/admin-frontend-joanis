import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotSettingsApi } from '@/services/api';
import type { BotSettings, UpdateBotSettingsBody } from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotSettingsKeys = {
  all: ['chatbot-settings'] as const,
  detail: () => [...chatbotSettingsKeys.all, 'detail'] as const,
};

// ============================================
// Queries
// ============================================

export const useBotSettings = (options?: { enabled?: boolean }) => {
  return useQuery<BotSettings>({
    queryKey: chatbotSettingsKeys.detail(),
    queryFn: () => chatbotSettingsApi.get(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

// ============================================
// Mutations
// ============================================

export const useUpdateBotSettings = () => {
  const queryClient = useQueryClient();
  return useMutation<BotSettings, Error, UpdateBotSettingsBody>({
    mutationFn: (body) => chatbotSettingsApi.update(body),
    onSuccess: (data) => {
      queryClient.setQueryData(chatbotSettingsKeys.detail(), data);
    },
  });
};
