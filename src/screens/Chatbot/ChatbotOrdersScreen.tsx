import React, { useEffect, useMemo, useState } from 'react';
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

import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { GradientHeader, contentWidthStyle } from '@/design-system/components';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import { useConversationVouchers } from '@/hooks/api/useChatbotConversations';
import {
  useChatbotOrdersPage,
  useExtendChatbotOrderHold,
  useCancelChatbotOrder,
  useRejectChatbotOrder,
  useSetChatbotOrderInvoiceType,
  useValidateChatbotOrder,
  useVerifyChatbotVoucher,
} from '@/hooks/api/useChatbotOrders';
import type {
  ChatbotOrder,
  ChatbotOrderDocument,
  ChatbotOrderPaymentFilter,
  ChatbotOrderStatus,
  ConversationVoucher,
  VoucherStatus,
} from '@/types/chatbot';
import Alert from '@/utils/alert';
import { saveAndSharePdf } from '@/utils/fileDownload';
import { bizlinksApi } from '@/services/api/bizlinks';
import { usePermissions } from '@/hooks/usePermissions';
import { config } from '@/utils/config';
import { PageControls } from './components/PageControls';
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

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

type PaymentFilter = ChatbotOrderPaymentFilter | 'ALL';
const PAYMENT_OPTIONS: Array<{ label: string; value: PaymentFilter }> = [
  { label: 'Cualquier pago', value: 'ALL' },
  { label: 'Pagado completo', value: 'covered' },
  { label: 'Parcial', value: 'partial' },
  { label: 'Sin pago', value: 'none' },
];

type DateQuick = 'all' | 'today' | 'week' | 'month' | 'custom';
const DATE_OPTIONS: Array<{ label: string; value: DateQuick }> = [
  { label: 'Cualquier fecha', value: 'all' },
  { label: 'Hoy', value: 'today' },
  { label: '7 días', value: 'week' },
  { label: 'Este mes', value: 'month' },
];

type SortOrder = 'oldest' | 'newest';
const SORT_OPTIONS: Array<{ label: string; value: SortOrder }> = [
  { label: 'Más antiguos', value: 'oldest' },
  { label: 'Más recientes', value: 'newest' },
];

