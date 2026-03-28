/**
 * Button Component
 *
 * Botón moderno con múltiples variantes y estados.
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../tokens/colors';
import { textVariants } from '../../tokens/typography';
import { spacing, borderRadius, touchTargets, iconSizes } from '../../tokens/spacing';
import { shadows } from '../../tokens/shadows';
import { activeOpacity } from '../../tokens/animations';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  /**
   * Texto del botón
   */
  title: string;

  /**
   * Callback al presionar
   */
  onPress: () => void;

  /**
   * Variante visual del botón
   */
  variant?: ButtonVariant;

  /**
   * Tamaño del botón
   */
  size?: ButtonSize;

  /**
   * Si el botón está deshabilitado
   */
  disabled?: boolean;

  /**
   * Si muestra estado de carga
   */
  loading?: boolean;

  /**
   * Si ocupa todo el ancho disponible
   */
  fullWidth?: boolean;

  /**
   * Icono a la izquierda (nombre de Ionicons)
   */
  leftIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Icono a la derecha (nombre de Ionicons)
   */
  rightIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Estilos adicionales del contenedor
   */
  style?: ViewStyle;

  /**
   * Estilos adicionales del texto
   */
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const containerStyles = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    variant === 'primary' && !isDisabled && shadows.sm,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    isDisabled && styles.textDisabled,
    textStyle,
  ];

  const getIconColor = (): string => {
    if (isDisabled) return colors.text.disabled;

    switch (variant) {
      case 'primary':
        return colors.text.inverse;
      case 'secondary':
        return colors.text.primary;
      case 'outline':
      case 'ghost':
        return colors.text.primary;
      case 'danger':
        return colors.text.inverse;
      case 'success':
        return colors.text.inverse;
      default:
        return colors.text.primary;
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes.sm;
      case 'large':
        return iconSizes.lg;
      default:
        return iconSizes.md;
    }
  };

  const getLoaderColor = (): string => {
    switch (variant) {
      case 'primary':
      case 'danger':
      case 'success':
        return colors.text.inverse;
      default:
        return colors.text.primary;
    }
  };

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={activeOpacity.medium}
    >
      {loading ? (
        <ActivityIndicator color={getLoaderColor()} size="small" />
      ) : (
        <View style={styles.content}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={getIconSize()}
              color={getIconColor()}
              style={styles.leftIcon}
            />
          )}
          <Text style={textStyles}>{title}</Text>
          {rightIcon && (
            <Ionicons
              name={rightIcon}
              size={getIconSize()}
              color={getIconColor()}
              style={styles.rightIcon}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // ============================================
  // BASE STYLES
  // ============================================
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fullWidth: {
    width: '100%',
  },

  disabled: {
    opacity: 0.5,
  },

  // ============================================
  // VARIANT STYLES
  // ============================================
  variant_primary: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },

  variant_secondary: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.neutral[200],
  },

  variant_outline: {
    backgroundColor: 'transparent',
    borderColor: colors.primary[900],
  },

  variant_ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },

  variant_danger: {
    backgroundColor: colors.danger[600],
    borderColor: colors.danger[600],
  },

  variant_success: {
    backgroundColor: colors.success[600],
    borderColor: colors.success[600],
  },

  // ============================================
  // SIZE STYLES
  // ============================================
  size_small: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    minHeight: touchTargets.small,
    borderRadius: borderRadius.sm,
  },

  size_medium: {
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    minHeight: touchTargets.medium,
  },

  size_large: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    minHeight: touchTargets.large,
    borderRadius: borderRadius.lg,
  },

  // ============================================
  // TEXT STYLES
  // ============================================
  text: {
    ...textVariants.buttonMedium,
  },

  text_primary: {
    color: colors.text.inverse,
  },

  text_secondary: {
    color: colors.text.primary,
  },

  text_outline: {
    color: colors.text.primary,
  },

  text_ghost: {
    color: colors.text.primary,
  },

  text_danger: {
    color: colors.text.inverse,
  },

  text_success: {
    color: colors.text.inverse,
  },

  text_small: {
    ...textVariants.buttonSmall,
  },

  text_medium: {
    ...textVariants.buttonMedium,
  },

  text_large: {
    ...textVariants.buttonLarge,
  },

  textDisabled: {
    color: colors.text.disabled,
  },

  // ============================================
  // ICON STYLES
  // ============================================
  leftIcon: {
    marginRight: spacing[2],
  },

  rightIcon: {
    marginLeft: spacing[2],
  },
});

export default Button;
