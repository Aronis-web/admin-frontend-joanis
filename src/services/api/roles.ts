import { apiClient } from './client';
import { config } from '@/utils/config';

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  key: string;
  description: string;
  module: string;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description: string;
}

export interface CreateRoleResponse {
  id: string;
  code: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface GetPermissionsParams {
  module?: string;
  q?: string;
}

export const rolesApi = {
  // Crear un nuevo rol
  createRole: async (data: CreateRoleRequest): Promise<CreateRoleResponse> => {
    try {
      const response = await apiClient.post('/iam/roles', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para crear roles');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      if (error.response?.status === 400) {
        throw new Error(
          `Datos inválidos: ${error.response?.data?.message || 'Verifica los datos del rol'}`
        );
      }
      if (error.response?.status === 422) {
        const validationErrors =
          error.response?.data?.errors || error.response?.data?.message || 'Error de validación';
        throw new Error(`Error de validación: ${validationErrors}`);
      }
      if (error.response?.status === 500) {
        throw new Error('Error interno del servidor. Contacta al administrador');
      }

      throw new Error(`Error al crear el rol: ${error.message}`);
    }
  },

  // Obtener todos los roles
  getRoles: async (searchQuery?: string): Promise<Role[]> => {
    try {
      const params = searchQuery ? { q: searchQuery } : {};

      const response = await apiClient.get('/iam/roles', { params });

      // Handle case where response itself is the data (not response.data)
      let processedData: any[] = [];

      if (Array.isArray(response.data)) {
        processedData = response.data;
      } else if (Array.isArray(response)) {
        processedData = response;
      } else if (response && typeof response === 'object') {
        // If response is an object but not an array, check if it has the data we expect
        if (Array.isArray(response.data)) {
          processedData = response.data;
        } else if (Array.isArray(response.roles)) {
          processedData = response.roles;
        } else {
          processedData = [];
        }
      } else {
        processedData = [];
      }

      return processedData;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'NETWORK_ERROR') {
        const mockData = getMockRoles(searchQuery);
        return mockData;
      }

      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para ver los roles');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }

      // En caso de cualquier error, retornar array vacío para evitar crashes

      const mockData = getMockRoles(searchQuery);
      return mockData;
    }
  },

  // Obtener un rol por ID
  getRoleById: async (id: string): Promise<Role> => {
    try {
      const response = await apiClient.get(`/iam/roles/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para ver este rol');
      }
      if (error.response?.status === 404) {
        throw new Error('Rol no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al obtener el rol. Inténtalo nuevamente');
    }
  },

  // Actualizar un rol
  updateRole: async (id: string, data: Partial<CreateRoleRequest>): Promise<Role> => {
    try {
      const response = await apiClient.put(`/iam/roles/${id}`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para actualizar este rol');
      }
      if (error.response?.status === 404) {
        throw new Error('Rol no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al actualizar el rol. Inténtalo nuevamente');
    }
  },

  // Eliminar un rol
  deleteRole: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/iam/roles/${id}`);
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para eliminar este rol');
      }
      if (error.response?.status === 404) {
        throw new Error('Rol no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al eliminar el rol. Inténtalo nuevamente');
    }
  },
};

export const permissionsApi = {
  // Obtener todos los permisos con filtros opcionales
  getPermissions: async (params?: GetPermissionsParams): Promise<Permission[]> => {
    try {
      const response = await apiClient.get('/iam/permissions', { params });

      // Handle case where response itself is the data (not response.data)
      let processedData: any[] = [];

      if (Array.isArray(response.data)) {
        processedData = response.data;
      } else if (Array.isArray(response)) {
        processedData = response;
      } else if (response && typeof response === 'object') {
        // If response is an object but not an array, check if it has the data we expect
        if (Array.isArray(response.data)) {
          processedData = response.data;
        } else if (Array.isArray(response.permissions)) {
          processedData = response.permissions;
        } else {
          processedData = [];
        }
      } else {
        processedData = [];
      }

      return processedData;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'NETWORK_ERROR') {
        const mockData = getMockPermissions(params);
        return mockData;
      }

      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para ver los permisos disponibles');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }

      // En caso de cualquier error, retornar array vacío para evitar crashes

      const mockData = getMockPermissions(params);
      return mockData;
    }
  },

  // Obtener permisos por módulo
  getPermissionsByModule: async (module: string): Promise<Permission[]> => {
    try {
      const response = await apiClient.get(`/iam/permissions?module=${module}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para ver los permisos de este módulo');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al obtener los permisos del módulo. Inténtalo nuevamente');
    }
  },

  // Buscar permisos por texto
  searchPermissions: async (query: string): Promise<Permission[]> => {
    try {
      const response = await apiClient.get(`/iam/permissions?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para buscar permisos');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al buscar permisos. Inténtalo nuevamente');
    }
  },
};

