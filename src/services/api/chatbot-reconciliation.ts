import { apiClient } from './client';
import { config } from '@/utils/config';
import { downloadWithAuth } from '@/utils/downloadWithAuth';
import type { PickedFile } from '@/components/Drive/pickFileCrossPlatform';

export type ReconcileKind = 'CON_PEDIDO' | 'SIN_PEDIDO' | 'SIN_VOUCHER';

export interface ReconciledLine {
  source: string;
  date: string;
  time: string | null;
  description: string;
  amountCents: number;
  operation: string | null;
  kind: ReconcileKind;
  voucher: {
    id: string;
    status: string;
    customer: string | null;
    conversationId: string;
    orderId: string | null;
    orderNo: string | null;
    orderStatus: string | null;
  } | null;
}

export interface StoredFile {
  id: string;
  name: string;
  sizeBytes: number;
  credits: number;
  error: string | null;
}

export interface ReconcileHistoryItem {
  id: string;
  createdAt: string;
  createdBy: string | null;
  fileCount: number;
  totals: ReconcileResult['totals'];
  files: StoredFile[];
}

export interface ReconcileResult {
  /** Id en el historial (null si no se pudo guardar). */
  id?: string | null;
  createdAt?: string;
  /** Archivos guardados (al abrir una carga del historial). */
  storedFiles?: StoredFile[];
  lines: ReconciledLine[];
  totals: {
    credits: number;
    creditsCents: number;
    withOrder: number;
    withOrderCents: number;
    withoutOrder: number;
    withoutOrderCents: number;
    missing: number;
    missingCents: number;
    debitsCents: number;
  };
  errors: string[];
  /** Lo que se leyo de cada archivo (movimientos, abonos o por que fallo). */
  files?: Array<{
    name: string;
    movements: number;
    credits: number;
    /** Abonos que ya venian en otro archivo del lote. */
    repeated?: number;
    error: string | null;
  }>;
}

/** Cruce de estados de cuenta (Excel BBVA/BCP o fotos) con los vouchers del chatbot. */
class ChatbotReconciliationService {
  async history(
    page = 1,
    limit = 20
  ): Promise<{
    items: ReconcileHistoryItem[];
    page: number;
    pages: number;
    total: number;
  }> {
    return apiClient.get('/chatbot/reconciliation', { params: { page, limit } });
  }

  async get(id: string): Promise<ReconcileResult> {
    return apiClient.get(`/chatbot/reconciliation/${id}`);
  }

  /** Archivo original subido en una carga del historial. */
  async downloadFile(id: string, fileId: string): Promise<Blob> {
    return downloadWithAuth(`${config.API_URL}/chatbot/reconciliation/${id}/files/${fileId}`);
  }

  async reconcile(files: PickedFile[]): Promise<ReconcileResult> {
    const fd = new FormData();
    for (const f of files) {
      if (typeof File !== 'undefined' && f.payload instanceof File) {
        fd.append('files', f.payload, f.name);
      } else if (typeof Blob !== 'undefined' && f.payload instanceof Blob) {
        fd.append('files', f.payload, f.name);
      } else {
        fd.append('files', f.payload as any);
      }
    }
    // Las fotos las lee la IA: puede tardar mas que una llamada normal.
    return apiClient.post<ReconcileResult>('/chatbot/reconciliation', fd, { timeout: 180000 });
  }
}

export const chatbotReconciliationApi = new ChatbotReconciliationService();
