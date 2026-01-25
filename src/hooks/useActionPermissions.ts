import { usePermissions } from './usePermissions';
import { buildPermission } from '@/constants/permissions';

/**
 * Hook para verificar permisos CRUD de un módulo específico
 *
 * @example
 * ```tsx
 * const { canCreate, canUpdate, canDelete, canManage } = useActionPermissions('products');
 *
 * if (canCreate) {
 *   // Mostrar botón de crear
 * }
 * ```
 */
export const useActionPermissions = (module: string) => {
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canCreate = hasPermission(buildPermission(module, 'create'));
  const canRead = hasPermission(buildPermission(module, 'read'));
  const canUpdate = hasPermission(buildPermission(module, 'update'));
  const canDelete = hasPermission(buildPermission(module, 'delete'));

  // Puede gestionar si tiene al menos uno de los permisos de escritura
  const canManage = hasAnyPermission([
    buildPermission(module, 'create'),
    buildPermission(module, 'update'),
    buildPermission(module, 'delete'),
  ]);

  // Tiene acceso completo si tiene todos los permisos
  const hasFullAccess = canCreate && canRead && canUpdate && canDelete;

  // Solo lectura si solo tiene permiso de lectura
  const isReadOnly = canRead && !canCreate && !canUpdate && !canDelete;

  return {
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canManage,
    hasFullAccess,
    isReadOnly,
  };
};

/**
 * Hook para verificar permisos específicos de un módulo
 *
 * @example
 * ```tsx
 * const { hasPermission: hasPurchasePermission } = useModulePermissions('purchases');
 *
 * if (hasPurchasePermission('close')) {
 *   // Puede cerrar compras
 * }
 * ```
 */
export const useModulePermissions = (module: string) => {
  const { hasPermission: checkPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const hasPermission = (action: string): boolean => {
    return checkPermission(buildPermission(module, action));
  };

  const hasAnyAction = (actions: string[]): boolean => {
    const permissions = actions.map((action) => buildPermission(module, action));
    return hasAnyPermission(permissions);
  };

  const hasAllActions = (actions: string[]): boolean => {
    const permissions = actions.map((action) => buildPermission(module, action));
    return hasAllPermissions(permissions);
  };

  return {
    hasPermission,
    hasAnyAction,
    hasAllActions,
  };
};

export default useActionPermissions;
