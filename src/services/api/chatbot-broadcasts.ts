import { apiClient } from './client';

export type BroadcastStatus = 'SENDING' | 'SENT' | 'FAILED';

export type BroadcastChannel = 'whatsapp' | 'messenger' | 'instagram';

/** Promocion enviada por WhatsApp, Messenger y/o Instagram. */
export interface ChatbotBroadcast {
  id: string;
  channel: string;
  /** Redes a las que se envio (promociones viejas: solo Messenger). */
  channels?: BroadcastChannel[];
  title: string;
  body: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  /** Costo estimado al enviarla, en pesos argentinos (WhatsApp factura en ARS). */
  estCostArs?: number | null;
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
  channels: BroadcastChannel[];
  /** "Preguntaron por": quienes escribieron alguna de estas palabras en 24 h. */
  keywords?: string[];
}

export interface BroadcastPreview {
  /** Clientes que aceptaron recibir avisos. */
  optedIn: number;
  /** De ellos, los que escribieron en las ultimas 24 h (regla de Meta). */
  reachable: number;
  windowHours: number;
  byChannel?: Partial<Record<BroadcastChannel, { optedIn: number; reachable: number }>>;
  cost?: {
    currency: 'ARS';
    waMessages: number;
    waUsedThisMonth: number;
    waFreeLeft: number;
    waPriceArs: number;
    totalArs: number;
    note: string;
  };
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
  linkUrl?: string | null;
  linkLabel?: string | null;
  /** Categoria en la que abre el boton del catalogo (p.ej. "Packs"). */
  catalogCategory?: string | null;
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
