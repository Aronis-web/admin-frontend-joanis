/**
 * SmartPurchaseAnalysisRankingScreen
 *
 * Vista global de ranking de proveedores según su viabilidad para compra
 * inteligente. Permite explorar candidatos y decidir qué grupos armar.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Body,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import type { MainStackParamList } from '@/types/navigation';
import type { SupplierAnalysisRow, SupplierViability } from '@/types/smartPurchase';
import { useSupplierAnalysis } from '@/hooks/api/useSmartPurchase';
import {
  formatNumber,
  formatPct,
  formatRelative,
  VIABILITY_COLOR,
  VIABILITY_LABEL,
  VIABILITY_OPTIONS,
} from './helpers';
import { SupplierAnalysisModal } from './components/SupplierAnalysisModal';

type Props = NativeStackScreenProps<MainStackParamList, 'SmartPurchaseAnalysisRanking'>;

export const SmartPurchaseAnalysisRankingScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [viability, setViability] = useState<SupplierViability | 'ALL'>('ALL');
  const [selected, setSelected] = useState<
    { supplierId: string; supplierName: string } | undefined
  >();

  const { data, isLoading, isError, refetch, isRefetching } = useSupplierAnalysis(
    viability === 'ALL' ? undefined : { viability }
  );

  const sorted = useMemo(() => {
    const list = [...(data ?? [])];
    const rank: Record<SupplierViability, number> = {
      IDEAL: 0,
      VIABLE: 1,
      CONDICIONADO: 2,
      NO_RECOMENDADO: 3,
    };
    list.sort((a, b) => rank[a.viability] - rank[b.viability]);
    return list;
  }, [data]);

  const renderItem = ({ item }: { item: SupplierAnalysisRow }) => (
    <Card
      onPress={() => setSelected({ supplierId: item.supplierId, supplierName: item.supplierName })}
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
        <Metric label="Ajuste" value={item.adjustmentRatio.toFixed(2)} />
        <Metric label="Cob. reco." value={`${item.recommendedCoverageDays}d`} />
      </View>
    </Card>
  );

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Title>Ranking proveedores</Title>
          <Caption color="muted">
            Ordenados por viabilidad para compra inteligente. Tap para ver historial completo.
          </Caption>
        </View>

        <View style={styles.filters}>
          <ChipGroup
            options={VIABILITY_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            selected={[viability]}
            onChange={(vals) => setViability((vals[0] ?? 'ALL') as SupplierViability | 'ALL')}
          />
        </View>

        <FlatList
          data={sorted}
          keyExtractor={(r) => r.supplierId}
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
            isError ? (
              <ErrorState
                title="No se pudo cargar el ranking"
                description="Reintenta en unos segundos."
                onRetry={() => refetch()}
              />
            ) : !isLoading ? (
              <EmptyState
                icon="analytics-outline"
                title="Sin proveedores analizados"
                description="Ejecuta el análisis desde un grupo para poblar el ranking."
              />
            ) : null
          }
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
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
      gap: spacing[1],
    },
    filters: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
    listContent: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[8],
      flexGrow: 1,
    },
    card: { gap: spacing[2] },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing[2],
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
