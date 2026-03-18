import React from 'react';
import { View, ViewProps } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedViewProps extends ViewProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  hideIfNoPermission?: boolean;
  fallback?: React.ReactNode;
}

/**
 * ProtectedView - View con verificación automática de permisos
 * Útil para ocultar secciones completas de la UI
 *
 * @example
 * ```tsx
 * import { ProtectedView } from '@/components/ui/ProtectedView';
 * import { PERMISSIONS } from '@/constants/permissions';
 *
 * // Ocultar sección de reportes
 * <ProtectedView requiredPermissions={[PERMISSIONS.EXPENSES.REPORTS.VIEW]}>
 *   <View style={styles.reportsSection}>
 *     <Text>Reportes</Text>
 *     <ReportsList />
 *   </View>
 * </ProtectedView>
 *
 * // Ocultar múltiples secciones con permisos alternativos
 * <ProtectedView
 *   requiredPermissions={[
 *     PERMISSIONS.PRODUCTS.CREATE,
 *     PERMISSIONS.PRODUCTS.UPDATE
 *   ]}
 *   requireAll={false}
 * >
 *   <ProductActions />
 * </ProtectedView>
 * ```
 */
export const ProtectedView: React.FC<ProtectedViewProps> = ({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  hideIfNoPermission = true,
  fallback = null,
  ...viewProps
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // Si no hay permisos requeridos, mostrar el contenido normalmente
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return <View {...viewProps}>{children}</View>;
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
    // Ocultar el contenido
    if (hideIfNoPermission) {
      return fallback ? <>{fallback}</> : null;
    }

    // Mostrar el contenido con opacidad reducida (deshabilitado visualmente)
    return (
      <View {...viewProps} style={[viewProps.style, { opacity: 0.5 }]} pointerEvents="none">
        {children}
      </View>
    );
  }

  // Tiene acceso, mostrar el contenido normalmente
  return <View {...viewProps}>{children}</View>;
};

export default ProtectedView;
