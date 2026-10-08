/**
 * Documentos del pedido en CUALQUIER etapa de post venta: boleta/factura y la
 * guia de remision del despacho a tienda. Cada uno se abre primero en vista
 * previa; desde ahi se descarga o imprime.
 */
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Button, Caption, useTheme, useThemedStyles } from '@/design-system';
import { PdfPreviewModal, type PdfPreviewRequest } from '@/components/PdfPreview/PdfPreviewModal';
import { bizlinksApi } from '@/services/api/bizlinks';
import { chatbotPostsaleApi } from '@/services/api/chatbot-postsale';
import { createPostsaleStyles } from './shared';

/** '01' factura, '03' boleta. */
export const documentKind = (type: string | null | undefined): string =>
  type === '01' ? 'Factura' : type === '03' ? 'Boleta' : 'Comprobante';

export const OrderDocuments: React.FC<{ orderId: string }> = ({ orderId }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const [preview, setPreview] = useState<PdfPreviewRequest | null>(null);
  const query = useQuery({
    queryKey: ['chatbot-postsale', 'documents', orderId],
    queryFn: () => chatbotPostsaleApi.documents(orderId),
    staleTime: 30 * 1000,
  });

  const docs = query.data?.documents ?? [];
  const guide = query.data?.guide ?? null;

  return (
    <View style={styles.block}>
      <Caption color={theme.color.text.muted}>Documentos</Caption>
      {query.isLoading ? (
        <ActivityIndicator color={theme.color.brand.accent} />
      ) : query.isError ? (
        <Caption color={theme.color.text.muted}>No se pudieron cargar los documentos.</Caption>
      ) : !docs.length && !guide ? (
        <Caption color={theme.color.text.muted}>
          Aún no tiene boleta, factura ni guía emitida.
        </Caption>
      ) : (
        <View style={styles.actionsRow}>
          {docs.map((d) => {
            const kind = documentKind(d.documentType);
            const label = d.documentNumber ?? 'en proceso';
            const docId = d.bizlinksDocumentId;
            return (
              <Button
                key={d.saleId}
                title={`${kind} ${label}`}
                leftIcon="receipt-outline"
                variant="outline"
                size="small"
                disabled={!docId}
                onPress={() =>
                  docId &&
                  setPreview({
                    title: `${kind} ${label}`,
                    fileName: `${kind} ${label}`,
                    load: () => bizlinksApi.downloadPDF(docId),
                  })
                }
              />
            );
          })}
          {guide ? (
            <Button
              title={`Guía ${guide.number}${guide.isDevelopment ? ' (desarrollo)' : ''}`}
              leftIcon="document-text-outline"
              variant="outline"
              size="small"
              disabled={!guide.bizlinksDocumentId}
              onPress={() => {
                const id = guide.bizlinksDocumentId;
                if (!id) return;
                setPreview({
                  title: `Guía de remisión ${guide.number}`,
                  fileName: `Guia ${guide.number}`,
                  load: () => bizlinksApi.downloadPDF(id),
                });
              }}
            />
          ) : null}
        </View>
      )}
      {docs.some((d) => !d.bizlinksDocumentId) ? (
        <Caption color={theme.color.text.muted}>
          El PDF de algún comprobante aún no está listo; vuelve a abrir en unos segundos.
        </Caption>
      ) : null}
      <PdfPreviewModal request={preview} onClose={() => setPreview(null)} />
    </View>
  );
};
