/**
 * Theme - Legacy Compatibility Layer
 *
 * Este archivo mantiene compatibilidad con el código existente
 * mientras se migra al nuevo Design System.
 *
 * Para nuevos componentes, usar: import { colors, spacing, ... } from '@/design-system';
 */

import { colors as legacyColors } from '@/theme/colors';
import { spacing as legacySpacing, borderRadius as legacyBorderRadius, fontSize } from '@/theme/spacing';

// Re-export desde el nuevo Design System para compatibilidad
import {
  colors as dsColors,
  spacing as dsSpacing,
  borderRadius as dsBorderRadius,
  shadows as dsShadows,
  fontWeights,
} from '@/design-system/tokens';

// Mapeo de colores legacy a nuevo sistema
const mappedColors = {
  ...legacyColors,
  // Agregar colores del nuevo sistema
  primary: dsColors.primary[900],
  primaryLight: dsColors.primary[100],
  primaryDark: dsColors.primary[950],
  secondary: dsColors.accent[500],
  secondaryLight: dsColors.accent[200],
  secondaryDark: dsColors.accent[700],
  background: dsColors.background.primary,
  surface: dsColors.surface.primary,
  error: dsColors.danger[500],
  success: dsColors.success[500],
  warning: dsColors.warning[500],
  text: {
    primary: dsColors.text.primary,
    secondary: dsColors.text.secondary,
    disabled: dsColors.text.disabled,
    hint: dsColors.text.placeholder,
    white: dsColors.text.inverse,
  },
  border: {
    light: dsColors.border.light,
    medium: dsColors.border.default,
    dark: dsColors.border.dark,
  },
};

export const theme = {
  colors: mappedColors,
  spacing: legacySpacing,
  borderRadius: legacyBorderRadius,
  fontSize,
  fonts: {
    bold: 'System',
    semibold: 'System',
    medium: 'System',
  },
  shadows: {
    sm: dsShadows.sm,
    md: dsShadows.md,
    lg: dsShadows.lg,
  },
} as const;

export type Theme = typeof theme;

export default theme;
