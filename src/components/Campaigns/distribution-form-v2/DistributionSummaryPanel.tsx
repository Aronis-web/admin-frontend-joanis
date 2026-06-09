/**
 * Panel resumen del modal V2: totales monetarios + validador visual
 * de venta vs esperado y botón explícito de "Recalcular resto".
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { DistributionTotals } from './types';

interface DistributionSummaryPanelProps {
  totals: DistributionTotals;
  stockTotal: number;
  onRecalculate: () => void;
  onReset: () => void;
}

const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });

export const DistributionSummaryPanel: React.FC<DistributionSummaryPanelProps> = ({
  totals,
  stockTotal,
  onRecalculate,
  onReset,
}) => {
  const diff = stockTotal - totals.totalQuantity;
  const buckets = totals.coverageBuckets;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Resumen del reparto</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onReset}>
            <Text style={styles.secondaryButtonText}>Reset filas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={onRecalculate}>
            <Text style={styles.primaryButtonText}>↻ Recalcular resto</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.grid}>
        <Metric label="Cantidad total" value={String(totals.totalQuantity)} />
        <Metric label="Stock seleccionado" value={String(stockTotal)} />
        <Metric
          label="Pendiente / Exceso"
          value={String(diff)}
          tone={diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'bad'}
        />
        <Metric label="Costo total" value={formatMoney(totals.totalCostCents)} />
        <Metric label="Venta este producto" value={formatMoney(totals.realSaleCents)} />
        <Metric label="Venta acumulada campaña" value={formatMoney(totals.totalSaleCents)} />
        <Metric
          label="Utilidad"
          value={formatMoney(totals.profitCents)}
          tone={totals.profitCents < 0 ? 'bad' : 'ok'}
        />
        <Metric label="Margen %" value={`${totals.marginPercent.toFixed(1)}%`} />
      </View>

      <View style={styles.coverageBox}>
        <Text style={styles.coverageTitle}>Cumplimiento campaña por participante</Text>
        <View style={styles.coverageRow}>
          <CoverageChip
            label="Completos (≥98%)"
            count={buckets.complete}
            bg={colors.success[100]}
            fg={colors.success[800]}
          />
          <CoverageChip
            label="En rango (90-98%)"
            count={buckets.inRange}
            bg={colors.warning[100]}
            fg={colors.warning[800]}
          />
          <CoverageChip
            label="Bajos (<90%)"
            count={buckets.low}
            bg={colors.danger[100]}
            fg={colors.danger[800]}
          />
          <CoverageChip
            label="Sobre (>102%)"
            count={buckets.over}
            bg={colors.danger[100]}
            fg={colors.danger[800]}
          />
          {buckets.noExpected > 0 && (
            <CoverageChip
              label="Sin esperado"
              count={buckets.noExpected}
              bg={colors.neutral[100]}
              fg={colors.text.tertiary}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const CoverageChip: React.FC<{ label: string; count: number; bg: string; fg: string }> = ({
  label,
  count,
  bg,
  fg,
}) => (
  <View style={[styles.chip, { backgroundColor: bg }]}>
    <Text style={[styles.chipCount, { color: fg }]}>{count}</Text>
    <Text style={[styles.chipLabel, { color: fg }]}>{label}</Text>
  </View>
);

const Metric: React.FC<{
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}> = ({ label, value, tone }) => {
  const color =
    tone === 'bad'
      ? colors.danger[700]
      : tone === 'warn'
        ? colors.warning[700]
        : tone === 'ok'
          ? colors.success[700]
          : colors.text.primary;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  primaryButton: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryButton: {
    backgroundColor: colors.surface.secondary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metric: {
    minWidth: 130,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  coverageBox: {
    borderRadius: borderRadius.md,
    padding: spacing[2],
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[1],
  },
  coverageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  coverageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
  },
  chip: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 110,
  },
  chipCount: {
    fontSize: 18,
    fontWeight: '800',
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
