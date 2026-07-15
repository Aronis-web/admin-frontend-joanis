/**
 * Pagination Component
 *
 * Controles de paginación para listas.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ViewStyle,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../primitives/Text';
import { iconSizes } from '../../tokens/spacing';
import { activeOpacity } from '../../tokens/animations';
import { useTheme, useThemedStyles } from '../../themes';
import type { Theme } from '../../themes';
import { useMeasuredFloatingFooter } from '../../layout/FloatingFooterProvider';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { onLayout: onFooterLayout } = useMeasuredFloatingFooter();
  const canGoPrevious = currentPage > 1 && !loading;
  const canGoNext = currentPage < totalPages && !loading;

  // Modal "ir a página"
  const [gotoOpen, setGotoOpen] = useState(false);
  const [pageInput, setPageInput] = useState<string>(String(currentPage));

  useEffect(() => {
    if (!gotoOpen) {
      setPageInput(String(currentPage));
    }
  }, [currentPage, gotoOpen]);

  const openGoto = () => {
    if (loading || totalPages <= 1) return;
    setPageInput(String(currentPage));
    setGotoOpen(true);
  };

  const confirmGoto = () => {
    const parsed = parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(Math.max(parsed, 1), Math.max(totalPages, 1));
      if (clamped !== currentPage) {
        onPageChange(clamped);
      }
    }
    setGotoOpen(false);
  };

  const cancelGoto = () => {
    setPageInput(String(currentPage));
    setGotoOpen(false);
  };

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
      <View onLayout={onFooterLayout} style={[styles.compactContainer, style]}>
        <TouchableOpacity
          style={[styles.compactButton, !canGoPrevious && styles.buttonDisabled]}
          onPress={handlePrevious}
          disabled={!canGoPrevious}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="chevron-back"
            size={iconSizes.md}
            color={canGoPrevious ? theme.color.icon.default : theme.color.icon.disabled}
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
            color={canGoNext ? theme.color.icon.default : theme.color.icon.disabled}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Simple variant - Sin info adicional
  if (variant === 'simple') {
    return (
      <View onLayout={onFooterLayout} style={[styles.simpleContainer, style]}>
        <TouchableOpacity
          style={[styles.navButton, !canGoPrevious && styles.buttonDisabled]}
          onPress={handlePrevious}
          disabled={!canGoPrevious}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="chevron-back"
            size={iconSizes.sm}
            color={canGoPrevious ? theme.color.icon.inverse : theme.color.icon.disabled}
          />
          <Text
            variant="buttonSmall"
            color={canGoPrevious ? theme.color.text.onAction : theme.color.text.disabled}
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
            color={canGoNext ? theme.color.text.onAction : theme.color.text.disabled}
            style={styles.navButtonText}
          >
            Siguiente
          </Text>
          <Ionicons
            name="chevron-forward"
            size={iconSizes.sm}
            color={canGoNext ? theme.color.icon.inverse : theme.color.icon.disabled}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Full variant - Con toda la información
  return (
    <View onLayout={onFooterLayout} style={[styles.container, theme.shadow.xs, style]}>
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
          color={canGoPrevious ? theme.color.icon.inverse : theme.color.icon.disabled}
        />
        <Text
          variant="buttonSmall"
          color={canGoPrevious ? theme.color.text.onAction : theme.color.text.disabled}
          style={styles.navButtonText}
        >
          Anterior
        </Text>
      </TouchableOpacity>

      {/* Center Info - botón para abrir modal "ir a página" */}
      <TouchableOpacity
        style={styles.centerInfo}
        onPress={openGoto}
        disabled={loading || totalPages <= 1}
        activeOpacity={activeOpacity.medium}
      >
        <View style={styles.pageBadge}>
          <Text variant="titleSmall" color="primary">
            Página {currentPage} de {totalPages}
          </Text>
          {totalPages > 1 && !loading && (
            <Ionicons
              name="create-outline"
              size={iconSizes.xs}
              color={theme.color.icon.subtle}
              style={styles.pageBadgeIcon}
            />
          )}
        </View>
        {totalItems !== undefined && itemsPerPage !== undefined && (
          <Text variant="caption" color="tertiary" style={styles.itemsInfo}>
            {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} registros
          </Text>
        )}
      </TouchableOpacity>

      {/* Modal Ir a página */}
      <Modal visible={gotoOpen} transparent animationType="fade" onRequestClose={cancelGoto}>
        <Pressable style={styles.gotoOverlay} onPress={cancelGoto}>
          <Pressable style={styles.gotoDialog} onPress={(e) => e.stopPropagation()}>
            <Text variant="titleSmall" color="primary" style={styles.gotoTitle}>
              Ir a página
            </Text>
            <Text variant="caption" color="tertiary" style={styles.gotoSubtitle}>
              Entre 1 y {totalPages}
            </Text>
            <TextInput
              value={pageInput}
              onChangeText={(text) => setPageInput(text.replace(/[^0-9]/g, ''))}
              onSubmitEditing={confirmGoto}
              keyboardType="number-pad"
              returnKeyType="go"
              autoFocus
              selectTextOnFocus
              maxLength={String(totalPages || 1).length + 1}
              placeholder={String(currentPage)}
              placeholderTextColor={theme.color.text.placeholder}
              style={[
                styles.gotoInput,
                { color: theme.color.text.body, borderColor: theme.color.border.default },
              ]}
              {...(Platform.OS === 'web' ? { inputMode: 'numeric' as const } : {})}
            />
            <View style={styles.gotoActions}>
              <TouchableOpacity
                style={[styles.gotoButton, styles.gotoButtonSecondary]}
                onPress={cancelGoto}
                activeOpacity={activeOpacity.medium}
              >
                <Text variant="buttonSmall" color="secondary">
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gotoButton, styles.gotoButtonPrimary]}
                onPress={confirmGoto}
                activeOpacity={activeOpacity.medium}
              >
                <Text variant="buttonSmall" style={{ color: theme.color.text.onAction }}>
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Next Button */}
      <TouchableOpacity
        style={[styles.navButton, !canGoNext && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!canGoNext}
        activeOpacity={activeOpacity.medium}
      >
        <Text
          variant="buttonSmall"
          color={canGoNext ? theme.color.text.onAction : theme.color.text.disabled}
          style={styles.navButtonText}
        >
          Siguiente
        </Text>
        <Ionicons
          name="chevron-forward"
          size={iconSizes.sm}
          color={canGoNext ? theme.color.icon.inverse : theme.color.icon.disabled}
        />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Full variant
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
    },

    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.action.primary.background,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      minWidth: 110,
    },

    buttonDisabled: {
      backgroundColor: theme.color.action.primary.backgroundDisabled,
    },

    navButtonText: {
      marginHorizontal: theme.space[1],
    },

    centerInfo: {
      alignItems: 'center',
      flex: 1,
      paddingHorizontal: theme.space[2],
    },

    pageBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2],
      borderRadius: theme.radii.sm,
    },

    pageBadgeIcon: {
      marginLeft: theme.space[0.5],
    },

    itemsInfo: {
      marginTop: theme.space[0.5],
    },

    // Modal "ir a página"
    gotoOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },

    gotoDialog: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[5],
      ...theme.shadow.md,
    },

    gotoTitle: {
      marginBottom: theme.space[1],
    },

    gotoSubtitle: {
      marginBottom: theme.space[3],
    },

    gotoInput: {
      width: '100%',
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '700',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      borderWidth: 1,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.base,
      marginBottom: theme.space[4],
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
    },

    gotoActions: {
      flexDirection: 'row',
      gap: theme.space[2],
      justifyContent: 'flex-end',
    },

    gotoButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.md,
      minWidth: 88,
      alignItems: 'center',
      justifyContent: 'center',
    },

    gotoButtonSecondary: {
      backgroundColor: theme.color.surface.subtle,
    },

    gotoButtonPrimary: {
      backgroundColor: theme.color.action.primary.background,
    },

    // Simple variant
    simpleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },

    pageIndicator: {
      alignItems: 'center',
    },

    // Compact variant
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[3],
      paddingVertical: theme.space[2],
    },

    compactButton: {
      padding: theme.space[2],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
    },
  });

export default Pagination;
