import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';
import { buildPermission } from '@/constants/permissions';

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

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minHeight: 36,
  },
  primary: {
    backgroundColor: '#4F46E5',
  },
  secondary: {
    backgroundColor: '#6B7280',
  },
  danger: {
    backgroundColor: '#DC2626',
  },
  success: {
    backgroundColor: '#10B981',
  },
  warning: {
    backgroundColor: '#F59E0B',
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 16,
    marginRight: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  label_primary: {
    color: '#FFFFFF',
  },
  label_secondary: {
    color: '#FFFFFF',
  },
  label_danger: {
    color: '#FFFFFF',
  },
  label_success: {
    color: '#FFFFFF',
  },
  label_warning: {
    color: '#FFFFFF',
  },
});

export default ProtectedActionButton;
