/**
 * ScreenHeader Component
 *
 * Header unificado para todas las pantallas.
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Title } from '../primitives/Text';
import { IconButton } from '../primitives/IconButton';
import { colors } from '../../tokens/colors';
import { spacing, iconSizes, zIndex } from '../../tokens/spacing';
import { shadows } from '../../tokens/shadows';
import { activeOpacity } from '../../tokens/animations';

export interface ScreenHeaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  badge?: number;
}

export interface ScreenHeaderProps {
  /**
   * Título principal
   */
  title: string;

  /**
   * Subtítulo opcional
   */
  subtitle?: string;

  /**
   * Callback para botón de retroceso
   */
  onBack?: () => void;

  /**
   * Callback para menú hamburguesa
   */
  onMenu?: () => void;

  /**
   * Acciones en la derecha
   */
  actions?: ScreenHeaderAction[];

  /**
   * Si el header es transparente
   */
  transparent?: boolean;

  /**
   * Si tiene sombra
   */
  elevated?: boolean;

  /**
   * Contenido personalizado a la derecha
   */
  rightContent?: React.ReactNode;

  /**
   * Si el título está centrado
   */
  centerTitle?: boolean;

  /**
   * Color de fondo personalizado
   */
  backgroundColor?: string;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  onMenu,
  actions = [],
  transparent = false,
  elevated = true,
  rightContent,
  centerTitle = false,
  backgroundColor,
  style,
}) => {
  const insets = useSafeAreaInsets();

  const containerStyles = [
    styles.container,
    {
      paddingTop: insets.top,
      backgroundColor: transparent
        ? 'transparent'
        : backgroundColor || colors.surface.primary,
    },
    elevated && !transparent && shadows.xs,
    style,
  ];

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={transparent ? 'transparent' : colors.surface.primary}
        translucent={transparent}
      />
      <View style={containerStyles}>
        <View style={styles.content}>
          {/* Left Section */}
          <View style={styles.leftSection}>
            {onBack && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={onBack}
                activeOpacity={activeOpacity.medium}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="chevron-back"
                  size={iconSizes.lg}
                  color={colors.icon.primary}
                />
              </TouchableOpacity>
            )}
            {onMenu && !onBack && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={onMenu}
                activeOpacity={activeOpacity.medium}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="menu"
                  size={iconSizes.lg}
                  color={colors.icon.primary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Title Section */}
          <View style={[styles.titleSection, centerTitle && styles.titleCentered]}>
            <Title size="large" numberOfLines={1}>
              {title}
            </Title>
            {subtitle && (
              <Text
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={styles.subtitle}
              >
                {subtitle}
              </Text>
            )}
          </View>

          {/* Right Section */}
          <View style={styles.rightSection}>
            {rightContent}
            {actions.map((action, index) => (
              <View key={index} style={styles.actionContainer}>
                <IconButton
                  icon={action.icon}
                  onPress={action.onPress}
                  disabled={action.disabled}
                  variant="ghost"
                  size="medium"
                />
                {action.badge !== undefined && action.badge > 0 && (
                  <View style={styles.badge}>
                    <Text variant="labelSmall" color={colors.text.inverse}>
                      {action.badge > 99 ? '99+' : action.badge}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    </>
  );
};

// ============================================
// LARGE HEADER (Para Dashboard, Home, etc.)
// ============================================
export interface LargeHeaderProps {
  title: string;
  subtitle?: string;
  onMenu?: () => void;
  actions?: ScreenHeaderAction[];
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const LargeHeader: React.FC<LargeHeaderProps> = ({
  title,
  subtitle,
  onMenu,
  actions = [],
  children,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.largeContainer,
        { paddingTop: insets.top },
        style,
      ]}
    >
      <View style={styles.largeTopRow}>
        {onMenu && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={onMenu}
            activeOpacity={activeOpacity.medium}
          >
            <Ionicons
              name="menu"
              size={iconSizes.lg}
              color={colors.icon.primary}
            />
          </TouchableOpacity>
        )}
        <View style={styles.largeActions}>
          {actions.map((action, index) => (
            <IconButton
              key={index}
              icon={action.icon}
              onPress={action.onPress}
              disabled={action.disabled}
              variant="ghost"
              size="medium"
            />
          ))}
        </View>
      </View>

      {/* Title Section */}
      <View style={styles.largeTitleSection}>
        <Text variant="displaySmall" color="primary">
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodyMedium" color="secondary" style={styles.largeSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  // ============================================
  // STANDARD HEADER
  // ============================================
  container: {
    backgroundColor: colors.surface.primary,
    zIndex: zIndex.base, // Bajo para que FAB quede por encima
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing[2],
  },

  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 48,
  },

  backButton: {
    padding: spacing[2],
    marginLeft: -spacing[2],
  },

  menuButton: {
    padding: spacing[2],
    marginLeft: -spacing[2],
  },

  titleSection: {
    flex: 1,
    paddingHorizontal: spacing[2],
  },

  titleCentered: {
    alignItems: 'center',
  },

  subtitle: {
    marginTop: spacing[0.5],
  },

  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 48,
    justifyContent: 'flex-end',
  },

  actionContainer: {
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.danger[600],
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
  },

  // ============================================
  // LARGE HEADER
  // ============================================
  largeContainer: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },

  largeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginBottom: spacing[2],
  },

  largeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },

  largeTitleSection: {
    marginBottom: spacing[2],
  },

  largeSubtitle: {
    marginTop: spacing[1],
  },
});

export default ScreenHeader;
