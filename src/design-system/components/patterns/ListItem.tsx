/**
 * ListItem Component
 *
 * Item de lista estándar con múltiples configuraciones.
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
import { Avatar } from '../primitives/Avatar';
import { Badge, StatusBadge } from '../primitives/Badge';
import { Divider } from '../primitives/Divider';
import { colors } from '../../tokens/colors';
import { spacing, borderRadius, iconSizes } from '../../tokens/spacing';
import { activeOpacity } from '../../tokens/animations';

export interface ListItemProps {
  /**
   * Título principal
   */
  title: string;

  /**
   * Subtítulo/descripción
   */
  subtitle?: string;

  /**
   * Texto terciario (metadata)
   */
  caption?: string;

  /**
   * Icono a la izquierda
   */
  leftIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Avatar a la izquierda
   */
  avatar?: { source?: string; name?: string };

  /**
   * Contenido personalizado a la izquierda
   */
  leftContent?: React.ReactNode;

  /**
   * Contenido a la derecha
   */
  rightContent?: React.ReactNode;

  /**
   * Valor a mostrar a la derecha
   */
  rightValue?: string;

  /**
   * Badge a la derecha
   */
  badge?: { label: string; variant?: 'default' | 'success' | 'warning' | 'danger' };

  /**
   * Status badge a la derecha
   */
  status?: 'active' | 'pending' | 'draft' | 'completed' | 'cancelled' | 'overdue' | 'paid' | 'partial';

  /**
   * Si muestra flecha a la derecha
   */
  showChevron?: boolean;

  /**
   * Callback al presionar
   */
  onPress?: () => void;

  /**
   * Si está deshabilitado
   */
  disabled?: boolean;

  /**
   * Si muestra divider abajo
   */
  showDivider?: boolean;

  /**
   * Variante de padding
   */
  padding?: 'compact' | 'normal' | 'comfortable';

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;

  /**
   * TestID
   */
  testID?: string;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  caption,
  leftIcon,
  avatar,
  leftContent,
  rightContent,
  rightValue,
  badge,
  status,
  showChevron = false,
  onPress,
  disabled = false,
  showDivider = false,
  padding = 'normal',
  style,
  testID,
}) => {
  const hasLeftContent = leftIcon || avatar || leftContent;

  const containerStyles = [
    styles.container,
    styles[`padding_${padding}`],
    disabled && styles.disabled,
    style,
  ];

  const content = (
    <>
      {/* Left Section */}
      {hasLeftContent && (
        <View style={styles.leftSection}>
          {leftContent ? (
            leftContent
          ) : avatar ? (
            <Avatar source={avatar.source} name={avatar.name} size="medium" />
          ) : leftIcon ? (
            <View style={styles.iconContainer}>
              <Ionicons name={leftIcon} size={iconSizes.lg} color={colors.icon.secondary} />
            </View>
          ) : null}
        </View>
      )}

      {/* Content Section */}
      <View style={styles.contentSection}>
        <Text variant="titleSmall" color="primary" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" color="secondary" numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
        {caption && (
          <Text variant="caption" color="tertiary" numberOfLines={1} style={styles.caption}>
            {caption}
          </Text>
        )}
      </View>

      {/* Right Section */}
      <View style={styles.rightSection}>
        {rightContent ? (
          rightContent
        ) : (
          <>
            {rightValue && (
              <Text variant="bodyMedium" color="primary" style={styles.rightValue}>
                {rightValue}
              </Text>
            )}
            {badge && (
              <Badge label={badge.label} variant={badge.variant || 'default'} size="small" />
            )}
            {status && <StatusBadge status={status} size="small" />}
          </>
        )}
        {showChevron && (
          <Ionicons
            name="chevron-forward"
            size={iconSizes.md}
            color={colors.icon.tertiary}
            style={styles.chevron}
          />
        )}
      </View>
    </>
  );

  if (onPress) {
    return (
      <>
        <TouchableOpacity
          style={containerStyles}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={activeOpacity.medium}
          testID={testID}
        >
          {content}
        </TouchableOpacity>
        {showDivider && <Divider variant="inset" spacing="none" />}
      </>
    );
  }

  return (
    <>
      <View style={containerStyles} testID={testID}>
        {content}
      </View>
      {showDivider && <Divider variant="inset" spacing="none" />}
    </>
  );
};

// ============================================
// LIST SECTION HEADER
// ============================================
export interface ListSectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export const ListSectionHeader: React.FC<ListSectionHeaderProps> = ({
  title,
  action,
  style,
}) => {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text variant="labelMedium" color="tertiary">
        {title}
      </Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} activeOpacity={activeOpacity.medium}>
          <Text variant="labelMedium" color={colors.accent[600]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
  },

  disabled: {
    opacity: 0.5,
  },

  // Padding variants
  padding_compact: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },

  padding_normal: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },

  padding_comfortable: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },

  // Sections
  leftSection: {
    marginRight: spacing[3],
  },

  contentSection: {
    flex: 1,
    justifyContent: 'center',
  },

  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing[2],
  },

  // Elements
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },

  subtitle: {
    marginTop: spacing[0.5],
  },

  caption: {
    marginTop: spacing[0.5],
  },

  rightValue: {
    marginRight: spacing[2],
  },

  chevron: {
    marginLeft: spacing[1],
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.background.secondary,
  },
});

export default ListItem;
