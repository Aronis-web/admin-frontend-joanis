import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { userPermissionsApi } from '@/services/api/roles';

export const usePermissions = () => {
  const { user, clearInvalidAuth } = useAuthStore();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id && user.id !== 'temp-id') {
      // Check if user already has permissions from login response
      if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
        setPermissions(user.permissions);
        setLoading(false);
        setError(null);
      } else {
        // Load permissions from API if not available
        loadUserPermissions();
      }
    } else {
      setPermissions([]);
      setLoading(false);

      if (user?.id === 'temp-id') {
        // Clear invalid auth data and show error
        setError('ID de usuario inválido. Por favor inicia sesión nuevamente.');
        clearInvalidAuth();
      } else {
        setError(user?.id ? 'ID de usuario inválido' : 'Usuario no autenticado');
      }
    }
  }, [user?.id, user?.permissions?.length, clearInvalidAuth]); // Only trigger when permissions length changes

  const loadUserPermissions = async () => {
    if (!user?.id || user.id === 'temp-id') {
      setError('ID de usuario inválido para cargar permisos');
      setPermissions([]);
      setLoading(false);
      clearInvalidAuth();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userPerms = await userPermissionsApi.getUserEffectivePermissions(user.id);

      // Double-check that we have a valid array
      if (!Array.isArray(userPerms)) {
        setError('Respuesta de permisos inválida del servidor');
        setPermissions([]);
        return;
      }

      setPermissions(userPerms);
    } catch (err: any) {
      // Handle specific error cases
      if (
        err.message?.includes('invalid input syntax for type uuid') ||
        err.message?.includes('temp-id')
      ) {
        setError('ID de usuario inválido. Por favor inicia sesión nuevamente.');
        clearInvalidAuth();
      } else if (err.response?.status === 404) {
        setError('Usuario no encontrado en el sistema');
        clearInvalidAuth();
      } else if (err.response?.status === 401) {
        setError('Sesión expirada. Por favor inicia sesión nuevamente.');
        clearInvalidAuth();
      } else {
        setError(err.message || 'Error al cargar permisos');
      }

      // En caso de error, establecer permisos vacíos para evitar bloqueos
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshPermissions = async () => {
    await loadUserPermissions();
  };

  const refreshPermissionsFromUser = () => {
    // Refresh permissions from the user object (if available from login)
    if (user?.permissions && Array.isArray(user.permissions)) {
      setPermissions(user.permissions);
      setError(null);
    } else {
      loadUserPermissions();
    }
  };

  const hasPermission = (permission: string): boolean => {
    // Ensure permissions is an array before using includes
    if (!Array.isArray(permissions)) {
      return false;
    }
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    if (perms.length === 0) {
      return true;
    }
    if (!Array.isArray(permissions)) {
      return false;
    }
    return perms.some((perm) => permissions.includes(perm));
  };

  const hasAllPermissions = (perms: string[]): boolean => {
    if (perms.length === 0) {
      return true;
    }
    if (!Array.isArray(permissions)) {
      return false;
    }
    return perms.every((perm) => permissions.includes(perm));
  };

  const hasModuleAccess = (module: string): boolean => {
    // Verifica si el usuario tiene cualquier permiso en un módulo específico
    if (!Array.isArray(permissions)) {
      return false;
    }
    const modulePermissions = permissions.filter((perm) => perm.startsWith(`${module}.`));
    return modulePermissions.length > 0;
  };

  const getModulePermissions = (module: string): string[] => {
    // Retorna todos los permisos que tiene el usuario en un módulo específico
    if (!Array.isArray(permissions)) {
      return [];
    }
    return permissions.filter((perm) => perm.startsWith(`${module}.`));
  };

  return {
    permissions,
    loading,
    error,
    refreshPermissions,
    refreshPermissionsFromUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasModuleAccess,
    getModulePermissions,
  };
};

export default usePermissions;
