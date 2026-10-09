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
  ErrorState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import {
  useAddNote,
  useApplyCredit,
  useChangeSite,
  useCloseCase,
  useDirectPurchase,
  usePriorityDelivery,
  usePurchaseOptions,
  useRefund,
  useRevealPii,
  useSetTags,
  useSupportCard,
  useSupportProducts,
  useSupportTags,
  useVoidMoney,
} from '@/hooks/api/useChatbotSupport';
import { useReplyConversation } from '@/hooks/api/useChatbotConversations';
import { usePermissions } from '@/hooks/usePermissions';
import { chatbotConversationsApi } from '@/services/api/chatbot-conversations';
import type { PiiField, SupportCard, SupportProduct } from '@/services/api/chatbot-support';
import Alert from '@/utils/alert';
import { printOrderStickers } from '@/utils/priceLabel/orderStickerPrint';
import { resolveStickerPrinter } from './postsale/printerStore';
import { STATUS_LABEL } from './postsale/shared';
import {
  CustomerDataModal,
  LinkVoucherModal,
  OrderActionsModal,
  ProductStockModal,
  orderActions,
} from './support/SupportOrderActions';
import { formatDateTime } from './utils';
import {
  CASE_TYPE_LABEL,
  MONEY_KIND_LABEL,
  PII_LABEL,
  SUGGESTED_TAGS,
  parseSolesToCents,
  soles,
} from './supportUtils';

type Props = NativeStackScreenProps<any, 'ChatbotSupportCustomer'>;
type Line = { product: SupportProduct; qty: number };

const ORDER_STATUS: Record<string, string> = {
  AWAITING_BALANCE: 'Falta pago',
  PENDING_PAYMENT: 'Validando pago',
  VALIDATED: 'Pagado',
  EMITTED: 'Comprobante emitido',
  REJECTED: 'Rechazado',
  EXPIRED: 'Vencido',
};
const FULFILLMENT_OPTIONS = [
  { label: 'Recojo en tienda', value: 'PICKUP' },
  { label: 'Delivery Lima', value: 'DELIVERY_LIMA' },
  { label: 'Agencia (provincia)', value: 'AGENCY' },
];
const INVOICE_OPTIONS = [
  { label: 'Boleta', value: 'BOLETA' },
  { label: 'Factura', value: 'FACTURA' },
];

/**
 * Ficha del cliente: sus chats de todas las redes, pedidos, vouchers, saldo a
 * favor, casos, notas internas y acciones de dinero. Los datos personales salen
 * enmascarados; verlos completos pide motivo y queda registrado.
 */
