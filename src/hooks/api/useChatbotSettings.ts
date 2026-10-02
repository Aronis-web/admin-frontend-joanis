import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotSettingsApi } from '@/services/api';
import type {
  BotFulfillmentSite,
  BotSettings,
  BotTerms,
  BotTermsBody,
  UpdateBotSettingsBody,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotSettingsKeys = {
  all: ['chatbot-settings'] as const,
  detail: () => [...chatbotSettingsKeys.all, 'detail'] as const,
  terms: () => [...chatbotSettingsKeys.all, 'terms'] as const,
  fulfillmentSites: () => [...chatbotSettingsKeys.all, 'fulfillment-sites'] as const,
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

/** Sedes activas para configurar puntos de recojo y origen del delivery. */
export const useBotFulfillmentSites = (options?: { enabled?: boolean }) => {
  return useQuery<BotFulfillmentSite[]>({
    queryKey: chatbotSettingsKeys.fulfillmentSites(),
    queryFn: () => chatbotSettingsApi.fulfillmentSites(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

// ============================================
// Términos y condiciones
// ============================================

export const useBotTerms = (options?: { enabled?: boolean }) => {
  return useQuery<BotTerms>({
    queryKey: chatbotSettingsKeys.terms(),
    queryFn: () => chatbotSettingsApi.getTerms(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

export const useUpdateBotTerms = () => {
  const queryClient = useQueryClient();
  return useMutation<BotTerms, Error, BotTermsBody>({
    mutationFn: (body) => chatbotSettingsApi.updateTerms(body),
    onSuccess: (data) => {
      queryClient.setQueryData(chatbotSettingsKeys.terms(), data);
    },
  });
};
