import { apiClient } from './client';
import { config } from '@/utils/config';
import { downloadWithAuth } from '@/utils/downloadWithAuth';

/** Estados del flujo de post venta de un pedido de redes sociales. */
export type PostsaleStatus =
  | 'PAGADO'
  | 'EN_ARMADO'
  | 'ARMADO_FINALIZADO'
  | 'EN_RUTA_TIENDA'
  | 'EN_TIENDA'
  | 'EN_RUTA_DOMICILIO'
  | 'EN_RUTA_AGENCIA'
  | 'ENTREGADO_AGENCIA'
  | 'ENTREGADO';

/**
 * Etapa del escaneo: el backend rechaza (400) pedidos que no están en ese paso.
 * - armado: EN_ARMADO → ARMADO_FINALIZADO
 * - despacho: ARMADO_FINALIZADO → EN_RUTA_TIENDA / EN_RUTA_DOMICILIO / EN_RUTA_AGENCIA
 * - recepcion: EN_RUTA_TIENDA → EN_TIENDA, EN_RUTA_AGENCIA → ENTREGADO_AGENCIA
 */
export type PostsaleScanStage = 'armado' | 'despacho' | 'recepcion';

/** Tipo de despacho del pedido. */
export type PostsaleRoute = 'PICKUP' | 'DELIVERY_LIMA' | 'AGENCY';

/** Fila del listado `GET /chatbot/postsale`. */
export interface PostsaleOrder {
  id: string;
  orderNo: string;
  postsaleStatus: PostsaleStatus;
  statusLabel: string;
  route: PostsaleRoute;
  fulfillment: string | null;
  totalCents: string | number | null;
  validatedAt: string | null;
  printedAt: string | null;
  /** Veces que se imprimió el sticker (primera impresión + reimpresiones). */
  stickerPrints?: number;
  /** Veces que se imprimió la hoja de armado. */
  sheetPrints?: number;
  updatedAt: string;
  customerName: string | null;
  convPhone: string | null;
}

/** Sticker devuelto por `POST /chatbot/postsale/print`. */
export interface PostsaleSticker {
  orderId: string;
  orderNo: string;
  /** Texto a codificar en el QR (`GRITPED:<uuid>`). */
  qr: string;
  /** Cliente ya abreviado ("Nombre I."). */
  customer: string;
  route: PostsaleRoute;
  routeLabel: string;
  destination: string | null;
  items: { name: string; qty: number }[];
}

/** Resultado de `POST /chatbot/postsale/scan`. */
export interface PostsaleScanResult {
  orderId: string;
  orderNo: string;
  route: PostsaleRoute;
  status: PostsaleStatus;
  statusLabel: string;
  customerName: string | null;
  /** Clave de agencia: solo se muestra una vez. */
  agencyCode?: string | null;
}

export interface PostsaleDeliverPayload {
  /** Código de 6 dígitos que dicta el cliente. */
  code: string;
  /** Data URL de la firma (`data:image/png;base64,...`). */
  signature: string;
  /** Data URL de la foto (`data:image/jpeg;base64,...`). */
  photo: string;
}

export interface PostsaleDeliverResult {
  orderId: string;
  orderNo: string;
  status: 'ENTREGADO';
}

export interface PostsaleEvent {
  action: string;
  fromStatus: PostsaleStatus | null;
  toStatus: PostsaleStatus | null;
  note: string | null;
  createdAt: string;
  userName: string | null;
}

/** Detalle `GET /chatbot/postsale/:id`. */
export interface PostsaleDetail {
  orderId: string;
  orderNo: string;
  route: PostsaleRoute;
  status: PostsaleStatus;
  statusLabel: string;
  hasSignature: boolean;
  hasPhoto: boolean;
  stickerPrints?: number;
  sheetPrints?: number;
  events: PostsaleEvent[];
}

export type PostsaleMediaKind = 'firma' | 'foto';

export interface PostsaleListParams {
  statuses?: PostsaleStatus[];
  /**
   * Búsqueda: cada palabra contra número de pedido (con o sin #), cliente,
   * teléfono, tienda/agencia/dirección y productos (nombre, SKU, código).
   * Un QR `GRITPED:<uuid>` devuelve exactamente ese pedido.
   */
  q?: string;
  page: number;
  pageSize: number;
}