export const ChatbotSupportCustomerScreen: React.FC<Props> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const conversationId: string = route.params?.conversationId;
  const caseId: string | undefined = route.params?.caseId;
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('chatbot.support.manage');
  const canPii = hasPermission('chatbot.support.pii');
  const canMoney = hasPermission('chatbot.support.money');

  const query = useSupportCard(conversationId);
  const card = query.data;
  const reveal = useRevealPii();
  const setTags = useSetTags();
  const addNote = useAddNote();
  const applyCredit = useApplyCredit();
  const priority = usePriorityDelivery();
  const voidMoney = useVoidMoney();
  const closeCase = useCloseCase();
  const tagStats = useSupportTags();

  const [revealed, setRevealed] = useState<Partial<Record<PiiField, string>>>({});
  const [revealField, setRevealField] = useState<PiiField | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [newTag, setNewTag] = useState('');
  const [noteText, setNoteText] = useState('');
  const [showRefund, setShowRefund] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [siteOrder, setSiteOrder] = useState<SupportCard['orders'][number] | null>(null);
  const [actionsOrder, setActionsOrder] = useState<SupportCard['orders'][number] | null>(null);
  const [linkVoucher, setLinkVoucher] = useState<SupportCard['vouchers'][number] | null>(null);
  const [showData, setShowData] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeNote, setCloseNote] = useState('');

  const openCaseId = useMemo(
    () => caseId ?? card?.cases.find((c) => c.status === 'PENDING' || c.status === 'ESCALATED')?.id,
    [caseId, card]
  );

  const doReveal = () => {
    if (!revealField) return;
    if (revealReason.trim().length < 5) {
      Alert.alert('Motivo', 'Escribe para qué necesitas el dato.');
      return;
    }
    reveal.mutate(
      { conversationId, field: revealField, reason: revealReason.trim() },
      {
        onSuccess: (r) => {
          setRevealed((p) => ({ ...p, [revealField]: r.value ?? '(sin dato)' }));
          setRevealField(null);
          setRevealReason('');
        },
        onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo ver el dato'),
      }
    );
  };

  const saveTags = (tags: string[]) =>
    setTags.mutate(
      { conversationId, tags },
      { onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se guardaron las etiquetas') }
    );

  const confirm = (title: string, message: string, onOk: () => void) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: onOk },
    ]);

  if (query.isLoading || !card) {
    return (
      <ScreenLayout navigation={navigation as any}>
        <View style={[styles.centerBox, { flex: 1 }]}>
          {query.isError ? (
            <ErrorState
              title="No se pudo cargar la ficha"
              description="Reintenta en un momento."
              onRetry={() => query.refetch()}
            />
          ) : (
            <ActivityIndicator color={theme.color.brand.accent} />
          )}
        </View>
      </ScreenLayout>
    );
  }

  const piiRow = (field: PiiField, masked: string | null) => (
    <View style={styles.piiRow} key={field}>
      <Caption color={theme.color.text.muted} style={{ width: 90 }}>
        {PII_LABEL[field]}
      </Caption>
      <Body style={{ flex: 1 }}>{revealed[field] ?? masked ?? '-'}</Body>
      {canPii && masked && !revealed[field] ? (
        <Button
          title="Ver"
          size="small"
          variant="ghost"
          leftIcon="eye-outline"
          onPress={() => {
            setRevealReason('');
            setRevealField(field);
          }}
        />
      ) : null}
    </View>
  );

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="person-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.headerTitle}>{card.customer.name ?? 'Cliente sin nombre'}</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {card.customer.identified ? 'Identificada' : 'Sin identificar (falta su registro)'}
            {card.customer.since ? ` · cliente desde ${formatDateTime(card.customer.since)}` : ''}
          </Text>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => query.refetch()}
            />
          }
        >
          {/* Acciones principales */}
          <View style={styles.actionsRow}>
            <Button
              title="Ver chat"
              size="small"
              variant="ghost"
              leftIcon="chatbubbles-outline"
              onPress={() => navigation.navigate('ChatbotChatDetail', { conversationId })}
            />
            {canManage ? (
              <Button
                title="Compra directa"
                size="small"
                leftIcon="cart-outline"
                onPress={() => setShowPurchase(true)}
              />
            ) : null}
            {canMoney ? (
              <Button
                title="Registrar devolución"
                size="small"
                variant="outline"
                leftIcon="cash-outline"
                onPress={() => setShowRefund(true)}
              />
            ) : null}
            <Button
              title="Consultar producto"
              size="small"
              variant="outline"
              leftIcon="search-outline"
              onPress={() => setShowStock(true)}
            />
            {canManage && openCaseId ? (
              <Button
                title="Cerrar caso"
                size="small"
                variant="outline"
                leftIcon="checkmark-circle-outline"
                onPress={() => {
                  setCloseNote('');
                  setClosing(true);
                }}
              />
            ) : null}
          </View>

          {/* Datos */}
          <Card style={styles.card}>
            <Title>Datos</Title>
            {card.customer.documentType ? (
              <Caption color={theme.color.text.muted}>
                Tipo de documento: {card.customer.documentType}
              </Caption>
            ) : null}
            {piiRow('document', card.customer.document)}
            {piiRow('phone', card.customer.phone)}
            {piiRow('email', card.customer.email)}
            {piiRow('address', card.customer.address)}
            {canPii ? (
              <Button
                title="Corregir datos"
                size="small"
                variant="ghost"
                leftIcon="create-outline"
                onPress={() => setShowData(true)}
              />
            ) : null}
            <View style={styles.block}>
              <Caption color={theme.color.text.muted}>Saldo a favor</Caption>
              <Body style={{ fontWeight: '700' }}>{soles(card.credit.availableCents)}</Body>
              {card.credit.refundedCents > 0 ? (
                <Caption color={theme.color.text.muted}>
                  Ya se devolvieron {soles(card.credit.refundedCents)} de su saldo
                </Caption>
              ) : null}
            </View>
          </Card>

          {/* Etiquetas */}
          <Card style={styles.card}>
            <Title>Etiquetas</Title>
            <View style={styles.tagsRow}>
              {card.tags.length === 0 ? (
                <Caption color={theme.color.text.muted}>Sin etiquetas</Caption>
              ) : null}
              {card.tags.map((t) => (
                <Pressable
                  key={t}
                  disabled={!canManage}
                  onPress={() => saveTags(card.tags.filter((x) => x !== t))}
                  style={styles.tagChip}
                >
                  <Text style={styles.tagText}>{t}</Text>
                  {canManage ? (
                    <Ionicons name="close" size={14} color={theme.color.text.muted} />
                  ) : null}
                </Pressable>
              ))}
            </View>
            {canManage ? (
              <>
                <View style={styles.tagsRow}>
                  {[...new Set([...SUGGESTED_TAGS, ...(tagStats.data ?? []).map((x) => x.tag)])]
                    .filter((t) => !card.tags.includes(t))
                    .slice(0, 12)
                    .map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => saveTags([...card.tags, t])}
                        style={styles.tagSuggest}
                      >
                        <Text style={styles.tagText}>+ {t}</Text>
                      </Pressable>
                    ))}
                </View>
                <View style={styles.inlineRow}>
                  <TextInput
                    value={newTag}
                    onChangeText={setNewTag}
                    placeholder="Otra etiqueta"
                    placeholderTextColor={theme.color.text.muted}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Button
                    title="Agregar"
                    size="small"
                    variant="outline"
                    onPress={() => {
                      const t = newTag.trim().toLowerCase();
                      if (t && !card.tags.includes(t)) saveTags([...card.tags, t]);
                      setNewTag('');
                    }}
                  />
                </View>
              </>
            ) : null}
          </Card>

          {/* Chats */}
          <Card style={styles.card}>
            <Title>Chats ({card.chats.length})</Title>
            {card.chats.map((c) => (
              <Pressable
                key={c.id}
                style={styles.listRow}
                onPress={() => navigation.navigate('ChatbotChatDetail', { conversationId: c.id })}
              >
                <View style={{ flex: 1 }}>
                  <Body>
                    {c.channel}
                    {c.phone ? ` · ${c.phone}` : ''}
                    {c.current ? ' · este chat' : ''}
                  </Body>
                  <Caption color={theme.color.text.muted}>
                    {c.name ?? ''} · último mensaje {formatDateTime(c.lastMessageAt)}
                    {c.botEnabled ? '' : ' · bot apagado'}
                  </Caption>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.color.text.muted} />
              </Pressable>
            ))}
          </Card>

          {/* Pedidos */}
          <Card style={styles.card}>
            <Title>Pedidos ({card.orders.length})</Title>
            {card.orders.length === 0 ? (
              <Caption color={theme.color.text.muted}>Sin pedidos</Caption>
            ) : null}
            {card.orders.map((o) => (
              <View key={o.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>
                    {o.no} · {o.cancelled ? 'Anulado (saldo a favor)' : (ORDER_STATUS[o.status] ?? o.status)}
                    {o.priority ? ' · ⚡ prioritaria' : ''}
                    {o.replacementOf ? ` · 🔁 reposición de ${o.replacementOf}` : ''}
                  </Body>
                  <Caption color={theme.color.text.muted}>
                    {formatDateTime(o.createdAt)} · total {soles(o.totalCents)} · pagado{' '}
                    {soles(o.paidCents)}
                    {o.creditCents ? ` · saldo usado ${soles(o.creditCents)}` : ''}
                    {o.place ? ` · ${o.place}` : ''}
                    {o.postsaleStatus
                      ? ` · ${STATUS_LABEL[o.postsaleStatus as keyof typeof STATUS_LABEL] ?? o.postsaleStatus}`
                      : ''}
                  </Caption>
                </View>
                {canMoney &&
                ['AWAITING_BALANCE', 'PENDING_PAYMENT'].includes(o.status) &&
                card.credit.availableCents > 0 ? (
                  <Button
                    title="Usar saldo"
                    size="small"
                    variant="ghost"
                    onPress={() =>
                      confirm(
                        'Aplicar saldo a favor',
                        `Se usará el saldo de la clienta en el pedido ${o.no}.`,
                        () =>
                          applyCredit.mutate(o.id, {
                            onSuccess: (r) =>
                              Alert.alert('Listo', `Se aplicaron ${soles(r.appliedCents)}.`),
                            onError: (e: any) =>
                              Alert.alert('Error', e?.message ?? 'No se pudo aplicar'),
                          })
                      )
                    }
                  />
                ) : null}
                {orderActions(o, { manage: canManage, money: canMoney }).length ? (
                  <Button
                    title="Acciones"
                    size="small"
                    variant="outline"
                    onPress={() => setActionsOrder(o)}
                  />
                ) : null}
                {canManage &&
                !o.cancelled &&
                o.fulfillment === 'PICKUP' &&
                !['REJECTED', 'EXPIRED'].includes(o.status) &&
                !['ENTREGADO', 'ENTREGADO_AGENCIA'].includes(o.postsaleStatus ?? '') ? (
                  <Button
                    title="Cambiar tienda"
                    size="small"
                    variant="ghost"
                    onPress={() => setSiteOrder(o)}
                  />
                ) : null}
                {canMoney &&
                !o.priority &&
                ['VALIDATED', 'EMITTED', 'PENDING_PAYMENT'].includes(o.status) ? (
                  <Button
                    title="Prioritaria"
                    size="small"
                    variant="ghost"
                    onPress={() =>
                      confirm(
                        'Entrega prioritaria',
                        `El pedido ${o.no} saldrá marcado como prioritario en Armado.`,
                        () =>
                          priority.mutate(
                            { orderId: o.id, note: 'pedido vencido' },
                            {
                              onError: (e: any) =>
                                Alert.alert('Error', e?.message ?? 'No se pudo marcar'),
                            }
                          )
                      )
                    }
                  />
                ) : null}
              </View>
            ))}
          </Card>

          {/* Vouchers */}
          <Card style={styles.card}>
            <Title>Vouchers ({card.vouchers.length})</Title>
            {card.vouchers.map((v) => (
              <View key={v.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Body>
                    {soles(v.amountCents)} · {v.bank ?? 'banco ?'} · op. {v.operationNumber ?? '-'}
                  </Body>
                  <Caption color={theme.color.text.muted}>
                    {formatDateTime(v.createdAt)} · {v.status}
                    {v.orderNo ? ` · pedido ${v.orderNo}` : ' · sin pedido'}
                    {v.duplicateReason ? ` · ${v.duplicateReason}` : ''}
                  </Caption>
                </View>
                {canMoney && !v.orderId && !['REJECTED', 'DUPLICATE'].includes(v.status) ? (
                  <Button
                    title="Vincular"
                    size="small"
                    variant="ghost"
                    onPress={() => setLinkVoucher(v)}
                  />
                ) : null}
              </View>
            ))}
          </Card>

          {/* Casos */}
          <Card style={styles.card}>
            <Title>Casos ({card.cases.length})</Title>
            {card.cases.map((c) => (
              <View key={c.id} style={styles.block}>
                <Caption color={theme.color.text.muted}>
                  {CASE_TYPE_LABEL[c.type] ?? c.type} · {formatDateTime(c.createdAt)} · {c.status}
                </Caption>
                {c.summary ? <Body>{c.summary}</Body> : null}
                {c.resolutionNote ? <Caption>Resolución: {c.resolutionNote}</Caption> : null}
              </View>
            ))}
          </Card>

          {/* Notas internas */}
          <Card style={styles.card}>
            <Title>Notas internas</Title>
            <Caption color={theme.color.text.muted}>
              Solo las ve el equipo; el bot nunca las envía.
            </Caption>
            {canManage ? (
              <View style={styles.inlineRow}>
                <TextInput
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Escribe una nota"
                  placeholderTextColor={theme.color.text.muted}
                  multiline
                  style={[styles.input, { flex: 1 }]}
                />
                <Button
                  title="Guardar"
                  size="small"
                  disabled={!noteText.trim() || addNote.isPending}
                  onPress={() =>
                    addNote.mutate(
                      { conversationId, body: noteText.trim() },
                      {
                        onSuccess: () => setNoteText(''),
                        onError: (e: any) =>
                          Alert.alert('Error', e?.message ?? 'No se guardó la nota'),
                      }
                    )
                  }
                />
              </View>
            ) : null}
            {card.notes.map((n) => (
              <View key={n.id} style={styles.block}>
                <Caption color={theme.color.text.muted}>
                  {n.author ?? 'Equipo'} · {formatDateTime(n.createdAt)}
                </Caption>
                <Body>{n.body}</Body>
              </View>
            ))}
          </Card>

          {/* Dinero */}
          <Card style={styles.card}>
            <Title>Devoluciones y acciones de dinero</Title>
            {card.money.length === 0 ? (
              <Caption color={theme.color.text.muted}>Sin movimientos</Caption>
            ) : null}
            {card.money.map((m) => (
              <View key={m.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Body style={m.voided ? { textDecorationLine: 'line-through' } : undefined}>
                    {MONEY_KIND_LABEL[m.kind] ?? m.kind}
                    {m.amountCents != null ? ` · ${soles(m.amountCents)}` : ''}
                    {m.orderNo ? ` · ${m.orderNo}` : ''}
                    {m.operationNumber ? ` · op. ${m.operationNumber}` : ''}
                  </Body>
                  <Caption color={theme.color.text.muted}>
                    {m.author ?? 'Equipo'} · {formatDateTime(m.createdAt)}
                    {m.bank ? ` · ${m.bank}` : ''}
                    {m.fromCredit ? ' · de su saldo a favor' : ''}
                    {m.note ? ` · ${m.note}` : ''}
                    {m.voided ? ' · anulada' : ''}
                  </Caption>
                </View>
                {canMoney && !m.voided ? (
                  <Button
                    title="Anular"
                    size="small"
                    variant="ghost"
                    onPress={() =>
                      confirm('Anular', 'La acción queda anulada (se conserva el registro).', () =>
                        voidMoney.mutate(m.id, {
                          onError: (e: any) =>
                            Alert.alert('Error', e?.message ?? 'No se pudo anular'),
                        })
                      )
                    }
                  />
                ) : null}
              </View>
            ))}
          </Card>

          {card.piiAccess.length ? (
            <Card style={styles.card}>
              <Title>Quién vio sus datos</Title>
              {card.piiAccess.map((l, i) => (
                <Caption key={i} color={theme.color.text.muted}>
                  {formatDateTime(l.at)} · {l.viewer ?? 'usuario'} vio{' '}
                  {PII_LABEL[l.field] ?? l.field}: {l.reason}
                </Caption>
              ))}
            </Card>
          ) : null}
        </ScrollView>

        {/* Ver dato completo */}
        <Modal
          visible={!!revealField}
          transparent
          animationType="fade"
          onRequestClose={() => setRevealField(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setRevealField(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Title>Ver {revealField ? PII_LABEL[revealField].toLowerCase() : ''} completo</Title>
              <Caption color={theme.color.text.muted}>
                Queda registrado quién lo vio, cuándo y para qué.
              </Caption>
              <TextInput
                value={revealReason}
                onChangeText={setRevealReason}
                placeholder="Para qué lo necesitas (emitir factura, coordinar entrega...)"
                placeholderTextColor={theme.color.text.muted}
                style={styles.input}
              />
              <View style={styles.actionsRow}>
                <Button title="Cancelar" variant="ghost" onPress={() => setRevealField(null)} />
                <Button title="Ver dato" onPress={doReveal} disabled={reveal.isPending} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Cerrar caso */}
        <Modal
          visible={closing}
          transparent
          animationType="fade"
          onRequestClose={() => setClosing(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setClosing(false)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Title>Cerrar caso</Title>
              <Caption color={theme.color.text.muted}>
                Se cierran todos los casos abiertos de este chat con esta nota.
              </Caption>
              <TextInput
                value={closeNote}
                onChangeText={setCloseNote}
                placeholder="Cómo se resolvió (cambio, devolución, se le respondió...)"
                placeholderTextColor={theme.color.text.muted}
                multiline
                style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
              />
              <View style={styles.actionsRow}>
                <Button title="Cancelar" variant="ghost" onPress={() => setClosing(false)} />
                <Button
                  title="Cerrar caso"
                  disabled={closeCase.isPending || closeNote.trim().length < 3}
                  onPress={() =>
                    openCaseId &&
                    closeCase.mutate(
                      { caseId: openCaseId, note: closeNote.trim() },
                      {
                        onSuccess: () => setClosing(false),
                        onError: (e: any) =>
                          Alert.alert('Error', e?.message ?? 'No se pudo cerrar'),
                      }
                    )
                  }
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {showRefund ? (
          <RefundModal
            card={card}
            conversationId={conversationId}
            caseId={openCaseId}
            onClose={() => setShowRefund(false)}
          />
        ) : null}
        {actionsOrder ? (
          <OrderActionsModal
            order={actionsOrder}
            can={{ manage: canManage, money: canMoney }}
            onClose={() => setActionsOrder(null)}
          />
        ) : null}
        {linkVoucher ? (
          <LinkVoucherModal
            voucher={linkVoucher}
            orders={card.orders}
            onClose={() => setLinkVoucher(null)}
          />
        ) : null}
        {showData ? (
          <CustomerDataModal conversationId={conversationId} onClose={() => setShowData(false)} />
        ) : null}
        {showStock ? <ProductStockModal onClose={() => setShowStock(false)} /> : null}
        {siteOrder ? (
          <ChangeSiteModal order={siteOrder} onClose={() => setSiteOrder(null)} />
        ) : null}
        {showPurchase ? (
          <PurchaseModal
            card={card}
            conversationId={conversationId}
            onClose={() => setShowPurchase(false)}
          />
        ) : null}
      </SafeAreaView>
    </ScreenLayout>
  );
};

// ----------------------------------------------------------- cambio de tienda

/** Imprime los stickers de cambio en la Godex (o con el diálogo del sistema). */
const printChangeStickers = async (stickers: any[]): Promise<string> => {
  const target = await resolveStickerPrinter().catch(() => ({ kind: 'unsupported' as const }));
  const device = target.kind === 'ready' ? target.name : undefined;
  await printOrderStickers(stickers, { deviceName: device });
  const n = stickers.length;
  return `${n === 1 ? 'Sticker de cambio enviado' : `${n} stickers de cambio enviados`}${device ? ` a ${device}` : ''}.`;
};

const ChangeSiteModal: React.FC<{
  order: SupportCard['orders'][number];
  onClose: () => void;
}> = ({ order, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const options = usePurchaseOptions();
  const changeSite = useChangeSite();
  const [siteId, setSiteId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [stickers, setStickers] = useState<any[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const sites = (options.data?.pickupSites ?? []).filter((s) => s.name !== order.place);
  const moving = ['EN_RUTA_TIENDA', 'EN_TIENDA'].includes(order.postsaleStatus ?? '');

  const print = async (list: any[]) => {
    try {
      setDone(await printChangeStickers(list));
    } catch (e: any) {
      Alert.alert('No se pudo imprimir', e?.message ?? 'Error de impresora. Usa "Reimprimir sticker".');
    }
  };

  const submit = () => {
    if (!siteId) return Alert.alert('Tienda', 'Elige la tienda nueva.');
    if (reason.trim().length < 3) return Alert.alert('Motivo', 'Escribe por qué se cambia la tienda.');
    changeSite.mutate(
      { orderId: order.id, input: { siteId, reason: reason.trim(), notify } },
      {
        onSuccess: async (r) => {
          setStickers(r.stickers);
          setDone(
            `Pedido ${r.orderNo}: de ${r.from} a ${r.to}${r.statusLabel ? ` · ${r.statusLabel}` : ''}.`
          );
          if (r.stickers.length) await print(r.stickers);
        },
        onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo cambiar la tienda'),
      }
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <Title>Cambiar tienda · {order.no}</Title>
            {stickers ? (
              <>
                <Body>✅ {done}</Body>
                {stickers.length ? (
                  <Caption color={theme.color.text.muted}>
                    Pega el sticker de cambio encima del original de cada bulto.
                  </Caption>
                ) : (
                  <Caption color={theme.color.text.muted}>
                    Aún no tenía sticker: saldrá con la tienda nueva al imprimirlo en Post venta.
                  </Caption>
                )}
                <View style={styles.actionsRow}>
                  {stickers.length ? (
                    <Button title="Reimprimir sticker" variant="ghost" onPress={() => print(stickers)} />
                  ) : null}
                  <Button title="Listo" onPress={onClose} />
                </View>
              </>
            ) : (
              <>
                <Caption color={theme.color.text.muted}>
                  Ahora: {order.place ?? 'sin tienda'}
                  {order.postsaleStatus
                    ? ` · ${STATUS_LABEL[order.postsaleStatus as keyof typeof STATUS_LABEL] ?? order.postsaleStatus}`
                    : ''}
                </Caption>
                {moving ? (
                  <Caption color={theme.color.text.warning}>
                    El pedido ya va o ya está en la tienda: vuelve a "En ruta a tienda" hacia la nueva y
                    allí lo reciben con el escaneo. El código anterior deja de servir; al recibirlo le llega
                    uno nuevo.
                  </Caption>
                ) : null}
                {options.isLoading ? <ActivityIndicator /> : null}
                <ChipGroup
                  options={sites.map((s) => ({
                    label: s.district ? `${s.name} (${s.district})` : s.name,
                    value: s.id,
                  }))}
                  selected={siteId ? [siteId] : []}
                  onChange={(s) => setSiteId(s[0] ?? '')}
                  multiple={false}
                />
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Motivo (vive cerca de otra tienda...)"
                  placeholderTextColor={theme.color.text.muted}
                  style={styles.input}
                />
                <ChipGroup
                  options={[
                    { label: 'Avisar a la clienta', value: 'yes' },
                    { label: 'No avisar', value: 'no' },
                  ]}
                  selected={[notify ? 'yes' : 'no']}
                  onChange={(s) => setNotify(s[0] !== 'no')}
                  multiple={false}
                />
                <View style={styles.actionsRow}>
                  <Button title="Cancelar" variant="ghost" onPress={onClose} />
                  <Button
                    title="Cambiar e imprimir sticker"
                    onPress={submit}
                    disabled={changeSite.isPending}
                    loading={changeSite.isPending}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ---------------------------------------------------------------- devolucion

const RefundModal: React.FC<{
  card: SupportCard;
  conversationId: string;
  caseId?: string;
  onClose: () => void;
}> = ({ card, conversationId, caseId, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const refund = useRefund();
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [op, setOp] = useState('');
  const [note, setNote] = useState('');
  const [orderId, setOrderId] = useState<string>('NONE');
  const [fromCredit, setFromCredit] = useState(false);
  const [closeIt, setCloseIt] = useState(!!caseId);

  const submit = () => {
    const cents = parseSolesToCents(amount);
    if (!cents) return Alert.alert('Monto', 'Escribe el monto devuelto (por ejemplo 24.10).');
    if (!op.trim())
      return Alert.alert('Operación', 'Escribe el N.° de operación de la transferencia.');
    refund.mutate(
      {
        conversationId,
        input: {
          amountCents: cents,
          bank: bank.trim() || undefined,
          operationNumber: op.trim(),
          orderId: orderId === 'NONE' ? null : orderId,
          fromCredit,
          note: note.trim() || undefined,
          caseId: closeIt ? (caseId ?? null) : null,
        },
      },
      {
        onSuccess: () => {
          Alert.alert('Listo', 'Devolución registrada.');
          onClose();
        },
        onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo registrar'),
      }
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <Title>Registrar devolución</Title>
            <Caption color={theme.color.text.muted}>
              Primero ofrece un cambio. Registra aquí la transferencia que ya hizo caja.
            </Caption>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Monto en soles (24.10)"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
            <TextInput
              value={bank}
              onChangeText={setBank}
              placeholder="Banco (BCP, Interbank...)"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
            <TextInput
              value={op}
              onChangeText={setOp}
              placeholder="N.° de operación"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
            <Caption color={theme.color.text.muted}>Pedido relacionado</Caption>
            <ChipGroup
              options={[
                { label: 'Ninguno', value: 'NONE' },
                ...card.orders
                  .slice(0, 8)
                  .map((o) => ({ label: `${o.no} ${soles(o.totalCents)}`, value: o.id })),
              ]}
              selected={[orderId]}
              onChange={(s) => s[0] && setOrderId(s[0])}
              multiple={false}
            />
            {card.credit.availableCents > 0 ? (
              <ChipGroup
                options={[
                  { label: 'No sale de su saldo', value: 'no' },
                  {
                    label: `Sale de su saldo (${soles(card.credit.availableCents)})`,
                    value: 'yes',
                  },
                ]}
                selected={[fromCredit ? 'yes' : 'no']}
                onChange={(s) => setFromCredit(s[0] === 'yes')}
                multiple={false}
              />
            ) : null}
            {caseId ? (
              <ChipGroup
                options={[
                  { label: 'Cerrar el caso', value: 'yes' },
                  { label: 'Dejar abierto', value: 'no' },
                ]}
                selected={[closeIt ? 'yes' : 'no']}
                onChange={(s) => setCloseIt(s[0] === 'yes')}
                multiple={false}
              />
            ) : null}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Nota (motivo: agotado, demora...)"
              placeholderTextColor={theme.color.text.muted}
              style={styles.input}
            />
            <View style={styles.actionsRow}>
              <Button title="Cancelar" variant="ghost" onPress={onClose} />
              <Button title="Registrar" onPress={submit} disabled={refund.isPending} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ------------------------------------------------------------ compra directa

const PurchaseModal: React.FC<{
  card: SupportCard;
  conversationId: string;
  onClose: () => void;
}> = ({ card, conversationId, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const options = usePurchaseOptions();
  const purchase = useDirectPurchase();
  const reply = useReplyConversation();
  const [q, setQ] = useState('');
  const products = useSupportProducts(q);
  const [lines, setLines] = useState<Line[]>([]);
  const [type, setType] = useState<'PICKUP' | 'DELIVERY_LIMA' | 'AGENCY'>('PICKUP');
  const [siteId, setSiteId] = useState('');
  const [address, setAddress] = useState('');
  const [reference, setReference] = useState('');
  const [agency, setAgency] = useState('');
  const [destination, setDestination] = useState('');
  const [fee, setFee] = useState('');
  const [invoice, setInvoice] = useState<'BOLETA' | 'FACTURA'>('BOLETA');
  const [voucherId, setVoucherId] = useState('NONE');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<string | null>(null);

  const freeVouchers = card.vouchers.filter(
    (v) =>
      v.conversationId === conversationId &&
      (!v.orderId || ['REJECTED', 'DUPLICATE'].includes(v.status))
  );
  const productsTotal = lines.reduce((s, l) => s + l.qty * l.product.unitPriceCents, 0);

  const addLine = (p: SupportProduct) =>
    setLines((prev) =>
      prev.some((l) => l.product.sellableProductId === p.sellableProductId)
        ? prev.map((l) =>
            l.product.sellableProductId === p.sellableProductId ? { ...l, qty: l.qty + 1 } : l
          )
        : [...prev, { product: p, qty: 1 }]
    );
  const setQty = (id: string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.sellableProductId !== id)
        : prev.map((l) => (l.product.sellableProductId === id ? { ...l, qty } : l))
    );

  const pickType = (t: string) => {
    const v = t as 'PICKUP' | 'DELIVERY_LIMA' | 'AGENCY';
    setType(v);
    if (v === 'DELIVERY_LIMA' && options.data?.lima.feeCents != null) {
      setFee((options.data.lima.feeCents / 100).toFixed(2));
    }
  };
  const pickAgency = (code: string) => {
    setAgency(code);
    const a = options.data?.agencies.find((x) => x.code === code);
    if (a) setFee((a.feeCents / 100).toFixed(2));
  };

  const submit = () => {
    if (!lines.length) return Alert.alert('Productos', 'Agrega al menos un producto.');
    const feeCents = type === 'PICKUP' ? 0 : (parseSolesToCents(fee) ?? 0);
    purchase.mutate(
      {
        conversationId,
        input: {
          items: lines.map((l) => ({ sellableProductId: l.product.sellableProductId, qty: l.qty })),
          fulfillment: {
            type,
            siteId: type === 'PICKUP' ? siteId : null,
            address: type === 'DELIVERY_LIMA' ? address : null,
            reference: reference || null,
            agency: type === 'AGENCY' ? agency : null,
            destination: type === 'AGENCY' ? destination : null,
            feeCents,
          },
          voucherId: voucherId === 'NONE' ? null : voucherId,
          orderNotes: notes || null,
          invoiceType: invoice,
        },
      },
      {
        onSuccess: (r) => {
          if (!r.ok) return Alert.alert('No se pudo', r.reason ?? 'Revisa los datos.');
          if (r.orderId) {
            Alert.alert(
              'Pedido creado',
              `Total ${soles(r.totalCents)} · pagado ${soles(r.paidCents)}.`
            );
            return onClose();
          }
          setSummary(r.summary ?? '');
        },
        onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo armar la compra'),
      }
    );
  };

  const sendSummary = async () => {
    if (!summary) return;
    try {
      const conv: any = await chatbotConversationsApi.getOne(conversationId);
      reply.mutate(
        { id: conversationId, body: { text: summary, waJid: conv.waJid } },
        {
          onSuccess: () => {
            Alert.alert('Enviado', 'La clienta recibió el resumen con el total.');
            onClose();
          },
          onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo enviar'),
        }
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo abrir el chat');
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { maxHeight: '92%' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <Title>Compra directa</Title>
            {!card.customer.identified ? (
              <Body style={{ color: theme.color.text.muted }}>
                La clienta aún no completó su registro: el pedido necesita su DNI, RUC o carnet.
              </Body>
            ) : null}
            {summary != null ? (
              <>
                <Caption color={theme.color.text.muted}>
                  Carrito armado con el stock apartado. Envíale el resumen para que pague:
                </Caption>
                <View style={styles.block}>
                  <Body>{summary}</Body>
                </View>
                <View style={styles.actionsRow}>
                  <Button title="Cerrar" variant="ghost" onPress={onClose} />
                  <Button
                    title="Enviar resumen al chat"
                    leftIcon="send-outline"
                    onPress={sendSummary}
                    disabled={reply.isPending}
                  />
                </View>
              </>
            ) : (
              <>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Buscar producto"
                  placeholderTextColor={theme.color.text.muted}
                  style={styles.input}
                />
                {(products.data ?? []).slice(0, 8).map((p) => (
                  <Pressable
                    key={p.sellableProductId}
                    style={styles.listRow}
                    disabled={p.availableQty <= 0}
                    onPress={() => addLine(p)}
                  >
                    <View style={{ flex: 1 }}>
                      <Body>
                        {p.name}
                        {p.presentationName ? ` · ${p.presentationName}` : ''}
                      </Body>
                      <Caption color={theme.color.text.muted}>
                        {soles(p.unitPriceCents)} ·{' '}
                        {p.availableQty > 0
                          ? `quedan ${p.availableQty}`
                          : p.closedByCampaign
                            ? 'fuera de campaña'
                            : 'agotado'}
                      </Caption>
                    </View>
                    {p.availableQty > 0 ? (
                      <Ionicons
                        name="add-circle-outline"
                        size={22}
                        color={theme.color.brand.accent}
                      />
                    ) : null}
                  </Pressable>
                ))}

                {lines.length ? (
                  <View style={styles.block}>
                    {lines.map((l) => (
                      <View key={l.product.sellableProductId} style={styles.inlineRow}>
                        <Body style={{ flex: 1 }}>
                          {l.product.name} · {soles(l.product.unitPriceCents * l.qty)}
                        </Body>
                        <Pressable onPress={() => setQty(l.product.sellableProductId, l.qty - 1)}>
                          <Ionicons
                            name="remove-circle-outline"
                            size={22}
                            color={theme.color.text.muted}
                          />
                        </Pressable>
                        <Body style={{ minWidth: 24, textAlign: 'center' }}>{l.qty}</Body>
                        <Pressable
                          onPress={() =>
                            setQty(
                              l.product.sellableProductId,
                              Math.min(l.qty + 1, l.product.availableQty)
                            )
                          }
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={22}
                            color={theme.color.text.muted}
                          />
                        </Pressable>
                      </View>
                    ))}
                    <Body style={{ fontWeight: '700' }}>Productos: {soles(productsTotal)}</Body>
                  </View>
                ) : null}

                <Caption color={theme.color.text.muted}>Entrega</Caption>
                <ChipGroup
                  options={FULFILLMENT_OPTIONS}
                  selected={[type]}
                  onChange={(s) => s[0] && pickType(s[0])}
                  multiple={false}
                />
                {type === 'PICKUP' ? (
                  <ChipGroup
                    options={(options.data?.pickupSites ?? []).map((s) => ({
                      label: s.name,
                      value: s.id,
                    }))}
                    selected={siteId ? [siteId] : []}
                    onChange={(s) => s[0] && setSiteId(s[0])}
                    multiple={false}
                  />
                ) : null}
                {type === 'DELIVERY_LIMA' ? (
                  <>
                    <TextInput
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Dirección"
                      placeholderTextColor={theme.color.text.muted}
                      style={styles.input}
                    />
                    <TextInput
                      value={reference}
                      onChangeText={setReference}
                      placeholder="Referencia"
                      placeholderTextColor={theme.color.text.muted}
                      style={styles.input}
                    />
                  </>
                ) : null}
                {type === 'AGENCY' ? (
                  <>
                    <ChipGroup
                      options={(options.data?.agencies ?? []).map((a) => ({
                        label: a.name,
                        value: a.code,
                      }))}
                      selected={agency ? [agency] : []}
                      onChange={(s) => s[0] && pickAgency(s[0])}
                      multiple={false}
                    />
                    <TextInput
                      value={destination}
                      onChangeText={setDestination}
                      placeholder="Ciudad / sede de destino"
                      placeholderTextColor={theme.color.text.muted}
                      style={styles.input}
                    />
                  </>
                ) : null}
                {type !== 'PICKUP' ? (
                  <TextInput
                    value={fee}
                    onChangeText={setFee}
                    keyboardType="decimal-pad"
                    placeholder="Costo de envío (S/)"
                    placeholderTextColor={theme.color.text.muted}
                    style={styles.input}
                  />
                ) : null}

                <Caption color={theme.color.text.muted}>Comprobante</Caption>
                <ChipGroup
                  options={INVOICE_OPTIONS}
                  selected={[invoice]}
                  onChange={(s) => s[0] && setInvoice(s[0] as 'BOLETA' | 'FACTURA')}
                  multiple={false}
                />

                <Caption color={theme.color.text.muted}>Pago</Caption>
                <ChipGroup
                  options={[
                    { label: 'Aún no paga', value: 'NONE' },
                    ...freeVouchers.map((v) => ({
                      label:
                        `Voucher ${soles(v.amountCents)} ${v.bank ?? ''} ${v.operationNumber ?? ''}`.trim(),
                      value: v.id,
                    })),
                  ]}
                  selected={[voucherId]}
                  onChange={(s) => s[0] && setVoucherId(s[0])}
                  multiple={false}
                />
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notas del pedido (color, talla...)"
                  placeholderTextColor={theme.color.text.muted}
                  style={styles.input}
                />

                <View style={styles.actionsRow}>
                  <Button title="Cancelar" variant="ghost" onPress={onClose} />
                  <Button
                    title={voucherId === 'NONE' ? 'Armar carrito' : 'Crear pedido'}
                    onPress={submit}
                    disabled={purchase.isPending || !card.customer.identified}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.color.brand.headerFrom },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[1] },
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
      flexShrink: 1,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    scrollView: { flex: 1, backgroundColor: theme.color.background.subtle },
    scrollContent: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },
    centerBox: { padding: spacing[5], alignItems: 'center', justifyContent: 'center' },
    card: { padding: spacing[3], gap: spacing[2] },
    piiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing[2],
      paddingVertical: 4,
      borderRadius: borderRadius.full ?? 999,
      backgroundColor: theme.color.background.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    tagSuggest: {
      paddingHorizontal: spacing[2],
      paddingVertical: 4,
      borderRadius: borderRadius.full ?? 999,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.color.border.default,
    },
    tagText: { fontSize: 13, color: theme.color.text.body },
    block: {
      gap: spacing[1],
      padding: spacing[2],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.md,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[4],
    },
    modalCard: {
      width: '100%',
      maxWidth: 620,
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      gap: spacing[3],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      padding: spacing[3],
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
    },
  });