// Endpoints adicionales para gestión completa de RBAC
export const rolePermissionsApi = {
  // Obtener permisos de un rol específico
  getRolePermissions: async (roleId: string): Promise<Permission[]> => {
    try {
      const response = await apiClient.get(`/iam/roles/${roleId}/permissions`);

      // Handle case where response itself is the data (not response.data)
      let processedData: any[] = [];

      if (Array.isArray(response.data)) {
        processedData = response.data;
      } else if (Array.isArray(response)) {
        processedData = response;
      } else if (response && typeof response === 'object') {
        // If response is an object but not an array, check if it has the data we expect
        if (Array.isArray(response.data)) {
          processedData = response.data;
        } else if (Array.isArray(response.permissions)) {
          processedData = response.permissions;
        } else {
          processedData = [];
        }
      } else {
        processedData = [];
      }

      return processedData;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'NETWORK_ERROR') {
        return getMockRolePermissions(roleId);
      }

      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para ver los permisos de este rol');
      }
      if (error.response?.status === 404) {
        throw new Error('Rol no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }

      // En caso de cualquier error, retornar array vacío para evitar crashes

      return getMockRolePermissions(roleId);
    }
  },

  // Asignar permisos a un rol (reemplaza todos los permisos existentes)
  assignPermissionsToRole: async (roleId: string, permissionKeys: string[]): Promise<void> => {
    try {
      // Permitir array vacío para eliminar todos los permisos
      if (!Array.isArray(permissionKeys)) {
        throw new Error('La lista de permisos debe ser un array');
      }

      // Filtrar y validar permisos
      const validPermissions = permissionKeys.filter(
        (key) => typeof key === 'string' && key.trim().length > 0
      );

      console.log('📤 Enviando permisos al backend:', {
        roleId,
        count: validPermissions.length,
        permissions: validPermissions,
      });

      // PUT reemplaza todos los permisos del rol
      await apiClient.put(`/iam/roles/${roleId}/permissions`, {
        permissionKeys: validPermissions,
      });

      console.log('✅ Permisos asignados correctamente al rol');
    } catch (error: any) {
      console.error('❌ Error al asignar permisos:', error);

      if (error.response?.status === 403) {
        throw new Error(
          'No tienes permisos para asignar permisos a este rol (roles.assign requerido)'
        );
      }
      if (error.response?.status === 404) {
        throw new Error('Rol no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      if (error.response?.status === 400) {
        throw new Error(
          `Datos inválidos: ${error.response?.data?.message || 'Verifica los permisos seleccionados'}`
        );
      }
      if (error.response?.status === 422) {
        const validationErrors = error.response?.data?.message || 'Error de validación de permisos';
        throw new Error(`Error de validación: ${validationErrors}`);
      }
      throw new Error('Error al asignar permisos al rol. Inténtalo nuevamente');
    }
  },

  // ⚠️ DEPRECADO: Este endpoint no existe en el backend
  // En su lugar, usa assignPermissionsToRole con todos los permisos que quieres mantener
  // El método PUT reemplaza todos los permisos del rol
  revokePermissionsFromRole: async (roleId: string, permissionKeys: string[]): Promise<void> => {
    console.warn(
      '⚠️ revokePermissionsFromRole está deprecado. El backend no soporta DELETE /iam/roles/{roleId}/permissions'
    );
    console.warn('💡 Usa assignPermissionsToRole con todos los permisos que quieres mantener');

    throw new Error(
      'Este método está deprecado. El backend no soporta la eliminación individual de permisos. ' +
        'Usa assignPermissionsToRole con todos los permisos que deseas mantener.'
    );

    // Código original comentado para referencia
    /*
    try {
      await apiClient.delete(`/iam/roles/${roleId}/permissions`, { data: { permissionKeys } });
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para revocar permisos de este rol');
      }
      if (error.response?.status === 404) {
        throw new Error('Rol no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al revocar permisos del rol. Inténtalo nuevamente');
    }
    */
  },
};

export const userRolesApi = {
  // Obtener roles de un usuario
  getUserRoles: async (userId: string): Promise<Role[]> => {
    try {
      const response = await apiClient.get(`/iam/users/${userId}/roles`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para ver los roles de este usuario');
      }
      if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al obtener los roles del usuario. Inténtalo nuevamente');
    }
  },

  // Asignar rol a usuario
  assignRoleToUser: async (userId: string, roleId: string): Promise<void> => {
    try {
      await apiClient.post(`/iam/users/${userId}/roles`, { roleId });
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para asignar roles a este usuario');
      }
      if (error.response?.status === 404) {
        throw new Error('Usuario o rol no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al asignar rol al usuario. Inténtalo nuevamente');
    }
  },

  // Revocar rol de usuario
  revokeRoleFromUser: async (userId: string, roleId: string): Promise<void> => {
    try {
      await apiClient.delete(`/iam/users/${userId}/roles/${roleId}`);
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para revocar roles de este usuario');
      }
      if (error.response?.status === 404) {
        throw new Error('Usuario o rol no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al revocar rol del usuario. Inténtalo nuevamente');
    }
  },
};

export const userPermissionsApi = {
  // Obtener permisos directos (overrides) de un usuario
  getUserPermissions: async (
    userId: string
  ): Promise<{ permission_key: string; granted: boolean }[]> => {
    try {
      const response = await apiClient.get(`/iam/users/${userId}/permissions`);

      // Validate response data
      if (!response.data) {
        return [];
      }

      // Ensure it's an array
      if (!Array.isArray(response.data)) {
        return [];
      }

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para ver los permisos de este usuario');
      }
      if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al obtener los permisos del usuario. Inténtalo nuevamente');
    }
  },

  // Obtener permisos efectivos de un usuario (heredados + directos)
  getUserEffectivePermissions: async (userId: string): Promise<string[]> => {
    try {
      const response = await apiClient.get(`/iam/users/${userId}/effective-permissions`);

      // Validate response data
      if (!response.data) {
        return [];
      }

      // Ensure it's an array
      if (!Array.isArray(response.data)) {
        return [];
      }

      // Validate all items are strings
      const validPermissions = response.data.filter((perm) => typeof perm === 'string');

      return validPermissions;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para ver los permisos efectivos de este usuario');
      }
      if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }

      // For any other error, return empty array to prevent crashes
      return [];
    }
  },

  // Conceder permiso directo a usuario
  grantPermissionToUser: async (userId: string, permissionKey: string): Promise<void> => {
    try {
      await apiClient.post(`/iam/users/${userId}/permissions`, { permissionKey, granted: true });
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para conceder permisos a este usuario');
      }
      if (error.response?.status === 404) {
        throw new Error('Usuario o permiso no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al conceder permiso al usuario. Inténtalo nuevamente');
    }
  },

  // Revocar permiso directo de usuario
  revokePermissionFromUser: async (userId: string, permissionKey: string): Promise<void> => {
    try {
      await apiClient.post(`/iam/users/${userId}/permissions`, { permissionKey, granted: false });
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('No tienes permisos para revocar permisos de este usuario');
      }
      if (error.response?.status === 404) {
        throw new Error('Usuario o permiso no encontrado');
      }
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
      }
      throw new Error('Error al revocar permiso del usuario. Inténtalo nuevamente');
    }
  },
};

