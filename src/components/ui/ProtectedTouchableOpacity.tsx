import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedTouchableOpacityProps extends TouchableOpacityProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  hideIfNoPermission?: boolean;
  fallback?: React.ReactNode;
}

/**
 * ProtectedTouchableOpacity - TouchableOpacity con verificación automática de permisos
 *
 * @example
 * ```tsx
 * import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
 * import { PERMISSIONS } from '@/constants/permissions';
 *
 * <ProtectedTouchableOpacity
 *   style={styles.editButton}
 *   onPress={handleEdit}
 *   requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
 *   hideIfNoPermission={true}
 * >
 *   <Text>✏️ Editar</Text>
 * </ProtectedTouchableOpacity>
 * ```
 */
export const ProtectedTouchableOpacity: React.FC<ProtectedTouchableOpacityProps> = ({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  hideIfNoPermission = true,
  fallback = null,
  disabled,
  ...touchableProps
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // Si no hay permisos requeridos, mostrar el componente normalmente
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return (
      <TouchableOpacity disabled={disabled} {...touchableProps}>
        {children}
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
    // Ocultar el componente
    if (hideIfNoPermission) {
      return fallback ? <>{fallback}</> : null;
    }

    // Mostrar el componente deshabilitado
    return (
      <TouchableOpacity disabled={true} {...touchableProps}>
        {children}
      </TouchableOpacity>
    );
  }

  // Tiene acceso, mostrar el componente normalmente
  return (
    <TouchableOpacity disabled={disabled} {...touchableProps}>
      {children}
    </TouchableOpacity>
  );
};

export default ProtectedTouchableOpacity;
