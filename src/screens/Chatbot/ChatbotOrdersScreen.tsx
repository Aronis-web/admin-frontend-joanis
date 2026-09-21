import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  useRejectChatbotOrder,
  useValidateChatbotOrder,
} from '@/hooks/api/useChatbotOrders';
import type {
  ChatbotOrder,
  ChatbotOrderStatus,
  ConversationVoucher,
  VoucherStatus,
} from '@/types/chatbot';
import Alert from '@/utils/alert';
import { config } from '@/utils/config';
import { formatDateTime, formatSolesFromCents } from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotOrders'>;

/**
 * Valor del filtro. `MANAGE` = bandeja por defecto (sin `status`): el backend
 * devuelve los pedidos accionables (`PENDING_PAYMENT` + `AWAITING_BALANCE`).
 */
type OrderFilter = ChatbotOrderStatus | 'MANAGE';

const STATUS_OPTIONS: Array<{ label: string; value: OrderFilter }> = [
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
  MATCHED: { variant: 'success', label: 'Conciliado' },
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

  const [filter, setFilter] = useState<OrderFilter>('MANAGE');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ChatbotOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [extendTarget, setExtendTarget] = useState<ChatbotOrder | null>(null);
  const [extendHours, setExtendHours] = useState('72');

  const isManage = filter === 'MANAGE';
  // "Por gestionar" pide explícitamente los estados accionables porque el
  // backend, sin `status`, devuelve TODOS los pedidos.
  const listParams = isManage ? { status: ACTIONABLE_STATUSES } : { status: filter };
  const isPolling = isManage || isActionable(filter as ChatbotOrderStatus);
  const { data, isLoading, isFetching, isError, refetch } = useChatbotOrdersList(listParams, {
    refetchIntervalMs: isPolling ? 20000 : undefined,
  });
  const orders = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const validateMutation = useValidateChatbotOrder();
  const rejectMutation = useRejectChatbotOrder();
  const extendMutation = useExtendChatbotOrderHold();

  const handleValidate = (order: ChatbotOrder) => {
    if (order.balanceCents > 0) {
      Alert.alert(
        'Saldo pendiente',
        `Aún falta ${formatSolesFromCents(String(order.balanceCents))} por cubrir. ¿Validar de todas formas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Validar igual', onPress: () => runValidate(order) },
        ]
      );
      return;
    }
    Alert.alert(
      'Validar pago',
      'Se confirmará el pago y se intentará emitir el comprobante en el POS.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Validar', onPress: () => runValidate(order) },
      ]
    );
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

  const handleDiscardVoucher = (order: ChatbotOrder, voucher: ConversationVoucher) => {
    Alert.alert(
      'Descartar voucher',
      'Se descartará este comprobante y se le pedirá al cliente uno nuevo. El pedido quedará a la espera de saldo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () =>
            rejectMutation.mutate(
              { id: order.id, body: { voucherId: voucher.id, action: 'request' } },
              {
                onError: (err: any) =>
                  Alert.alert('Error', err?.message ?? 'No se pudo descartar el voucher'),
              }
            ),
        },
      ]
    );
  };

  const confirmExtend = () => {
    if (!extendTarget) return;
    const hours = Number.parseInt(extendHours, 10);
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
    rejectMutation.mutate(
      {
        id: rejectTarget.id,
        body: { action: 'cancel', ...(rejectReason ? { reason: rejectReason } : {}) },
      },
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
              <Text style={styles.headerTitle}>Pedidos WhatsApp</Text>
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
                const voucher = resolveVoucherUrl(order.voucherUrl);
                const balancePositive = order.balanceCents > 0;
                const balanceColor =
                  order.balanceCents > 0
                    ? theme.color.text.danger
                    : order.balanceCents < 0
                      ? theme.color.text.warning
                      : theme.color.text.success;
                return (
                  <Card key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.orderTitleRow}>
                          <Ionicons name="cart-outline" size={16} color={theme.color.text.muted} />
                          <Title>Pedido #{order.id.slice(0, 8)}</Title>
                        </View>
                        <Caption color={theme.color.text.muted}>
                          {formatDateTime(order.createdAt)}
                        </Caption>
                      </View>
                      <Badge variant={badge.variant} label={badge.label} />
                    </View>

                    {/* Resumen de saldo */}
                    <View style={styles.balanceRow}>
                      <View style={styles.balanceCell}>
                        <Caption color={theme.color.text.muted}>Total</Caption>
                        <Body>{formatSolesFromCents(order.totalCents)}</Body>
                      </View>
                      <View style={styles.balanceCell}>
                        <Caption color={theme.color.text.muted}>Pagado</Caption>
                        <Body>{formatSolesFromCents(order.paidCents)}</Body>
                      </View>
                      <View style={styles.balanceCell}>
                        <Caption color={theme.color.text.muted}>
                          {balancePositive ? 'Falta' : order.balanceCents < 0 ? 'A favor' : 'Saldo'}
                        </Caption>
                        <Body color={balanceColor}>
                          {formatSolesFromCents(String(Math.abs(order.balanceCents)))}
                        </Body>
                      </View>
                    </View>

                    {voucher ? (
                      <Pressable onPress={() => setPreviewUrl(voucher)} style={styles.voucherBox}>
                        <Image
                          source={{ uri: voucher }}
                          style={styles.voucherImg}
                          resizeMode="cover"
                        />
                        <Caption color={theme.color.text.muted}>Toca para ampliar</Caption>
                      </Pressable>
                    ) : null}

                    {/* Vouchers (comprobantes) del pedido */}
                    <OrderVouchersSection
                      order={order}
                      styles={styles}
                      theme={theme}
                      onPreview={setPreviewUrl}
                      onDiscard={handleDiscardVoucher}
                      discardPending={rejectMutation.isPending}
                      allowDiscard={isActionable(order.status)}
                    />

                    {order.rejectedReason ? (
                      <Body color={theme.color.text.muted}>
                        Motivo rechazo: {order.rejectedReason}
                      </Body>
                    ) : null}

                    {resolveDeliveryLabel(order) ? (
                      <Caption color={theme.color.text.muted}>
                        {resolveDeliveryLabel(order)}
                      </Caption>
                    ) : null}

                    {order.saleIds && order.saleIds.length > 0 ? (
                      <Caption color={theme.color.text.muted}>
                        Ventas: {order.saleIds.join(', ')}
                      </Caption>
                    ) : null}

                    {isActionable(order.status) ? (
                      <View style={styles.actionsRow}>
                        <Button
                          title="Extender"
                          variant="ghost"
                          leftIcon="timer-outline"
                          onPress={() => openExtend(order)}
                        />
                        <Button
                          title="Cancelar"
                          variant="outline"
                          leftIcon="close-circle-outline"
                          onPress={() => openReject(order)}
                        />
                        <Button
                          title="Validar"
                          leftIcon="checkmark-circle-outline"
                          onPress={() => handleValidate(order)}
                          loading={
                            validateMutation.isPending && validateMutation.variables === order.id
                          }
                        />
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Preview voucher */}
        <Modal visible={!!previewUrl} transparent animationType="fade">
          <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUrl(null)}>
            {previewUrl ? (
              <Image
                source={{ uri: previewUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
        </Modal>

        {/* Reject / cancel order modal */}
        <Modal visible={!!rejectTarget} transparent animationType="fade">
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
                  loading={rejectMutation.isPending}
                  leftIcon="close-circle-outline"
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Extend-hold modal */}
        <Modal visible={!!extendTarget} transparent animationType="fade">
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
  onPreview: (url: string | null) => void;
  onDiscard: (order: ChatbotOrder, voucher: ConversationVoucher) => void;
  discardPending: boolean;
  /** Solo permite descartar vouchers cuando el pedido sigue siendo accionable. */
  allowDiscard: boolean;
}

const OrderVouchersSection: React.FC<OrderVouchersSectionProps> = ({
  order,
  styles,
  theme,
  onPreview,
  onDiscard,
  discardPending,
  allowDiscard,
}) => {
  const { data, isLoading } = useConversationVouchers(order.conversationId);
  const vouchers = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  if (isLoading) {
    return (
      <View style={styles.vouchersLoading}>
        <ActivityIndicator size="small" color={theme.color.brand.accent} />
      </View>
    );
  }

  if (vouchers.length === 0) {
    return <Caption color={theme.color.text.muted}>Sin vouchers registrados aún.</Caption>;
  }

  return (
    <View style={styles.vouchersBox}>
      <Caption color={theme.color.text.muted}>Comprobantes ({vouchers.length})</Caption>
      {vouchers.map((v) => {
        const vbadge = VOUCHER_BADGE[v.status] ?? VOUCHER_BADGE.PENDING;
        const img = resolveVoucherUrl(v.imageUrl);
        const isRejected = v.status === 'REJECTED';
        return (
          <View key={v.id} style={styles.voucherItem}>
            <View style={styles.voucherItemHeader}>
              <View style={{ flex: 1 }}>
                <Body>
                  {v.bank ?? 'Banco -'}
                  {v.operationNumber ? ` · Op. ${v.operationNumber}` : ''}
                </Body>
                <Caption color={theme.color.text.muted}>
                  {formatSolesFromCents(
                    v.amountCents === null || v.amountCents === undefined
                      ? null
                      : String(v.amountCents)
                  )}
                  {v.operationDate ? ` · ${v.operationDate}` : ''}
                  {v.operationTime ? ` ${v.operationTime}` : ''}
                </Caption>
              </View>
              <Badge variant={vbadge.variant} label={vbadge.label} />
            </View>
            <View style={styles.voucherItemActions}>
              {img ? (
                <Button
                  title="Ver"
                  variant="ghost"
                  size="small"
                  leftIcon="image-outline"
                  onPress={() => onPreview(img)}
                />
              ) : null}
              {allowDiscard && !isRejected ? (
                <Button
                  title="Descartar"
                  variant="outline"
                  size="small"
                  leftIcon="close-circle-outline"
                  onPress={() => onDiscard(order, v)}
                  disabled={discardPending}
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
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    actionsRow: {
      flexDirection: 'row',
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
