import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  chatbotComplaintsApi,
  type ComplaintSheet,
  type ComplaintStatus,
} from '@/services/api/chatbot-complaints';

export const chatbotComplaintsKeys = {
  all: ['chatbot-complaints'] as const,
  list: (status?: ComplaintStatus) => [...chatbotComplaintsKeys.all, 'list', status] as const,
};

export const useComplaints = (status?: ComplaintStatus) =>
  useQuery<ComplaintSheet[]>({
    queryKey: chatbotComplaintsKeys.list(status),
    queryFn: () => chatbotComplaintsApi.list(status),
    staleTime: 30 * 1000,
  });

export const useRespondComplaint = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      chatbotComplaintsApi.respond(id, response),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatbotComplaintsKeys.all }),
  });
};
