import { apiClient } from './client';

export type BroadcastStatus = 'SENDING' | 'SENT' | 'FAILED';

/** Promocion enviada por Messenger. */
export interface ChatbotBroadcast {
  id: string;
  channel: 'messenger';
  title: string;
  body: string;
  productIds: string[];
  audiencePromos: boolean;
  audienceLive: boolean;
  status: BroadcastStatus;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface BroadcastAudience {
  promos: boolean;
  live: boolean;
}

export interface BroadcastPreview {
  /** Clientes que aceptaron recibir avisos. */
  optedIn: number;
  /** De ellos, los que escribieron en las ultimas 24 h (regla de Meta). */
  reachable: number;
  windowHours: number;
}

export interface BroadcastProduct {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
}

export interface CreateBroadcastPayload extends BroadcastAudience {
  title: string;
  body: string;
  productIds: string[];
}

/**
 * Promociones por Messenger API Service
 *
 * Base path: `/chatbot/broadcasts`.
 */
class ChatbotBroadcastsService {
  private readonly basePath = '/chatbot/broadcasts';

  async list(): Promise<ChatbotBroadcast[]> {
    return apiClient.get<ChatbotBroadcast[]>(this.basePath);
  }

  async preview(audience: BroadcastAudience): Promise<BroadcastPreview> {
    return apiClient.post<BroadcastPreview>(`${this.basePath}/preview`, audience);
  }

  async products(q: string): Promise<BroadcastProduct[]> {
    return apiClient.get<BroadcastProduct[]>(`${this.basePath}/products`, { params: { q } });
  }

  async create(payload: CreateBroadcastPayload): Promise<ChatbotBroadcast> {
    return apiClient.post<ChatbotBroadcast>(this.basePath, payload);
  }
}

export const chatbotBroadcastsApi = new ChatbotBroadcastsService();
