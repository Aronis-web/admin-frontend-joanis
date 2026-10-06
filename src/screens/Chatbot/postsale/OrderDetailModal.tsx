/**
 * Detalle de un pedido de post venta: historial (timeline), firma/foto de entrega
 * y acciones (reimprimir sticker, hoja de armado, reenviar código, entregar).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Badge,
  Body,
  Button,
  Caption,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import { spacing } from '@/design-system/tokens';
import { usePostsaleDetail, useResendPostsaleCode } from '@/hooks/api/useChatbotPostsale';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import {
  chatbotPostsaleApi,
  isPostsaleDeliverable,
  postsaleErrorMessage,
  type PostsaleMediaKind,
  type PostsaleOrder,
  type PostsaleRoute,
  type PostsalePackageScan,
  type PostsaleScanStage,
} from '@/services/api/chatbot-postsale';
import { logger } from '@/utils/logger';
import { formatDateTime } from '../utils';
import {
  ACTION_LABEL,
  PRINT_ACTIONS,
  ROUTE_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  blobToDataUrl,
  createPostsaleStyles,
  formatOrderNo,
  statusLabel,
  timesLabel,
} from './shared';
import type { PostsalePrinting, PrintResult } from './usePostsalePrinting';
import { PackageActions } from './PackageActions';
import { PrinterPickerModal, PrinterRow } from './PrinterPicker';
import { usePostsalePrinterStore } from './printerStore';

export const OrderDetailModal: React.FC<{
  orderId: string | null;
  fallback: PostsaleOrder | null;
  printing: PostsalePrinting;
  onClose: () => void;
  onDeliver?: (orderId: string) => void;
}> = ({ orderId, fallback, printing, onClose, onDeliver }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const detail = usePostsaleDetail(orderId);
  const resend = useResendPostsaleCode();
  const { hasPermission } = usePermissions();
  const canPrint = hasPermission(PERMISSIONS.CHATBOT.POSTSALE_PRINT);
  // La hoja de armado la usan quien imprime y quien arma.
  const canPicking = canPrint || hasPermission(PERMISSIONS.CHATBOT.POSTSALE_ASSEMBLE);
  const canDeliver = hasPermission(PERMISSIONS.CHATBOT.POSTSALE_DELIVER);
  const canResend = hasPermission(PERMISSIONS.CHATBOT.ORDERS_VALIDATE);
  const d = detail.data;
  const status = d?.status ?? fallback?.postsaleStatus ?? null;
  const deliverable = isPostsaleDeliverable(status);
  const orderNo = d?.orderNo ?? fallback?.orderNo ?? '';
  const route = (d?.route ?? fallback?.route) as PostsaleRoute | undefined;

  /**
   * Resultado de la última acción, mostrado DENTRO de la hoja (los Alert
   * globales pueden quedar ocultos tras este Modal en escritorio).
   */
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [askResend, setAskResend] = useState(false);

  // Mientras la hoja está abierta, el selector de impresora se muestra encima de ella.
  const setPickerHost = usePostsalePrinterStore((st) => st.setPickerHost);
  useEffect(() => {
    setPickerHost(orderId ? 'sheet' : 'screen');
    return () => setPickerHost('screen');
  }, [orderId, setPickerHost]);

  // Al cambiar de pedido se limpian avisos y confirmaciones.
  useEffect(() => {
    setNotice(null);
    setAskResend(false);
  }, [orderId]);

  /** Resultado de agregar bulto / reimprimir (desde PackageActions). */
  const onPackageResult = (res: PrintResult) => {
    setNotice({ ok: res.ok, text: res.message });
    if (res.ok) detail.refetch();
  };
  const packages = d?.packages ?? fallback?.packages ?? 1;

  const printSheet = async () => {
    if (!orderId) return;
    setNotice(null);
    const res = await printing.printPicking([orderId], { notify: false });
    setNotice({ ok: res.ok, text: res.message });
    if (res.ok) detail.refetch();
  };

  const doResend = () => {
    if (!orderId) return;
    setAskResend(false);
    setNotice(null);
    resend.mutate(orderId, {
      onSuccess: () =>
        setNotice({ ok: true, text: 'Código reenviado: el cliente recibirá un nuevo código.' }),
      onError: (err) =>
        setNotice({
          ok: false,
          text: postsaleErrorMessage(err, 'No se pudo reenviar el código'),
        }),
    });
  };

  const [onlyPrints, setOnlyPrints] = useState(false);
  const events = [...(d?.events ?? [])]
    .filter((ev) => !onlyPrints || PRINT_ACTIONS.includes(ev.action))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Modal visible={!!orderId} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.rowBetween}>
            <Text style={styles.bigOrderNo}>{formatOrderNo(orderNo)}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={26} color={theme.color.text.muted} />
            </Pressable>
          </View>
          {status ? (
            <View style={styles.metaRow}>
              <Badge
                variant={STATUS_VARIANT[status] ?? 'default'}
                label={statusLabel(status, d?.statusLabel ?? fallback?.statusLabel)}
              />
              <Caption color={theme.color.text.muted}>
                {route ? (ROUTE_LABEL[route] ?? route) : ''}
              </Caption>
            </View>
          ) : null}
          {fallback?.customerName ? <Body>{fallback.customerName}</Body> : null}

          {orderId ? (
            <PackageActions
              orderId={orderId}
              packages={packages}
              printing={printing}
              canAdd={canPicking}
              canReprint={canPrint}
              onResult={onPackageResult}
              hideNotice
            />
          ) : null}

          <View style={styles.actionsRow}>
            {canPicking ? (
              <Button
                guardDoubleTap
                title="Hoja de armado (PDF)"
                leftIcon="document-text-outline"
                variant="outline"
                size="small"
                onPress={() => printSheet()}
                disabled={printing.printingPicking}
                loading={printing.printingPicking}
              />
            ) : null}
            {deliverable && canResend ? (
              <Button
                guardDoubleTap
                title="Reenviar código"
                leftIcon="chatbubble-ellipses-outline"
                variant="outline"
                size="small"
                onPress={() => setAskResend(true)}
                disabled={resend.isPending}
                loading={resend.isPending}
              />
            ) : null}
            {deliverable && canDeliver && onDeliver && orderId ? (
              <Button
                guardDoubleTap
                title="Entregar"
                leftIcon="hand-left-outline"
                size="small"
                onPress={() => onDeliver(orderId)}
              />
            ) : null}
          </View>

          {canPrint || canPicking ? <PrinterRow /> : null}

          {askResend ? (
            <View style={styles.block}>
              <Body>
                Se enviará un nuevo código de entrega al cliente del pedido {formatOrderNo(orderNo)}{' '}
                por WhatsApp. ¿Continuar?
              </Body>
              <View style={styles.actionsRow}>
                <Button
                  guardDoubleTap
                  title="Cancelar"
                  variant="ghost"
                  size="small"
                  onPress={() => setAskResend(false)}
                />
                <Button guardDoubleTap title="Reenviar" size="small" onPress={doResend} />
              </View>
            </View>
          ) : null}

          {notice ? (
            <View
              style={[
                styles.noticeBox,
                notice.ok
                  ? {
                      borderColor: theme.color.state.success.border,
                      backgroundColor: theme.color.state.success.background,
                    }
                  : {
                      borderColor: theme.color.state.danger.border,
                      backgroundColor: theme.color.state.danger.background,
                    },
              ]}
            >
              <Ionicons
                name={notice.ok ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={notice.ok ? theme.color.state.success.text : theme.color.state.danger.text}
              />
              <Body
                style={{
                  flex: 1,
                  fontWeight: '600',
                  color: notice.ok ? theme.color.state.success.text : theme.color.state.danger.text,
                }}
              >
                {notice.text}
              </Body>
              <Pressable
                onPress={() => setNotice(null)}
                hitSlop={8}
                accessibilityLabel="Cerrar aviso"
              >
                <Ionicons name="close" size={16} color={theme.color.text.muted} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing[3] }}>
            {detail.isLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={theme.color.brand.accent} />
              </View>
            ) : detail.isError ? (
              <Caption color={theme.color.state.danger.text}>
                {postsaleErrorMessage(detail.error, 'No se pudo cargar el detalle')}
              </Caption>
            ) : (
              <>
                {orderId && (d?.hasSignature || d?.hasPhoto) ? (
                  <View style={styles.mediaRow}>
                    {d?.hasSignature ? (
                      <View style={{ flex: 1, gap: spacing[1] }}>
                        <Caption color={theme.color.text.muted}>Firma</Caption>
                        <PostsaleMediaImage orderId={orderId} kind="firma" />
                      </View>
                    ) : null}
                    {d?.hasPhoto ? (
                      <View style={{ flex: 1, gap: spacing[1] }}>
                        <Caption color={theme.color.text.muted}>Foto</Caption>
                        <PostsaleMediaImage orderId={orderId} kind="foto" />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.block}>
                  <Caption color={theme.color.text.muted}>Impresiones</Caption>
                  <Body>
                    Sticker: {timesLabel(d?.stickerPrints ?? fallback?.stickerPrints)} · Hoja de
                    armado: {timesLabel(d?.sheetPrints ?? fallback?.sheetPrints)} · Bultos:{' '}
                    {packages}
                  </Body>
                </View>

                <PackageScanMatrix packages={packages} scans={d?.packageScans ?? []} />

                <View style={styles.rowBetween}>
                  <Title>Historial</Title>
                  <Button
                    guardDoubleTap
                    title={onlyPrints ? 'Ver todo' : 'Solo impresiones'}
                    variant="ghost"
                    size="small"
                    leftIcon={onlyPrints ? 'list-outline' : 'print-outline'}
                    onPress={() => setOnlyPrints((v) => !v)}
                  />
                </View>
                {events.length === 0 ? (
                  <Caption color={theme.color.text.muted}>
                    {onlyPrints ? 'Sin impresiones registradas.' : 'Sin movimientos registrados.'}
                  </Caption>
                ) : (
                  events.map((ev, i) => (
                    <View key={`${ev.createdAt}-${i}`} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Body style={{ fontWeight: '700' }}>
                          {ACTION_LABEL[ev.action] ??
                            (ev.toStatus ? (STATUS_LABEL[ev.toStatus] ?? ev.toStatus) : ev.action)}
                        </Body>
                        {ev.fromStatus && ev.toStatus && ev.fromStatus !== ev.toStatus ? (
                          <Caption color={theme.color.text.muted}>
                            {STATUS_LABEL[ev.fromStatus] ?? ev.fromStatus} →{' '}
                            {STATUS_LABEL[ev.toStatus] ?? ev.toStatus}
                          </Caption>
                        ) : ev.toStatus && !ACTION_LABEL[ev.action] ? (
                          <Caption color={theme.color.text.muted}>{ev.action}</Caption>
                        ) : null}
                        {ev.note ? <Caption>{ev.note}</Caption> : null}
                        <Caption color={theme.color.text.muted}>
                          {formatDateTime(ev.createdAt)} · {ev.userName || 'Sistema'}
                        </Caption>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
      <PrinterPickerModal host="sheet" />
    </Modal>
  );
};

/** Firma o foto de entrega (endpoint autenticado → data URL). */
const PostsaleMediaImage: React.FC<{ orderId: string; kind: PostsaleMediaKind }> = ({
  orderId,
  kind,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setFailed(false);
    chatbotPostsaleApi
      .fetchMedia(orderId, kind)
      .then(blobToDataUrl)
      .then((u) => {
        if (!cancelled) setUri(u);
      })
      .catch((err) => {
        logger.error(`No se pudo cargar ${kind} de post venta`, err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, kind]);

  if (failed) return <Caption color={theme.color.text.muted}>No se pudo cargar.</Caption>;
  if (!uri) return <ActivityIndicator color={theme.color.brand.accent} />;
  return <Image source={{ uri }} style={styles.mediaImage} resizeMode="contain" />;
};

const SCAN_STAGES: Array<{ key: PostsaleScanStage; label: string }> = [
  { key: 'armado', label: 'Armado' },
  { key: 'despacho', label: 'Despacho' },
  { key: 'recepcion', label: 'Recepción' },
];

/** Matriz bultos × etapas: ✓ con quién y cuándo se escaneó cada bulto. */
const PackageScanMatrix: React.FC<{ packages: number; scans: PostsalePackageScan[] }> = ({
  packages,
  scans,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  if (!scans.length && packages <= 1) return null;
  const find = (n: number, stage: PostsaleScanStage) =>
    scans
      .filter((s) => s.packageNo === n && s.stage === stage)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  return (
    <View style={styles.block}>
      <Caption color={theme.color.text.muted}>Escaneo por bulto</Caption>
      <View style={styles.matrixRow}>
        <Caption style={{ width: 62, fontWeight: '700' }}>Bulto</Caption>
        {SCAN_STAGES.map((st) => (
          <Caption key={st.key} style={[styles.matrixCell, { fontWeight: '700' }]}>
            {st.label}
          </Caption>
        ))}
      </View>
      {Array.from({ length: Math.max(1, packages) }, (_, i) => i + 1).map((n) => (
        <View key={n} style={styles.matrixRow}>
          <Body style={{ width: 62, fontWeight: '700' }}>{n}</Body>
          {SCAN_STAGES.map((st) => {
            const scan = find(n, st.key);
            return (
              <View key={st.key} style={styles.matrixCell}>
                {scan ? (
                  <>
                    <Caption style={{ color: theme.color.state.success.text, fontWeight: '700' }}>
                      ✓ {scan.userName || 'Sistema'}
                    </Caption>
                    <Caption color={theme.color.text.muted} numberOfLines={1}>
                      {formatDateTime(scan.createdAt)}
                    </Caption>
                  </>
                ) : (
                  <Caption color={theme.color.text.muted}>—</Caption>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};
