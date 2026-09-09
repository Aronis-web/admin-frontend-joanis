/**
 * SmartPurchaseOrdersScreen
 *
 * Lista de órdenes sugeridas del módulo Compra Inteligente.
 *
 * - Si viene con `groupId`, filtra por grupo y ofrece "Generar órdenes".
 * - Filtro rápido por estado (DRAFT / APPROVED / SENT / CANCELLED).
 * - Tap → detalle de orden.
 */
import React, { useMemo, useState } from 'react';
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
  Body,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Pagination,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useSmartPurchaseGroup, useSmartPurchaseOrders } from '@/hooks/api/useSmartPurchase';
import { useAllActiveSites } from './hooks/useAllActiveSites';
import type { MainStackParamList } from '@/types/navigation';
import type {
  QueryOrdersDto,
  SmartPurchaseOrder,
  SmartPurchaseOrderStatus,
} from '@/types/smartPurchase';
import {
  formatCents,
  formatDateTime,
  formatNumber,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_OPTIONS,
} from './helpers';
import { GenerateOrdersModal } from './components/GenerateOrdersModal';

type Props = NativeStackScreenProps<MainStackParamList, 'SmartPurchaseOrders'>;

const PAGE_LIMIT = 25;

export const SmartPurchaseOrdersScreen: React.FC<Props> = ({ navigation, route }) => {
  const groupId = route.params?.groupId;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [status, setStatus] = useState<SmartPurchaseOrderStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [generateVisible, setGenerateVisible] = useState(false);

  const { data: group } = useSmartPurchaseGroup(groupId);

  const query: QueryOrdersDto = useMemo(
    () => ({
      groupId,
      status: status === 'ALL' ? undefined : status,
      page,
      limit: PAGE_LIMIT,
    }),
    [groupId, status, page]
  );

  const { data, isLoading, isError, refetch, isRefetching } = useSmartPurchaseOrders(query);

  // Preload all active sites (auto-paginated) to map siteId → name in la lista.
  const { siteName } = useAllActiveSites();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const renderItem = ({ item }: { item: SmartPurchaseOrder }) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('SmartPurchaseOrderDetail', { orderId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '600' }}>{item.code}</Body>
          <Caption color="muted">
            {siteName(item.siteId)} · Generado {formatDateTime(item.generatedAt)}
          </Caption>
        </View>
        <View style={styles.statusChip}>
          <View style={[styles.statusDot, { backgroundColor: ORDER_STATUS_COLOR[item.status] }]} />
          <Body size="small" style={{ fontWeight: '600' }}>
            {ORDER_STATUS_LABEL[item.status]}
          </Body>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Items" value={String(item.totalItems)} />
        <Metric label="Unidades" value={formatNumber(item.totalUnits)} />
        <Metric label="Costo" value={formatCents(item.totalCostCents)} />
        <Metric label="Cobertura" value={`${item.coverageDays}d`} />
        <Metric label="Ventana" value={`${item.windowDays}d`} />
      </View>

      {item.approvedAt && (
        <Caption color="muted">Aprobada {formatDateTime(item.approvedAt)}</Caption>
      )}
    </Card>
  );

  const renderEmpty = () => {
    if (isError) {
      return (
        <ErrorState
          title="No se pudieron cargar las órdenes"
          description="Reintenta en unos segundos."
          onRetry={() => refetch()}
        />
      );
    }
    if (!isLoading) {
      return (
        <EmptyState
          icon="clipboard-outline"
          title="Sin órdenes"
          description={
            groupId
              ? 'Genera órdenes sugeridas para este grupo y aparecerán acá.'
              : 'Cuando generes órdenes desde un grupo, se listarán acá.'
          }
          actionLabel={groupId ? 'Generar órdenes' : undefined}
          onAction={groupId ? () => setGenerateVisible(true) : undefined}
        />
      );
    }
    return null;
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          {groupId ? (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={theme.color.text.body} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Title>Órdenes sugeridas</Title>
            <Caption color="muted">
              {group ? `Grupo: ${group.name}` : 'Todas las órdenes del módulo.'}
              {total > 0 ? ` · ${total} orden(es)` : ''}
            </Caption>
          </View>
        </View>

        <View style={styles.filters}>
          <ChipGroup
            options={ORDER_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            selected={[status]}
            onChange={(vals) => {
              setStatus((vals[0] ?? 'ALL') as SmartPurchaseOrderStatus | 'ALL');
              setPage(1);
            }}
          />
        </View>

        {isLoading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.color.brand.primary} />
          </View>
        ) : (
          <FlatList
            data={data?.data ?? []}
            keyExtractor={(o) => o.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
            ListEmptyComponent={renderEmpty()}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.color.brand.primary}
              />
            }
          />
        )}

        {total > PAGE_LIMIT && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={PAGE_LIMIT}
            onPageChange={setPage}
            loading={isLoading || isRefetching}
          />
        )}

        {groupId && group ? (
          <ProtectedFAB
            actions={[
              {
                icon: 'add-circle-outline',
                label: 'Generar órdenes',
                onPress: () => setGenerateVisible(true),
                requiredPermissions: ['smart_purchase.orders.generate'],
              },
            ]}
          />
        ) : null}

        {groupId && group ? (
          <GenerateOrdersModal
            visible={generateVisible}
            onClose={() => setGenerateVisible(false)}
            group={group}
            onGenerated={() => refetch()}
          />
        ) : null}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.background.canvas },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    filters: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
    listContent: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing[2],
      paddingBottom: spacing[8] * 2,
      flexGrow: 1,
    },
    card: { gap: spacing[2] },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing[2],
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
    metricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    metric: {
      minWidth: 90,
      flexGrow: 1,
      padding: spacing[2],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.subtle,
      gap: 2,
    },
  });
