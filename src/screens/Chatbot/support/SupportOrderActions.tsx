/**
 * Acciones de Atención al cliente sobre un pedido y su clienta: reposición sin
 * cobro, editar productos, anular dejando saldo a favor, reenviar boleta y
 * código (el código nunca se muestra al asesor), vincular un voucher suelto,
 * corregir datos y consultar stock por tienda.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  Body,
  Button,
  Caption,
  ChipGroup,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import {
  useCancelToCredit,
  useEditOrder,
  useLinkVoucher,
  useProductStock,
  useReplacement,
  useResendCode,
  useResendReceipt,
  useSupportOrderItems,
  useSupportProducts,
  useUpdateCustomer,
} from '@/hooks/api/useChatbotSupport';
import { chatbotSupportApi, type SupportCard } from '@/services/api/chatbot-support';
import Alert from '@/utils/alert';
import { soles } from '../supportUtils';

type Order = SupportCard['orders'][number];
type Voucher = SupportCard['vouchers'][number];

const errorOf = (e: any, fallback: string) =>
  e?.response?.data?.message ?? e?.message ?? fallback;

// ---------------------------------------------------------------- base modal

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <Title>{title}</Title>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const Field: React.FC<{
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad' | 'email-address' | 'phone-pad' | 'decimal-pad';
}> = (p) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <TextInput
      value={p.value}
      onChangeText={p.onChangeText}
      placeholder={p.placeholder}
      keyboardType={p.keyboardType}
      placeholderTextColor={theme.color.text.muted}
      style={styles.input}
    />
  );
};

const Stepper: React.FC<{ value: number; max?: number; onChange: (n: number) => void }> = ({
  value,
  max,
  onChange,
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(0, value - 1))}>
        <Body>−</Body>
      </Pressable>
      <Body style={{ minWidth: 24, textAlign: 'center', fontWeight: '700' }}>{value}</Body>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
      >
        <Body>+</Body>
      </Pressable>
    </View>
  );
};

// ------------------------------------------------------- menu de un pedido

export type OrderAction = 'replacement' | 'edit' | 'cancel' | 'receipt' | 'code';

/** Acciones disponibles para el pedido según su estado. */
export const orderActions = (
  o: Order,
  can: { manage: boolean; money: boolean }
): Array<{ key: OrderAction; label: string }> => {
  const out: Array<{ key: OrderAction; label: string }> = [];
  if (o.cancelled || ['REJECTED', 'EXPIRED'].includes(o.status)) return out;
  const untouched = !o.printed && !o.hasReceipt && (!o.postsaleStatus || o.postsaleStatus === 'PAGADO');
  if (can.manage && ['VALIDATED', 'EMITTED'].includes(o.status))
    out.push({ key: 'replacement', label: 'Reponer sin cobro' });
  if (can.manage && untouched && ['VALIDATED', 'PENDING_PAYMENT', 'AWAITING_BALANCE'].includes(o.status))
    out.push({ key: 'edit', label: 'Editar productos' });
  if (can.money && untouched && o.status === 'VALIDATED')
    out.push({ key: 'cancel', label: 'Anular con saldo a favor' });
  if (can.manage && o.hasReceipt) out.push({ key: 'receipt', label: 'Reenviar boleta' });
  if (can.manage && ['EN_TIENDA', 'EN_RUTA_DOMICILIO'].includes(o.postsaleStatus ?? ''))
    out.push({ key: 'code', label: 'Reenviar código' });
  return out;
};

