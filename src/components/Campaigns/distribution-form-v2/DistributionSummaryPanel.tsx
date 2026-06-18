/**
 * Panel resumen del modal V2: totales monetarios + validador visual
 * de venta vs esperado y botón explícito de "Recalcular resto".
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const diff = stockTotal - totals.totalQuantity;
  const buckets = totals.coverageBuckets;

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
        ? theme.color.text.danger
        : tone === 'warn'
          ? theme.color.text.warning
          : tone === 'ok'
            ? theme.color.text.success
            : theme.color.text.heading;
    return (
      <View style={styles.metric}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
      </View>
    );
  };

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
            bg={theme.color.state.success.background}
            fg={theme.color.state.success.text}
          />
          <CoverageChip
            label="En rango (90-98%)"
            count={buckets.inRange}
            bg={theme.color.state.warning.background}
            fg={theme.color.state.warning.text}
          />
          <CoverageChip
            label="Bajos (<90%)"
            count={buckets.low}
            bg={theme.color.state.danger.background}
            fg={theme.color.state.danger.text}
          />
          <CoverageChip
            label="Sobre (>102%)"
            count={buckets.over}
            bg={theme.color.state.danger.background}
            fg={theme.color.state.danger.text}
          />
          {buckets.noExpected > 0 && (
            <CoverageChip
              label="Sin esperado"
              count={buckets.noExpected}
              bg={theme.color.surface.muted}
              fg={theme.color.text.subtle}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.space[1],
    },
    primaryButton: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
    },
    primaryButtonText: {
      color: theme.color.text.inverse,
      fontWeight: '700',
      fontSize: 12,
    },
    secondaryButton: {
      backgroundColor: theme.color.surface.subtle,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    secondaryButtonText: {
      color: theme.color.text.heading,
      fontWeight: '600',
      fontSize: 12,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    metric: {
      minWidth: 130,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    metricLabel: {
      fontSize: 11,
      color: theme.color.text.subtle,
    },
    metricValue: {
      fontSize: 15,
      fontWeight: '700',
    },
    coverageBox: {
      borderRadius: theme.radii.md,
      padding: theme.space[2],
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[1],
    },
    coverageTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    coverageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[1],
    },
    chip: {
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
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
