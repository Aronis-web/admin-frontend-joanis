import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
        style={[
          styles.paginationButton,
          currentPage === 1 && styles.paginationButtonDisabled,
        ]}
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    color: '#475569',
  },
  paginationSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#6366F1',
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
});
