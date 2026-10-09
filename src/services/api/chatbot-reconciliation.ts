import { apiClient } from './client';
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

export interface ReconcileResult {
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
}

/** Cruce de estados de cuenta (Excel BBVA/BCP o fotos) con los vouchers del chatbot. */
class ChatbotReconciliationService {
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
