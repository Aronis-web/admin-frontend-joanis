/**
 * Vista previa de un PDF (boleta, factura, guia...) antes de descargarlo o
 * imprimirlo. Primero se ve el documento; luego "Descargar" o "Imprimir".
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';

import { Body, Button, Text, useTheme } from '@/design-system';
import { spacing } from '@/design-system/tokens';
import { blobToBase64, saveAndSharePdf } from '@/utils/fileDownload';
import { PdfPreviewFrame } from './PdfPreviewFrame';

export interface PdfPreviewRequest {
  /** Titulo del visor ("Boleta B001-123"). */
  title: string;
  /** Nombre del archivo al descargar (sin .pdf). */
  fileName: string;
  /** Trae el PDF (se llama al abrir). */
  load: () => Promise<Blob>;
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-');

export const PdfPreviewModal: React.FC<{
  request: PdfPreviewRequest | null;
  onClose: () => void;
}> = ({ request, onClose }) => {
  const theme = useTheme();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);
  const webPrint = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    setBlob(null);
    setBase64(null);
    setError(null);
    if (!request) return;
    request
      .load()
      .then(async (b) => {
        const b64 = await blobToBase64(b);
        if (!alive) return;
        setBlob(b);
        setBase64(b64);
      })
      .catch((e: any) => {
        if (alive) setError(e?.message ?? 'No se pudo traer el documento');
      });
    return () => {
      alive = false;
    };
  }, [request]);

  const onPrintReady = useCallback((fn: () => void) => {
    webPrint.current = fn;
  }, []);

  const download = async () => {
    if (!blob || !request) return;
    setBusy('download');
    try {
      await saveAndSharePdf(blob, safeName(request.fileName), request.title);
    } finally {
      setBusy(null);
    }
  };

  const print = async () => {
    if (!base64 || !request) return;
    if (Platform.OS === 'web') {
      webPrint.current?.();
      return;
    }
    setBusy('print');
    try {
      const uri = `${FileSystem.cacheDirectory}${safeName(request.fileName)}.pdf`;
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Print.printAsync({ uri });
    } catch {
      // Cancelar el dialogo de impresion no es un error.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={!!request} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.color.surface.base }]}>
        <View style={[styles.header, { borderBottomColor: theme.color.border.default }]}>
          <Text style={styles.title} numberOfLines={1}>
            {request?.title ?? ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar vista previa">
            <Ionicons name="close" size={26} color={theme.color.text.muted} />
          </Pressable>
        </View>
        <View style={styles.body}>
          {error ? (
            <View style={styles.center}>
              <Body>{error}</Body>
            </View>
          ) : base64 ? (
            <PdfPreviewFrame base64={base64} onPrintReady={onPrintReady} />
          ) : (
            <View style={styles.center}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          )}
        </View>
        <View style={[styles.footer, { borderTopColor: theme.color.border.default }]}>
          <Button title="Cerrar" variant="ghost" size="small" onPress={onClose} />
          <Button
            title="Imprimir"
            leftIcon="print-outline"
            variant="outline"
            size="small"
            onPress={() => {
              print().catch(() => undefined);
            }}
            disabled={!base64 || !!busy}
            loading={busy === 'print'}
          />
          <Button
            title="Descargar"
            leftIcon="download-outline"
            size="small"
            onPress={() => {
              download().catch(() => undefined);
            }}
            disabled={!blob || !!busy}
            loading={busy === 'download'}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[5] },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
    padding: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
