import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseProjection, ConfidenceLevelLabels, ConfidenceLevelColors } from '@/types/expenses';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface ProjectionCardProps {
  projection: ExpenseProjection;
  onPress: (projection: ExpenseProjection) => void;
}

export const ProjectionCard: React.FC<ProjectionCardProps> = ({ projection, onPress }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
        <Ionicons name="trending-up-outline" size={24} color={theme.color.brand.accent} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    headerLeft: {
      flex: 1,
    },
    expenseName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1.5],
    },
    confidenceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.xl,
      gap: theme.space[1.5],
    },
    confidenceDot: {
      width: 6,
      height: 6,
      borderRadius: theme.radii.full,
    },
    confidenceText: {
      fontSize: 11,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.default,
      marginBottom: theme.space[3],
    },
    content: {
      gap: theme.space[3],
    },
    amountContainer: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
    },
    amountLabel: {
      fontSize: 11,
      color: theme.color.text.subtle,
      fontWeight: '600',
      marginBottom: theme.space[1],
    },
    amountValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    row: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    infoItem: {
      flex: 1,
    },
    label: {
      fontSize: 10,
      color: theme.color.text.placeholder,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    value: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    notesContainer: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.lg,
      padding: theme.space[2.5],
      borderLeftWidth: 3,
      borderLeftColor: theme.color.state.warning.border,
    },
    notesLabel: {
      fontSize: 10,
      color: theme.color.state.warning.text,
      fontWeight: '600',
      marginBottom: theme.space[1],
    },
    notesText: {
      fontSize: 12,
      color: theme.color.state.warning.text,
      lineHeight: 16,
    },
  });

export default ProjectionCard;
