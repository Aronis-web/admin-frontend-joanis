/**
 * SmartPurchaseAnalysisRankingScreen
 *
 * Vista global de proveedores para el módulo Compra Inteligente.
 *
 * Contiene dos tabs:
 *  - Ranking → proveedores ya analizados, ordenados por viabilidad (filtro por chip).
 *  - Sin analizar → proveedores activos sin snapshot todavía; se pueden analizar
 *                    individualmente o en bloque desde el FAB (`Ejecutar análisis`).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { ProtectedView } from '@/components/ui/ProtectedView';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Input,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { suppliersService } from '@/services/api/suppliers';
import { useDebounce } from '@/hooks/useDebounce';
import { useRunAnalysis, useSupplierAnalysis } from '@/hooks/api/useSmartPurchase';
import type { MainStackParamList } from '@/types/navigation';
import type { SupplierAnalysisRow, SupplierViability } from '@/types/smartPurchase';
import type { Supplier } from '@/types/suppliers';
import {
  formatNumber,
  formatPct,
  formatRelative,
  safeFixed,
  VIABILITY_COLOR,
  VIABILITY_LABEL,
  VIABILITY_OPTIONS,
} from './helpers';
import { SupplierAnalysisModal } from './components/SupplierAnalysisModal';

type Props = NativeStackScreenProps<MainStackParamList, 'SmartPurchaseAnalysisRanking'>;

type TabKey = 'RANKING' | 'PENDING';

export const SmartPurchaseAnalysisRankingScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [tab, setTab] = useState<TabKey>('RANKING');
  const [viability, setViability] = useState<SupplierViability | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [selected, setSelected] = useState<
    { supplierId: string; supplierName: string } | undefined
  >();
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  // Analysis snapshots (ranking).
  const {
    data: analysis,
    isLoading: analysisLoading,
    isError: analysisError,
    refetch: refetchAnalysis,
    isRefetching: analysisRefetching,
  } = useSupplierAnalysis(viability === 'ALL' ? undefined : { viability });

  // All active suppliers (used to compute "sin analizar").
  const {
    data: suppliersRes,
    isLoading: suppliersLoading,
    isError: suppliersError,
    refetch: refetchSuppliers,
    isRefetching: suppliersRefetching,
  } = useQuery({
    queryKey: ['smart-purchase', 'all-suppliers', debouncedSearch],
    queryFn: () =>
      suppliersService.getSuppliers({
        query: debouncedSearch || undefined,
        isActive: true,
        limit: 200,
      }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const runAnalysis = useRunAnalysis();

  const analyzedIds = useMemo(() => new Set((analysis ?? []).map((r) => r.supplierId)), [analysis]);

  const rankedSorted = useMemo(() => {
    const list = [...(analysis ?? [])];
    const rank: Record<SupplierViability, number> = {
      IDEAL: 0,
      VIABLE: 1,
      CONDICIONADO: 2,
      NO_RECOMENDADO: 3,
    };
    list.sort((a, b) => rank[a.viability] - rank[b.viability]);
    if (debouncedSearch) {
      const needle = debouncedSearch.toLowerCase();
      return list.filter(
        (r) =>
          r.supplierName.toLowerCase().includes(needle) ||
          (r.ruc ?? '').toLowerCase().includes(needle)
      );
    }
    return list;
  }, [analysis, debouncedSearch]);

  const pendingSuppliers: Supplier[] = useMemo(() => {
    const list = suppliersRes?.data ?? [];
    return list.filter((s) => !analyzedIds.has(s.id));
  }, [suppliersRes, analyzedIds]);

  const handleReanalyzeOne = useCallback(
    async (supplierId: string, supplierName: string) => {
      setReanalyzingId(supplierId);
      try {
        await runAnalysis.mutateAsync({ supplierId });
        await refetchAnalysis();
      } catch (err: any) {
        logger.error('Reanalizar proveedor error', err);
        Alert.alert('Error', err?.message ?? `No se pudo analizar ${supplierName}.`);
      } finally {
        setReanalyzingId(null);
      }
    },
    [runAnalysis, refetchAnalysis]
  );

  const handleRunGlobal = useCallback(async () => {
    try {
      const res = await runAnalysis.mutateAsync();
      await Promise.all([refetchAnalysis(), refetchSuppliers()]);
      Alert.alert(
        'Análisis completado',
        `Se analizaron ${res.analyzed} proveedores. Revisa el ranking.`
      );
      setTab('RANKING');
    } catch (err: any) {
      logger.error('Run global analysis error', err);
      Alert.alert('Error', err?.message ?? 'No se pudo ejecutar el análisis.');
    }
  }, [runAnalysis, refetchAnalysis, refetchSuppliers]);

  const renderRankRow = useCallback(
    ({ item }: { item: SupplierAnalysisRow }) => (
      <Card
        onPress={() =>
          setSelected({ supplierId: item.supplierId, supplierName: item.supplierName })
        }
        style={styles.card}
      >
        <View style={styles.rowHeader}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }}>{item.supplierName}</Body>
            <Caption color="muted">
              {item.ruc ? `RUC ${item.ruc} · ` : ''}
              {formatRelative(item.analyzedAt)}
            </Caption>
          </View>
          <View style={styles.viabilityChip}>
            <View
              style={[styles.viabilityDot, { backgroundColor: VIABILITY_COLOR[item.viability] }]}
            />
            <Body size="small" style={{ fontWeight: '600' }}>
              {VIABILITY_LABEL[item.viability]}
            </Body>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <Metric label="Compras 60d" value={formatNumber(item.purchases60d)} />
          <Metric label="Cobertura" value={formatPct(item.coveragePct)} />
          <Metric label="Duplicados" value={formatPct(item.duplicateFamilyRate)} />
          <Metric label="Ajuste" value={safeFixed(item.adjustmentRatio, 2)} />
          <Metric label="Cob. reco." value={`${item.recommendedCoverageDays}d`} />
        </View>

        <ProtectedView requiredPermissions={['smart_purchase.analysis.run']}>
          <View style={styles.rowActions}>
            <Button
              title="Re-analizar"
              variant="ghost"
              onPress={() => handleReanalyzeOne(item.supplierId, item.supplierName)}
              loading={reanalyzingId === item.supplierId}
              disabled={reanalyzingId === item.supplierId}
              leftIcon="refresh-outline"
              size="small"
            />
          </View>
        </ProtectedView>
      </Card>
    ),
    [styles, handleReanalyzeOne, reanalyzingId]
  );

  const renderPendingRow = useCallback(
    ({ item }: { item: Supplier }) => (
      <Card style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }}>{item.commercialName}</Body>
            <Caption color="muted">
              {item.code}
              {item.email ? ` · ${item.email}` : ''}
            </Caption>
          </View>
          <Badge variant="default" label="Sin análisis" />
        </View>
        <ProtectedView requiredPermissions={['smart_purchase.analysis.run']}>
          <View style={styles.rowActions}>
            <Button
              title="Analizar"
              variant="primary"
              size="small"
              leftIcon="analytics-outline"
              onPress={() => handleReanalyzeOne(item.id, item.commercialName)}
              loading={reanalyzingId === item.id}
              disabled={reanalyzingId === item.id}
            />
          </View>
        </ProtectedView>
      </Card>
    ),
    [styles, handleReanalyzeOne, reanalyzingId]
  );

  const showingList = tab === 'RANKING' ? rankedSorted : pendingSuppliers;
  const isLoading = tab === 'RANKING' ? analysisLoading : suppliersLoading;
  const isError = tab === 'RANKING' ? analysisError : suppliersError;
  const isRefetching = tab === 'RANKING' ? analysisRefetching : suppliersRefetching;
  const refetch = tab === 'RANKING' ? refetchAnalysis : refetchSuppliers;

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.color.text.body} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Title>Proveedores · Compra Inteligente</Title>
            <Caption color="muted">
              Ranking por viabilidad + gestión de proveedores aún no analizados.
            </Caption>
          </View>
        </View>

        <View style={styles.tabsRow}>
          <TabButton
            active={tab === 'RANKING'}
            label={`Ranking (${analysis?.length ?? 0})`}
            onPress={() => setTab('RANKING')}
          />
          <TabButton
            active={tab === 'PENDING'}
            label={`Sin analizar (${pendingSuppliers.length})`}
            onPress={() => setTab('PENDING')}
          />
        </View>

        <View style={styles.filters}>
          <Input
            leftIcon="search"
            placeholder="Buscar por nombre o RUC..."
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {tab === 'RANKING' && (
            <ChipGroup
              options={VIABILITY_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              selected={[viability]}
              onChange={(vals) => setViability((vals[0] ?? 'ALL') as SupplierViability | 'ALL')}
            />
          )}
        </View>

        <FlatList
          data={showingList as any[]}
          keyExtractor={(r: any) => (tab === 'RANKING' ? r.supplierId : r.id)}
          renderItem={tab === 'RANKING' ? (renderRankRow as any) : (renderPendingRow as any)}
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
            isError ? (
              <ErrorState
                title="No se pudo cargar la lista"
                description="Reintenta en unos segundos."
                onRetry={() => refetch()}
              />
            ) : !isLoading ? (
              tab === 'RANKING' ? (
                <EmptyState
                  icon="analytics-outline"
                  title="Sin proveedores analizados"
                  description="Ejecuta el análisis global para poblar el ranking o revisa el tab 'Sin analizar'."
                  actionLabel="Ejecutar análisis"
                  onAction={handleRunGlobal}
                />
              ) : (
                <EmptyState
                  icon="checkmark-done-outline"
                  title="Todos los proveedores están analizados"
                  description="No hay proveedores activos pendientes."
                />
              )
            ) : null
          }
        />

        <ProtectedFAB
          actions={[
            {
              icon: 'refresh-outline',
              label: 'Ejecutar análisis global',
              onPress: handleRunGlobal,
              requiredPermissions: ['smart_purchase.analysis.run'],
            },
          ]}
        />

        <SupplierAnalysisModal
          visible={!!selected}
          supplierId={selected?.supplierId}
          supplierName={selected?.supplierName}
          onClose={() => setSelected(undefined)}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const TabButton: React.FC<{ active: boolean; label: string; onPress: () => void }> = ({
  active,
  label,
  onPress,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
      activeOpacity={0.7}
    >
      <Body
        size="small"
        style={{
          fontWeight: '600',
          color: active ? theme.color.text.onAction : theme.color.text.body,
        }}
      >
        {label}
      </Body>
    </TouchableOpacity>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    tabsRow: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
    tab: {
      flex: 1,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[3],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: theme.color.action.primary.background,
    },
    filters: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
      gap: spacing[2],
    },
    listContent: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[8] * 2,
      flexGrow: 1,
    },
    card: { gap: spacing[2] },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    rowActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    viabilityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.subtle,
    },
    viabilityDot: { width: 8, height: 8, borderRadius: 4 },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    metric: {
      minWidth: 90,
      flexGrow: 1,
      padding: spacing[2],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.subtle,
      gap: 2,
    },
  });