export interface PostsalePage {
  items: PostsaleOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PostsalePickingItem {
  name: string;
  sku: string | null;
  barcode: string | null;
  variant: string | null;
  presentation: string | null;
  warehouse: string | null;
  qty: number;
  unitPriceCents: string | number | null;
}

/** Hoja de armado `GET /chatbot/postsale/:id/picking` (items por almacén y nombre). */
export interface PostsalePicking {
  orderId: string;
  orderNo: string;
  qr: string;
  status: PostsaleStatus;
  statusLabel: string;
  /** Nombre completo del cliente. */
  customerName: string | null;
  /** 9 dígitos o null. */
  customerPhone: string | null;
  route: PostsaleRoute;
  routeLabel: string;
  place: string | null;
  address: string | null;
  reference: string | null;
  orderNotes: string | null;
  deliveryNotes: string | null;
  totalCents: string | number | null;
  items: PostsalePickingItem[];
}

/** Estados en los que se entrega con código + firma + foto. */
export const POSTSALE_DELIVERABLE: PostsaleStatus[] = ['EN_TIENDA', 'EN_RUTA_DOMICILIO'];

export const isPostsaleDeliverable = (status: PostsaleStatus | null | undefined): boolean =>
  !!status && POSTSALE_DELIVERABLE.includes(status);

/** Extrae el mensaje de error (en español) que devuelve el backend. */
export const postsaleErrorMessage = (err: unknown, fallback = 'Ocurrió un error'): string => {
  const e = err as { response?: { data?: { message?: unknown } }; message?: string } | null;
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('\n');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return e?.message || fallback;
};

/**
 * Post venta de pedidos de redes sociales (armado, despacho y entrega).
 *
 * Base path: `/chatbot/postsale`.
 */
class ChatbotPostsaleService {
  private readonly basePath = '/chatbot/postsale';

  /** Sin `statuses`: activos + entregados en los últimos 7 días. */
  async list(statuses?: PostsaleStatus[]): Promise<PostsaleOrder[]> {
    return apiClient.get<PostsaleOrder[]>(this.basePath, {
      params: statuses?.length ? { status: statuses.join(',') } : undefined,
    });
  }

  /** Listado paginado con búsqueda. */
  async listPage({ statuses, q, page, pageSize }: PostsaleListParams): Promise<PostsalePage> {
    const params: Record<string, string | number> = { page, pageSize };
    if (statuses?.length) params.status = statuses.join(',');
    if (q?.trim()) params.q = q.trim();
    return apiClient.get<PostsalePage>(this.basePath, { params });
  }

  async get(id: string): Promise<PostsaleDetail> {
    return apiClient.get<PostsaleDetail>(`${this.basePath}/${id}`);
  }

  /** Primera impresión pasa PAGADO → EN_ARMADO; reimpresiones solo se registran. */
  async print(orderIds: string[]): Promise<PostsaleSticker[]> {
    return apiClient.post<PostsaleSticker[]>(`${this.basePath}/print`, { orderIds });
  }

  /** Escaneo de una etapa (obligatoria; 403 sin el permiso de esa etapa). */
  async scan(code: string, stage: PostsaleScanStage): Promise<PostsaleScanResult> {
    return apiClient.post<PostsaleScanResult>(`${this.basePath}/scan`, { code, stage });
  }

  async deliver(id: string, payload: PostsaleDeliverPayload): Promise<PostsaleDeliverResult> {
    return apiClient.post<PostsaleDeliverResult>(`${this.basePath}/${id}/deliver`, payload);
  }

  async picking(id: string): Promise<PostsalePicking> {
    return apiClient.get<PostsalePicking>(`${this.basePath}/${id}/picking`);
  }

  async resendCode(id: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>(`${this.basePath}/${id}/resend-code`);
  }

  /**
   * Reporte Excel de stock vendido (hojas "Consolidado" y "Detalle"). Fechas
   * YYYY-MM-DD en hora de Lima (validación del pago).
   */
  async soldReport(from: string, to: string, includePending = false): Promise<Blob> {
    // includePending=1: también pedidos sin validar (por fecha de creación).
    const qs =
      `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
      (includePending ? '&includePending=1' : '');
    return downloadWithAuth(`${config.API_URL}${this.basePath}/sold-report?${qs}`);
  }

  /** Descarga la firma o foto de entrega (endpoint autenticado). */
  async fetchMedia(id: string, kind: PostsaleMediaKind): Promise<Blob> {
    return downloadWithAuth(`${config.API_URL}${this.basePath}/${id}/media/${kind}`);
  }
}

export const chatbotPostsaleApi = new ChatbotPostsaleService();
