/**
 * Badge Component
 *
 * Insignia para mostrar estados, contadores y etiquetas.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors } from '../../tokens/colors';
import { spacing, borderRadius, iconSizes } from '../../tokens/spacing';
import { textVariants } from '../../tokens/typography';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'active'
  | 'pending'
  | 'draft'
  | 'completed'
  | 'cancelled'
  | 'overdue'
  | 'paid'
  | 'partial';

export type BadgeSize = 'small' | 'medium' | 'large';

export interface BadgeProps {
  /**
   * Texto del badge
   */
  label: string;

  /**
   * Variante de color
   */
  variant?: BadgeVariant;

  /**
   * Tamaño del badge
   */
  size?: BadgeSize;

  /**
   * Icono opcional
   */
  icon?: keyof typeof Ionicons.glyphMap;

  /**
   * Si el badge tiene forma de píldora
   */
  pill?: boolean;

  /**
   * Si tiene borde
   */
  outlined?: boolean;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

const getVariantColors = (variant: BadgeVariant, outlined: boolean) => {
  // Status colors from tokens
  const statusMap: Record<string, { background: string; text: string; border: string }> = {
    active: colors.status.active,
    pending: colors.status.pending,
    draft: colors.status.draft,
    completed: colors.status.completed,
    cancelled: colors.status.cancelled,
    overdue: colors.status.overdue,
    paid: colors.status.paid,
    partial: colors.status.partial,
  };

  if (statusMap[variant]) {
    const status = statusMap[variant];
    return {
      backgroundColor: outlined ? 'transparent' : status.background,
      textColor: status.text,
      borderColor: status.border,
    };
  }

  // Semantic colors
  const semanticMap: Record<string, { bg: string; text: string; border: string }> = {
    default: {
      bg: colors.neutral[100],
      text: colors.neutral[700],
      border: colors.neutral[300],
    },
    primary: {
      bg: colors.primary[100],
      text: colors.primary[900],
      border: colors.primary[300],
    },
    success: {
      bg: colors.success[100],
      text: colors.success[800],
      border: colors.success[300],
    },
    warning: {
      bg: colors.warning[100],
      text: colors.warning[800],
      border: colors.warning[300],
    },
    danger: {
      bg: colors.danger[100],
      text: colors.danger[800],
      border: colors.danger[300],
    },
    info: {
      bg: colors.info[100],
      text: colors.info[800],
      border: colors.info[300],
    },
  };

  const semantic = semanticMap[variant] || semanticMap.default;
  return {
    backgroundColor: outlined ? 'transparent' : semantic.bg,
    textColor: semantic.text,
    borderColor: semantic.border,
  };
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'medium',
  icon,
  pill = false,
  outlined = false,
  style,
}) => {
  const variantColors = getVariantColors(variant, outlined);

  const containerStyles = [
    styles.base,
    styles[`size_${size}`],
    {
      backgroundColor: variantColors.backgroundColor,
      borderColor: variantColors.borderColor,
    },
    outlined && styles.outlined,
    pill && styles.pill,
    style,
  ];

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes.xs;
      case 'large':
        return iconSizes.md;
      default:
        return iconSizes.sm;
    }
  };

  return (
    <View style={containerStyles}>
      {icon && (
        <Ionicons
          name={icon}
          size={getIconSize()}
          color={variantColors.textColor}
          style={styles.icon}
        />
      )}
      <Text
        variant={size === 'small' ? 'labelSmall' : size === 'large' ? 'labelLarge' : 'labelMedium'}
        color={variantColors.textColor}
        style={size === 'small' ? styles.textSmall : undefined}
      >
        {label}
      </Text>
    </View>
  );
};

// ============================================
// STATUS BADGE (Preconfigurado para estados)
// ============================================
export interface StatusBadgeProps {
  status: 'active' | 'pending' | 'draft' | 'completed' | 'cancelled' | 'overdue' | 'paid' | 'partial';
  label?: string;
  size?: BadgeSize;
  style?: ViewStyle;
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  draft: 'Borrador',
  completed: 'Completado',
  cancelled: 'Cancelado',
  overdue: 'Vencido',
  paid: 'Pagado',
  partial: 'Parcial',
};

const statusIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  active: 'checkmark-circle',
  pending: 'time',
  draft: 'document-outline',
  completed: 'checkmark-done-circle',
  cancelled: 'close-circle',
  overdue: 'alert-circle',
  paid: 'checkmark-circle',
  partial: 'pie-chart',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'medium',
  style,
}) => {
  return (
    <Badge
      label={label || statusLabels[status]}
      variant={status}
      size={size}
      icon={statusIcons[status]}
      style={style}
    />
  );
};

// ============================================
// COUNTER BADGE (Para notificaciones)
// ============================================
export interface CounterBadgeProps {
  count: number;
  max?: number;
  variant?: 'primary' | 'danger' | 'success';
  style?: ViewStyle;
}

export const CounterBadge: React.FC<CounterBadgeProps> = ({
  count,
  max = 99,
  variant = 'danger',
  style,
}) => {
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <View style={[styles.counterBadge, styles[`counter_${variant}`], style]}>
      <Text variant="labelSmall" color={colors.text.inverse}>
        {displayCount}
      </Text>
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
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },

  outlined: {
    borderWidth: 1.5,
  },

  pill: {
    borderRadius: borderRadius.full,
  },

  icon: {
    marginRight: spacing[1],
  },

  // ============================================
  // SIZE STYLES
  // ============================================
  size_small: {
    paddingVertical: spacing[0.5],
    paddingHorizontal: spacing[1.5],
  },

  size_medium: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },

  size_large: {
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
  },

  textSmall: {
    textTransform: 'none',
    letterSpacing: 0,
  },

  // ============================================
  // COUNTER BADGE STYLES
  // ============================================
  counterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[1.5],
  },

  counter_primary: {
    backgroundColor: colors.primary[900],
  },

  counter_danger: {
    backgroundColor: colors.danger[600],
  },

  counter_success: {
    backgroundColor: colors.success[600],
  },
});

export default Badge;