/** Fecha de Lima (UTC-5, sin horario de verano) como YYYY-MM-DD. */
const limaDate = (offsetDays = 0): string =>
  new Date(Date.now() - 5 * 3600 * 1000 + offsetDays * 86400 * 1000).toISOString().slice(0, 10);

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fromYmd = (v: string) => {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const quickRange = (q: DateQuick): { from: string; to: string } => {
  const today = limaDate();
  if (q === 'today') return { from: today, to: today };
  if (q === 'week') return { from: limaDate(-6), to: today };
  if (q === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: '', to: '' };
};

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

/** Boleta o factura a emitir, con el documento del cliente. */
const describeOrderInvoice = (order: ChatbotOrder): string | null => {
  const inv = order.invoice;
  if (!inv) return null;
  const doc =
    inv.customerDocumentType && inv.customerDocumentNumber
      ? ` · ${inv.customerDocumentType} ${inv.customerDocumentNumber}`
      : '';
  const who = inv.customerName ? ` a ${inv.customerName}` : '';
  return `🧾 ${inv.type === 'FACTURA' ? 'Factura' : 'Boleta'}${who}${doc}${
    inv.chosen ? '' : ' (deducido del documento)'
  }`;
};

/** Se puede cambiar boleta/factura mientras no exista la venta. */
const canChangeInvoice = (order: ChatbotOrder): boolean =>
  order.status === 'PENDING_PAYMENT' ||
  order.status === 'AWAITING_BALANCE' ||
  (order.status === 'VALIDATED' && !(order.saleIds && order.saleIds.length > 0));

/** Estado del comprobante en SUNAT (vía Bizlinks), en palabras del asesor. */
const documentStatusLabel = (doc: ChatbotOrderDocument): string => {
  const ws = doc.statusWs ?? '';
  const st = doc.status ?? '';
  if (ws === 'SIGNED/RC_05' || st === 'REJECTED') return 'Rechazado por SUNAT';
  if (
    ws.startsWith('SIGNED/PE_02') ||
    ws === 'SIGNED/AC_03' ||
    st === 'ACCEPTED' ||
    st === 'COMPLETED'
  )
    return 'Aceptado';
  if (st === 'FAILED' || st === 'NEEDS_RECONCILIATION') return 'Con error';
  return 'En proceso';
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
  const isPolling = isAll || isManage || isActionable(filter as ChatbotOrderStatus);
  const [channel, setChannel] = useState<SalesChannel | 'ALL'>('ALL');
  const [payment, setPayment] = useState<PaymentFilter>('ALL');
  // Por defecto, de los más antiguos a los más recientes en todas las vistas.
  const [sort, setSort] = useState<SortOrder>('oldest');
  const [dateQuick, setDateQuick] = useState<DateQuick>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Cualquier cambio de filtro vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [filter, channel, payment, sort, from, to, q]);

  const applyDateQuick = (v: DateQuick) => {
    setDateQuick(v);
    const r = quickRange(v);
    setFrom(r.from);
    setTo(r.to);
  };

  const { data, isLoading, isFetching, isError, refetch } = useChatbotOrdersPage(
    {
      status: isManage ? ACTIONABLE_STATUSES : isAll ? 'ALL' : [filter as ChatbotOrderStatus],
      q: q || undefined,
      channel: channel === 'ALL' ? undefined : channel,
      payment: payment === 'ALL' ? undefined : payment,
      from: from || undefined,
      to: to || undefined,
      sort,
      page,
      pageSize: PAGE_SIZE,
    },
    { refetchIntervalMs: isPolling ? 20000 : undefined }
  );
  const orders = data?.items ?? [];
  const total = data?.total ?? 0;

  // Si tras una acción la página quedó vacía, retrocede una.
  useEffect(() => {
    if (!isFetching && page > 1 && data && data.items.length === 0) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [isFetching, data, page]);

  const activeFilters =
    (channel !== 'ALL' ? 1 : 0) + (payment !== 'ALL' ? 1 : 0) + (from || to ? 1 : 0);

  const { hasPermission } = usePermissions();
  const canValidate = hasPermission('chatbot.orders.validate');
  const canCancel = hasPermission('chatbot.orders.cancel');
  const cancelMutation = useCancelChatbotOrder();
  const validateMutation = useValidateChatbotOrder();
  const rejectMutation = useRejectChatbotOrder();
  const extendMutation = useExtendChatbotOrderHold();
  const verifyMutation = useVerifyChatbotVoucher();
  const invoiceMutation = useSetChatbotOrderInvoiceType();

  const handleToggleInvoice = (order: ChatbotOrder) => {
    const next = order.invoice?.type === 'FACTURA' ? 'BOLETA' : 'FACTURA';
    setConfirm({
      title: next === 'FACTURA' ? 'Emitir factura' : 'Emitir boleta',
      message:
        next === 'FACTURA'
          ? 'Se emitirá factura al RUC del cliente. Se verifica en SUNAT que el RUC esté activo y habido.'
          : 'Se emitirá boleta en lugar de factura.',
      confirmLabel: next === 'FACTURA' ? 'Sí, factura' : 'Sí, boleta',
      onConfirm: () =>
        invoiceMutation.mutate(
          { id: order.id, invoiceType: next },
          {
            onError: (err: any) =>
              Alert.alert(
                'No se pudo cambiar',
                err?.message ?? 'No se pudo cambiar el comprobante'
              ),
          }
        ),
    });
  };

  const openDocumentPdf = async (doc: ChatbotOrderDocument) => {
    if (!doc.bizlinksDocumentId) return;
    try {
      const blob = await bizlinksApi.downloadPDF(doc.bizlinksDocumentId);
      const name = (doc.documentNumber || `comprobante-${doc.saleId.slice(0, 8)}`).replace(
        /[\\/:*?"<>|]/g,
        '-'
      );
      await saveAndSharePdf(blob, name, `Comprobante ${doc.documentNumber ?? ''}`.trim());
    } catch (err: any) {
      Alert.alert(
        'PDF no disponible',
        err?.message ?? 'El PDF aún no está listo. Intenta en unos minutos.'
      );
    }
  };

  const voucherLabel = (v: ConversationVoucher) =>
    `${formatSolesFromCents(v.amountCents == null ? null : String(v.amountCents))}${
      v.bank ? ` · ${v.bank}` : ''
    }${v.operationNumber ? ` op. ${v.operationNumber}` : ''}`;

  const handleVerifyVoucher = (order: ChatbotOrder, v: ConversationVoucher) =>
    setConfirm({
      title: 'Validar este pago',
      message:
        `¿Confirmas que el pago ${voucherLabel(v)} llegó a la cuenta?\n\n` +
        'Si es el último pago pendiente del pedido, el pedido se valida. La boleta o factura se emite en Armado.',
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
      message: 'Se confirmará el pedido. La boleta o factura se emite en Post venta · Armado.',
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
        <GradientHeader
          icon="cart-outline"
          title="Pedidos Redes Sociales"
          subtitle="Pedidos, saldo y validación de vouchers"
          stat={{ value: isLoading ? '…' : total, label: 'Pedidos' }}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, contentWidthStyle]}
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
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={theme.color.text.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar pedido, cliente, teléfono, DNI, operación o producto"
              placeholderTextColor={theme.color.text.muted}
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {isFetching && !isLoading ? (
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
            ) : search ? (
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.color.text.muted}
                onPress={() => setSearch('')}
                accessibilityLabel="Limpiar búsqueda"
              />
            ) : null}
          </View>

          <View style={styles.toolbarRow}>
            <ChipGroup
              options={SORT_OPTIONS}
              selected={[sort]}
              onChange={(sel) => sel[0] && setSort(sel[0] as SortOrder)}
              size="small"
            />
            <Button
              guardDoubleTap
              title={`Filtros${activeFilters ? ` (${activeFilters})` : ''}`}
              leftIcon="options-outline"
              variant={showFilters ? 'primary' : 'outline'}
              size="small"
              onPress={() => setShowFilters((v) => !v)}
            />
          </View>

          {showFilters ? (
            <Card style={styles.filtersCard}>
              <Caption color={theme.color.text.muted}>Red social</Caption>
              <ChipGroup
                options={[
                  { label: 'Todas las redes', value: 'ALL' },
                  ...SALES_CHANNELS.map((c) => ({ label: CHANNEL_META[c].label, value: c })),
                ]}
                selected={[channel]}
                onChange={(sel) => sel[0] && setChannel(sel[0] as SalesChannel | 'ALL')}
                size="small"
              />
              <Caption color={theme.color.text.muted}>Pago</Caption>
              <ChipGroup
                options={PAYMENT_OPTIONS}
                selected={[payment]}
                onChange={(sel) => sel[0] && setPayment(sel[0] as PaymentFilter)}
                size="small"
              />
              <Caption color={theme.color.text.muted}>Fecha del pedido</Caption>
              <ChipGroup
                options={DATE_OPTIONS}
                selected={dateQuick === 'custom' ? [] : [dateQuick]}
                onChange={(sel) => sel[0] && applyDateQuick(sel[0] as DateQuick)}
                size="small"
              />
              <View style={styles.toolbarRow}>
                <View style={{ flex: 1 }}>
                  <DatePickerButton
                    label="Desde"
                    value={from}
                    placeholder="Sin límite"
                    onPress={() => setPicker('from')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <DatePickerButton
                    label="Hasta"
                    value={to}
                    placeholder="Sin límite"
                    onPress={() => setPicker('to')}
                  />
                </View>
              </View>
              {activeFilters ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Button
                    guardDoubleTap
                    title="Limpiar filtros"
                    variant="ghost"
                    size="small"
                    onPress={() => {
                      setChannel('ALL');
                      setPayment('ALL');
                      applyDateQuick('all');
                    }}
                  />
                </View>
              ) : null}
            </Card>
          ) : null}

          <Caption color={theme.color.text.muted}>
            {isLoading ? 'Cargando…' : `${total} pedido${total === 1 ? '' : 's'}`}
          </Caption>

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
              description={
                q || activeFilters
                  ? 'Ningún pedido coincide con la búsqueda o los filtros.'
                  : 'No hay pedidos en este estado.'
              }
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
                        {Number(order.creditCents ?? 0) > 0 ? (
                          <Caption color={theme.color.text.muted}>
                            {`incluye ${formatSolesFromCents(String(order.creditCents))} de saldo a favor`}
                          </Caption>
                        ) : null}
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
                    {/* Comprobante: boleta/factura a emitir y los ya emitidos */}
                    {describeOrderInvoice(order) || (order.documents?.length ?? 0) > 0 ? (
                      <View style={styles.infoBox}>
                        {(order.documents?.length ?? 0) === 0 && describeOrderInvoice(order) ? (
                          <Caption color={theme.color.text.body}>
                            {describeOrderInvoice(order)}
                          </Caption>
                        ) : null}
                        {order.documents?.map((doc) => (
                          <View
                            key={doc.saleId}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                          >
                            <Caption color={theme.color.text.body} style={{ flex: 1 }}>
                              🧾 {doc.documentType === '01' ? 'Factura' : 'Boleta'}{' '}
                              {doc.documentNumber ?? 'en preparación'} · {documentStatusLabel(doc)}
                            </Caption>
                            {doc.bizlinksDocumentId ? (
                              <Button
                                guardDoubleTap
                                title="PDF"
                                variant="ghost"
                                size="small"
                                leftIcon="document-text-outline"
                                onPress={() => openDocumentPdf(doc)}
                              />
                            ) : null}
                          </View>
                        ))}
                        {canValidate && canChangeInvoice(order) ? (
                          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {order.invoice?.type === 'FACTURA' ||
                            order.invoice?.customerDocumentType === 'RUC' ? (
                              <Button
                                guardDoubleTap
                                title={
                                  order.invoice?.type === 'FACTURA'
                                    ? 'Cambiar a boleta'
                                    : 'Cambiar a factura'
                                }
                                variant="ghost"
                                size="small"
                                leftIcon="swap-horizontal-outline"
                                onPress={() => handleToggleInvoice(order)}
                                loading={
                                  invoiceMutation.isPending &&
                                  invoiceMutation.variables?.id === order.id
                                }
                              />
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {isActionable(order.status) && (canValidate || canCancel) ? (
                      <View style={styles.actionsRow}>
                        {canValidate ? (
                          <Button
                            guardDoubleTap
                            title="Dar más tiempo"
                            variant="ghost"
                            size="small"
                            leftIcon="timer-outline"
                            onPress={() => openExtend(order)}
                          />
                        ) : null}
                        {canCancel ? (
                          <Button
                            guardDoubleTap
                            title="Cancelar pedido"
                            variant="outline"
                            size="small"
                            leftIcon="close-circle-outline"
                            onPress={() => openReject(order)}
                          />
                        ) : null}
                        {canValidate && order.status === 'PENDING_PAYMENT' && !order.voucherUrl ? (
                          <Button
                            guardDoubleTap
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
        {/* Paginación fija al pie (fuera del scroll); eleva los botones flotantes. */}
        <PageControls
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          count={orders.length}
          busy={isFetching}
          onPage={setPage}
        />

        <DatePicker
          visible={picker !== null}
          date={fromYmd((picker === 'to' ? to : from) || limaDate())}
          title={picker === 'to' ? 'Hasta' : 'Desde'}
          onConfirm={(d) => {
            if (picker === 'to') setTo(toYmd(d));
            else setFrom(toYmd(d));
            setDateQuick('custom');
            setPicker(null);
          }}
          onCancel={() => setPicker(null)}
        />

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
                <Button
                  guardDoubleTap
                  title="Volver"
                  variant="outline"
                  onPress={() => setRejectTarget(null)}
                />
                <Button
                  guardDoubleTap
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
                <Button
                  guardDoubleTap
                  title="Cancelar"
                  variant="outline"
                  onPress={() => setExtendTarget(null)}
                />
                <Button
                  guardDoubleTap
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
                <Button
                  guardDoubleTap
                  title="Volver"
                  variant="outline"
                  onPress={() => setConfirm(null)}
                />
                <Button
                  guardDoubleTap
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
        // El listado de vouchers no siempre trae imageUrl: si el backend dice
        // explicitamente que no hay imagen (hasImage === false) se oculta; si no,
        // el boton pide el link y avisa si no hay imagen.
        const hasImage = (v as { hasImage?: boolean }).hasImage !== false;
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
                  guardDoubleTap
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
                  guardDoubleTap
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
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing[3],
      backgroundColor: theme.color.surface.base,
    },
    searchInput: { flex: 1, paddingVertical: spacing[3], color: theme.color.text.body },
    toolbarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    filtersCard: { padding: spacing[3], gap: spacing[2] },
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
