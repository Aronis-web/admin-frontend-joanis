import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  itemLabel: _itemLabel = 'elementos',
}) => {
  const styles = useThemedStyles(createStyles);
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    paginationContainer: {
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
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
      color: theme.color.text.muted,
    },
    paginationSubtext: {
      fontSize: 11,
      color: theme.color.text.subtle,
      marginTop: 2,
    },
    paginationButtons: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    paginationButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.action.primary.background,
      minWidth: 80,
      alignItems: 'center',
    },
    paginationButtonDisabled: {
      backgroundColor: theme.color.action.primary.backgroundDisabled,
    },
    paginationButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    paginationButtonTextDisabled: {
      color: theme.color.text.disabled,
    },
  });
