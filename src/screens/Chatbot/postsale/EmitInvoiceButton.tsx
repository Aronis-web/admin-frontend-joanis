/**
 * Botón de Armado que emite la boleta/factura del pedido (venta en POS por la
 * caja virtual) e imprime el comprobante. Si ya se emitió, solo reimprime.
 * El escaneo de Armado se bloquea hasta que el comprobante esté emitido.
 */
import React, { useRef, useState } from 'react';

import { Button } from '@/design-system';
import Alert from '@/utils/alert';
import { saveAndSharePdf } from '@/utils/fileDownload';
import { bizlinksApi } from '@/services/api/bizlinks';
import {
  chatbotPostsaleApi,
  postsaleErrorMessage,
  type PostsaleOrder,
} from '@/services/api/chatbot-postsale';
import type { ChatbotOrderDocument } from '@/types/chatbot';

const docName = (o: Pick<PostsaleOrder, 'invoiceType'>): string =>
  o.invoiceType === 'FACTURA' ? 'factura' : o.invoiceType === 'BOLETA' ? 'boleta' : 'comprobante';

/** Descarga e imprime cada comprobante; devuelve los que aún no tienen PDF. */
async function printDocuments(docs: ChatbotOrderDocument[]): Promise<string[]> {
  const missing: string[] = [];
  for (const doc of docs) {
    const label = doc.documentNumber ?? `venta ${doc.saleId.slice(0, 8)}`;
    if (!doc.bizlinksDocumentId) {
      missing.push(label);
      continue;
    }
    try {
      const blob = await bizlinksApi.downloadPDF(doc.bizlinksDocumentId);
      await saveAndSharePdf(blob, label.replace(/[\\/:*?"<>|]/g, '-'), `Comprobante ${label}`);
    } catch {
      missing.push(label);
    }
  }
  return missing;
}

export const EmitInvoiceButton: React.FC<{
  order: Pick<PostsaleOrder, 'id' | 'orderNo' | 'emission' | 'invoiceType'>;
  /** Tras emitir, para refrescar la lista. */
  onEmitted?: () => void;
}> = ({ order, onEmitted }) => {
  const [busy, setBusy] = useState(false);
  // Candado sincrono: un doble toque no alcanza a ver el estado "busy".
  const running = useRef(false);
  if (order.emission !== 'PENDING' && order.emission !== 'EMITTED') return null;
  const emitted = order.emission === 'EMITTED';
  const name = docName(order);

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const res = await chatbotPostsaleApi.emit(order.id);
      if (!emitted) onEmitted?.();
      const numbers = res.documents
        .map((d) => d.documentNumber)
        .filter(Boolean)
        .join(', ');
      const missing = await printDocuments(res.documents);
      if (missing.length) {
        Alert.alert(
          emitted ? 'PDF aún no disponible' : 'Comprobante emitido',
          `${emitted ? '' : `Pedido #${order.orderNo}: ${numbers || 'venta creada'}. `}` +
            `El PDF de ${missing.join(', ')} aún no está listo. Vuelve a tocar "Imprimir ${name}" en unos segundos.`
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
    <Button
      title={emitted ? `Imprimir ${name}` : `Emitir ${name}`}
      leftIcon={emitted ? 'print-outline' : 'receipt-outline'}
      variant={emitted ? 'outline' : 'primary'}
      size="small"
      onPress={confirmAndRun}
      disabled={busy}
      loading={busy}
    />
  );
};
