import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotTrainingApi } from '@/services/api';
import type {
  CreateKnowledgeBody,
  EscalateCaseBody,
  GetTrainingCasesParams,
  GetTrainingKnowledgeParams,
  TeachCaseBody,
  TeachCaseResponse,
  TrainingCase,
  TrainingKnowledge,
  UpdateKnowledgeBody,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotTrainingKeys = {
  all: ['chatbot-training'] as const,
  cases: (params?: GetTrainingCasesParams) =>
    [...chatbotTrainingKeys.all, 'cases', params] as const,
  knowledge: (params?: GetTrainingKnowledgeParams) =>
    [...chatbotTrainingKeys.all, 'knowledge', params] as const,
};

const CASES_STALE_TIME = 30 * 1000;
const KNOWLEDGE_STALE_TIME = 3 * 60 * 1000;

// ============================================
// Queries
// ============================================

export const useTrainingCases = (
  params?: GetTrainingCasesParams,
  options?: { refetchIntervalMs?: number }
) => {
  return useQuery<TrainingCase[]>({
    queryKey: chatbotTrainingKeys.cases(params),
    queryFn: () => chatbotTrainingApi.listCases(params),
    staleTime: CASES_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

export const useTrainingKnowledge = (params?: GetTrainingKnowledgeParams) => {
  return useQuery<TrainingKnowledge[]>({
    queryKey: chatbotTrainingKeys.knowledge(params),
    queryFn: () => chatbotTrainingApi.listKnowledge(params),
    staleTime: KNOWLEDGE_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

// ============================================
// Mutations · Casos
// ============================================

export const useTeachCase = () => {
  const queryClient = useQueryClient();
  return useMutation<TeachCaseResponse, Error, { id: string; body: TeachCaseBody }>({
    mutationFn: ({ id, body }) => chatbotTrainingApi.teachCase(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotTrainingKeys.all });
    },
  });
};

export const useEscalateCase = () => {
  const queryClient = useQueryClient();
  return useMutation<TrainingCase, Error, { id: string; body?: EscalateCaseBody }>({
    mutationFn: ({ id, body }) => chatbotTrainingApi.escalateCase(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotTrainingKeys.all });
    },
  });
};

export const useDismissCase = () => {
  const queryClient = useQueryClient();
  return useMutation<TrainingCase, Error, string>({
    mutationFn: (id) => chatbotTrainingApi.dismissCase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotTrainingKeys.all });
    },
  });
};

// ============================================
// Mutations · Conocimiento
// ============================================

export const useCreateKnowledge = () => {
  const queryClient = useQueryClient();
  return useMutation<TrainingKnowledge, Error, CreateKnowledgeBody>({
    mutationFn: (body) => chatbotTrainingApi.createKnowledge(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotTrainingKeys.all });
    },
  });
};

export const useUpdateKnowledge = () => {
  const queryClient = useQueryClient();
  return useMutation<TrainingKnowledge, Error, { id: string; body: UpdateKnowledgeBody }>({
    mutationFn: ({ id, body }) => chatbotTrainingApi.updateKnowledge(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotTrainingKeys.all });
    },
  });
};

export const useDeleteKnowledge = () => {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => chatbotTrainingApi.deleteKnowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotTrainingKeys.all });
    },
  });
};
