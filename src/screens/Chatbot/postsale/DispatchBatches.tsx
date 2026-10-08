/**
 * Despachos a tiendas: los pedidos de recojo en tienda se cargan en un
 * despacho por tienda (se escanea cada bulto) y al terminar se emite UNA guía
 * de remisión (almacén virtual → tienda) para todo el viaje. Los pedidos pasan
 * a En ruta a tienda.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import { TransportSelectionModal } from '@/components/Transport';
import type { Driver, Transporter, Vehicle } from '@/types/transport';
import type {
  ChatbotDispatch,
  ChatbotDispatchClosePayload,
  ChatbotDispatchScanInfo,
  ChatbotDispatchStatus,
} from '@/types/chatbot';
import type { BadgeVariant } from '@/design-system';
import {
  useCancelChatbotDispatch,
  useChatbotDispatch,
  useChatbotDispatchSites,
  useChatbotDispatches,
  useCloseChatbotDispatch,
  useOpenChatbotDispatch,
  useRemoveChatbotDispatchOrder,
  useScanChatbotDispatch,
} from '@/hooks/api/useChatbotPostsale';
import { postsaleErrorMessage } from '@/services/api/chatbot-postsale';
import { bizlinksApi } from '@/services/api/bizlinks';
import { saveAndSharePdf } from '@/utils/fileDownload';
import { PdfPreviewModal, type PdfPreviewRequest } from '@/components/PdfPreview/PdfPreviewModal';
import Alert from '@/utils/alert';
import { formatDateTime } from '../utils';
import { OLD_STICKER_MESSAGE, isOldSticker } from './paging';
import { QrInput, ScanResultCard } from './scanner';
import { createPostsaleStyles, formatOrderNo } from './shared';

const STATUS_LABEL: Record<ChatbotDispatchStatus, string> = {
  OPEN: 'Abierto',
  CLOSED: 'Terminado',
  CANCELLED: 'Cancelado',
};

const STATUS_VARIANT: Record<ChatbotDispatchStatus, BadgeVariant> = {
  OPEN: 'pending',
  CLOSED: 'completed',
  CANCELLED: 'cancelled',
};

/** Descarga e imprime el PDF de la guía. Devuelve false si aún no está disponible. */
export async function printDispatchGuide(d: ChatbotDispatch): Promise<boolean> {
  const guide = d.guide;
  if (!guide?.bizlinksDocumentId) return false;
  try {
    const blob = await bizlinksApi.downloadPDF(guide.bizlinksDocumentId);
    await saveAndSharePdf(
      blob,
      `Guia ${guide.number}`.replace(/[\\/:*?"<>|]/g, '-'),
      `Guía de remisión ${guide.number}`
    );
    return true;
  } catch {
    return false;
  }
}

/** Sección "Despachos a tiendas" de Post venta · Despacho. */
export const DispatchBatchesSection: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const openBatches = useChatbotDispatches('OPEN', !activeId);

  if (activeId) {
    return <DispatchBatchView id={activeId} onBack={() => setActiveId(null)} />;
  }

  const batches = openBatches.data ?? [];
  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.metaRow}>
          <Ionicons name="storefront-outline" size={18} color={theme.color.text.heading} />
          <Title>Despachos a tiendas</Title>
        </View>
        <Button
          guardDoubleTap
          title="Iniciar despacho"
          leftIcon="play-outline"
          size="small"
          onPress={() => setPicker(true)}
        />
      </View>
      <Caption color={theme.color.text.muted}>
        Los pedidos de recojo en tienda salen juntos: inicia un despacho por tienda, escanea cada
        bulto y al terminar se emite una sola guía de remisión para el viaje.
      </Caption>
      {openBatches.isLoading ? (
        <ActivityIndicator color={theme.color.brand.accent} />
      ) : openBatches.isError ? (
        <Caption color={theme.color.state.danger.text}>
          {postsaleErrorMessage(openBatches.error, 'No se pudieron cargar los despachos')}
        </Caption>
      ) : batches.length ? (
        batches.map((b) => (
          <Pressable key={b.id} onPress={() => setActiveId(b.id)} style={styles.orderRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Body style={{ fontWeight: '700' }}>{b.siteName}</Body>
              <Caption color={theme.color.text.muted}>
                {`${b.totals.orders} pedidos · ${b.totals.packages} bultos · ${formatDateTime(b.createdAt)}`}
                {b.createdByName ? ` · ${b.createdByName}` : ''}
              </Caption>
              {b.error ? <Caption color={theme.color.state.danger.text}>{b.error}</Caption> : null}
            </View>
            <Button
              guardDoubleTap
              title="Continuar"
              variant="outline"
              size="small"
              onPress={() => setActiveId(b.id)}
            />
          </Pressable>
        ))
      ) : (
        <Caption color={theme.color.text.muted}>No hay despachos abiertos.</Caption>
      )}
      <SitePickerModal
        visible={picker}
        onClose={() => setPicker(false)}
        onOpened={(d) => {
          setPicker(false);
          setActiveId(d.id);
        }}
      />
    </Card>
  );
};