export const OrderActionsModal: React.FC<{
  order: Order;
  can: { manage: boolean; money: boolean };
  onClose: () => void;
}> = ({ order, can, onClose }) => {
  const theme = useTheme();
  const [action, setAction] = useState<OrderAction | null>(null);
  const receipt = useResendReceipt();
  const code = useResendCode();
  const list = orderActions(order, can);

  const runReceipt = () =>
    receipt.mutate(order.id, {
      onSuccess: (r) => {
        Alert.alert('Enviado', `${r.documents.join(', ')} enviado por ${r.channel}.`);
        onClose();
      },
      onError: (e: any) => Alert.alert('Error', errorOf(e, 'No se pudo reenviar')),
    });
  const runCode = () =>
    Alert.alert(
      'Reenviar código',
      'Se genera un código nuevo y le llega a la clienta por SMS y chat. El anterior deja de servir. Tú no lo verás.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: () =>
            code.mutate(order.id, {
              onSuccess: (r) => {
                Alert.alert('Enviado', `Código nuevo enviado por ${r.channels.join(' y ')}.`);
                onClose();
              },
              onError: (e: any) => Alert.alert('Error', errorOf(e, 'No se pudo reenviar')),
            }),
        },
      ]
    );

  if (action === 'replacement') return <ReplacementModal order={order} onClose={onClose} />;
  if (action === 'edit') return <EditOrderModal order={order} onClose={onClose} />;
  if (action === 'cancel') return <CancelModal order={order} onClose={onClose} />;

  return (
    <Sheet title={`Pedido ${order.no}`} onClose={onClose}>
      {list.length === 0 ? (
        <Caption color={theme.color.text.muted}>No hay acciones para este pedido.</Caption>
      ) : null}
      {list.map((a) => (
        <Button
          key={a.key}
          title={a.label}
          variant="outline"
          loading={(a.key === 'receipt' && receipt.isPending) || (a.key === 'code' && code.isPending)}
          onPress={() =>
            a.key === 'receipt' ? runReceipt() : a.key === 'code' ? runCode() : setAction(a.key)
          }
        />
      ))}
      <Button title="Cerrar" variant="ghost" onPress={onClose} />
    </Sheet>
  );
};

// ---------------------------------------------------------------- reposicion

const REASONS = [
  { label: 'Faltó en el pedido', value: 'FALTANTE' },
  { label: 'Producto equivocado', value: 'EQUIVOCADO' },
  { label: 'Llegó dañado', value: 'DANADO' },
];

const ReplacementModal: React.FC<{ order: Order; onClose: () => void }> = ({ order, onClose }) => {
  const theme = useTheme();
  const items = useSupportOrderItems(order.id);
  const replacement = useReplacement();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>('FALTANTE');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);

  const submit = () => {
    const picked = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([itemId, n]) => ({ itemId, qty: n }));
    if (!picked.length) return Alert.alert('Productos', 'Elige qué productos se reponen.');
    replacement.mutate(
      {
        orderId: order.id,
        input: { items: picked, reason: reason as any, note: note.trim() || undefined, notify },
      },
      {
        onSuccess: (r) => {
          Alert.alert(
            'Reposición creada',
            `Pedido ${r.orderNo} (sin costo) ya está en Post venta para imprimir y armar.`
          );
          onClose();
        },
        onError: (e: any) => Alert.alert('Error', errorOf(e, 'No se pudo crear la reposición')),
      }
    );
  };

  return (
    <Sheet title={`Reponer sin cobro · ${order.no}`} onClose={onClose}>
      <Caption color={theme.color.text.muted}>
        Se crea un pedido a S/ 0 con la misma entrega, sin boleta. El stock sale ahora.
      </Caption>
      <ChipGroup
        options={REASONS}
        selected={[reason]}
        onChange={(s) => s[0] && setReason(s[0])}
        multiple={false}
      />
      {items.isLoading ? <ActivityIndicator /> : null}
      {(items.data ?? []).map((it) => (
        <View key={it.id} style={rowStyle}>
          <View style={{ flex: 1 }}>
            <Body>{it.name}</Body>
            <Caption color={theme.color.text.muted}>Compró {it.qty}</Caption>
          </View>
          <Stepper
            value={qty[it.id] ?? 0}
            max={it.qty}
            onChange={(n) => setQty((p) => ({ ...p, [it.id]: n }))}
          />
        </View>
      ))}
      <Field value={note} onChangeText={setNote} placeholder="Detalle (qué pasó, foto recibida...)" />
      <ChipGroup
        options={[
          { label: 'Avisar a la clienta', value: 'yes' },
          { label: 'No avisar', value: 'no' },
        ]}
        selected={[notify ? 'yes' : 'no']}
        onChange={(s) => setNotify(s[0] !== 'no')}
        multiple={false}
      />
      {reason === 'EQUIVOCADO' ? (
        <Caption color={theme.color.text.warning}>
          Pídele que entregue en tienda el producto equivocado al recoger la reposición.
        </Caption>
      ) : null}
      <View style={actionsStyle}>
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
        <Button title="Crear reposición" onPress={submit} loading={replacement.isPending} />
      </View>
    </Sheet>
  );
};

// ------------------------------------------------------------ editar pedido

