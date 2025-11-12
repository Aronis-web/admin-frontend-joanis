import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePermissions, useCommonPermissions } from '@/hooks/usePermissions';
import { ProtectedRoute, ProtectedElement, ConditionalRender } from '@/components/auth/ProtectedRoute';

/**
 * Ejemplo completo de cómo usar el sistema RBAC en componentes React Native
 */
export const RBACUsageExample: React.FC = () => {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasModuleAccess,
    getModulePermissions,
    permissions,
    loading
  } = usePermissions();

  const {
    canManageUsers,
    canManageRoles,
    canManageProducts,
    canManageInventory,
    canViewReports,
    canManageFiles,
    isAdmin,
    isManager,
    isOperator
  } = useCommonPermissions();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Cargando permisos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ejemplo de Uso del Sistema RBAC</Text>

      {/* Información de permisos del usuario */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tus Permisos:</Text>
        <Text style={styles.permissionText}>
          Total de permisos: {permissions.length}
        </Text>
        <Text style={styles.permissionText}>
          Permisos: {permissions.join(', ')}
        </Text>
      </View>

      {/* Ejemplos de verificación de permisos individuales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verificación de Permisos Individuales:</Text>

        <ProtectedElement requiredPermissions={['users.read']}>
          <View style={styles.permissionBox}>
            <Text>✅ Puedes ver usuarios</Text>
          </View>
        </ProtectedElement>

        <ProtectedElement requiredPermissions={['users.create']}>
          <View style={styles.permissionBox}>
            <Text>✅ Puedes crear usuarios</Text>
          </View>
        </ProtectedElement>

        <ProtectedElement requiredPermissions={['roles.delete']}>
          <View style={styles.permissionBox}>
            <Text>✅ Puedes eliminar roles</Text>
          </View>
        </ProtectedElement>

        <ProtectedElement
          requiredPermissions={['roles.delete']}
          fallback={
            <View style={styles.deniedBox}>
              <Text>❌ No puedes eliminar roles</Text>
            </View>
          }
        >
          <View style={styles.permissionBox}>
            <Text>✅ Puedes eliminar roles</Text>
          </View>
        </ProtectedElement>
      </View>

      {/* Ejemplos de verificación con múltiples permisos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verificación con Múltiples Permisos:</Text>

        <ConditionalRender
          requiredPermissions={['users.read', 'users.create']}
          requireAll={false}
        >
          <View style={styles.permissionBox}>
            <Text>✅ Tienes acceso a gestión de usuarios (lectura O creación)</Text>
          </View>
        </ConditionalRender>

        <ConditionalRender
          requiredPermissions={['users.read', 'users.create', 'users.delete']}
          requireAll={true}
        >
          <View style={styles.permissionBox}>
            <Text>✅ Tienes control completo sobre usuarios (TODOS los permisos)</Text>
          </View>
        </ConditionalRender>
      </View>

      {/* Ejemplos usando hooks de permisos comunes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permisos Comunes (Hooks):</Text>

        <View style={styles.permissionBox}>
          <Text>👑 Administrador: {isAdmin ? 'Sí' : 'No'}</Text>
        </View>

        <View style={styles.permissionBox}>
          <Text>👔 Gerente: {isManager ? 'Sí' : 'No'}</Text>
        </View>

        <View style={styles.permissionBox}>
          <Text>🔧 Operador: {isOperator ? 'Sí' : 'No'}</Text>
        </View>

        <View style={styles.permissionBox}>
          <Text>👥 Gestión de Usuarios: {canManageUsers ? 'Sí' : 'No'}</Text>
        </View>

        <View style={styles.permissionBox}>
          <Text>🔐 Gestión de Roles: {canManageRoles ? 'Sí' : 'No'}</Text>
        </View>

        <View style={styles.permissionBox}>
          <Text>📦 Gestión de Productos: {canManageProducts ? 'Sí' : 'No'}</Text>
        </View>

        <View style={styles.permissionBox}>
          <Text>📊 Ver Reportes: {canViewReports ? 'Sí' : 'No'}</Text>
        </View>
      </View>

      {/* Ejemplos de acceso por módulo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acceso por Módulo:</Text>

        <View style={styles.permissionBox}>
          <Text>👤 Módulo Usuarios: {hasModuleAccess('users') ? 'Sí' : 'No'}</Text>
          {hasModuleAccess('users') && (
            <Text style={styles.subText}>
              Permisos: {getModulePermissions('users').join(', ')}
            </Text>
          )}
        </View>

        <View style={styles.permissionBox}>
          <Text>🔐 Módulo IAM: {hasModuleAccess('iam') ? 'Sí' : 'No'}</Text>
          {hasModuleAccess('iam') && (
            <Text style={styles.subText}>
              Permisos: {getModulePermissions('iam').join(', ')}
            </Text>
          )}
        </View>

        <View style={styles.permissionBox}>
          <Text>📦 Módulo Productos: {hasModuleAccess('products') ? 'Sí' : 'No'}</Text>
          {hasModuleAccess('products') && (
            <Text style={styles.subText}>
              Permisos: {getModulePermissions('products').join(', ')}
            </Text>
          )}
        </View>
      </View>

      {/* Ejemplo de botones protegidos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Botones Protegidos:</Text>

        <ProtectedElement requiredPermissions={['users.create']}>
          <TouchableOpacity style={[styles.button, styles.createButton]}>
            <Text style={styles.buttonText}>Crear Usuario</Text>
          </TouchableOpacity>
        </ProtectedElement>

        <ProtectedElement requiredPermissions={['users.update']}>
          <TouchableOpacity style={[styles.button, styles.editButton]}>
            <Text style={styles.buttonText}>Editar Usuario</Text>
          </TouchableOpacity>
        </ProtectedElement>

        <ProtectedElement requiredPermissions={['users.delete']}>
          <TouchableOpacity style={[styles.button, styles.deleteButton]}>
            <Text style={styles.buttonText}>Eliminar Usuario</Text>
          </TouchableOpacity>
        </ProtectedElement>

        <ProtectedElement
          requiredPermissions={['users.delete']}
          fallback={
            <TouchableOpacity style={[styles.button, styles.disabledButton]} disabled>
              <Text style={styles.buttonText}>Eliminar Usuario (No autorizado)</Text>
            </TouchableOpacity>
          }
        >
          <TouchableOpacity style={[styles.button, styles.deleteButton]}>
            <Text style={styles.buttonText}>Eliminar Usuario</Text>
          </TouchableOpacity>
        </ProtectedElement>
      </View>

      {/* Ejemplo de sección completa protegida */}
      <ProtectedRoute
        requiredPermissions={['admin.access']}
        fallback={
          <View style={styles.section}>
            <Text style={styles.deniedText}>
              ⚠️ No tienes permisos de administrador para ver esta sección
            </Text>
          </View>
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sección de Administrador</Text>
          <Text>Esta sección solo es visible para administradores</Text>
          <TouchableOpacity style={[styles.button, styles.adminButton]}>
            <Text style={styles.buttonText}>Acción Administrativa</Text>
          </TouchableOpacity>
        </View>
      </ProtectedRoute>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1F2937',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#374151',
  },
  permissionText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  permissionBox: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  deniedBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  subText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  button: {
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  createButton: {
    backgroundColor: '#10B981',
  },
  editButton: {
    backgroundColor: '#F59E0B',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  adminButton: {
    backgroundColor: '#8B5CF6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deniedText: {
    color: '#DC2626',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default RBACUsageExample;