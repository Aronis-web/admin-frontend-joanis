import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import { useConversationVouchers } from '@/hooks/api/useChatbotConversations';
import {
  useChatbotOrdersList,
  useExtendChatbotOrderHold,
  useCancelChatbotOrder,
  useRejectChatbotOrder,
  useValidateChatbotOrder,
  useVerifyChatbotVoucher,
} from '@/hooks/api/useChatbotOrders';
import type {
  ChatbotOrder,
  ChatbotOrderStatus,
  ConversationVoucher,
  VoucherStatus,
} from '@/types/chatbot';
import Alert from '@/utils/alert';
import { usePermissions } from '@/hooks/usePermissions';
import { config } from '@/utils/config';
import { VoucherLinkButton } from './components/VoucherLinkButton';
import {
  CHANNEL_META,
  channelOf,
  displayPhone,
  formatDateTime,
  formatSolesFromCents,
  SALES_CHANNELS,
  type SalesChannel,
} from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotOrders'>;

/** Linea de entrega del pedido (recojo / delivery / agencia) para el asesor. */
const describeOrderFulfillment = (order: ChatbotOrder): string | null => {
  const f = order.fulfillment;
  if (!f) return null;
  const fee = f.feeCents > 0 ? formatSolesFromCents(String(f.feeCents)) : null;
  if (f.type === 'PICKUP') {
    return `🏪 Recojo en ${f.name ?? 'tienda'}${f.address ? ` (${f.address})` : ''}`;
  }
  if (f.type === 'DELIVERY_LIMA') {
    const km = f.distanceKm != null ? ` · ~${f.distanceKm} km` : '';
    return `🛵 Delivery: ${f.address ?? 'sin dirección'}${km}${fee ? ` · envío ${fee}` : ''}`;
  }
  return `🚚 ${f.name ?? 'Agencia'} → ${f.destination ?? 'provincia'}${fee ? ` · envío ${fee}` : ' · pago en destino'}`;
};

/**
 * Valor del filtro. `MANAGE` = bandeja por defecto (sin `status`): el backend
 * devuelve los pedidos accionables (`PENDING_PAYMENT` + `AWAITING_BALANCE`).
 */
type OrderFilter = ChatbotOrderStatus | 'MANAGE' | 'ALL';

const STATUS_OPTIONS: Array<{ label: string; value: OrderFilter }> = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Por gestionar', value: 'MANAGE' },
  { label: 'Pendiente', value: 'PENDING_PAYMENT' },
  { label: 'Falta saldo', value: 'AWAITING_BALANCE' },
  { label: 'Validado', value: 'VALIDATED' },
  { label: 'Emitido', value: 'EMITTED' },
  { label: 'Rechazado', value: 'REJECTED' },
  { label: 'Expirado', value: 'EXPIRED' },
];

const STATUS_BADGE: Record<ChatbotOrderStatus, { variant: BadgeVariant; label: string }> = {
  PENDING_PAYMENT: { variant: 'warning', label: 'Pendiente pago' },
  AWAITING_BALANCE: { variant: 'pending', label: 'Falta saldo' },
  VALIDATED: { variant: 'info', label: 'Validado' },
  EMITTED: { variant: 'success', label: 'Emitido' },
  REJECTED: { variant: 'danger', label: 'Rechazado' },
  EXPIRED: { variant: 'default', label: 'Expirado' },
};

const VOUCHER_BADGE: Record<VoucherStatus, { variant: BadgeVariant; label: string }> = {
  PENDING: { variant: 'pending', label: 'Sin conciliar' },
  MATCHED: { variant: 'warning', label: 'Por validar' },
  VERIFIED: { variant: 'success', label: 'Validado' },
  MISMATCH_LESS: { variant: 'warning', label: 'Pagó de menos' },
  MISMATCH_MORE: { variant: 'info', label: 'Pagó de más' },
  ORPHAN: { variant: 'default', label: 'Sin pedido' },
  DUPLICATE: { variant: 'default', label: 'Duplicado' },
  REJECTED: { variant: 'danger', label: 'Descartado' },
};

const resolveVoucherUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = (config.API_URL ?? '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const AGENCY_LABEL: Record<string, string> = {
  SHALOM: 'Shalom',
  FLORES: 'Flores',
  MARVISUR: 'Marvisur',
};