/** Elige la tienda destino y abre (o retoma) su despacho. */
const SitePickerModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onOpened: (d: ChatbotDispatch) => void;
}> = ({ visible, onClose, onOpened }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const sites = useChatbotDispatchSites(visible);
  const open = useOpenChatbotDispatch();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const choose = async (siteId: string) => {
    setOpeningId(siteId);
    try {
      onOpened(await open.mutateAsync(siteId));
    } catch (err) {
      Alert.alert('No se pudo iniciar el despacho', postsaleErrorMessage(err));
    } finally {
      setOpeningId(null);
    }
  };

  const list = sites.data ?? [];
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.rowBetween}>
            <Title>¿A qué tienda despachas?</Title>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={26} color={theme.color.text.muted} />
            </Pressable>
          </View>
          <Caption color={theme.color.text.muted}>
            Tiendas con pedidos de recojo armados esperando despacho.
          </Caption>
          {sites.isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : sites.isError ? (
            <EmptyState
              icon="alert-circle-outline"
              title="No se pudo cargar"
              description={postsaleErrorMessage(sites.error)}
            />
          ) : list.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="Nada por despachar"
              description="No hay pedidos de recojo en tienda armados."
            />
          ) : (
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {list.map((s) => (
                <Pressable
                  key={s.siteId}
                  onPress={() => choose(s.siteId)}
                  disabled={!!openingId}
                  style={styles.orderRow}
                >
                  <Ionicons name="storefront-outline" size={22} color={theme.color.text.heading} />
                  <Body style={{ flex: 1, fontWeight: '700' }}>{s.siteName}</Body>
                  <Badge
                    variant="info"
                    size="small"
                    label={`${s.pendingOrders} ${s.pendingOrders === 1 ? 'pedido' : 'pedidos'}`}
                  />
                  {openingId === s.siteId ? (
                    <ActivityIndicator color={theme.color.brand.accent} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={theme.color.text.muted} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

interface DispatchScanEntry {
  key: string;
  at: string;
  scan?: ChatbotDispatchScanInfo;
  error?: string;
}

/** Despacho de una tienda: escaneo de bultos, pedidos, totales y cierre con guía. */
const DispatchBatchView: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const query = useChatbotDispatch(id);
  const scan = useScanChatbotDispatch();
  const remove = useRemoveChatbotDispatchOrder();
  const cancel = useCancelChatbotDispatch();
  const close = useCloseChatbotDispatch();
  const [entries, setEntries] = useState<DispatchScanEntry[]>([]);
  const [transport, setTransport] = useState(false);
  const [printingGuide, setPrintingGuide] = useState(false);
  const [guidePreview, setGuidePreview] = useState<PdfPreviewRequest | null>(null);

  const d = query.data;
  const incomplete = d ? d.orders.filter((o) => !o.complete).length : 0;

  const handleCode = useCallback(
    async (code: string) => {
      const at = new Date().toISOString();
      const key = `${at}-${Math.random().toString(36).slice(2, 8)}`;
      if (isOldSticker(code)) {
        setEntries((prev) => [{ key, at, error: OLD_STICKER_MESSAGE }, ...prev].slice(0, 5));
        return;
      }
      try {
        const res = await scan.mutateAsync({ id, code });
        setEntries((prev) => [{ key, at, scan: res.scan }, ...prev].slice(0, 5));
      } catch (err) {
        setEntries((prev) =>
          [
            { key, at, error: postsaleErrorMessage(err, 'No se pudo registrar el escaneo') },
            ...prev,
          ].slice(0, 5)
        );
      }
    },
    [scan, id]
  );

  /** Vista previa de la guia; desde ahi se descarga o imprime. */
  const printGuide = async (dispatch: ChatbotDispatch) => {
    setPrintingGuide(true);
    try {
      const g = dispatch.guide;
      const docId = g?.bizlinksDocumentId;
      if (g && docId) {
        setGuidePreview({
          title: `Guía de remisión ${g.number}`,
          fileName: `Guia ${g.number}`,
          load: () => bizlinksApi.downloadPDF(docId),
        });
      } else {
        Alert.alert(
          'PDF aún no disponible',
          `El PDF de la guía ${dispatch.guide?.number ?? ''} aún no está listo. Vuelve a tocar "Ver guía" en unos segundos.`
        );
      }
    } finally {
      setPrintingGuide(false);
    }
  };

  const confirmRemove = (orderId: string, orderNo: string) =>
    Alert.alert(
      'Sacar pedido',
      `¿Sacar el pedido ${formatOrderNo(orderNo)} de este despacho? Vuelve a quedar por despachar.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sacar',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove.mutateAsync({ id, orderId });
            } catch (err) {
              Alert.alert('No se pudo sacar el pedido', postsaleErrorMessage(err));
            }
          },
        },
      ]
    );

  const confirmCancel = () =>
    Alert.alert(
      'Cancelar despacho',
      'Los pedidos escaneados vuelven a quedar por despachar. ¿Cancelar este despacho?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancelar despacho',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancel.mutateAsync(id);
              onBack();
            } catch (err) {
              Alert.alert('No se pudo cancelar', postsaleErrorMessage(err));
            }
          },
        },
      ]
    );

  const handleTransport = (
    vehicle: Vehicle | null,
    driver: Driver | null,
    transporter: Transporter | null
  ) => {
    setTransport(false);
    if (!d) return;
    const publicTransporter = transporter && !vehicle && !driver ? transporter : null;
    const payload: ChatbotDispatchClosePayload = publicTransporter
      ? { transporterId: publicTransporter.id }
      : { vehicleId: vehicle?.id, driverId: driver?.id };
    const detail = publicTransporter
      ? `Transporte: Público\nTransportista: ${publicTransporter.razonSocial}\nRUC: ${publicTransporter.numeroRuc}`
      : `Transporte: Privado\nVehículo: ${vehicle?.numeroPlaca ?? '-'}\nConductor: ${
          driver ? `${driver.nombre} ${driver.apellido}` : '-'
        }`;
    const pendingNote = incomplete
      ? `\n\n⚠️ ${incomplete} ${incomplete === 1 ? 'pedido tiene' : 'pedidos tienen'} bultos sin escanear.`
      : '';
    Alert.alert(
      'Terminar despacho',
      `Tienda: ${d.siteName}\nPedidos: ${d.totals.orders} · Bultos: ${d.totals.packages}\n${detail}${pendingNote}\n\nSe emitirá una guía de remisión y los pedidos pasarán a En ruta a tienda.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Terminar',
          onPress: async () => {
            try {
              const res = await close.mutateAsync({ id, payload });
              if (res.status !== 'CLOSED' || !res.guide) {
                Alert.alert(
                  'No se pudo emitir la guía',
                  res.error || 'El despacho sigue abierto. Intenta de nuevo.'
                );
                return;
              }
              if (res.guide.isDevelopment) {
                Alert.alert(
                  'Despacho terminado',
                  `Guía ${res.guide.number} (desarrollo). Los pedidos van en ruta a ${res.siteName}.`
                );
                return;
              }
              await printGuide(res);
            } catch (err) {
              Alert.alert('No se pudo terminar el despacho', postsaleErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  if (query.isLoading) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator color={theme.color.brand.accent} />
      </Card>
    );
  }
  if (query.isError || !d) {
    return (
      <Card style={styles.card}>
        <EmptyState
          icon="alert-circle-outline"
          title="No se pudo cargar el despacho"
          description={postsaleErrorMessage(query.error)}
        />
        <Button guardDoubleTap title="Volver" variant="outline" size="small" onPress={onBack} />
      </Card>
    );
  }

  const isOpen = d.status === 'OPEN';
  const busy = close.isPending || cancel.isPending;

  return (
    <>
      <Card style={StyleSheet.flatten([styles.card, styles.highlightCard])}>
        <View style={styles.rowBetween}>
          <View style={[styles.metaRow, { flex: 1 }]}>
            <Ionicons name="storefront-outline" size={20} color={theme.color.text.heading} />
            <Title>{`Despacho a ${d.siteName}`}</Title>
          </View>
          <Badge variant={STATUS_VARIANT[d.status]} label={STATUS_LABEL[d.status]} />
        </View>
        <Caption color={theme.color.text.muted}>
          {`Iniciado ${formatDateTime(d.createdAt)}`}
          {d.createdByName ? ` por ${d.createdByName}` : ''}
          {d.closedAt ? ` · Terminado ${formatDateTime(d.closedAt)}` : ''}
        </Caption>
        <View style={styles.metaRow}>
          <Badge variant="default" label={`${d.totals.orders} pedidos`} />
          <Badge variant="default" label={`📦 ${d.totals.packages} bultos`} />
          <Badge variant="default" label={`${d.totals.units} unidades`} />
        </View>
        {d.error ? (
          <View
            style={[
              styles.noticeBox,
              {
                borderColor: theme.color.state.danger.border,
                backgroundColor: theme.color.state.danger.background,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={18} color={theme.color.state.danger.text} />
            <Body style={{ flex: 1, color: theme.color.state.danger.text, fontWeight: '700' }}>
              {d.error}
            </Body>
          </View>
        ) : null}
        {d.guide ? (
          <View style={styles.block}>
            <Caption color={theme.color.text.muted}>Guía de remisión</Caption>
            <View style={styles.metaRow}>
              <Text style={styles.orderNo}>{d.guide.number}</Text>
              {d.guide.isDevelopment ? (
                <Badge variant="warning" size="small" label="desarrollo" />
              ) : null}
              {d.guide.status ? <Badge variant="info" size="small" label={d.guide.status} /> : null}
            </View>
            {!d.guide.isDevelopment && d.guide.bizlinksDocumentId ? (
              <View style={styles.actionsRow}>
                <Button
                  guardDoubleTap
                  title="Ver guía"
                  leftIcon="print-outline"
                  variant="outline"
                  size="small"
                  onPress={() => printGuide(d)}
                  loading={printingGuide}
                  disabled={printingGuide}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {isOpen ? (
          <QrInput
            onCode={handleCode}
            busy={scan.isPending}
            placeholder="Código del sticker"
            buttonTitle="Registrar"
          />
        ) : null}
      </Card>

      {entries.map((e, i) =>
        e.error ? (
          <ScanResultCard key={e.key} entry={{ key: e.key, at: e.at, error: e.error }} compact />
        ) : e.scan ? (
          <DispatchScanCard key={e.key} scan={e.scan} highlight={i === 0} />
        ) : null
      )}

      <View style={styles.sectionHeader}>
        <Ionicons name="cube-outline" size={18} color={theme.color.text.heading} />
        <Title>{`Pedidos del despacho (${d.orders.length})`}</Title>
      </View>
      {d.orders.length === 0 ? (
        <Caption color={theme.color.text.muted}>
          Escanea los stickers de los pedidos de recojo en esta tienda.
        </Caption>
      ) : (
        d.orders.map((o) => (
          <View key={o.orderId} style={styles.orderRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.metaRow}>
                <Body style={styles.orderNo}>{formatOrderNo(o.orderNo)}</Body>
                <Badge
                  variant={o.complete ? 'success' : 'warning'}
                  size="small"
                  label={`bultos ${o.scannedPackages}/${o.packages}`}
                />
              </View>
              <Body numberOfLines={1}>{o.customerName || 'Sin nombre'}</Body>
              {o.documents.length ? (
                <Caption color={theme.color.text.muted}>{o.documents.join(', ')}</Caption>
              ) : null}
            </View>
            {isOpen ? (
              <Button
                guardDoubleTap
                title="Sacar"
                leftIcon="remove-circle-outline"
                variant="ghost"
                size="small"
                onPress={() => confirmRemove(o.orderId, o.orderNo)}
                disabled={remove.isPending || busy}
              />
            ) : null}
          </View>
        ))
      )}

      {isOpen && incomplete > 0 ? (
        <Caption color={theme.color.state.warning.text}>
          {`${incomplete} ${incomplete === 1 ? 'pedido tiene' : 'pedidos tienen'} bultos sin escanear.`}
        </Caption>
      ) : null}

      <View style={styles.actionsRow}>
        <Button
          guardDoubleTap
          title="Volver"
          leftIcon="arrow-back-outline"
          variant="outline"
          size="small"
          onPress={onBack}
        />
        {isOpen && !d.guide ? (
          <Button
            guardDoubleTap
            title="Cancelar despacho"
            leftIcon="close-circle-outline"
            variant="danger"
            size="small"
            onPress={confirmCancel}
            disabled={busy}
            loading={cancel.isPending}
          />
        ) : null}
        {isOpen ? (
          <Button
            guardDoubleTap
            title="Terminar despacho"
            leftIcon="checkmark-done-outline"
            size="small"
            onPress={() => setTransport(true)}
            disabled={busy || d.orders.length === 0}
            loading={close.isPending}
          />
        ) : null}
      </View>

      <PdfPreviewModal request={guidePreview} onClose={() => setGuidePreview(null)} />
      <TransportSelectionModal
        visible={transport}
        onClose={() => setTransport(false)}
        onConfirm={handleTransport}
      />
    </>
  );
};

/** Resultado de un escaneo dentro del despacho. */
const DispatchScanCard: React.FC<{ scan: ChatbotDispatchScanInfo; highlight?: boolean }> = ({
  scan,
  highlight,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const pending = scan.pendingPackages ?? [];
  const tone = pending.length ? theme.color.state.warning : theme.color.state.success;
  return (
    <Card style={StyleSheet.flatten([styles.card, highlight && styles.highlightCard])}>
      <View style={styles.rowBetween}>
        <Text style={styles.orderNo}>{formatOrderNo(scan.orderNo)}</Text>
        {scan.packages > 1 ? (
          <Caption color={theme.color.text.muted}>
            {scan.packageNo
              ? `bulto ${scan.packageNo} de ${scan.packages}`
              : `${scan.packages} bultos`}
          </Caption>
        ) : null}
      </View>
      <View
        style={[styles.stageBanner, { borderColor: tone.border, backgroundColor: tone.background }]}
      >
        <Ionicons
          name={pending.length ? 'time-outline' : 'checkmark-circle'}
          size={18}
          color={tone.text}
        />
        <Body style={{ flex: 1, fontWeight: '700', color: tone.text }}>
          {scan.message ||
            (pending.length
              ? `Faltan bultos: ${pending.map((n) => `bulto ${n}`).join(', ')}.`
              : 'Pedido completo en el despacho.')}
        </Body>
      </View>
    </Card>
  );
};