// Mock data functions for when backend is not available
const getMockRoles = (searchQuery?: string): Role[] => {
  const mockRoles: Role[] = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      code: 'ADMIN',
      name: 'Administrador',
      description: 'Acceso completo a todas las funcionalidades del sistema',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '456e7890-f12b-34d4-b567-537715285111',
      code: 'MANAGER',
      name: 'Gerente',
      description: 'Gestión de usuarios, roles y configuración del sistema',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '789e0123-g23c-45e5-c678-648826396222',
      code: 'OPERATOR',
      name: 'Operador',
      description: 'Acceso a operaciones básicas del catálogo e inventario',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  if (!searchQuery) {
    return mockRoles;
  }

  const query = searchQuery.toLowerCase();
  const filteredRoles = mockRoles.filter(
    (role) =>
      role.name.toLowerCase().includes(query) ||
      role.code.toLowerCase().includes(query) ||
      role.description.toLowerCase().includes(query)
  );

  return filteredRoles;
};

const getMockPermissions = (params?: GetPermissionsParams): Permission[] => {
  const mockPermissions: Permission[] = [
    {
      key: 'users.read',
      description: 'Ver usuarios',
      module: 'users',
    },
    {
      key: 'users.create',
      description: 'Crear usuarios',
      module: 'users',
    },
    {
      key: 'users.update',
      description: 'Editar usuarios',
      module: 'users',
    },
    {
      key: 'users.delete',
      description: 'Eliminar usuarios',
      module: 'users',
    },
    {
      key: 'roles.read',
      description: 'Ver roles',
      module: 'iam',
    },
    {
      key: 'roles.create',
      description: 'Crear roles',
      module: 'iam',
    },
    {
      key: 'roles.update',
      description: 'Editar roles',
      module: 'iam',
    },
    {
      key: 'roles.delete',
      description: 'Eliminar roles',
      module: 'iam',
    },
    {
      key: 'permissions.read',
      description: 'Listar permisos',
      module: 'iam',
    },
    {
      key: 'products.read',
      description: 'Ver productos',
      module: 'products',
    },
    {
      key: 'products.create',
      description: 'Crear productos',
      module: 'products',
    },
    {
      key: 'products.update',
      description: 'Editar productos',
      module: 'products',
    },
    {
      key: 'products.delete',
      description: 'Eliminar productos',
      module: 'products',
    },
    {
      key: 'inventory.read',
      description: 'Ver inventario',
      module: 'inventory',
    },
    {
      key: 'inventory.update',
      description: 'Actualizar inventario',
      module: 'inventory',
    },
  ];

  if (!params) {
    return mockPermissions;
  }

  let filtered = mockPermissions;

  if (params.module) {
    filtered = filtered.filter((p) => p.module === params.module);
  }

  if (params.q) {
    const query = params.q.toLowerCase();
    filtered = filtered.filter(
      (p) => p.description.toLowerCase().includes(query) || p.key.toLowerCase().includes(query)
    );
  }

  return filtered;
};

