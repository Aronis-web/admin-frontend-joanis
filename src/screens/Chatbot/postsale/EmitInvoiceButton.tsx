/**
 * Botón de Armado que emite la boleta/factura del pedido (venta en POS por la
 * caja virtual) y abre la vista previa del comprobante para descargarlo o
 * imprimirlo. Si ya se emitió, solo abre la vista previa.
 * El escaneo de Armado se bloquea hasta que el comprobante esté emitido.
 */
import React, { useRef, useState } from 'react';

import { Button } from '@/design-system';
import Alert from '@/utils/alert';
import { PdfPreviewModal, type PdfPreviewRequest } from '@/components/PdfPreview/PdfPreviewModal';
import { bizlinksApi } from '@/services/api/bizlinks';
import {
  chatbotPostsaleApi,
  postsaleErrorMessage,
  type PostsaleOrder,
} from '@/services/api/chatbot-postsale';
import type { ChatbotOrderDocument } from '@/types/chatbot';

const docName = (o: Pick<PostsaleOrder, 'invoiceType'>): string =>
  o.invoiceType === 'FACTURA' ? 'factura' : o.invoiceType === 'BOLETA' ? 'boleta' : 'comprobante';

/** Comprobantes con PDF (para la vista previa) y los que aún no lo tienen. */
function splitDocuments(docs: ChatbotOrderDocument[], name: string) {
  const ready: PdfPreviewRequest[] = [];
  const missing: string[] = [];
  for (const doc of docs) {
    const label = doc.documentNumber ?? `venta ${doc.saleId.slice(0, 8)}`;
    const id = doc.bizlinksDocumentId;
    if (!id) missing.push(label);
    else
      ready.push({
        title: `${name.charAt(0).toUpperCase()}${name.slice(1)} ${label}`,
        fileName: label,
        load: () => bizlinksApi.downloadPDF(id),
      });
  }
  return { ready, missing };
}

export const EmitInvoiceButton: React.FC<{
  order: Pick<PostsaleOrder, 'id' | 'orderNo' | 'emission' | 'invoiceType'>;
  /** Tras emitir, para refrescar la lista. */
  onEmitted?: () => void;
  /** Permiso de emitir: sin el, solo se ve (no se emite ni se regenera). */
  canEmit?: boolean;
}> = ({ order, onEmitted, canEmit = true }) => {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PdfPreviewRequest | null>(null);
  // Candado sincrono: un doble toque no alcanza a ver el estado "busy".
  const running = useRef(false);
  if (order.emission !== 'PENDING' && order.emission !== 'EMITTED') return null;
  if (order.emission === 'PENDING' && !canEmit) return null;
  const emitted = order.emission === 'EMITTED';
  const name = docName(order);

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      // Ya emitido y sin permiso de emitir: solo se consultan sus documentos.
      const res =
        emitted && !canEmit
          ? await chatbotPostsaleApi.documents(order.id)
          : await chatbotPostsaleApi.emit(order.id);
      if (!emitted) onEmitted?.();
      const numbers = res.documents
        .map((d) => d.documentNumber)
        .filter(Boolean)
        .join(', ');
      const { ready, missing } = splitDocuments(res.documents, name);
      if (ready.length) setPreview(ready[0]);
      if (missing.length) {
        Alert.alert(
          emitted ? 'PDF aún no disponible' : 'Comprobante emitido',
          `${emitted ? '' : `Pedido #${order.orderNo}: ${numbers || 'venta creada'}. `}` +
            `El PDF de ${missing.join(', ')} aún no está listo. Vuelve a tocar "Ver ${name}" en unos segundos.`
        );
      } else if (!emitted) {
        Alert.alert('Comprobante emitido', `Pedido #${order.orderNo}: ${numbers}.`);
      }
    } catch (err) {
      Alert.alert('No se pudo emitir', postsaleErrorMessage(err));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  // Emitir crea la venta y el comprobante en SUNAT: se confirma antes.
  const confirmAndRun = () => {
    if (running.current) return;
    if (emitted) {
      run().catch(() => undefined);
      return;
    }
    Alert.alert(
      `Emitir ${name}`,
      `Pedido #${order.orderNo}: se emite la ${name} desde la caja virtual y se descuenta el stock. No se puede deshacer (solo con nota de crédito).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Emitir ${name}`,
          style: 'default',
          onPress: () => {
            run().catch(() => undefined);
          },
        },
      ]
    );
  };

  return (
    <>
      <PdfPreviewModal request={preview} onClose={() => setPreview(null)} />
      <Button
        guardDoubleTap
        title={emitted ? `Ver ${name}` : `Emitir ${name}`}
        leftIcon={emitted ? 'print-outline' : 'receipt-outline'}
        variant={emitted ? 'outline' : 'primary'}
        size="small"
        onPress={confirmAndRun}
        disabled={busy}
        loading={busy}
      />
    </>
  );
};
