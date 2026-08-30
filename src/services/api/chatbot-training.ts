import { apiClient } from './client';
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

/**
 * Chatbot · Panel de entrenamiento API Service
 *
 * Base path: `/chatbot/training`.
 */
class ChatbotTrainingService {
  private readonly basePath = '/chatbot/training';

  // -------- Casos (escalations) --------
  async listCases(params?: GetTrainingCasesParams): Promise<TrainingCase[]> {
    return apiClient.get<TrainingCase[]>(`${this.basePath}/cases`, { params });
  }

  async teachCase(id: string, body: TeachCaseBody): Promise<TeachCaseResponse> {
    return apiClient.post<TeachCaseResponse>(`${this.basePath}/cases/${id}/teach`, body);
  }

  async escalateCase(id: string, body?: EscalateCaseBody): Promise<TrainingCase> {
    return apiClient.post<TrainingCase>(`${this.basePath}/cases/${id}/escalate`, body ?? {});
  }

  async dismissCase(id: string): Promise<TrainingCase> {
    return apiClient.post<TrainingCase>(`${this.basePath}/cases/${id}/dismiss`, {});
  }

  // -------- Base de conocimiento --------
  async listKnowledge(params?: GetTrainingKnowledgeParams): Promise<TrainingKnowledge[]> {
    // El backend acepta el flag como string "true"/"false".
    const queryParams: Record<string, string> = {};
    if (params?.includeInactive) queryParams.includeInactive = 'true';
    return apiClient.get<TrainingKnowledge[]>(`${this.basePath}/knowledge`, {
      params: queryParams,
    });
  }

  async createKnowledge(body: CreateKnowledgeBody): Promise<TrainingKnowledge> {
    return apiClient.post<TrainingKnowledge>(`${this.basePath}/knowledge`, body);
  }

  async updateKnowledge(id: string, body: UpdateKnowledgeBody): Promise<TrainingKnowledge> {
    return apiClient.patch<TrainingKnowledge>(`${this.basePath}/knowledge/${id}`, body);
  }

  async deleteKnowledge(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete<{ ok: boolean }>(`${this.basePath}/knowledge/${id}`);
  }
}

export const chatbotTrainingApi = new ChatbotTrainingService();
