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
import {
  useChatbotOrdersList,
  useRejectChatbotOrder,
  useValidateChatbotOrder,
} from '@/hooks/api/useChatbotOrders';
import type { ChatbotOrder, ChatbotOrderStatus } from '@/types/chatbot';
import Alert from '@/utils/alert';
import { config } from '@/utils/config';
import { formatDateTime, formatSolesFromCents } from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotOrders'>;

const STATUS_OPTIONS: Array<{ label: string; value: ChatbotOrderStatus }> = [
  { label: 'Pendiente', value: 'PENDING_PAYMENT' },
  { label: 'Validado', value: 'VALIDATED' },
  { label: 'Emitido', value: 'EMITTED' },
  { label: 'Rechazado', value: 'REJECTED' },
  { label: 'Expirado', value: 'EXPIRED' },
];

const STATUS_BADGE: Record<ChatbotOrderStatus, { variant: BadgeVariant; label: string }> = {
  PENDING_PAYMENT: { variant: 'warning', label: 'Pendiente pago' },
  VALIDATED: { variant: 'info', label: 'Validado' },
  EMITTED: { variant: 'success', label: 'Emitido' },
  REJECTED: { variant: 'danger', label: 'Rechazado' },
  EXPIRED: { variant: 'default', label: 'Expirado' },
};

const resolveVoucherUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = (config.API_URL ?? '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const ChatbotOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [status, setStatus] = useState<ChatbotOrderStatus>('PENDING_PAYMENT');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ChatbotOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, isFetching, isError, refetch } = useChatbotOrdersList(
    { status },
    { refetchIntervalMs: status === 'PENDING_PAYMENT' ? 20000 : undefined }
  );
  const orders = useMemo(() => data ?? [], [data]);

  const validateMutation = useValidateChatbotOrder();
  const rejectMutation = useRejectChatbotOrder();

  const handleValidate = (order: ChatbotOrder) => {
    Alert.alert(
      'Validar pago',
      'Se confirmará el pago y se intentará emitir el comprobante en el POS.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Validar',
          onPress: () =>
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
              onError: (err: any) =>
                Alert.alert('Error', err?.message ?? 'No se pudo validar el pago'),
            }),
        },
      ]
    );
  };

  const openReject = (order: ChatbotOrder) => {
    setRejectTarget(order);
    setRejectReason('');
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    rejectMutation.mutate(
      { id: rejectTarget.id, body: rejectReason ? { reason: rejectReason } : undefined },
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
            <Text style={styles.headerSubtitle}>
              Validación de vouchers y emisión de comprobantes
            </Text>
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
            selected={[status]}
            onChange={(sel) => sel[0] && setStatus(sel[0] as ChatbotOrderStatus)}
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
              icon="cart-outline"
              title="Sin pedidos"
              description="No hay pedidos en este estado."
            />
          ) : (
            <View style={styles.list}>
              {orders.map((order) => {
                const badge = STATUS_BADGE[order.status];
                const voucher = resolveVoucherUrl(order.voucherUrl);
                return (
                  <Card key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <View style={{ flex: 1 }}>
                        <Title>{formatSolesFromCents(order.totalCents)}</Title>
                        <Caption color={theme.color.text.muted}>
                          {formatDateTime(order.createdAt)}
                        </Caption>
                      </View>
                      <Badge variant={badge.variant} label={badge.label} />
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
                    ) : (
                      <Caption color={theme.color.text.muted}>Sin voucher adjunto</Caption>
                    )}

                    {order.rejectedReason ? (
                      <Body color={theme.color.text.muted}>
                        Motivo rechazo: {order.rejectedReason}
                      </Body>
                    ) : null}

                    {order.saleIds && order.saleIds.length > 0 ? (
                      <Caption color={theme.color.text.muted}>
                        Ventas: {order.saleIds.join(', ')}
                      </Caption>
                    ) : null}

                    {order.status === 'PENDING_PAYMENT' ? (
                      <View style={styles.actionsRow}>
                        <Button
                          title="Rechazar"
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

        {/* Reject modal */}
        <Modal visible={!!rejectTarget} transparent animationType="fade">
          <Pressable style={styles.previewBackdrop} onPress={() => setRejectTarget(null)}>
            <Pressable style={styles.rejectCard} onPress={(e) => e.stopPropagation()}>
              <Title>Rechazar pedido</Title>
              <Caption color={theme.color.text.muted}>
                Se liberará el stock reservado. El motivo es opcional.
              </Caption>
              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Motivo (ej. voucher ilegible)"
                placeholderTextColor={theme.color.text.muted}
                style={styles.rejectInput}
                multiline
              />
              <View style={styles.rejectActions}>
                <Button title="Cancelar" variant="outline" onPress={() => setRejectTarget(null)} />
                <Button
                  title="Rechazar"
                  onPress={confirmReject}
                  loading={rejectMutation.isPending}
                  leftIcon="close-circle-outline"
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ScreenLayout>
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