/** Etiqueta legible de los datos de entrega del pedido (modo cajón). */
const resolveDeliveryLabel = (order: ChatbotOrder): string | null => {
  const parts: string[] = [];
  if (order.deliveryInLima === true) {
    parts.push('Entrega a domicilio (Lima)');
  } else if (order.deliveryAgency) {
    parts.push(`Agencia ${AGENCY_LABEL[order.deliveryAgency] ?? order.deliveryAgency}`);
  }
  if (order.deliveryAddress) {
    parts.push(order.deliveryAddress);
  }
  return parts.length > 0 ? `Entrega: ${parts.join(' · ')}` : null;
};

/** Estados accionables que componen la bandeja "Por gestionar". */
const ACTIONABLE_STATUSES: ChatbotOrderStatus[] = ['PENDING_PAYMENT', 'AWAITING_BALANCE'];

/** Estados en los que el pedido sigue siendo accionable (falta pago/saldo). */
const isActionable = (status: ChatbotOrderStatus): boolean => ACTIONABLE_STATUSES.includes(status);

export const ChatbotOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [filter, setFilter] = useState<OrderFilter>('ALL');
  /** Confirmación previa de cualquier acción (segunda validación). */
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  /** Vouchers ya procesados en esta pantalla: sus botones se ocultan al instante. */
  const [handledVouchers, setHandledVouchers] = useState<Record<string, 'REJECTED' | 'VERIFIED'>>(
    {}
  );
  const markHandled = (id: string, st: 'REJECTED' | 'VERIFIED') =>
    setHandledVouchers((prev) => ({ ...prev, [id]: st }));
  const [rejectTarget, setRejectTarget] = useState<ChatbotOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [extendTarget, setExtendTarget] = useState<ChatbotOrder | null>(null);
  const [extendHours, setExtendHours] = useState('72');

  const isManage = filter === 'MANAGE';
  // "Por gestionar" pide explícitamente los estados accionables porque el
  // backend, sin `status`, devuelve TODOS los pedidos.
  const isAll = filter === 'ALL';
  const listParams = isManage ? { status: ACTIONABLE_STATUSES } : { status: filter };
  const isPolling = isAll || isManage || isActionable(filter as ChatbotOrderStatus);
  const { data, isLoading, isFetching, isError, refetch } = useChatbotOrdersList(listParams, {
    refetchIntervalMs: isPolling ? 20000 : undefined,
  });
  const [channel, setChannel] = useState<SalesChannel | 'ALL'>('ALL');
  const orders = useMemo(
    () =>
      (Array.isArray(data) ? data : []).filter(
        (o) => channel === 'ALL' || channelOf(o.phone) === channel
      ),
    [data, channel]
  );

  const { hasPermission } = usePermissions();
  const canValidate = hasPermission('chatbot.orders.validate');
  const canCancel = hasPermission('chatbot.orders.cancel');
  const cancelMutation = useCancelChatbotOrder();
  const validateMutation = useValidateChatbotOrder();
  const rejectMutation = useRejectChatbotOrder();
  const extendMutation = useExtendChatbotOrderHold();
  const verifyMutation = useVerifyChatbotVoucher();

  const voucherLabel = (v: ConversationVoucher) =>
    `${formatSolesFromCents(v.amountCents == null ? null : String(v.amountCents))}${
      v.bank ? ` · ${v.bank}` : ''
    }${v.operationNumber ? ` op. ${v.operationNumber}` : ''}`;

  const handleVerifyVoucher = (order: ChatbotOrder, v: ConversationVoucher) =>
    setConfirm({
      title: 'Validar este pago',
      message:
        `¿Confirmas que el pago ${voucherLabel(v)} llegó a la cuenta?\n\n` +
        'Si es el último pago pendiente del pedido, el pedido se valida y se emite la venta.',
      confirmLabel: 'Sí, validar pago',
      onConfirm: () =>
        verifyMutation.mutate(
          { orderId: order.id, voucherId: v.id },
          {
            onSuccess: (res) => {
              markHandled(v.id, 'VERIFIED');
              if (res.orderStatus === 'EMITTED') {
                Alert.alert('Pedido validado', `Venta emitida: ${res.saleIds?.join(', ') ?? '-'}`);
              } else if (res.orderStatus === 'VALIDATED') {
                Alert.alert(
                  'Pedido validado',
                  res.error ?? res.note ?? 'Emitir la venta en el POS.'
                );
              }
            },
            onError: (err: any) =>
              Alert.alert('Error', err?.message ?? 'No se pudo validar el pago'),
          }
        ),
    });

  const handleValidate = (order: ChatbotOrder) => {
    // balanceCents = pagado - total: negativo = falta pagar.
    if (order.balanceCents < 0) {
      Alert.alert(
        'Saldo pendiente',
        `Aún falta ${formatSolesFromCents(String(Math.abs(order.balanceCents)))} por cubrir. ¿Validar de todas formas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Validar igual', onPress: () => runValidate(order) },
        ]
      );
      return;
    }
    setConfirm({
      title: 'Validar pedido',
      message: 'Se confirmará el pedido y se intentará emitir el comprobante en el POS.',
      confirmLabel: 'Sí, validar pedido',
      onConfirm: () => runValidate(order),
    });
  };

  const runValidate = (order: ChatbotOrder) => {
    validateMutation.mutate(order.id, {
      onSuccess: (res) => {
        if (res.status === 'EMITTED') {
          Alert.alert('Emitido', `Ventas: ${res.saleIds?.join(', ') ?? '-'}`);
        } else if (res.error) {
          Alert.alert('Validado sin emisión', res.error);
        } else if (res.note) {
          Alert.alert('Validado', res.note);
        }
      },
      onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo validar el pago'),
    });
  };

  const openReject = (order: ChatbotOrder) => {
    setRejectTarget(order);
    setRejectReason('');
  };

  const openExtend = (order: ChatbotOrder) => {
    setExtendTarget(order);
    setExtendHours('72');
  };

  const handleDiscardVoucher = (order: ChatbotOrder, voucher: ConversationVoucher) =>
    setConfirm({
      title: 'Descartar comprobante',
      message:
        `Se descartará el pago ${voucherLabel(voucher)} (no llegó o no es válido). ` +
        'Su monto se resta de lo pagado y el pedido queda esperando el saldo.',
      confirmLabel: 'Sí, descartar',
      danger: true,
      onConfirm: () =>
        rejectMutation.mutate(
          { id: order.id, body: { voucherId: voucher.id, action: 'request' } },
          {
            onSuccess: () => markHandled(voucher.id, 'REJECTED'),
            onError: (err: any) =>
              Alert.alert('Error', err?.message ?? 'No se pudo descartar el voucher'),
          }
        ),
    });

  const confirmExtend = () => {
    if (!extendTarget) return;
    const hours = Number.parseInt(extendHours, 10);
    const target = extendTarget;
    setConfirm({
      title: 'Dar más tiempo',
      message: `El stock del pedido #${target.id.slice(0, 8)} seguirá apartado ${
        Number.isFinite(hours) && hours > 0 ? hours : 72
      } h más.`,
      confirmLabel: 'Sí, extender',
      onConfirm: () => runExtend(target, hours),
    });
  };

  const runExtend = (extendTarget: ChatbotOrder, hours: number) => {
    extendMutation.mutate(
      { id: extendTarget.id, body: Number.isFinite(hours) && hours > 0 ? { hours } : undefined },
      {
        onSuccess: (res) => {
          setExtendTarget(null);
          Alert.alert('Apartado extendido', `${res.hours} h · ${res.holds} holds`);
        },
        onError: (err: any) =>
          Alert.alert('Error', err?.message ?? 'No se pudo extender el apartado'),
      }
    );
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const target = rejectTarget;
    setConfirm({
      title: 'Cancelar pedido',
      message: `Se anulará el pedido #${target.id.slice(0, 8)} y se liberará el stock apartado. Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, cancelar pedido',
      danger: true,
      onConfirm: () => runReject(target),
    });
  };

  const runReject = (rejectTarget: ChatbotOrder) => {
    cancelMutation.mutate(
      { id: rejectTarget.id, reason: rejectReason || undefined },
      {
        onSuccess: () => {
          setRejectTarget(null);
          setRejectReason('');
        },
        onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo rechazar'),
      }
    );
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="cart-outline" size={22} color={theme.color.brand.onHeader} />
              </View>
              <Text style={styles.headerTitle}>Pedidos Redes Sociales</Text>
            </View>
            <Text style={styles.headerSubtitle}>Pedidos, saldo y validación de vouchers</Text>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} />
          }
        >
          <ChipGroup
            options={STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            selected={[filter]}
            onChange={(sel) => sel[0] && setFilter(sel[0] as OrderFilter)}
            multiple={false}
          />
          <ChipGroup
            options={[
              { label: 'Todas las redes', value: 'ALL' },
              ...SALES_CHANNELS.map((c) => ({ label: CHANNEL_META[c].label, value: c })),
            ]}
            selected={[channel]}
            onChange={(sel) => sel[0] && setChannel(sel[0] as SalesChannel | 'ALL')}
            multiple={false}
          />

          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <ErrorState
              title="Error al cargar pedidos"
              description="Reintenta en un momento."
              onRetry={() => refetch()}
            />
          ) : orders.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="Sin pedidos"
              description="No hay pedidos en este estado."
            />
          ) : (
            <View style={styles.list}>
              {orders.map((order) => {
                const badge = STATUS_BADGE[order.status];
                // balanceCents = pagado - total: negativo = falta, positivo = a favor.
                const balanceMissing = order.balanceCents < 0;
                const balanceColor =
                  order.balanceCents < 0
                    ? theme.color.text.danger
                    : order.balanceCents > 0
                      ? theme.color.text.warning
                      : theme.color.text.success;
                const delivery = describeOrderFulfillment(order);
                const who =
                  order.customerName?.trim() || (order.phone ? displayPhone(order.phone) : null);
                const ch = CHANNEL_META[channelOf(order.phone)];
                return (
                  <Card key={order.id} style={styles.orderCard}>
                    {/* Cabecera: cliente, pedido y estado */}
                    <View style={styles.orderHeader}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={ch.icon} size={16} color={ch.color} />
                          <Title numberOfLines={1} style={{ flexShrink: 1 }}>
                            {who ?? `Pedido #${order.id.slice(0, 8)}`}
                          </Title>
                        </View>
                        <Caption color={theme.color.text.muted} numberOfLines={1}>
                          #{order.id.slice(0, 8)}
                          {who && order.phone && order.customerName
                            ? ` · ${displayPhone(order.phone)}`
                            : ''}{' '}
                          · {formatDateTime(order.createdAt)}
                        </Caption>
                      </View>
                      <Badge variant={badge.variant} label={badge.label} />
                    </View>

                    {/* Montos en una línea */}
                    <View style={styles.balanceRow}>
                      <View style={styles.balanceCell}>
                        <Caption color={theme.color.text.muted}>Total</Caption>
                        <Body style={styles.amount}>{formatSolesFromCents(order.totalCents)}</Body>
                      </View>
                      <View style={styles.balanceCell}>
                        <Caption color={theme.color.text.muted}>Pagado</Caption>
                        <Body style={styles.amount}>{formatSolesFromCents(order.paidCents)}</Body>
                      </View>
                      <View style={styles.balanceCell}>
                        <Caption color={theme.color.text.muted}>
                          {balanceMissing ? 'Falta' : order.balanceCents > 0 ? 'A favor' : 'Saldo'}
                        </Caption>
                        <Body color={balanceColor} style={styles.amount}>
                          {formatSolesFromCents(String(Math.abs(order.balanceCents)))}
                        </Body>
                      </View>
                    </View>

                    {/* Entrega y notas */}
                    {delivery ||
                    order.fulfillment?.orderNotes ||
                    order.fulfillment?.deliveryNotes ? (
                      <View style={styles.infoBox}>
                        {delivery ? (
                          <Caption color={theme.color.text.body}>{delivery}</Caption>
                        ) : null}
                        {order.fulfillment?.orderNotes ? (
                          <Caption color={theme.color.text.body}>
                            📝 {order.fulfillment.orderNotes}
                          </Caption>
                        ) : null}
                        {order.fulfillment?.deliveryNotes ? (
                          <Caption color={theme.color.text.body}>
                            📍 {order.fulfillment.deliveryNotes}
                          </Caption>
                        ) : null}
                      </View>
                    ) : null}
                    {resolveDeliveryLabel(order) ? (
                      <Caption color={theme.color.text.muted}>
                        {resolveDeliveryLabel(order)}
                      </Caption>
                    ) : null}

                    {/* Pagos: cada voucher se valida o descarta por separado */}
                    <OrderVouchersSection
                      order={order}
                      styles={styles}
                      theme={theme}
                      onDiscard={handleDiscardVoucher}
                      onVerify={handleVerifyVoucher}
                      busy={rejectMutation.isPending || verifyMutation.isPending}
                      handled={handledVouchers}
                      allowActions={isActionable(order.status) && canValidate}
                    />

                    {order.rejectedReason ? (
                      <Caption color={theme.color.text.muted}>
                        Motivo rechazo: {order.rejectedReason}
                      </Caption>
                    ) : null}
                    {order.saleIds && order.saleIds.length > 0 ? (
                      <Caption color={theme.color.text.muted}>
                        Ventas: {order.saleIds.join(', ')}
                      </Caption>
                    ) : null}

                    {isActionable(order.status) && (canValidate || canCancel) ? (
                      <View style={styles.actionsRow}>
                        {canValidate ? (
                          <Button
                            title="Dar más tiempo"
                            variant="ghost"
                            size="small"
                            leftIcon="timer-outline"
                            onPress={() => openExtend(order)}
                          />
                        ) : null}
                        {canCancel ? (
                          <Button
                            title="Cancelar pedido"
                            variant="outline"
                            size="small"
                            leftIcon="close-circle-outline"
                            onPress={() => openReject(order)}
                          />
                        ) : null}
                        {canValidate && order.status === 'PENDING_PAYMENT' && !order.voucherUrl ? (
                          <Button
                            title="Validar pedido"
                            size="small"
                            leftIcon="checkmark-circle-outline"
                            onPress={() => handleValidate(order)}
                            loading={
                              validateMutation.isPending && validateMutation.variables === order.id
                            }
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Reject / cancel order modal */}
        <Modal
          visible={!!rejectTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setRejectTarget(null)}
        >
          <Pressable style={styles.previewBackdrop} onPress={() => setRejectTarget(null)}>
            <Pressable style={styles.rejectCard} onPress={(e) => e.stopPropagation()}>
              <Title>Cancelar pedido</Title>
              <Caption color={theme.color.text.muted}>
                Se liberará el stock reservado. El motivo es opcional.
              </Caption>
              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Motivo (ej. cliente desistió)"
                placeholderTextColor={theme.color.text.muted}
                style={styles.rejectInput}
                multiline
              />
              <View style={styles.rejectActions}>
                <Button title="Volver" variant="outline" onPress={() => setRejectTarget(null)} />
                <Button
                  title="Cancelar pedido"
                  onPress={confirmReject}
                  loading={cancelMutation.isPending}
                  leftIcon="close-circle-outline"
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Extend-hold modal */}
        <Modal
          visible={!!extendTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setExtendTarget(null)}
        >
          <Pressable style={styles.previewBackdrop} onPress={() => setExtendTarget(null)}>
            <Pressable style={styles.rejectCard} onPress={(e) => e.stopPropagation()}>
              <Title>Extender apartado</Title>
              <Caption color={theme.color.text.muted}>
                Extiende la vigencia del stock reservado. Si se deja vacío se usa 72 h.
              </Caption>
              <TextInput
                value={extendHours}
                onChangeText={(v) => setExtendHours(v.replace(/[^0-9]/g, ''))}
                placeholder="Horas (ej. 72)"
                placeholderTextColor={theme.color.text.muted}
                style={styles.rejectInput}
                keyboardType="number-pad"
              />
              <View style={styles.rejectActions}>
                <Button title="Cancelar" variant="outline" onPress={() => setExtendTarget(null)} />
                <Button
                  title="Extender"
                  onPress={confirmExtend}
                  loading={extendMutation.isPending}
                  leftIcon="timer-outline"
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        {/* Confirmación (segunda validación) de cualquier acción */}
        <Modal
          visible={!!confirm}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirm(null)}
        >
          <Pressable style={styles.previewBackdrop} onPress={() => setConfirm(null)}>
            <Pressable style={styles.rejectCard} onPress={(e) => e.stopPropagation()}>
              <Title>{confirm?.title}</Title>
              <Body color={theme.color.text.body}>{confirm?.message}</Body>
              <View style={styles.rejectActions}>
                <Button title="Volver" variant="outline" onPress={() => setConfirm(null)} />
                <Button
                  title={confirm?.confirmLabel ?? 'Confirmar'}
                  variant={confirm?.danger ? 'danger' : 'primary'}
                  onPress={() => {
                    const run = confirm?.onConfirm;
                    setConfirm(null);
                    run?.();
                  }}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ScreenLayout>
  );
};

// ============================================
// Vouchers de la conversación (por pedido)
// ============================================
interface OrderVouchersSectionProps {
  order: ChatbotOrder;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  onDiscard: (order: ChatbotOrder, voucher: ConversationVoucher) => void;
  onVerify: (order: ChatbotOrder, voucher: ConversationVoucher) => void;
  busy: boolean;
  /** Estado local de vouchers ya validados/descartados (antes de refrescar). */
  handled: Record<string, 'REJECTED' | 'VERIFIED'>;
  /** Validar/descartar solo mientras el pedido sigue abierto. */
  allowActions: boolean;
}

const OrderVouchersSection: React.FC<OrderVouchersSectionProps> = ({
  order,
  styles,
  theme,
  onDiscard,
  onVerify,
  busy,
  handled,
  allowActions,
}) => {
  const { data, isLoading } = useConversationVouchers(order.conversationId);
  // Solo los comprobantes de ESTE pedido (la conversación puede tener otros).
  const vouchers = useMemo(
    () => (Array.isArray(data) ? data : []).filter((v) => !v.orderId || v.orderId === order.id),
    [data, order.id]
  );

  if (isLoading) {
    return (
      <View style={styles.vouchersLoading}>
        <ActivityIndicator size="small" color={theme.color.brand.accent} />
      </View>
    );
  }

  if (vouchers.length === 0) {
    // Pedido con voucher guardado directamente (sin comprobantes en la conversación).
    if (order.voucherUrl) {
      return (
        <View style={styles.voucherItemActions}>
          <VoucherLinkButton orderId={order.id} />
        </View>
      );
    }
    return <Caption color={theme.color.text.muted}>Sin pagos registrados aún.</Caption>;
  }

  return (
    <View style={styles.vouchersBox}>
      <Caption color={theme.color.text.muted} style={{ fontWeight: '700' }}>
        PAGOS ({vouchers.length})
      </Caption>
      {vouchers.map((v) => {
        const status = (handled[v.id] ?? v.status) as VoucherStatus;
        const vbadge = VOUCHER_BADGE[status] ?? VOUCHER_BADGE.PENDING;
        const hasImage = !!v.imageUrl;
        const closed = status === 'REJECTED' || status === 'DUPLICATE';
        const canVerify =
          allowActions && !closed && status !== 'VERIFIED' && v.orderId === order.id;
        return (
          <View key={v.id} style={styles.voucherItem}>
            <View style={styles.voucherItemHeader}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700' }}>
                  {formatSolesFromCents(
                    v.amountCents === null || v.amountCents === undefined
                      ? null
                      : String(v.amountCents)
                  )}
                  <Caption color={theme.color.text.muted}>
                    {'  '}
                    {v.bank ?? 'Banco -'}
                    {v.operationNumber ? ` · Op. ${v.operationNumber}` : ''}
                    {v.operationDate ? ` · ${v.operationDate}` : ''}
                    {v.operationTime ? ` ${v.operationTime}` : ''}
                  </Caption>
                </Body>
              </View>
              <Badge variant={vbadge.variant} label={vbadge.label} />
            </View>
            <View style={styles.voucherItemActions}>
              {hasImage ? <VoucherLinkButton voucherId={v.id} /> : null}
              {allowActions && !closed ? (
                <Button
                  title="Descartar"
                  variant="outline"
                  size="small"
                  leftIcon="close-circle-outline"
                  onPress={() => onDiscard(order, v)}
                  disabled={busy}
                />
              ) : null}
              {canVerify ? (
                <Button
                  title="Validar pago"
                  size="small"
                  leftIcon="checkmark-circle-outline"
                  onPress={() => onVerify(order, v)}
                  disabled={busy}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.color.brand.headerFrom,
    },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[1],
    },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    scrollContent: {
      padding: spacing[4],
      paddingBottom: spacing[8],
      gap: spacing[3],
    },
    centerBox: {
      padding: spacing[5],
      alignItems: 'center',
    },
    list: {
      gap: spacing[3],
    },
    orderCard: {
      padding: spacing[3],
      gap: spacing[2],
    },
    orderHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
    },
    orderTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    balanceRow: {
      flexDirection: 'row',
      gap: spacing[2],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.md,
      padding: spacing[2],
    },
    balanceCell: {
      flex: 1,
      gap: spacing[1] / 2,
    },
    amount: {
      fontWeight: '700',
    },
    infoBox: {
      gap: 2,
      paddingVertical: spacing[1],
    },
    voucherBox: {
      alignItems: 'center',
      gap: spacing[1],
    },
    voucherImg: {
      width: '100%',
      height: 180,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.background.subtle,
    },
    vouchersLoading: {
      paddingVertical: spacing[2],
      alignItems: 'flex-start',
    },
    vouchersBox: {
      gap: spacing[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
      paddingTop: spacing[2],
    },
    voucherItem: {
      gap: spacing[1],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.md,
      padding: spacing[2],
    },
    voucherItemHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
    },
    voucherItemActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    previewBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[4],
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    rejectCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      gap: spacing[3],
    },
    rejectInput: {
      minHeight: 80,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      padding: spacing[3],
      color: theme.color.text.body,
      textAlignVertical: 'top',
    },
    rejectActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
  });
