import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';
import { buildPermission } from '@/constants/permissions';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

type ActionType = 'create' | 'read' | 'update' | 'delete' | 'custom';
type VariantType = 'primary' | 'secondary' | 'danger' | 'success' | 'warning';

interface ProtectedActionButtonProps {
  action: ActionType;
  module: string;
  customPermission?: string;
  onPress: () => void;
  icon?: string;
  label?: string;
  variant?: VariantType;
  hideIfNoPermission?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fallback?: React.ReactNode;
}

/**
 * ProtectedActionButton - Botón de acción con mapeo automático de permisos
 *
 * Este componente mapea automáticamente acciones CRUD a permisos del módulo.
 *
 * @example
 * ```tsx
 * import { ProtectedActionButton } from '@/components/ui/ProtectedActionButton';
 *
 * // Automáticamente verifica 'products.create'
 * <ProtectedActionButton
 *   action="create"
 *   module="products"
 *   onPress={handleCreate}
 *   icon="+"
 *   label="Nuevo"
 *   variant="primary"
 * />
 *
 * // Automáticamente verifica 'products.update'
 * <ProtectedActionButton
 *   action="update"
 *   module="products"
 *   onPress={handleEdit}
 *   icon="✏️"
 *   variant="secondary"
 * />
 *
 * // Automáticamente verifica 'products.delete'
 * <ProtectedActionButton
 *   action="delete"
 *   module="products"
 *   onPress={handleDelete}
 *   icon="🗑️"
 *   variant="danger"
 * />
 *
 * // Permiso personalizado
 * <ProtectedActionButton
 *   action="custom"
 *   module="purchases"
 *   customPermission="purchases.close"
 *   onPress={handleClose}
 *   label="Cerrar"
 *   variant="primary"
 * />
 * ```
 */
export const ProtectedActionButton: React.FC<ProtectedActionButtonProps> = ({
  action,
  module,
  customPermission,
  onPress,
  icon,
  label,
  variant = 'primary',
  hideIfNoPermission = true,
  disabled = false,
  style,
  textStyle,
  fallback = null,
}) => {
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();

  // Determinar el permiso requerido
  const requiredPermission =
    action === 'custom' && customPermission
      ? customPermission
      : buildPermission(module, action);

  // Verificar permiso
  const hasAccess = hasPermission(requiredPermission);

  // Si no tiene acceso
  if (!hasAccess) {
    if (hideIfNoPermission) {
      return fallback ? <>{fallback}</> : null;
    }

    // Mostrar deshabilitado
    return (
      <TouchableOpacity
        style={[styles.button, styles[variant], styles.disabled, style]}
        disabled={true}
        activeOpacity={0.7}
      >
        {icon && <Text style={[styles.icon, textStyle]}>{icon}</Text>}
        {label && <Text style={[styles.label, styles[`label_${variant}`], textStyle]}>{label}</Text>}
      </TouchableOpacity>
    );
  }

  // Tiene acceso
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant], disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon && <Text style={[styles.icon, textStyle]}>{icon}</Text>}
      {label && <Text style={[styles.label, styles[`label_${variant}`], textStyle]}>{label}</Text>}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radii.md,
    minHeight: 36,
  },
  primary: {
    backgroundColor: theme.color.action.primary.background,
  },
  secondary: {
    backgroundColor: theme.color.action.secondary.background,
  },
  danger: {
    backgroundColor: theme.color.action.danger.background,
  },
  success: {
    backgroundColor: theme.color.action.success.background,
  },
  warning: {
    backgroundColor: theme.color.state.warning.border,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 16,
    marginRight: theme.space[1],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  label_primary: {
    color: theme.color.action.primary.text,
  },
  label_secondary: {
    color: theme.color.action.secondary.text,
  },
  label_danger: {
    color: theme.color.action.danger.text,
  },
  label_success: {
    color: theme.color.action.success.text,
  },
  label_warning: {
    color: theme.color.text.inverse,
  },
});

export default ProtectedActionButton;
