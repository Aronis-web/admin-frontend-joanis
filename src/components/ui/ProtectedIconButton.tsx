import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, Text, ViewStyle, TextStyle } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedIconButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  icon: string;
  label?: string;
  onPress: () => void;
  style?: ViewStyle;
  iconStyle?: TextStyle;
  labelStyle?: TextStyle;

  // Permission props
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  hideIfNoPermission?: boolean;
  fallback?: React.ReactNode;
}

/**
 * ProtectedIconButton - Botón de icono con verificación automática de permisos
 *
 * @example
 * ```tsx
 * import { ProtectedIconButton } from '@/components/ui/ProtectedIconButton';
 * import { PERMISSIONS } from '@/constants/permissions';
 *
 * // Botón de editar
 * <ProtectedIconButton
 *   icon="✏️"
 *   onPress={handleEdit}
 *   requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
 *   hideIfNoPermission={true}
 * />
 *
 * // Botón de eliminar con label
 * <ProtectedIconButton
 *   icon="🗑️"
 *   label="Eliminar"
 *   onPress={handleDelete}
 *   requiredPermissions={[PERMISSIONS.PRODUCTS.DELETE]}
 *   hideIfNoPermission={true}
 * />
 * ```
 */
export const ProtectedIconButton: React.FC<ProtectedIconButtonProps> = ({
  icon,
  label,
  onPress,
  style,
  iconStyle,
  labelStyle,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  hideIfNoPermission = true,
  fallback = null,
  disabled,
  ...touchableProps
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // Si no hay permisos requeridos, mostrar el botón normalmente
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={style}
        {...touchableProps}
      >
        <Text style={iconStyle}>{icon}</Text>
        {label && <Text style={labelStyle}>{label}</Text>}
      </TouchableOpacity>
    );
  }

  // Verificar permisos
  let hasPermissionAccess = true;
  if (requiredPermissions.length > 0) {
    hasPermissionAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
  }

  // TODO: Implementar verificación de roles cuando esté disponible
  const hasAccess = hasPermissionAccess;

  // Si no tiene acceso
  if (!hasAccess) {
    // Ocultar el botón
    if (hideIfNoPermission) {
      return fallback ? <>{fallback}</> : null;
    }

    // Mostrar el botón deshabilitado
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={true}
        style={[style, { opacity: 0.5 }]}
        {...touchableProps}
      >
        <Text style={iconStyle}>{icon}</Text>
        {label && <Text style={labelStyle}>{label}</Text>}
      </TouchableOpacity>
    );
  }

  // Tiene acceso, mostrar el botón normalmente
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={style}
      {...touchableProps}
    >
      <Text style={iconStyle}>{icon}</Text>
      {label && <Text style={labelStyle}>{label}</Text>}
    </TouchableOpacity>
  );
};

export default ProtectedIconButton;
