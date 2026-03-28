/**
 * Pagination Component
 *
 * Controles de paginación para listas.
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../primitives/Text';
import { colors } from '../../tokens/colors';
import { spacing, borderRadius, iconSizes } from '../../tokens/spacing';
import { shadows } from '../../tokens/shadows';
import { activeOpacity } from '../../tokens/animations';

export interface PaginationProps {
  /**
   * Página actual
   */
  currentPage: number;

  /**
   * Total de páginas
   */
  totalPages: number;

  /**
   * Total de items
   */
  totalItems?: number;

  /**
   * Items por página
   */
  itemsPerPage?: number;

  /**
   * Callback al cambiar de página
   */
  onPageChange: (page: number) => void;

  /**
   * Si está cargando
   */
  loading?: boolean;

  /**
   * Variante visual
   */
  variant?: 'simple' | 'full' | 'compact';

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  loading = false,
  variant = 'full',
  style,
}) => {
  const canGoPrevious = currentPage > 1 && !loading;
  const canGoNext = currentPage < totalPages && !loading;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(currentPage + 1);
    }
  };

  // Compact variant - Solo flechas
  if (variant === 'compact') {
    return (
      <View style={[styles.compactContainer, style]}>
        <TouchableOpacity
          style={[styles.compactButton, !canGoPrevious && styles.buttonDisabled]}
          onPress={handlePrevious}
          disabled={!canGoPrevious}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="chevron-back"
            size={iconSizes.md}
            color={canGoPrevious ? colors.icon.primary : colors.icon.disabled}
          />
        </TouchableOpacity>

        <Text variant="labelMedium" color="secondary">
          {currentPage} / {totalPages}
        </Text>

        <TouchableOpacity
          style={[styles.compactButton, !canGoNext && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canGoNext}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="chevron-forward"
            size={iconSizes.md}
            color={canGoNext ? colors.icon.primary : colors.icon.disabled}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Simple variant - Sin info adicional
  if (variant === 'simple') {
    return (
      <View style={[styles.simpleContainer, style]}>
        <TouchableOpacity
          style={[styles.navButton, !canGoPrevious && styles.buttonDisabled]}
          onPress={handlePrevious}
          disabled={!canGoPrevious}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="chevron-back"
            size={iconSizes.sm}
            color={canGoPrevious ? colors.icon.inverse : colors.icon.disabled}
          />
          <Text
            variant="buttonSmall"
            color={canGoPrevious ? colors.text.inverse : colors.text.disabled}
            style={styles.navButtonText}
          >
            Anterior
          </Text>
        </TouchableOpacity>

        <View style={styles.pageIndicator}>
          <Text variant="labelMedium" color="primary">
            Página {currentPage} de {totalPages}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.navButton, !canGoNext && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canGoNext}
          activeOpacity={activeOpacity.medium}
        >
          <Text
            variant="buttonSmall"
            color={canGoNext ? colors.text.inverse : colors.text.disabled}
            style={styles.navButtonText}
          >
            Siguiente
          </Text>
          <Ionicons
            name="chevron-forward"
            size={iconSizes.sm}
            color={canGoNext ? colors.icon.inverse : colors.icon.disabled}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Full variant - Con toda la información
  return (
    <View style={[styles.container, shadows.xs, style]}>
      {/* Previous Button */}
      <TouchableOpacity
        style={[styles.navButton, !canGoPrevious && styles.buttonDisabled]}
        onPress={handlePrevious}
        disabled={!canGoPrevious}
        activeOpacity={activeOpacity.medium}
      >
        <Ionicons
          name="chevron-back"
          size={iconSizes.sm}
          color={canGoPrevious ? colors.icon.inverse : colors.icon.disabled}
        />
        <Text
          variant="buttonSmall"
          color={canGoPrevious ? colors.text.inverse : colors.text.disabled}
          style={styles.navButtonText}
        >
          Anterior
        </Text>
      </TouchableOpacity>

      {/* Center Info */}
      <View style={styles.centerInfo}>
        <Text variant="titleSmall" color="primary">
          Página {currentPage} de {totalPages}
        </Text>
        {totalItems !== undefined && itemsPerPage !== undefined && (
          <Text variant="caption" color="tertiary" style={styles.itemsInfo}>
            {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} registros
          </Text>
        )}
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[styles.navButton, !canGoNext && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!canGoNext}
        activeOpacity={activeOpacity.medium}
      >
        <Text
          variant="buttonSmall"
          color={canGoNext ? colors.text.inverse : colors.text.disabled}
          style={styles.navButtonText}
        >
          Siguiente
        </Text>
        <Ionicons
          name="chevron-forward"
          size={iconSizes.sm}
          color={canGoNext ? colors.icon.inverse : colors.icon.disabled}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Full variant
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },

  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[900],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    minWidth: 110,
  },

  buttonDisabled: {
    backgroundColor: colors.neutral[200],
  },

  navButtonText: {
    marginHorizontal: spacing[1],
  },

  centerInfo: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: spacing[2],
  },

  itemsInfo: {
    marginTop: spacing[0.5],
  },

  // Simple variant
  simpleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  pageIndicator: {
    alignItems: 'center',
  },

  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },

  compactButton: {
    padding: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
  },
});

export default Pagination;
