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
import {
  chatbotPostsaleApi,
  isPostsaleDeliverable,
  postsaleErrorMessage,
  type PostsaleMediaKind,
  type PostsaleOrder,
  type PostsaleRoute,
} from '@/services/api/chatbot-postsale';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { formatDateTime } from '../utils';
import {
  ROUTE_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  blobToDataUrl,
  createPostsaleStyles,
  formatOrderNo,
  statusLabel,
} from './shared';
import type { PostsalePrinting } from './usePostsalePrinting';

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
  const d = detail.data;
  const status = d?.status ?? fallback?.postsaleStatus ?? null;
  const deliverable = isPostsaleDeliverable(status);
  const orderNo = d?.orderNo ?? fallback?.orderNo ?? '';
  const route = (d?.route ?? fallback?.route) as PostsaleRoute | undefined;

  const confirmResend = () => {
    if (!orderId) return;
    Alert.alert(
      'Reenviar código',
      `Se enviará un nuevo código de entrega al cliente del pedido ${formatOrderNo(orderNo)} por WhatsApp. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reenviar',
          onPress: () =>
            resend.mutate(orderId, {
              onSuccess: () =>
                Alert.alert('Código reenviado', 'El cliente recibirá un nuevo código.'),
              onError: (err) =>
                Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo reenviar el código')),
            }),
        },
      ]
    );
  };

  const events = [...(d?.events ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

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

          <View style={styles.actionsRow}>
            <Button
              title="Reimprimir sticker"
              leftIcon="print-outline"
              variant="outline"
              size="small"
              onPress={() => orderId && printing.printStickers([orderId])}
              disabled={printing.printingStickers}
              loading={printing.printingStickers}
            />
            <Button
              title="Hoja de armado (PDF)"
              leftIcon="document-text-outline"
              variant="outline"
              size="small"
              onPress={() => orderId && printing.printPicking([orderId])}
              disabled={printing.printingPicking}
              loading={printing.printingPicking}
            />
            {deliverable ? (
              <Button
                title="Reenviar código"
                leftIcon="chatbubble-ellipses-outline"
                variant="outline"
                size="small"
                onPress={confirmResend}
                disabled={resend.isPending}
                loading={resend.isPending}
              />
            ) : null}
            {deliverable && onDeliver && orderId ? (
              <Button
                title="Entregar"
                leftIcon="hand-left-outline"
                size="small"
                onPress={() => onDeliver(orderId)}
              />
            ) : null}
          </View>

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

                <Title>Historial</Title>
                {events.length === 0 ? (
                  <Caption color={theme.color.text.muted}>Sin movimientos registrados.</Caption>
                ) : (
                  events.map((ev, i) => (
                    <View key={`${ev.createdAt}-${i}`} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Body style={{ fontWeight: '700' }}>
                          {ev.toStatus ? (STATUS_LABEL[ev.toStatus] ?? ev.toStatus) : ev.action}
                        </Body>
                        {ev.fromStatus && ev.toStatus && ev.fromStatus !== ev.toStatus ? (
                          <Caption color={theme.color.text.muted}>
                            {STATUS_LABEL[ev.fromStatus] ?? ev.fromStatus} →{' '}
                            {STATUS_LABEL[ev.toStatus] ?? ev.toStatus}
                          </Caption>
                        ) : ev.toStatus ? (
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
