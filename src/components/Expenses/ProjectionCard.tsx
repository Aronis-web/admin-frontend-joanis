import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseProjection, ConfidenceLevelLabels, ConfidenceLevelColors } from '@/types/expenses';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface ProjectionCardProps {
  projection: ExpenseProjection;
  onPress: (projection: ExpenseProjection) => void;
}

export const ProjectionCard: React.FC<ProjectionCardProps> = ({ projection, onPress }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (amount: number) => {
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const confidenceColor = ConfidenceLevelColors[projection.confidenceLevel];
  const confidenceLabel = ConfidenceLevelLabels[projection.confidenceLevel];

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(projection)} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.expenseName} numberOfLines={1}>
            {projection.expense?.name || 'Gasto sin nombre'}
          </Text>
          <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor + '20' }]}>
            <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
            <Text style={[styles.confidenceText, { color: confidenceColor }]}>
              {confidenceLabel}
            </Text>
          </View>
        </View>
        <Ionicons name="trending-up-outline" size={24} color={colors.accent[500]} />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Monto Proyectado</Text>
          <Text style={styles.amountValue}>{formatAmount(projection.projectedAmount)}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Fecha de Proyección</Text>
            <Text style={styles.value}>{formatDate(projection.projectionDate)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Moneda</Text>
            <Text style={styles.value}>{projection.currency}</Text>
          </View>
        </View>

        {projection.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notas:</Text>
            <Text style={styles.notesText} numberOfLines={2}>
              {projection.notes}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  headerLeft: {
    flex: 1,
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1.5],
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.xl,
    gap: spacing[1.5],
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginBottom: spacing[3],
  },
  content: {
    gap: spacing[3],
  },
  amountContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
  },
  amountLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  infoItem: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: colors.neutral[400],
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  notesContainer: {
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    padding: spacing[2.5],
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  notesLabel: {
    fontSize: 10,
    color: colors.warning[800],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  notesText: {
    fontSize: 12,
    color: colors.warning[900],
    lineHeight: 16,
  },
});

export default ProjectionCard;
