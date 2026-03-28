import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { useAuthStore } from '@/store/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  fallback,
  loadingComponent,
}) => {
  const {
    isAuthenticated,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
  } = useAuthStore();

  // Check authentication first
  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.deniedTitle}>🔒 Autenticación Requerida</Text>
        <Text style={styles.deniedMessage}>Debes iniciar sesión para acceder a esta sección.</Text>
      </View>
    );
  }

  // While loading authentication state
  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Verificando permisos...</Text>
      </View>
    );
  }

  // If no specific permissions or roles required, allow access
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return <>{children}</>;
  }

  // Check permissions
  let hasPermissionAccess = true;
  if (requiredPermissions.length > 0) {
    hasPermissionAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
  }

  // Check roles
  let hasRoleAccess = true;
  if (requiredRoles.length > 0) {
    hasRoleAccess = hasAnyRole(requiredRoles);
  }

  // User must have both permission and role access if both are specified
  const hasAccess = hasPermissionAccess && hasRoleAccess;

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.deniedTitle}>⚠️ Acceso Restringido</Text>
        <Text style={styles.deniedMessage}>
          No tienes los permisos necesarios para acceder a esta sección.
        </Text>
        <Text style={styles.deniedHint}>
          {requiredPermissions.length > 0 && requiredRoles.length > 0
            ? `Permisos requeridos: ${requiredPermissions.join(', ')} | Roles requeridos: ${requiredRoles.join(', ')}`
            : requiredPermissions.length > 0
              ? `Permisos requeridos: ${requiredPermissions.join(', ')}`
              : requiredRoles.length > 0
                ? `Roles requeridos: ${requiredRoles.join(', ')}`
                : 'Se requieren permisos adicionales'}
        </Text>
      </View>
    );
  }

  return <>{children}</>;
};

// Componente para proteger elementos individuales (botones, enlaces, etc.)
interface ProtectedElementProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export const ProtectedElement: React.FC<ProtectedElementProps> = ({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  fallback = null,
}) => {
  const {
    isAuthenticated,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    user,
  } = useAuthStore();

  // If not authenticated or loading, don't show anything
  if (!isAuthenticated || isLoading) {
    return null;
  }

  // If no permissions or roles required, show the element
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return <>{children}</>;
  }

  // Check permissions
  let hasPermissionAccess = true;
  if (requiredPermissions.length > 0) {
    hasPermissionAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
  }

  // Check roles
  let hasRoleAccess = true;
  if (requiredRoles.length > 0) {
    hasRoleAccess = hasAnyRole(requiredRoles);
  }

  // User must have both permission and role access if both are specified
  const hasAccess = hasPermissionAccess && hasRoleAccess;

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

// Componente para mostrar contenido basado en permisos
interface ConditionalRenderProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  renderIfNoPermission?: React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  renderIfNoPermission = null,
}) => {
  const {
    isAuthenticated,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
  } = useAuthStore();

  if (!isAuthenticated || isLoading) {
    return null;
  }

  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return <>{children}</>;
  }

  // Check permissions
  let hasPermissionAccess = true;
  if (requiredPermissions.length > 0) {
    hasPermissionAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
  }

  // Check roles
  let hasRoleAccess = true;
  if (requiredRoles.length > 0) {
    hasRoleAccess = hasAnyRole(requiredRoles);
  }

  // User must have both permission and role access if both are specified
  const hasAccess = hasPermissionAccess && hasRoleAccess;

  return hasAccess ? <>{children}</> : <>{renderIfNoPermission}</>;
};

// Hook simplificado para verificar permisos específicos comúnmente usados
export const useCommonPermissions = () => {
  const { hasPermission, hasAnyPermission, hasRole, hasAnyRole } = useAuthStore();

  const canManageUsers =
    hasPermission('users.create') || hasPermission('users.update') || hasPermission('users.delete');
  const canManageRoles =
    hasPermission('roles.create') || hasPermission('roles.update') || hasPermission('roles.delete');
  const canManageProducts =
    hasPermission('products.create') ||
    hasPermission('products.update') ||
    hasPermission('products.delete');
  const canManageInventory = hasPermission('inventory.read') || hasPermission('inventory.update');
  const canViewReports = hasPermission('reports.read');
  const canManageFiles =
    hasPermission('files.public.upload') || hasPermission('files.private.upload');

  // Combine role-based and permission-based checks
  const isAdmin =
    hasRole('SUPERADMIN') ||
    hasAnyPermission(['roles.create', 'roles.delete', 'iam.assign_user_roles']);
  const isManager =
    hasRole('MANAGER') || hasAnyPermission(['users.create', 'users.update', 'roles.assign']);
  const isOperator = hasRole('OPERATOR') || hasAnyPermission(['products.read', 'inventory.read']);

  return {
    canManageUsers,
    canManageRoles,
    canManageProducts,
    canManageInventory,
    canViewReports,
    canManageFiles,
    isAdmin,
    isManager,
    isOperator,
  };
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  deniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.danger[500],
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  deniedMessage: {
    fontSize: 16,
    color: colors.neutral[700],
    textAlign: 'center',
    marginBottom: spacing[2],
    lineHeight: 24,
  },
  deniedHint: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ProtectedRoute;
