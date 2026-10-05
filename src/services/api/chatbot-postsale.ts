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
  /** Bultos del pedido (1 si no viene). */
  packages?: number;
}

/** Sticker devuelto por `POST /chatbot/postsale/print`. */
export interface PostsaleSticker {
  orderId: string;
  orderNo: string;
  /**
   * Texto a codificar en el QR: token cifrado opaco por bulto (`GP1.<base64url>`).
   * La app no lo interpreta; para saber qué pedido/bulto es, usar `resolve()`.
   */
  qr: string;
  /** Cliente ya abreviado ("Nombre I."). */
  customer: string;
  /** Bulto de este sticker (1..N) y total de bultos del pedido. */
  packageNo?: number | null;
  packages?: number | null;
  route: PostsaleRoute;
  routeLabel: string;
  destination: string | null;
  /** Puede no venir en versiones nuevas del backend (el sticker ya no lista productos). */
  items?: { name: string; qty: number }[];
  /** Nombre completo del cliente. */
  customerFullName?: string | null;
  /** 9 dígitos o null. */
  customerPhone?: string | null;
  /** Cantidad total de artículos. */
  units?: number | null;
  /** Fecha de impresión (ISO). */
  printedAt?: string | null;
  destinationDetail?: {
    place?: string | null;
    address?: string | null;
    reference?: string | null;
    agency?: string | null;
    city?: string | null;
  } | null;
  company?: { name?: string | null; ruc?: string | null; address?: string | null } | null;
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
  /** Bultos del pedido y bulto escaneado. */
  packages?: number;
  packageNo?: number | null;
  /**
   * Bultos que faltan escanear en esta etapa. Si hay alguno, el pedido NO
   * avanzó (mismo estado); vacío = completo y avanzó.
   */
  pendingPackages?: number[];
  /** Mensaje del backend ("Bulto 1 escaneado. Faltan: bulto 2."). */
  message?: string | null;
}

/** Resultado de `GET /chatbot/postsale/resolve?code=…` (QR escaneado → pedido/bulto). */
export interface PostsaleResolved {
  orderId: string;
  orderNo: string;
  packageNo: number | null;
  packages: number;
  postsaleStatus: PostsaleStatus;
  statusLabel: string;
  customerName: string | null;
}

/** Escaneo de un bulto en una etapa. */
export interface PostsalePackageScan {
  packageNo: number;
  stage: PostsaleScanStage;
  createdAt: string;
  userName: string | null;
}

export interface PostsaleDeliverPayload {
  /** Código de 6 dígitos que dicta el cliente. */
  code: string;
  /** Data URL de la firma (`data:image/png;base64,...`). */
  signature: string;
  /** Data URL de la foto (`data:image/jpeg;base64,...`). */
  photo: string;
  /** Bultos confirmados (deben cubrir 1..N cuando hay más de uno). */
  packages?: number[];
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
  /** Bultos del pedido (1 si no viene). */
  packages?: number;
  events: PostsaleEvent[];
  /** Escaneos por bulto y etapa. */
  packageScans?: PostsalePackageScan[];
}

export type PostsaleMediaKind = 'firma' | 'foto';

/** `GET /chatbot/postsale/overview`: conteos de pago y del flujo de post venta. */
export interface PostsaleOverview {
  payment: { status: string; label: string; n: number; covered?: number }[];
  postsale: { status: PostsaleStatus; label: string; n: number }[];
  /** Pedidos que superaron el tiempo límite de su etapa. */
  stalled: number;
  /** Horas límite por etapa. */
  thresholds: Record<string, number>;
}

/** Pedido estancado (`GET /chatbot/postsale/stalled`). */
export interface PostsaleStalledItem {
  id: string;
  orderNo: string;
  customerName: string | null;
  convPhone: string | null;
  status: string;
  postsaleStatus: PostsaleStatus | null;
  stage: string;
  stageLabel: string;
  since: string;
  hours: number;
  limitHours: number;
  packages?: number;
  route: PostsaleRoute | null;
  totalCents: string | number | null;
  paidCents: string | number | null;
}

export interface PostsaleStalledPage {
  items: PostsaleStalledItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PostsaleListParams {
  statuses?: PostsaleStatus[];
  /**
   * Búsqueda: cada palabra contra número de pedido (con o sin #), cliente,
   * teléfono, tienda/agencia/dirección y productos (nombre, SKU, código).
   * El QR cifrado del sticker (`GP1.…`) devuelve exactamente ese pedido.
   */
  q?: string;
  /** Un pedido concreto por id (para refrescar su fila). */
  orderId?: string;
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
  async listPage({
    statuses,
    q,
    orderId,
    page,
    pageSize,
  }: PostsaleListParams): Promise<PostsalePage> {
    const params: Record<string, string | number> = { page, pageSize };
    if (statuses?.length) params.status = statuses.join(',');
    if (q?.trim()) params.q = q.trim();
    if (orderId) params.orderId = orderId;
    return apiClient.get<PostsalePage>(this.basePath, { params });
  }

  /**
   * Interpreta un texto escaneado (QR cifrado por bulto `GP1.…`):
   * devuelve pedido y bulto. 400 con mensaje si no es un pedido o fue alterado.
   */
  async resolve(code: string): Promise<PostsaleResolved> {
    return apiClient.get<PostsaleResolved>(`${this.basePath}/resolve`, {
      params: { code: code.trim() },
    });
  }

  async overview(): Promise<PostsaleOverview> {
    return apiClient.get<PostsaleOverview>(`${this.basePath}/overview`);
  }

  /** Pedidos estancados, del más atrasado (horas / límite) al menos. */
  async stalled(page: number, pageSize: number): Promise<PostsaleStalledPage> {
    return apiClient.get<PostsaleStalledPage>(`${this.basePath}/stalled`, {
      params: { page, pageSize },
    });
  }

  async get(id: string): Promise<PostsaleDetail> {
    return apiClient.get<PostsaleDetail>(`${this.basePath}/${id}`);
  }

  /** Primera impresión pasa PAGADO → EN_ARMADO; reimpresiones solo se registran. */
  /**
   * Sin `packageNo`: un sticker por bulto (1..N). Con `packageNo`: solo ese bulto
   * (reimpresión puntual).
   */
  async print(orderIds: string[], packageNo?: number): Promise<PostsaleSticker[]> {
    return apiClient.post<PostsaleSticker[]>(`${this.basePath}/print`, {
      orderIds,
      ...(packageNo ? { packageNo } : {}),
    });
  }

  /** Agrega un bulto al pedido; devuelve el total y el sticker del bulto nuevo. */
  async addPackage(id: string): Promise<{ packages: number; sticker: PostsaleSticker }> {
    return apiClient.post<{ packages: number; sticker: PostsaleSticker }>(
      `${this.basePath}/${id}/packages`
    );
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
