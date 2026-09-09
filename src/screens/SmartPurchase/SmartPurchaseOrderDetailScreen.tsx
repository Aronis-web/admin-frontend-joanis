/**
 * SmartPurchaseOrderDetailScreen
 *
 * Detalle editable de una orden sugerida:
 *  - cabecera (código, sede, estado, totales, parámetros usados),
 *  - lista de items ordenados por score,
 *  - editar item (solo en DRAFT), aprobar / cancelar, exportar Excel/PDF.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import {
  Badge,
  Body,
  Caption,
  Card,
  ErrorState,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import {
  downloadSmartPurchaseOrder,
  useApproveOrder,
  useCancelOrder,
  useSmartPurchaseOrder,
} from '@/hooks/api/useSmartPurchase';
import { useAllActiveSites } from './hooks/useAllActiveSites';
import type { MainStackParamList } from '@/types/navigation';
import type { OrderExportFormat, SmartPurchaseOrderItem } from '@/types/smartPurchase';
import {
  formatCents,
  formatDateTime,
  formatNumber,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  safeFixed,
} from './helpers';
import { OrderItemEditModal } from './components/OrderItemEditModal';

type Props = NativeStackScreenProps<MainStackParamList, 'SmartPurchaseOrderDetail'>;

export const SmartPurchaseOrderDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [editingItem, setEditingItem] = useState<SmartPurchaseOrderItem | null>(null);
  const [exporting, setExporting] = useState<OrderExportFormat | null>(null);

  const { data: order, isLoading, isError, refetch, isRefetching } = useSmartPurchaseOrder(orderId);
  const approveOrder = useApproveOrder();
  const cancelOrder = useCancelOrder();

  const { siteName: resolveSiteName } = useAllActiveSites({ enabled: !!order });

  const siteName = useMemo(() => {
    if (!order) return '';
    return resolveSiteName(order.siteId);
  }, [resolveSiteName, order]);

  const sortedItems = useMemo(() => {
    if (!order) return [];
    return [...order.items].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  }, [order]);

  const isDraft = order?.status === 'DRAFT';

  const handleApprove = useCallback(() => {
    if (!order) return;
    Alert.alert(
      'Aprobar orden',
      `Vas a aprobar y congelar la orden ${order.code}. Ya no podrás editar sus items.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            try {
              await approveOrder.mutateAsync(order.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'No se pudo aprobar la orden.');
            }
          },
        },
      ]
    );
  }, [order, approveOrder]);

  const handleCancel = useCallback(() => {
    if (!order) return;
    Alert.alert('Cancelar orden', `¿Cancelar la orden ${order.code}?`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar orden',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelOrder.mutateAsync(order.id);
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'No se pudo cancelar la orden.');
          }
        },
      },
    ]);
  }, [order, cancelOrder]);

  const handleExport = useCallback(
    async (format: OrderExportFormat) => {
      if (!order) return;
      setExporting(format);
      try {
        await downloadSmartPurchaseOrder(order.id, order.code, format);
      } catch (err: any) {
        logger.error('Export order error', err);
        Alert.alert('Error', err?.message ?? 'No se pudo descargar el archivo.');
      } finally {
        setExporting(null);
      }
    },
    [order]
  );

  if (isLoading) {
    return (
      <ScreenLayout navigation={navigation as any}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.color.brand.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (isError || !order) {
    return (
      <ScreenLayout navigation={navigation as any}>
        <ErrorState
          title="No se pudo cargar la orden"
          description="Reintenta o vuelve a la lista."
          onRetry={() => refetch()}
        />
      </ScreenLayout>
    );
  }

  const renderItem = ({ item }: { item: SmartPurchaseOrderItem }) => {
    const score = Number(item.score ?? 0) || 0;
    const scoreColor =
      score >= 70
        ? theme.color.text.success
        : score >= 40
          ? theme.color.text.warning
          : theme.color.text.muted;

    return (
      <Card
        style={item.excluded ? { ...styles.itemCard, ...styles.itemCardExcluded } : styles.itemCard}
        onPress={isDraft ? () => setEditingItem(item) : undefined}
      >
        <View style={styles.itemHeader}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }} numberOfLines={2}>
              {item.title}
            </Body>
            <Caption color="muted">
              {item.sku ? `SKU ${item.sku} · ` : ''}
              Score{' '}
              <Body size="small" style={{ fontWeight: '600', color: scoreColor }}>
                {safeFixed(item.score, 1)}
              </Body>
            </Caption>
          </View>
          {item.excluded && <Badge variant="warning" label="Excluido" />}
          {item.isManualOverride && !item.excluded && <Badge variant="info" label="Manual" />}
        </View>

        <View style={styles.metricsRow}>
          <Metric label="Venta 30d" value={formatNumber(item.sales30d)} />
          <Metric label="Stock sede" value={formatNumber(item.stockSiteUnits)} />
          <Metric label="Sugerido" value={formatNumber(item.suggestedUnits)} />
          <Metric label={`× ${item.factorToBase}`} value={formatNumber(item.finalPresentations)} />
          <Metric label="Unidades" value={formatNumber(item.finalUnits)} />
          <Metric
            label="Total"
            value={formatCents((Number(item.unitCostCents) * item.finalUnits).toString())}
          />
        </View>
        {isDraft && (
          <View style={styles.editHint}>
            <Ionicons name="create-outline" size={14} color={theme.color.text.muted} />
            <Caption color="muted">Toca para editar</Caption>
          </View>
        )}
      </Card>
    );
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.color.text.body} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Title>{order.code}</Title>
            <Caption color="muted">
              {siteName} · Generado {formatDateTime(order.generatedAt)}
            </Caption>
          </View>
          <View style={styles.statusChip}>
            <View
              style={[styles.statusDot, { backgroundColor: ORDER_STATUS_COLOR[order.status] }]}
            />
            <Body size="small" style={{ fontWeight: '600' }}>
              {ORDER_STATUS_LABEL[order.status]}
            </Body>
          </View>
        </View>

        <View style={styles.summary}>
          <SummaryTile label="Items" value={String(order.totalItems)} />
          <SummaryTile label="Unidades" value={formatNumber(order.totalUnits)} />
          <SummaryTile label="Costo total" value={formatCents(order.totalCostCents)} />
          <SummaryTile label="Cobertura" value={`${order.coverageDays}d`} />
          <SummaryTile label="Lead" value={`${order.leadTimeDays}d`} />
          <SummaryTile label="Seguridad" value={`${order.safetyDays}d`} />
          <SummaryTile label="Ventana" value={`${order.windowDays}d`} />
        </View>

        {order.approvedAt && (
          <Caption color="muted" style={styles.approvedLine}>
            Aprobada {formatDateTime(order.approvedAt)}
          </Caption>
        )}
        {order.notes ? (
          <Caption color="muted" style={styles.approvedLine}>
            {order.notes}
          </Caption>
        ) : null}

        <FlatList
          data={sortedItems}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.color.brand.primary}
            />
          }
          ListEmptyComponent={
            <Caption color="muted" style={{ textAlign: 'center', padding: spacing[6] }}>
              La orden no tiene items.
            </Caption>
          }
        />

        <ProtectedFAB
          actions={[
            {
              icon: 'download-outline',
              label: `Excel${exporting === 'xlsx' ? '...' : ''}`,
              onPress: () => handleExport('xlsx'),
              requiredPermissions: ['smart_purchase.orders.export'],
            },
            {
              icon: 'document-text-outline',
              label: `PDF${exporting === 'pdf' ? '...' : ''}`,
              onPress: () => handleExport('pdf'),
              requiredPermissions: ['smart_purchase.orders.export'],
            },
            ...(isDraft
              ? [
                  {
                    icon: 'checkmark-done-outline' as const,
                    label: 'Aprobar',
                    onPress: handleApprove,
                    requiredPermissions: ['smart_purchase.orders.manage'],
                  },
                  {
                    icon: 'close-circle-outline' as const,
                    label: 'Cancelar orden',
                    onPress: handleCancel,
                    requiredPermissions: ['smart_purchase.orders.manage'],
                  },
                ]
              : []),
          ]}
        />

        <OrderItemEditModal
          visible={!!editingItem}
          orderId={order.id}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => refetch()}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metric}>
      <Caption color="muted" style={{ fontSize: 10 }}>
        {label}
      </Caption>
      <Body size="small" style={{ fontWeight: '600' }}>
        {value}
      </Body>
    </View>
  );
};

const SummaryTile: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.summaryTile}>
      <Caption color="muted" style={{ fontSize: 10 }}>
        {label}
      </Caption>
      <Body size="small" style={{ fontWeight: '700' }}>
        {value}
      </Body>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.background.canvas },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.subtle,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    summary: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
    summaryTile: {
      minWidth: 90,
      flexGrow: 1,
      padding: spacing[2],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
      gap: 2,
    },
    approvedLine: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
    listContent: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing[2],
      paddingBottom: spacing[8] * 3,
      flexGrow: 1,
    },
    itemCard: {
      gap: spacing[2],
    },
    itemCardExcluded: {
      opacity: 0.6,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
    },
    metricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    metric: {
      minWidth: 80,
      flexGrow: 1,
      padding: spacing[2],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.subtle,
      gap: 2,
    },
    editHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      marginTop: 2,
    },
  });
