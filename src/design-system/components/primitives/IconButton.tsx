/**
 * IconButton Component
 *
 * Botón circular con icono.
 */

import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../tokens/colors';
import { spacing, borderRadius, iconSizes, touchTargets } from '../../tokens/spacing';
import { shadows } from '../../tokens/shadows';
import { activeOpacity } from '../../tokens/animations';

export type IconButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
export type IconButtonSize = 'small' | 'medium' | 'large';

export interface IconButtonProps {
  /**
   * Nombre del icono de Ionicons
   */
  icon: keyof typeof Ionicons.glyphMap;

  /**
   * Callback al presionar
   */
  onPress: () => void;

  /**
   * Variante visual
   */
  variant?: IconButtonVariant;

  /**
   * Tamaño del botón
   */
  size?: IconButtonSize;

  /**
   * Si está deshabilitado
   */
  disabled?: boolean;

  /**
   * Si está cargando
   */
  loading?: boolean;

  /**
   * Color del icono (override)
   */
  iconColor?: string;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;

  /**
   * TestID para pruebas
   */
  testID?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'default',
  size = 'medium',
  disabled = false,
  loading = false,
  iconColor,
  style,
  testID,
}) => {
  const isDisabled = disabled || loading;

  const getContainerSize = (): number => {
    switch (size) {
      case 'small':
        return touchTargets.small;
      case 'large':
        return touchTargets.large;
      default:
        return touchTargets.medium;
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes.sm;
      case 'large':
        return iconSizes.xl;
      default:
        return iconSizes.lg;
    }
  };

  const getIconColor = (): string => {
    if (iconColor) return iconColor;
    if (isDisabled) return colors.icon.disabled;

    switch (variant) {
      case 'primary':
        return colors.icon.inverse;
      case 'secondary':
        return colors.icon.primary;
      case 'ghost':
        return colors.icon.secondary;
      case 'danger':
        return colors.danger[600];
      default:
        return colors.icon.primary;
    }
  };

  const containerSize = getContainerSize();

  const containerStyles = [
    styles.base,
    styles[`variant_${variant}`],
    {
      width: containerSize,
      height: containerSize,
      borderRadius: containerSize / 2,
    },
    isDisabled && styles.disabled,
    variant === 'primary' && !isDisabled && shadows.sm,
    style,
  ];

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={activeOpacity.medium}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.icon.inverse : colors.icon.primary}
        />
      ) : (
        <Ionicons
          name={icon}
          size={getIconSize()}
          color={getIconColor()}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabled: {
    opacity: 0.5,
  },

  // ============================================
  // VARIANT STYLES
  // ============================================
  variant_default: {
    backgroundColor: colors.surface.secondary,
  },

  variant_primary: {
    backgroundColor: colors.primary[900],
  },

  variant_secondary: {
    backgroundColor: colors.neutral[100],
  },

  variant_ghost: {
    backgroundColor: 'transparent',
  },

  variant_danger: {
    backgroundColor: colors.danger[50],
  },
});

export default IconButton;
