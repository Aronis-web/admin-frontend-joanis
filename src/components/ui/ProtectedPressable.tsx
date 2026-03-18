import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedPressableProps extends PressableProps {
  children: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  hideIfNoPermission?: boolean;
  fallback?: React.ReactNode;
}

/**
 * ProtectedPressable - Pressable con verificación automática de permisos
 *
 * @example
 * ```tsx
 * import { ProtectedPressable } from '@/components/ui/ProtectedPressable';
 * import { PERMISSIONS } from '@/constants/permissions';
 *
 * <ProtectedPressable
 *   style={styles.menuItem}
 *   onPress={handleEdit}
 *   requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
 *   hideIfNoPermission={true}
 * >
 *   {({ pressed }) => (
 *     <View style={[styles.item, pressed && styles.itemPressed]}>
 *       <Text>Editar</Text>
 *     </View>
 *   )}
 * </ProtectedPressable>
 * ```
 */
export const ProtectedPressable: React.FC<ProtectedPressableProps> = ({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  hideIfNoPermission = true,
  fallback = null,
  disabled,
  ...pressableProps
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // Si no hay permisos requeridos, mostrar el componente normalmente
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return (
      <Pressable disabled={disabled} {...pressableProps}>
        {children}
      </Pressable>
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
      <Pressable disabled={true} {...pressableProps}>
        {children}
      </Pressable>
    );
  }

  // Tiene acceso, mostrar el componente normalmente
  return (
    <Pressable disabled={disabled} {...pressableProps}>
      {children}
    </Pressable>
  );
};

export default ProtectedPressable;
