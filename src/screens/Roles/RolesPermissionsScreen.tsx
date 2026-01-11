import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  rolesApi,
  permissionsApi,
  rolePermissionsApi,
  userRolesApi,
  userPermissionsApi,
  Role,
  Permission,
  CreateRoleRequest
} from '@/services/api/roles';
import { ProtectedRoute, ProtectedElement } from '@/components/auth/ProtectedRoute';
import { usePermissions } from '@/hooks/usePermissions';

import { useAuthStore } from '@/store/auth';
import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import { AddButton } from '@/components/Navigation/AddButton';

interface RolesPermissionsScreenProps {
  navigation: any;
}

export const RolesPermissionsScreen: React.FC<RolesPermissionsScreenProps> = ({ navigation }) => {
  const { hasAnyPermission } = usePermissions();
  const { logout } = useAuthStore();
  const navigateFromMenu = useMenuNavigation(navigation);

  // All useState hooks must be declared before any early returns to follow Rules of Hooks
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Estados adicionales para funcionalidades extendidas
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRolePermissionsModal, setShowRolePermissionsModal] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);

  // Estados para gestión por módulos
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [customEditMode, setCustomEditMode] = useState(false);

  // Form state
  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');


  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Bottom navigation states
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);

  // Function definitions - must be declared before useEffect hooks that use them
  const loadData = async () => {
    try {
      setIsLoading(true);
      const rolesData = await rolesApi.getRoles();
      // Ensure rolesData is an array before setting
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      // Set empty array on error to prevent undefined issues
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const rolesData = await rolesApi.getRoles(roleSearchQuery);
      // Ensure rolesData is an array before setting
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (error: any) {
      // Set empty array on error to prevent undefined issues
      setRoles([]);
    }
  };

  const loadPermissions = async () => {
    try {
      const permissionsData = await permissionsApi.getPermissions();
      // Ensure permissionsData is an array before setting
      setPermissions(Array.isArray(permissionsData) ? permissionsData : []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      // Set empty array on error to prevent undefined issues
      setPermissions([]);
    }
  };



  // ALL hooks (useState, useEffect, etc.) must be declared before any early returns
  useEffect(() => {

    loadData();
  }, []);





  // Cargar roles cuando cambia la búsqueda
  useEffect(() => {
    if (!isLoading) {
      const timeoutId = setTimeout(() => {
        loadRoles();
      }, 500); // Debounce de 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [roleSearchQuery]);

  // Verificar permisos de acceso - now after ALL hooks are declared
  if (!hasAnyPermission(['roles.read', 'permissions.read'])) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.deniedTitle}>⚠️ Acceso Restringido</Text>
        <Text style={styles.deniedMessage}>
          No tienes los permisos necesarios para acceder a esta sección.
        </Text>
        <Text style={styles.deniedHint}>
          Permisos requeridos: roles.read, permissions.read
        </Text>
      </View>
    );
  }

  const handleCreateRole = async () => {
    if (!roleCode || !roleName || !roleDescription) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    try {
      setIsCreatingRole(true);

      // Primero crear el rol sin permisos
      const roleData: CreateRoleRequest = {
        code: roleCode.toUpperCase(),
        name: roleName,
        description: roleDescription
      };

      const createdRole = await rolesApi.createRole(roleData);

      // Luego asignar los permisos seleccionados
      if (selectedPermissions.length > 0) {
        await rolePermissionsApi.assignPermissionsToRole(createdRole.id, selectedPermissions);
      }

      Alert.alert('Éxito', 'Rol creado correctamente');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsCreatingRole(false);
    }
  };

  // Nuevas funciones para funcionalidades extendidas
  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setRoleCode(role.code);
    setRoleName(role.name);
    setRoleDescription(role.description);
    setShowEditModal(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedRole || !roleName || !roleDescription) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    try {
      setIsUpdatingRole(true);
      await rolesApi.updateRole(selectedRole.id, {
        name: roleName,
        description: roleDescription
      });

      Alert.alert('Éxito', 'Rol actualizado correctamente');
      setShowEditModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleDeleteRole = (role: Role) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await rolesApi.deleteRole(role.id);
              Alert.alert('Éxito', 'Rol eliminado correctamente');
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleViewRolePermissions = async (role: Role) => {
    try {
      // Load permissions if not already loaded
      if (permissions.length === 0) {
        await loadPermissions();
      }

      setSelectedRole(role);
      const perms = await rolePermissionsApi.getRolePermissions(role.id);

      // Ensure perms is an array before using map
      const permissionsArray = Array.isArray(perms) ? perms : [];

      setRolePermissions(permissionsArray);
      setSelectedPermissions(permissionsArray.map(p => p.key));
      setShowRolePermissionsModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUpdateRolePermissions = async () => {
    if (!selectedRole) return;

    try {
      setIsUpdatingPermissions(true);


      // Ensure rolePermissions is an array before using map
      const currentPermsArray = Array.isArray(rolePermissions) ? rolePermissions : [];
      const currentPerms = currentPermsArray.map(p => p.key);

      // Ensure selectedPermissions is an array before filtering
      const selectedPermsArray = Array.isArray(selectedPermissions) ? selectedPermissions : [];

      // Calcular cambios para mostrar al usuario
      const toAdd = selectedPermsArray.filter(p => !currentPerms.includes(p));
      const toRemove = currentPerms.filter(p => !selectedPermsArray.includes(p));

      console.log('🔄 Actualizando permisos del rol:', selectedRole.name);
      console.log('  📊 Permisos actuales:', currentPerms.length);
      console.log('  ✅ Permisos seleccionados:', selectedPermsArray.length);
      console.log('  ➕ Nuevos:', toAdd.length);
      console.log('  ➖ A eliminar:', toRemove.length);

      // En lugar de usar DELETE (que no existe en el backend),
      // usamos PUT para reemplazar TODOS los permisos
      if (selectedPermsArray.length > 0) {
        await rolePermissionsApi.assignPermissionsToRole(selectedRole.id, selectedPermsArray);
        console.log('✅ Permisos actualizados correctamente');
      } else {
        // Si no hay permisos seleccionados, enviar array vacío
        await rolePermissionsApi.assignPermissionsToRole(selectedRole.id, []);
        console.log('✅ Todos los permisos eliminados');
      }

      Alert.alert('Éxito', 'Permisos del rol actualizados correctamente');
      setShowRolePermissionsModal(false);
      resetForm();
    } catch (error: any) {
      console.error('❌ Error al actualizar permisos:', error);
      Alert.alert('Error', error.message);
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  const resetForm = () => {
    setRoleCode('');
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions([]);
  };

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleMenuSelect = (menuId: string) => {
    setIsMenuVisible(false);
    navigateFromMenu(menuId);
  };

  const handleLogout = async () => {
    setIsMenuVisible(false);
    await logout();
  };

  const handleChatPress = () => {
    console.log('Abrir chat');
  };

  const handleNotificationsPress = () => {
    console.log('Abrir notificaciones');
  };

  const togglePermission = (permissionKey: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionKey)
        ? prev.filter(p => p !== permissionKey)
        : [...prev, permissionKey]
    );
  };

  // Funciones para gestión por módulos
  const groupPermissionsByModule = (permissions: Permission[]) => {
    const grouped: Record<string, Permission[]> = {};

    // Ensure permissions is an array before iterating
    if (!Array.isArray(permissions)) {
      return grouped;
    }

    permissions.forEach(permission => {
      if (!grouped[permission.module]) {
        grouped[permission.module] = [];
      }
      grouped[permission.module].push(permission);
    });

    // Ordenar módulos alfabéticamente y permisos dentro de cada módulo
    const sortedGrouped: Record<string, Permission[]> = {};
    Object.keys(grouped).sort().forEach(module => {
      sortedGrouped[module] = grouped[module].sort((a, b) =>
        a.description.localeCompare(b.description)
      );
    });

    return sortedGrouped;
  };

  const toggleModuleExpansion = (module: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(module)) {
        newSet.delete(module);
      } else {
        newSet.add(module);
      }
      return newSet;
    });
  };

  const toggleAllPermissionsInModule = (module: string, modulePermissions: Permission[]) => {
    // Ensure modulePermissions is an array
    if (!Array.isArray(modulePermissions)) {
      return;
    }

    const modulePermissionKeys = modulePermissions.map(p => p.key);
    const allSelected = modulePermissionKeys.every(key => selectedPermissions.includes(key));

    if (allSelected) {
      // Deseleccionar todos los permisos del módulo
      setSelectedPermissions(prev =>
        prev.filter(key => !modulePermissionKeys.includes(key))
      );
    } else {
      // Seleccionar todos los permisos del módulo
      setSelectedPermissions(prev => {
        const newSet = new Set(prev);
        modulePermissionKeys.forEach(key => newSet.add(key));
        return Array.from(newSet);
      });
    }
  };

  const getModuleSelectionStatus = (modulePermissions: Permission[]) => {
    // Ensure modulePermissions is an array
    if (!Array.isArray(modulePermissions)) {
      return {
        count: 0,
        total: 0,
        isAllSelected: false,
        isPartiallySelected: false
      };
    }

    const modulePermissionKeys = modulePermissions.map(p => p.key);
    const selectedCount = modulePermissionKeys.filter(key =>
      selectedPermissions.includes(key)
    ).length;

    return {
      count: selectedCount,
      total: modulePermissionKeys.length,
      isAllSelected: selectedCount === modulePermissionKeys.length,
      isPartiallySelected: selectedCount > 0 && selectedCount < modulePermissionKeys.length
    };
  };



  const renderRole = ({ item }: { item: Role }) => (
    <View style={styles.roleCard}>
      <View style={styles.roleHeader}>
        <Text style={styles.roleCode}>{item.code}</Text>
        <Text style={styles.roleName}>{item.name}</Text>
      </View>
      <Text style={styles.roleDescription}>{item.description}</Text>
      <Text style={styles.roleDate}>
        Creado: {new Date(item.created_at).toLocaleDateString()}
      </Text>

      <View style={styles.roleActions}>
        <ProtectedElement requiredPermissions={['roles.read']}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => handleViewRolePermissions(item)}
          >
            <Text style={styles.actionButtonText}>Ver Permisos</Text>
          </TouchableOpacity>
        </ProtectedElement>

        <ProtectedElement requiredPermissions={['roles.update']}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditRole(item)}
          >
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
        </ProtectedElement>

        <ProtectedElement requiredPermissions={['roles.delete']}>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteRole(item)}
          >
            <Text style={styles.actionButtonText}>Eliminar</Text>
          </TouchableOpacity>
        </ProtectedElement>
      </View>
    </View>
  );

  const renderPermission = ({ item }: { item: Permission }) => (
    <TouchableOpacity
      style={[
        styles.permissionItem,
        selectedPermissions.includes(item.key) && styles.permissionItemSelected
      ]}
      onPress={() => togglePermission(item.key)}
    >
      <View style={styles.permissionInfo}>
        <Text style={styles.permissionDescription}>{item.description}</Text>
        <Text style={styles.permissionKey}>{item.key}</Text>
      </View>
      <View style={[
        styles.checkbox,
        selectedPermissions.includes(item.key) && styles.checkboxChecked
      ]}>
        {selectedPermissions.includes(item.key) && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderModuleCard = (module: string, modulePermissions: Permission[]) => {
    const status = getModuleSelectionStatus(modulePermissions);
    const isExpanded = expandedModules.has(module);

    return (
      <View key={module} style={styles.moduleCard}>
        <TouchableOpacity
          style={styles.moduleHeader}
          onPress={() => toggleModuleExpansion(module)}
        >
          <View style={styles.moduleInfo}>
            <Text style={styles.moduleName}>{module.toUpperCase()}</Text>
            <Text style={styles.moduleStatus}>
              {status.count} de {status.total} permisos seleccionados
            </Text>
          </View>

          <View style={styles.moduleControls}>
            <Switch
              value={status.isAllSelected}
              onValueChange={() => toggleAllPermissionsInModule(module, modulePermissions)}
              trackColor={{ false: '#E5E7EB', true: '#EEF2FF' }}
              thumbColor={status.isAllSelected ? '#4F46E5' : '#9CA3AF'}
              ios_backgroundColor="#E5E7EB"
            />

            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => toggleModuleExpansion(module)}
            >
              <Text style={styles.expandButtonText}>
                {isExpanded ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.modulePermissions}>
            {modulePermissions.map((permission) => (
              <View key={permission.key}>
                {renderPermission({ item: permission })}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPermissionsByModule = () => {
    const groupedPermissions = groupPermissionsByModule(permissions);

    return (
      <View style={styles.modulesContainer}>
        {Object.entries(groupedPermissions).map(([module, modulePermissions]) =>
          renderModuleCard(module, modulePermissions)
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando roles y permisos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ProtectedRoute requiredPermissions={['roles.read', 'permissions.read']} requireAll={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Roles y Permisos</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={[styles.content, isLandscape && styles.contentLandscape]} showsVerticalScrollIndicator={false}>
          {/* Roles Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Roles Existentes</Text>

            {/* Búsqueda de roles */}
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar roles..."
              value={roleSearchQuery}
              onChangeText={setRoleSearchQuery}
            />

            {/* Debug logs eliminados */}

            {roles.length > 0 ? (
              <>
                {/* Renderizando lista de roles */}
                {roles.map((role) => (
                  <View key={role.id}>
                    {renderRole({ item: role })}
                  </View>
                ))}
              </>
            ) : (
              <>
                {/* No hay roles para mostrar */}
                <Text style={styles.emptyText}>
                  {roleSearchQuery ? 'No se encontraron roles' : 'No hay roles configurados'}
                </Text>
              </>
            )}
          </View>


        </ScrollView>

        {/* Create Role Modal */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Crear Nuevo Rol</Text>
              <TouchableOpacity onPress={handleCreateRole} disabled={isCreatingRole}>
                <Text style={styles.saveButtonText}>
                  {isCreatingRole ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Código del Rol</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: CONTENT_MANAGER"
                  value={roleCode}
                  onChangeText={setRoleCode}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre del Rol</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Gestor de Contenido"
                  value={roleName}
                  onChangeText={setRoleName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe las responsabilidades de este rol"
                  value={roleDescription}
                  onChangeText={setRoleDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Permisos Seleccionados ({selectedPermissions.length})
                </Text>
                <ScrollView style={styles.permissionsList} showsVerticalScrollIndicator={true}>
                  {renderPermissionsByModule()}
                </ScrollView>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Edit Role Modal */}
        <Modal
          visible={showEditModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Editar Rol</Text>
              <TouchableOpacity onPress={handleUpdateRole} disabled={isUpdatingRole}>
                <Text style={styles.saveButtonText}>
                  {isUpdatingRole ? 'Actualizando...' : 'Actualizar'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Código del Rol</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={roleCode}
                  editable={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre del Rol</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del rol"
                  value={roleName}
                  onChangeText={setRoleName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe las responsabilidades de este rol"
                  value={roleDescription}
                  onChangeText={setRoleDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Role Permissions Modal */}
        <Modal
          visible={showRolePermissionsModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRolePermissionsModal(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                Permisos de {selectedRole?.name}
              </Text>
              <TouchableOpacity
                onPress={handleUpdateRolePermissions}
                disabled={isUpdatingPermissions}
              >
                <Text style={styles.saveButtonText}>
                  {isUpdatingPermissions ? 'Actualizando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Permisos ({selectedPermissions.length})
                </Text>
                <ScrollView style={styles.permissionsList} showsVerticalScrollIndicator={true}>
                  {renderPermissionsByModule()}
                </ScrollView>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Add Button */}
        <ProtectedElement requiredPermissions={['roles.create']}>
          <AddButton
            onPress={async () => {
              await loadPermissions();
              setShowCreateModal(true);
            }}
            icon="🔐"
          />
        </ProtectedElement>
      </SafeAreaView>
    </ProtectedRoute>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#4F46E5',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 100,
  },
  contentLandscape: {
    paddingBottom: 70,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  roleDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  roleDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    fontSize: 16,
  },

  permissionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  permissionItemSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  permissionModule: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  permissionsList: {
    flex: 1,
    maxHeight: 400,
  },
  roleActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#3B82F6',
  },
  editButton: {
    backgroundColor: '#F59E0B',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  deniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  deniedMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  deniedHint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Estilos para gestión por módulos
  modulesContainer: {
    flex: 1,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  moduleInfo: {
    flex: 1,
  },
  moduleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  moduleStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  moduleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandButtonText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },
  modulePermissions: {
    padding: 8,
  },
});

export default RolesPermissionsScreen;