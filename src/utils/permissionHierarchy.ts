/**
 * Jerarquía de Permisos
 *
 * Define qué permisos "padre" incluyen automáticamente permisos "hijo".
 * Por ejemplo, 'expenses.admin' incluye todos los permisos de expenses.
 */

export const PERMISSION_HIERARCHY: Record<string, string[]> = {
  // Gastos Admin incluye todos los permisos de gastos
  'expenses.admin': [
    'expenses.create',
    'expenses.read',
    'expenses.update',
    'expenses.delete',
    'expenses.payments.create',
    'expenses.payments.read',
    'expenses.payments.update',
    'expenses.payments.delete',
    'expenses.payments.approve',
    'expenses.categories.create',
    'expenses.categories.read',
    'expenses.categories.update',
    'expenses.categories.delete',
    'expenses.projects.create',
    'expenses.projects.read',
    'expenses.projects.update',
    'expenses.projects.delete',
    'expenses.projects.close',
    'expenses.templates.create',
    'expenses.templates.read',
    'expenses.templates.update',
    'expenses.templates.delete',
    'expenses.templates.generate',
    'expenses.alerts.create',
    'expenses.alerts.read',
    'expenses.alerts.update',
    'expenses.alerts.delete',
    'expenses.projections.create',
    'expenses.projections.read',
    'expenses.projections.update',
    'expenses.projections.delete',
    'expenses.projections.generate',
    'expenses.reports.view',
  ],

  // Templates Admin incluye permisos de templates
  'expenses.templates.admin': [
    'expenses.templates.create',
    'expenses.templates.read',
    'expenses.templates.update',
    'expenses.templates.delete',
    'expenses.templates.generate',
  ],

  // Apps Manage incluye permisos básicos de apps
  'apps.manage': [
    'apps.create',
    'apps.read',
    'apps.update',
    'apps.delete',
    'apps.scopes.read',
    'apps.users.read',
    'apps.permissions.read',
  ],

  // Scopes Admin incluye todos los permisos de scopes
  'scopes.admin': [
    'scopes.create',
    'scopes.read',
    'scopes.assign',
    'scopes.update',
    'scopes.delete',
    'scopes.revoke',
  ],

  // Files Admin incluye todos los permisos de archivos
  'files.admin': ['files.upload', 'files.read', 'files.delete'],

  // Roles Assign puede incluir lectura de roles
  'roles.assign': ['roles.read'],

  // IAM Assign User Roles puede incluir lectura de usuarios
  'iam.assign_user_roles': ['users.read', 'roles.read'],

  // IAM Assign User Permissions puede incluir lectura de usuarios y permisos
  'iam.assign_user_perms': ['users.read', 'permissions.read'],
};

/**
 * Verifica si un usuario tiene un permiso, considerando la jerarquía
 */
export const hasPermissionWithHierarchy = (
  userPermissions: string[],
  requiredPermission: string
): boolean => {
  // Verificar permiso directo
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Verificar permisos jerárquicos
  for (const [parentPermission, childPermissions] of Object.entries(PERMISSION_HIERARCHY)) {
    if (userPermissions.includes(parentPermission) && childPermissions.includes(requiredPermission)) {
      return true;
    }
  }

  return false;
};

/**
 * Verifica si un usuario tiene al menos uno de los permisos requeridos
 */
export const hasAnyPermissionWithHierarchy = (
  userPermissions: string[],
  requiredPermissions: string[]
): boolean => {
  return requiredPermissions.some((permission) =>
    hasPermissionWithHierarchy(userPermissions, permission)
  );
};

/**
 * Verifica si un usuario tiene todos los permisos requeridos
 */
export const hasAllPermissionsWithHierarchy = (
  userPermissions: string[],
  requiredPermissions: string[]
): boolean => {
  return requiredPermissions.every((permission) =>
    hasPermissionWithHierarchy(userPermissions, permission)
  );
};

/**
 * Obtiene todos los permisos efectivos de un usuario (incluyendo los heredados)
 */
export const getEffectivePermissions = (userPermissions: string[]): string[] => {
  const effectivePermissions = new Set<string>(userPermissions);

  // Agregar permisos heredados
  for (const userPermission of userPermissions) {
    const childPermissions = PERMISSION_HIERARCHY[userPermission];
    if (childPermissions) {
      childPermissions.forEach((childPerm) => effectivePermissions.add(childPerm));
    }
  }

  return Array.from(effectivePermissions);
};