const EditOrderModal: React.FC<{ order: Order; onClose: () => void }> = ({ order, onClose }) => {
  const theme = useTheme();
  const items = useSupportOrderItems(order.id);
  const edit = useEditOrder();
  const [lines, setLines] = useState<
    Array<{ sellableProductId: string; name: string; qty: number; unitPriceCents: number }>
  >([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{ totalCents: number; differenceCents: number } | null>(null);
  const products = useSupportProducts(search);

  useEffect(() => {
    if (items.data && !lines.length) {
      setLines(
        items.data
          .filter((i) => i.sellableProductId)
          .map((i) => ({
            sellableProductId: i.sellableProductId as string,
            name: i.name ?? 'Producto',
            qty: i.qty,
            unitPriceCents: i.unitPriceCents,
          }))
      );
    }
  }, [items.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = (items.data ?? []).some((i) => !i.editable);
  const payload = () =>
    lines
      .filter((l) => l.qty > 0)
      .map((l) => ({ sellableProductId: l.sellableProductId, qty: l.qty }));

  useEffect(() => {
    if (!lines.length || !payload().length) return setPreview(null);
    const t = setTimeout(() => {
      // Solo calcula: sin invalidar la ficha.
      chatbotSupportApi
        .editOrder(order.id, { items: payload(), dryRun: true })
        .then((r) => setPreview({ totalCents: r.totalCents, differenceCents: r.differenceCents }))
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (reason.trim().length < 3) return Alert.alert('Motivo', 'Escribe por qué cambia el pedido.');
    edit.mutate(
      { orderId: order.id, input: { items: payload(), reason: reason.trim() } },
      {
        onSuccess: (r) => {
          Alert.alert(
            'Pedido actualizado',
            `Total ${soles(r.totalCents)}.${r.differenceCents > 1 && order.status === 'VALIDATED' ? ` ${soles(r.differenceCents)} quedan de saldo a favor.` : ''}`
          );
          onClose();
        },
        onError: (e: any) => Alert.alert('Error', errorOf(e, 'No se pudo editar')),
      }
    );
  };

  return (
    <Sheet title={`Editar productos · ${order.no}`} onClose={onClose}>
      {items.isLoading ? <ActivityIndicator /> : null}
      {locked ? (
        <Caption color={theme.color.text.danger}>
          Este pedido tiene packs o cajón y no se puede editar aquí.
        </Caption>
      ) : null}
      {lines.map((l, i) => (
        <View key={l.sellableProductId} style={rowStyle}>
          <View style={{ flex: 1 }}>
            <Body>{l.name}</Body>
            <Caption color={theme.color.text.muted}>{soles(l.unitPriceCents)} c/u</Caption>
          </View>
          <Stepper
            value={l.qty}
            onChange={(n) => setLines((p) => p.map((x, j) => (j === i ? { ...x, qty: n } : x)))}
          />
        </View>
      ))}
      <Field value={search} onChangeText={setSearch} placeholder="Agregar o reemplazar: buscar producto" />
      {(products.data ?? []).slice(0, 6).map((p) => (
        <Pressable
          key={p.sellableProductId}
          style={rowStyle}
          onPress={() => {
            setLines((prev) =>
              prev.some((x) => x.sellableProductId === p.sellableProductId)
                ? prev.map((x) =>
                    x.sellableProductId === p.sellableProductId ? { ...x, qty: x.qty + 1 } : x
                  )
                : [
                    ...prev,
                    {
                      sellableProductId: p.sellableProductId,
                      name: p.name,
                      qty: 1,
                      unitPriceCents: p.unitPriceCents ?? 0,
                    },
                  ]
            );
            setSearch('');
          }}
        >
          <View style={{ flex: 1 }}>
            <Body>{p.name}</Body>
            <Caption color={theme.color.text.muted}>
              {soles(p.unitPriceCents)} · quedan {p.availableQty}
            </Caption>
          </View>
          <Body>＋</Body>
        </Pressable>
      ))}
      {preview ? (
        <Body style={{ fontWeight: '700' }}>
          Total nuevo {soles(preview.totalCents)} · pagado {soles(order.paidCents)}
          {preview.differenceCents > 1
            ? order.status === 'VALIDATED'
              ? ` · ${soles(preview.differenceCents)} quedan de saldo a favor`
              : ` · pagó ${soles(preview.differenceCents)} de más`
            : preview.differenceCents < -1
              ? ` · falta ${soles(-preview.differenceCents)}`
              : ''}
        </Body>
      ) : null}
      <Field value={reason} onChangeText={setReason} placeholder="Motivo (se agotó, cambia de color...)" />
      <View style={actionsStyle}>
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
        <Button title="Guardar cambios" onPress={save} disabled={locked} loading={edit.isPending} />
      </View>
    </Sheet>
  );
};

// ------------------------------------------------------------------- anular

const CancelModal: React.FC<{ order: Order; onClose: () => void }> = ({ order, onClose }) => {
  const theme = useTheme();
  const cancel = useCancelToCredit();
  const [reason, setReason] = useState('');
  return (
    <Sheet title={`Anular ${order.no}`} onClose={onClose}>
      <Caption color={theme.color.text.muted}>
        Se libera el stock, sale de Post venta y lo pagado ({soles(order.paidCents)}) queda como saldo
        a favor para su próxima compra o una devolución.
      </Caption>
      <Field value={reason} onChangeText={setReason} placeholder="Motivo (no viaja a Lima...)" />
      <View style={actionsStyle}>
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
        <Button
          title="Anular"
          loading={cancel.isPending}
          onPress={() => {
            if (reason.trim().length < 3) return Alert.alert('Motivo', 'Escribe el motivo.');
            cancel.mutate(
              { orderId: order.id, reason: reason.trim() },
              {
                onSuccess: (r) => {
                  Alert.alert('Anulado', `Quedan ${soles(r.creditCents)} de saldo a favor.`);
                  onClose();
                },
                onError: (e: any) => Alert.alert('Error', errorOf(e, 'No se pudo anular')),
              }
            );
          }}
        />
      </View>
    </Sheet>
  );
};

// ------------------------------------------------------------ vincular voucher

export const LinkVoucherModal: React.FC<{
  voucher: Voucher;
  orders: Order[];
  onClose: () => void;
}> = ({ voucher, orders, onClose }) => {
  const theme = useTheme();
  const link = useLinkVoucher();
  const open = orders.filter((o) => ['PENDING_PAYMENT', 'AWAITING_BALANCE'].includes(o.status));
  const [orderId, setOrderId] = useState<string>(open[0]?.id ?? '');
  return (
    <Sheet title="Vincular voucher" onClose={onClose}>
      <Body>
        {soles(voucher.amountCents)} · {voucher.bank ?? 'banco ?'} · op. {voucher.operationNumber ?? '-'}
      </Body>
      {open.length ? (
        <ChipGroup
          options={open.map((o) => ({
            label: `${o.no} · falta ${soles(Math.max(0, o.totalCents - o.paidCents))}`,
            value: o.id,
          }))}
          selected={orderId ? [orderId] : []}
          onChange={(s) => setOrderId(s[0] ?? '')}
          multiple={false}
        />
      ) : (
        <Caption color={theme.color.text.muted}>
          No tiene pedidos por pagar. Usa Compra directa para crear el pedido con este voucher.
        </Caption>
      )}
      <View style={actionsStyle}>
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
        <Button
          title="Vincular"
          disabled={!orderId}
          loading={link.isPending}
          onPress={() =>
            link.mutate(
              { voucherId: voucher.id, orderId },
              {
                onSuccess: () => {
                  Alert.alert('Listo', 'Voucher vinculado al pedido.');
                  onClose();
                },
                onError: (e: any) => Alert.alert('Error', errorOf(e, 'No se pudo vincular')),
              }
            )
          }
        />
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------- corregir datos

export const CustomerDataModal: React.FC<{ conversationId: string; onClose: () => void }> = ({
  conversationId,
  onClose,
}) => {
  const theme = useTheme();
  const update = useUpdateCustomer();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [docType, setDocType] = useState<'DNI' | 'RUC' | 'CE'>('DNI');
  const [doc, setDoc] = useState('');
  const [fullName, setFullName] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Sheet title="Corregir datos" onClose={onClose}>
      <Caption color={theme.color.text.muted}>
        Llena solo lo que cambia. Al cambiar el documento, los pedidos de este chat sin boleta pasan al
        nuevo titular.
      </Caption>
      <Field value={phone} onChangeText={setPhone} placeholder="Celular (9 dígitos)" keyboardType="phone-pad" />
      <Field value={email} onChangeText={setEmail} placeholder="Correo" keyboardType="email-address" />
      <ChipGroup
        options={[
          { label: 'DNI', value: 'DNI' },
          { label: 'RUC', value: 'RUC' },
          { label: 'Carnet ext.', value: 'CE' },
        ]}
        selected={[docType]}
        onChange={(s) => s[0] && setDocType(s[0] as any)}
        multiple={false}
      />
      <Field value={doc} onChangeText={setDoc} placeholder="N.° de documento" keyboardType="number-pad" />
      {docType === 'CE' ? (
        <Field value={fullName} onChangeText={setFullName} placeholder="Nombre completo (carnet)" />
      ) : null}
      <Field value={reason} onChangeText={setReason} placeholder="Motivo del cambio" />
      <View style={actionsStyle}>
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
        <Button
          title="Guardar"
          loading={update.isPending}
          onPress={() => {
            if (reason.trim().length < 3) return Alert.alert('Motivo', 'Escribe el motivo.');
            update.mutate(
              {
                conversationId,
                input: {
                  phone: phone.trim() || undefined,
                  email: email.trim() || undefined,
                  documentType: doc.trim() ? docType : undefined,
                  documentNumber: doc.trim() || undefined,
                  fullName: fullName.trim() || undefined,
                  reason: reason.trim(),
                },
              },
              {
                onSuccess: (r) => {
                  Alert.alert('Guardado', `Se actualizó: ${r.changes.join(', ')}.`);
                  onClose();
                },
                onError: (e: any) => Alert.alert('Error', errorOf(e, 'No se pudo guardar')),
              }
            );
          }}
        />
      </View>
    </Sheet>
  );
};

// ------------------------------------------------------- stock por tienda

export const ProductStockModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const products = useSupportProducts(search);
  const stock = useProductStock(selected);
  const total = useMemo(
    () => (stock.data?.stores ?? []).reduce((s, x) => s + x.units, 0),
    [stock.data]
  );
  return (
    <Sheet title="Consultar producto" onClose={onClose}>
      <Field
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setSelected(null);
        }}
        placeholder="Buscar por nombre o código"
      />
      {!selected
        ? (products.data ?? []).slice(0, 8).map((p) => (
            <Pressable key={p.sellableProductId} style={rowStyle} onPress={() => setSelected(p.sellableProductId)}>
              <View style={{ flex: 1 }}>
                <Body>{p.name}</Body>
                <Caption color={theme.color.text.muted}>
                  {soles(p.unitPriceCents)} · por chat quedan {p.availableQty}
                </Caption>
              </View>
            </Pressable>
          ))
        : null}
      {selected && stock.isLoading ? <ActivityIndicator /> : null}
      {stock.data && selected ? (
        <View style={{ gap: spacing[2] }}>
          {stock.data.imageUrl ? (
            <Image
              source={{ uri: stock.data.imageUrl }}
              style={{ width: 120, height: 120, borderRadius: borderRadius.md }}
            />
          ) : null}
          <Body style={{ fontWeight: '700' }}>{stock.data.name}</Body>
          <Caption color={theme.color.text.muted}>
            {[stock.data.sku, stock.data.variant, stock.data.presentation].filter(Boolean).join(' · ')}
            {stock.data.unitPriceCents != null ? ` · ${soles(stock.data.unitPriceCents)}` : ''}
          </Caption>
          {stock.data.description ? <Caption>{stock.data.description}</Caption> : null}
          <Body>
            Por chat se pueden vender {stock.data.availableToSell}. En tiendas y almacenes: {total}.
          </Body>
          {stock.data.stores.map((s) => (
            <View key={`${s.site}-${s.warehouse}`} style={rowStyle}>
              <Body style={{ flex: 1 }}>
                {s.site ?? '-'} · {s.warehouse}
              </Body>
              <Body style={{ fontWeight: '700' }}>{s.units}</Body>
            </View>
          ))}
          <Button title="Otro producto" variant="ghost" onPress={() => setSelected(null)} />
        </View>
      ) : null}
      <Button title="Cerrar" variant="ghost" onPress={onClose} />
    </Sheet>
  );
};

const rowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing[2],
  paddingVertical: spacing[2],
};
const actionsStyle = {
  flexDirection: 'row' as const,
  flexWrap: 'wrap' as const,
  justifyContent: 'flex-end' as const,
  gap: spacing[2],
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[4],
    },
    card: {
      width: '100%',
      maxWidth: 620,
      maxHeight: '90%',
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
    stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
