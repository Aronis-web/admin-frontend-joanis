/**
 * Picker de stock para el modal V2.
 *
 * SOLO muestra stock de la sede actual del tenant. Si la sede no tiene stock
 * disponible, muestra un warning bloqueante (no hay fallback).
 */
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { StockBucket } from './types';

interface StockAllocationPickerProps {
  buckets: StockBucket[];
  allocations: Record<string, number>;
  onToggle: (key: string) => void;
  onAllocate: (key: string, qty: number) => void;
  total: number;
  siteName?: string;
}

export const StockAllocationPicker: React.FC<StockAllocationPickerProps> = ({
  buckets,
  allocations,
  onToggle,
  onAllocate,
  total,
  siteName,
}) => {
  if (buckets.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Stock de la sede actual</Text>
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Sin stock en la sede actual</Text>
          <Text style={styles.warningText}>
            {siteName
              ? `La sede "${siteName}" no tiene stock disponible para este producto.`
              : 'No hay sede seleccionada. Selecciona una sede en el header.'}
          </Text>
          <Text style={styles.warningText}>
            Solo se permite generar repartos con stock de la sede actual.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Stock disponible — {siteName ?? 'Sede actual'}</Text>
      <Text style={styles.hint}>
        Marca los buckets a usar y la cantidad. El total a repartir es la suma.
      </Text>

      {buckets.map((b) => {
        const isSelected = allocations[b.key] !== undefined;
        const value = allocations[b.key] ?? 0;
        const disabled = b.available <= 0;
        return (
          <View
            key={b.key}
            style={[
              styles.card,
              isSelected && styles.cardSelected,
              disabled && styles.cardDisabled,
            ]}
          >
            <TouchableOpacity
              onPress={() => !disabled && onToggle(b.key)}
              style={styles.cardHeader}
              disabled={disabled}
            >
              <Text style={styles.checkbox}>{isSelected ? '☑' : '☐'}</Text>
              <View style={styles.cardHeaderText}>
                <Text style={styles.warehouse}>{b.warehouseName}</Text>
                <Text style={styles.area}>{b.areaName ?? 'Sin área'}</Text>
              </View>
              <View style={styles.availability}>
                <Text style={styles.availableLabel}>Disponible</Text>
                <Text style={styles.availableValue}>{b.available}</Text>
              </View>
            </TouchableOpacity>
            {isSelected && (
              <View style={styles.allocationRow}>
                <Text style={styles.allocLabel}>Cantidad a tomar</Text>
                <TextInput
                  style={styles.allocInput}
                  keyboardType="numeric"
                  value={String(value)}
                  onChangeText={(t) => {
                    const parsed = parseFloat(t);
                    const safe =
                      Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, b.available) : 0;
                    onAllocate(b.key, safe);
                  }}
                />
                <Text style={styles.allocMax}>/ {b.available}</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Total a repartir</Text>
        <Text style={styles.totalValue}>{total}</Text>
      </View>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  hint: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing[2],
    backgroundColor: colors.surface.secondary,
  },
  cardSelected: {
    borderColor: colors.primary[900],
    backgroundColor: colors.surface.primary,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  checkbox: {
    fontSize: 18,
    color: colors.primary[900],
  },
  cardHeaderText: {
    flex: 1,
  },
  warehouse: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  area: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  availability: {
    alignItems: 'flex-end',
  },
  availableLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  availableValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success[700],
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  allocLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  allocInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    color: colors.text.primary,
    backgroundColor: colors.surface.primary,
  },
  allocMax: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary[900],
  },
  warningBox: {
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[400],
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    gap: 4,
  },
  warningTitle: {
    fontWeight: '700',
    color: colors.warning[800],
  },
  warningText: {
    color: colors.warning[800],
    fontSize: 12,
  },
});
