import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chatbotSyncApi } from '@/services/api';
import { chatbotCatalogKeys } from './useChatbotCatalog';
import type {
  PinSellableBody,
  PriceTier,
  SellableProduct,
  SyncRule,
  SyncRulePreview,
  SyncSummary,
  UpdatePriceTierBody,
  UpdateSyncRuleBody,
  UpsertPriceTierBody,
  UpsertSyncRuleBody,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotSyncKeys = {
  all: ['chatbot-sync'] as const,
  rules: () => [...chatbotSyncKeys.all, 'rules'] as const,
  rule: (id: string) => [...chatbotSyncKeys.all, 'rule', id] as const,
  rulePreview: (id: string) => [...chatbotSyncKeys.all, 'rule-preview', id] as const,
  tiers: (sellableId: string) => [...chatbotSyncKeys.all, 'tiers', sellableId] as const,
};

const RULES_STALE_TIME = 5 * 60 * 1000; // 5 min
const TIERS_STALE_TIME = 3 * 60 * 1000; // 3 min

// ============================================
// Queries · Reglas
// ============================================

/** Lista todas las reglas de sincronización del tenant. */
export const useSyncRules = () => {
  return useQuery<SyncRule[]>({
    queryKey: chatbotSyncKeys.rules(),
    queryFn: () => chatbotSyncApi.listRules(),
    staleTime: RULES_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

/** Detalle de una regla. */
export const useSyncRule = (id: string | null | undefined) => {
  return useQuery<SyncRule>({
    queryKey: chatbotSyncKeys.rule(id ?? ''),
    queryFn: () => chatbotSyncApi.getRule(id as string),
    enabled: !!id,
    staleTime: RULES_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

/**
 * Previsualización de la regla (no escribe nada en BD).
 * Habilitado sólo bajo demanda (con `id` no nulo y `enabled: true`).
 */
export const useSyncRulePreview = (id: string | null | undefined, enabled = true) => {
  return useQuery<SyncRulePreview>({
    queryKey: chatbotSyncKeys.rulePreview(id ?? ''),
    queryFn: () => chatbotSyncApi.previewRule(id as string),
    enabled: !!id && enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

// ============================================
// Mutations · Reglas
// ============================================

export const useCreateSyncRule = () => {
  const queryClient = useQueryClient();
  return useMutation<SyncRule, Error, UpsertSyncRuleBody>({
    mutationFn: (body) => chatbotSyncApi.createRule(body),
    onSuccess: (rule) => {
      queryClient.invalidateQueries({ queryKey: chatbotSyncKeys.rules() });
      queryClient.setQueryData(chatbotSyncKeys.rule(rule.id), rule);
    },
  });
};

export const useUpdateSyncRule = () => {
  const queryClient = useQueryClient();
  return useMutation<SyncRule, Error, { id: string; body: UpdateSyncRuleBody }>({
    mutationFn: ({ id, body }) => chatbotSyncApi.updateRule(id, body),
    onSuccess: (rule) => {
      queryClient.invalidateQueries({ queryKey: chatbotSyncKeys.rules() });
      queryClient.setQueryData(chatbotSyncKeys.rule(rule.id), rule);
    },
  });
};

export const useDeleteSyncRule = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => chatbotSyncApi.deleteRule(id),
    onSuccess: (_v, id) => {
      queryClient.invalidateQueries({ queryKey: chatbotSyncKeys.rules() });
      queryClient.removeQueries({ queryKey: chatbotSyncKeys.rule(id) });
    },
  });
};

/**
 * Ejecuta una regla (dry-run o en firme). En caso de corrida en firme,
 * invalida el catálogo vendible para reflejar altas/bajas y actualiza
 * la regla (por `lastSyncedAt` / `lastSyncSummary`).
 */
export const useRunSyncRule = () => {
  const queryClient = useQueryClient();
  return useMutation<SyncSummary, Error, { id: string; dryRun?: boolean }>({
    mutationFn: ({ id, dryRun }) => chatbotSyncApi.runRule(id, dryRun),
    onSuccess: (_summary, { id, dryRun }) => {
      if (!dryRun) {
        queryClient.invalidateQueries({ queryKey: chatbotCatalogKeys.all });
        queryClient.invalidateQueries({ queryKey: chatbotSyncKeys.rules() });
        queryClient.invalidateQueries({ queryKey: chatbotSyncKeys.rule(id) });
      }
    },
  });
};

// ============================================
// Queries · Tiers
// ============================================

export const useSellableTiers = (sellableId: string | null | undefined) => {
  return useQuery<PriceTier[]>({
    queryKey: chatbotSyncKeys.tiers(sellableId ?? ''),
    queryFn: () => chatbotSyncApi.listTiers(sellableId as string),
    enabled: !!sellableId,
    staleTime: TIERS_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

// ============================================
// Mutations · Tiers
// ============================================

export const useCreateTier = () => {
  const queryClient = useQueryClient();
  return useMutation<PriceTier, Error, { sellableId: string; body: UpsertPriceTierBody }>({
    mutationFn: ({ sellableId, body }) => chatbotSyncApi.createTier(sellableId, body),
    onSuccess: (_tier, { sellableId }) => {
      queryClient.invalidateQueries({ queryKey: chatbotSyncKeys.tiers(sellableId) });
    },
  });
};

export const useUpdateTier = () => {
  const queryClient = useQueryClient();
  return useMutation<
    PriceTier,
    Error,
    { tierId: string; sellableId: string; body: UpdatePriceTierBody }
  >({
    mutationFn: ({ tierId, body }) => chatbotSyncApi.updateTier(tierId, body),
    onSuccess: (_tier, { sellableId }) => {
      queryClient.invalidateQueries({ queryKey: chatbotSyncKeys.tiers(sellableId) });
    },
  });
};

export const useDeleteTier = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { tierId: string; sellableId: string }>({
    mutationFn: ({ tierId }) => chatbotSyncApi.deleteTier(tierId),
    onSuccess: (_v, { sellableId }) => {
      queryClient.invalidateQueries({ queryKey: chatbotSyncKeys.tiers(sellableId) });
    },
  });
};

// ============================================
// Mutations · Pin
// ============================================

/**
 * Fija o libera una fila del catálogo. Mientras `pinned: true`, la sync no la
 * toca. Actualiza el catálogo cacheado optimistamente por id.
 */
export const usePinSellable = () => {
  const queryClient = useQueryClient();
  return useMutation<SellableProduct, Error, { sellableId: string; pinned: boolean }>({
    mutationFn: ({ sellableId, pinned }: { sellableId: string; pinned: boolean }) =>
      chatbotSyncApi.pinSellable(sellableId, { pinned } satisfies PinSellableBody),
    onSuccess: (updated) => {
      queryClient.setQueryData<SellableProduct[] | undefined>(chatbotCatalogKeys.list(), (prev) =>
        prev?.map((row) => (row.id === updated.id ? { ...row, ...updated } : row))
      );
      queryClient.invalidateQueries({ queryKey: chatbotCatalogKeys.all });
    },
  });
};
