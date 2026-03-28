/**
 * Chip Component
 *
 * Chip para filtros y selecciones.
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors } from '../../tokens/colors';
import { spacing, borderRadius, iconSizes } from '../../tokens/spacing';
import { activeOpacity } from '../../tokens/animations';

export type ChipVariant = 'filled' | 'outlined';
export type ChipSize = 'small' | 'medium';

export interface ChipProps {
  /**
   * Texto del chip
   */
  label: string;

  /**
   * Si está seleccionado
   */
  selected?: boolean;

  /**
   * Callback al presionar
   */
  onPress?: () => void;

  /**
   * Callback al cerrar (muestra X)
   */
  onClose?: () => void;

  /**
   * Variante visual
   */
  variant?: ChipVariant;

  /**
   * Tamaño
   */
  size?: ChipSize;

  /**
   * Icono a la izquierda
   */
  icon?: keyof typeof Ionicons.glyphMap;

  /**
   * Si está deshabilitado
   */
  disabled?: boolean;

  /**
   * Color personalizado cuando está seleccionado
   */
  selectedColor?: string;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  onClose,
  variant = 'filled',
  size = 'medium',
  icon,
  disabled = false,
  selectedColor = colors.primary[900],
  style,
}) => {
  const isInteractive = !!onPress && !disabled;

  const containerStyles = [
    styles.base,
    styles[`size_${size}`],
    variant === 'filled' && styles.filled,
    variant === 'outlined' && styles.outlined,
    selected && variant === 'filled' && { backgroundColor: selectedColor },
    selected && variant === 'outlined' && { borderColor: selectedColor },
    disabled && styles.disabled,
    style,
  ];

  const getTextColor = (): string => {
    if (disabled) return colors.text.disabled;
    if (selected) return variant === 'filled' ? colors.text.inverse : selectedColor;
    return colors.text.secondary;
  };

  const getIconColor = (): string => {
    if (disabled) return colors.icon.disabled;
    if (selected) return variant === 'filled' ? colors.icon.inverse : selectedColor;
    return colors.icon.tertiary;
  };

  const getIconSize = (): number => {
    return size === 'small' ? iconSizes.xs : iconSizes.sm;
  };

  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon}
          size={getIconSize()}
          color={getIconColor()}
          style={styles.leftIcon}
        />
      )}
      <Text
        variant={size === 'small' ? 'labelSmall' : 'labelMedium'}
        color={getTextColor()}
        style={size === 'small' ? styles.textSmall : undefined}
      >
        {label}
      </Text>
      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          activeOpacity={activeOpacity.medium}
          disabled={disabled}
        >
          <Ionicons
            name="close"
            size={getIconSize()}
            color={getIconColor()}
          />
        </TouchableOpacity>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <TouchableOpacity
        style={containerStyles}
        onPress={onPress}
        activeOpacity={activeOpacity.medium}
        disabled={disabled}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyles}>{content}</View>;
};

// ============================================
// CHIP GROUP
// ============================================
export interface ChipGroupProps {
  /**
   * Lista de opciones
   */
  options: Array<{ label: string; value: string; icon?: keyof typeof Ionicons.glyphMap }>;

  /**
   * Valores seleccionados
   */
  selected: string[];

  /**
   * Callback al cambiar selección
   */
  onChange: (selected: string[]) => void;

  /**
   * Si permite selección múltiple
   */
  multiple?: boolean;

  /**
   * Variante visual
   */
  variant?: ChipVariant;

  /**
   * Tamaño
   */
  size?: ChipSize;

  /**
   * Estilos del contenedor
   */
  style?: ViewStyle;
}

export const ChipGroup: React.FC<ChipGroupProps> = ({
  options,
  selected,
  onChange,
  multiple = false,
  variant = 'filled',
  size = 'medium',
  style,
}) => {
  const handlePress = (value: string) => {
    if (multiple) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      onChange([value]);
    }
  };

  return (
    <View style={[styles.group, style]}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          icon={option.icon}
          selected={selected.includes(option.value)}
          onPress={() => handlePress(option.value)}
          variant={variant}
          size={size}
          style={styles.groupChip}
        />
      ))}
    </View>
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
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },

  disabled: {
    opacity: 0.5,
  },

  // ============================================
  // SIZE STYLES
  // ============================================
  size_small: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    minHeight: 28,
  },

  size_medium: {
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
    minHeight: 36,
  },

  // ============================================
  // VARIANT STYLES
  // ============================================
  filled: {
    backgroundColor: colors.neutral[100],
  },

  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },

  // ============================================
  // ELEMENT STYLES
  // ============================================
  leftIcon: {
    marginRight: spacing[1],
  },

  closeButton: {
    marginLeft: spacing[1],
    padding: spacing[0.5],
    marginRight: -spacing[1],
  },

  textSmall: {
    textTransform: 'none',
    letterSpacing: 0,
  },

  // ============================================
  // GROUP STYLES
  // ============================================
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },

  groupChip: {
    // Individual chip in group
  },
});

export default Chip;
