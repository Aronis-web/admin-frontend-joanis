/**
 * Card Component
 *
 * Contenedor con sombra y bordes redondeados.
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../tokens/colors';
import { spacing, borderRadius } from '../../tokens/spacing';
import { shadows } from '../../tokens/shadows';
import { activeOpacity } from '../../tokens/animations';

export type CardVariant = 'elevated' | 'outlined' | 'filled';
export type CardPadding = 'none' | 'small' | 'medium' | 'large';

export interface CardProps {
  /**
   * Contenido del card
   */
  children: React.ReactNode;

  /**
   * Variante visual
   */
  variant?: CardVariant;

  /**
   * Padding interno
   */
  padding?: CardPadding;

  /**
   * Si el card es presionable
   */
  onPress?: () => void;

  /**
   * Si el card está deshabilitado
   */
  disabled?: boolean;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;

  /**
   * TestID para pruebas
   */
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'medium',
  onPress,
  disabled = false,
  style,
  testID,
}) => {
  const containerStyles = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`padding_${padding}`],
    disabled && styles.disabled,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyles}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={activeOpacity.medium}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyles} testID={testID}>
      {children}
    </View>
  );
};

// ============================================
// CARD SUB-COMPONENTS
// ============================================

export interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, style }) => (
  <View style={[styles.header, style]}>{children}</View>
);

export interface CardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardContent: React.FC<CardContentProps> = ({ children, style }) => (
  <View style={[styles.content, style]}>{children}</View>
);

export interface CardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, style }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

export interface CardDividerProps {
  style?: ViewStyle;
}

export const CardDivider: React.FC<CardDividerProps> = ({ style }) => (
  <View style={[styles.divider, style]} />
);

const styles = StyleSheet.create({
  // ============================================
  // BASE STYLES
  // ============================================
  base: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    overflow: 'hidden',
  },

  disabled: {
    opacity: 0.6,
  },

  // ============================================
  // VARIANT STYLES
  // ============================================
  variant_elevated: {
    backgroundColor: colors.surface.elevated,
    ...shadows.sm,
  },

  variant_outlined: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  variant_filled: {
    backgroundColor: colors.surface.secondary,
  },

  // ============================================
  // PADDING STYLES
  // ============================================
  padding_none: {
    padding: 0,
  },

  padding_small: {
    padding: spacing[3],
  },

  padding_medium: {
    padding: spacing[4],
  },

  padding_large: {
    padding: spacing[5],
  },

  // ============================================
  // SUB-COMPONENT STYLES
  // ============================================
  header: {
    marginBottom: spacing[3],
  },

  content: {
    // Flexible content area
  },

  footer: {
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },

  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing[3],
    marginHorizontal: -spacing[4],
  },
});

export default Card;