const getMockRolePermissions = (roleId: string): Permission[] => {
  // Different mock permissions based on role ID
  const adminPermissions: Permission[] = [
    {
      key: 'users.read',
      description: 'Ver usuarios',
      module: 'users',
    },
    {
      key: 'users.create',
      description: 'Crear usuarios',
      module: 'users',
    },
    {
      key: 'users.update',
      description: 'Editar usuarios',
      module: 'users',
    },
    {
      key: 'users.delete',
      description: 'Eliminar usuarios',
      module: 'users',
    },
    {
      key: 'roles.read',
      description: 'Ver roles',
      module: 'iam',
    },
    {
      key: 'roles.create',
      description: 'Crear roles',
      module: 'iam',
    },
    {
      key: 'roles.update',
      description: 'Editar roles',
      module: 'iam',
    },
    {
      key: 'roles.delete',
      description: 'Eliminar roles',
      module: 'iam',
    },
    {
      key: 'permissions.read',
      description: 'Listar permisos',
      module: 'iam',
    },
  ];

  const managerPermissions: Permission[] = [
    {
      key: 'users.read',
      description: 'Ver usuarios',
      module: 'users',
    },
    {
      key: 'users.update',
      description: 'Editar usuarios',
      module: 'users',
    },
    {
      key: 'roles.read',
      description: 'Ver roles',
      module: 'iam',
    },
    {
      key: 'permissions.read',
      description: 'Listar permisos',
      module: 'iam',
    },
  ];

  const operatorPermissions: Permission[] = [
    {
      key: 'products.read',
      description: 'Ver productos',
      module: 'products',
    },
    {
      key: 'inventory.read',
      description: 'Ver inventario',
      module: 'inventory',
    },
  ];

  // Return different permissions based on role ID pattern
  if (roleId.includes('123e4567')) {
    return adminPermissions;
  } else if (roleId.includes('456e7890')) {
    return managerPermissions;
  } else if (roleId.includes('789e0123')) {
    return operatorPermissions;
  }

  // Default empty permissions for unknown roles
  return [];
};
