import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  itemLabel?: string; // e.g., "compras", "gastos", "productos"
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPreviousPage,
  onNextPage,
  itemLabel = 'elementos',
}) => {
  const currentItemsCount = Math.min(itemsPerPage, totalItems - (currentPage - 1) * itemsPerPage);

  return (
    <View style={styles.paginationContainer}>
      <TouchableOpacity
        style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
        onPress={onPreviousPage}
        disabled={currentPage === 1}
      >
        <Text
          style={[
            styles.paginationButtonText,
            currentPage === 1 && styles.paginationButtonTextDisabled,
          ]}
        >
          ← Anterior
        </Text>
      </TouchableOpacity>

      <View style={styles.paginationInfo}>
        <Text style={styles.paginationText}>
          Pág. {currentPage}/{totalPages}
        </Text>
        <Text style={styles.paginationSubtext}>
          {currentItemsCount} de {totalItems}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.paginationButton,
          currentPage >= totalPages && styles.paginationButtonDisabled,
        ]}
        onPress={onNextPage}
        disabled={currentPage >= totalPages}
      >
        <Text
          style={[
            styles.paginationButtonText,
            currentPage >= totalPages && styles.paginationButtonTextDisabled,
          ]}
        >
          Siguiente →
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  paginationContainer: {
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paginationInfo: {
    flex: 1,
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  paginationSubtext: {
    fontSize: 11,
    color: colors.neutral[400],
    marginTop: 2,
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  paginationButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: colors.border.default,
  },
  paginationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  paginationButtonTextDisabled: {
    color: colors.neutral[400],
  },
});
