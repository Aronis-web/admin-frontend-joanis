import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { appPermissionsApi, AppPermission } from '@/services/api/apps';
import { permissionsApi, Permission } from '@/services/api/roles';

interface PermissionsManagementModalProps {
  visible: boolean;
  appId: string;
  appName: string;
  onClose: () => void;
}

export const PermissionsManagementModal: React.FC<PermissionsManagementModalProps> = ({
  visible,
  appId,
  appName,
  onClose,
}) => {
  const [appPermissions, setAppPermissions] = useState<AppPermission[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [customPermission, setCustomPermission] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');

  useEffect(() => {
    if (visible && appId) {
      // Resetear estado al abrir
      setSelectedPermissions(new Set());
      setAppPermissions([]);
      setAllPermissions([]);
      setSearchQuery('');
      setSelectedModule('all');

      // Cargar datos
      loadData();
    }
  }, [visible, appId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadingPermissions(true);

      console.log('🔄 Cargando permisos para app:', appId);

      // Cargar ambos en paralelo
      const [appPermsData, allPermsData] = await Promise.all([
        appPermissionsApi.getAppPermissions(appId),
        permissionsApi.getPermissions(),
      ]);

      console.log('📦 Permisos de la app recibidos:', appPermsData.length);
      console.log('📚 Todos los permisos del sistema:', allPermsData.length);

      // Asegurar que son arrays
      const appPermsArray = Array.isArray(appPermsData) ? appPermsData : [];
      const allPermsArray = Array.isArray(allPermsData) ? allPermsData : [];

      // Guardar permisos de la app
      setAppPermissions(appPermsArray);

      // Guardar todos los permisos del sistema
      setAllPermissions(allPermsArray);

      // Inicializar permisos seleccionados con los que ya tiene la app
      const permKeys = new Set(appPermsArray.map((p) => p.permissionKey));
      setSelectedPermissions(permKeys);

      console.log('✅ Permisos actuales de la app:', Array.from(permKeys));
      console.log('📋 Total permisos disponibles en sistema:', allPermsArray.length);
      console.log('🎯 Permisos seleccionados inicialmente:', permKeys.size);

      // Verificar que los permisos se cargaron correctamente
      if (permKeys.size === 0 && appPermsArray.length > 0) {
        console.warn('⚠️ ADVERTENCIA: Los permisos de la app no se mapearon correctamente');
        console.warn('Datos recibidos:', appPermsArray);
      }
    } catch (error: any) {
      console.error('❌ Error loading permissions:', error);
      Alert.alert('Error', 'No se pudieron cargar los permisos');
      // Asegurar que los estados tengan valores por defecto
      setAppPermissions([]);
      setAllPermissions([]);
      setSelectedPermissions(new Set());
    } finally {
      setLoading(false);
      setLoadingPermissions(false);
    }
  };

  const handleTogglePermission = (permissionKey: string) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permissionKey)) {
        newSet.delete(permissionKey);
      } else {
        newSet.add(permissionKey);
      }
      return newSet;
    });
  };

  const handleAddCustomPermission = () => {
    const trimmed = customPermission.trim();

    if (!trimmed) {
      Alert.alert('Error', 'Ingresa un permiso válido');
      return;
    }

    // Validar formato: recurso.accion
    if (!/^[a-z]+\.[a-z]+$/.test(trimmed)) {
      Alert.alert(
        'Formato Inválido',
        'El permiso debe seguir el formato: recurso.accion\nEjemplo: stock.read'
      );
      return;
    }

    setSelectedPermissions((prev) => new Set(prev).add(trimmed));
    setCustomPermission('');
  };

  const handleSave = async () => {
    if (selectedPermissions.size === 0) {
      Alert.alert('Error', 'Debe seleccionar al menos un permiso');
      return;
    }

    const permissionsToSave = Array.from(selectedPermissions);
    const originalPermissions = appPermissions.map((p) => p.permissionKey);

    // Calcular cambios
    const added = permissionsToSave.filter((p) => !originalPermissions.includes(p));
    const removed = originalPermissions.filter((p) => !permissionsToSave.includes(p));
    const unchanged = permissionsToSave.filter((p) => originalPermissions.includes(p));

    console.log('💾 Preparando para guardar permisos:');
    console.log('  📊 Originales:', originalPermissions.length, originalPermissions);
    console.log('  ✅ Sin cambios:', unchanged.length, unchanged);
    console.log('  ➕ Agregados:', added.length, added);
    console.log('  ➖ Eliminados:', removed.length, removed);
    console.log('  📦 Total a guardar:', permissionsToSave.length, permissionsToSave);

    // Mostrar confirmación con resumen de cambios
    let message = `Se guardarán ${permissionsToSave.length} permisos en total.\n\n`;
    if (added.length > 0) {
      message += `✅ Nuevos: ${added.length}\n`;
    }
    if (removed.length > 0) {
      message += `❌ Eliminados: ${removed.length}\n`;
    }
    if (unchanged.length > 0) {
      message += `📌 Sin cambios: ${unchanged.length}\n`;
    }
    message += '\n¿Deseas continuar?';

    Alert.alert('Confirmar Cambios', message, [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Guardar',
        onPress: async () => {
          try {
            setSaving(true);

            await appPermissionsApi.setAppPermissions(appId, {
              permissionKeys: permissionsToSave,
            });

            console.log('✅ Permisos guardados exitosamente');
            Alert.alert('Éxito', `${permissionsToSave.length} permisos actualizados correctamente`);

            // Recargar datos para verificar
            await loadData();
          } catch (error: any) {
            console.error('❌ Error saving permissions:', error);
            const errorMessage = error.response?.data?.message || 'Error al guardar los permisos';
            Alert.alert('Error', errorMessage);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // Obtener módulos únicos
  const modules = ['all', ...new Set(allPermissions.map((p) => p.module))];

  // Filtrar permisos
  const filteredPermissions = allPermissions.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesModule = selectedModule === 'all' || p.module === selectedModule;

    return matchesSearch && matchesModule;
  });

  // Agrupar permisos por módulo
  const groupedPermissions = filteredPermissions.reduce(
    (acc, permission) => {
      const module = permission.module || 'Sin módulo';
      if (!acc[module]) {
        acc[module] = [];
      }
      acc[module].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  // Verificar si todos los permisos de un módulo están seleccionados
  const isModuleFullySelected = (module: string): boolean => {
    const modulePerms = groupedPermissions[module] || [];
    return modulePerms.length > 0 && modulePerms.every((p) => selectedPermissions.has(p.key));
  };

  // Verificar si algunos permisos de un módulo están seleccionados
  const isModulePartiallySelected = (module: string): boolean => {
    const modulePerms = groupedPermissions[module] || [];
    const selectedCount = modulePerms.filter((p) => selectedPermissions.has(p.key)).length;
    return selectedCount > 0 && selectedCount < modulePerms.length;
  };

  // Seleccionar/deseleccionar todos los permisos de un módulo
  const handleToggleModule = (module: string) => {
    const modulePerms = groupedPermissions[module] || [];
    const isFullySelected = isModuleFullySelected(module);

    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);

      if (isFullySelected) {
        // Deseleccionar todos
        modulePerms.forEach((p) => newSet.delete(p.key));
      } else {
        // Seleccionar todos
        modulePerms.forEach((p) => newSet.add(p.key));
      }

      return newSet;
    });
  };

  const renderPermissionItem = (permKey: string, description?: string) => {
    const isSelected = selectedPermissions.has(permKey);
    const wasOriginallyAssigned = appPermissions.some((p) => p.permissionKey === permKey);

    return (
      <TouchableOpacity
        key={permKey}
        style={[styles.permissionItem, isSelected && styles.permissionItemSelected]}
        onPress={() => handleTogglePermission(permKey)}
        activeOpacity={0.7}
      >
        <View style={styles.permissionInfo}>
          <View style={styles.permissionHeader}>
            <View style={styles.permissionKeyContainer}>
              <Text style={[styles.permissionKey, isSelected && styles.permissionKeySelected]}>
                {permKey}
              </Text>
              {wasOriginallyAssigned && (
                <View style={styles.assignedBadge}>
                  <Text style={styles.assignedBadgeText}>Asignado</Text>
                </View>
              )}
            </View>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
          {description && <Text style={styles.permissionDescription}>{description}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🔐 Gestión de Permisos</Text>
              <Text style={styles.subtitle}>{appName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Define qué acciones pueden realizar los usuarios dentro de esta app. Usa el formato:
                recurso.accion
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{appPermissions.length}</Text>
                <Text style={styles.statLabel}>Actuales</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{selectedPermissions.size}</Text>
                <Text style={styles.statLabel}>Seleccionados</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{allPermissions.length}</Text>
                <Text style={styles.statLabel}>Disponibles</Text>
              </View>
            </View>

            {/* Module Filter */}
            <View style={styles.moduleFilter}>
              <Text style={styles.filterLabel}>Filtrar por módulo:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.moduleScroll}
              >
                {modules.map((module) => (
                  <TouchableOpacity
                    key={module}
                    style={[
                      styles.moduleChip,
                      selectedModule === module && styles.moduleChipActive,
                    ]}
                    onPress={() => setSelectedModule(module)}
                  >
                    <Text
                      style={[
                        styles.moduleChipText,
                        selectedModule === module && styles.moduleChipTextActive,
                      ]}
                    >
                      {module === 'all' ? 'Todos' : module}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar permisos..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94A3B8"
                keyboardType="default"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Custom Permission */}
            <View style={styles.customPermissionSection}>
              <Text style={styles.sectionTitle}>Agregar Permiso Personalizado</Text>
              <View style={styles.customPermissionInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: stock.read"
                  value={customPermission}
                  onChangeText={setCustomPermission}
                  autoCapitalize="none"
                  placeholderTextColor="#94A3B8"
                  keyboardType="default"
                />
                <TouchableOpacity
                  style={styles.addCustomButton}
                  onPress={handleAddCustomPermission}
                >
                  <Text style={styles.addCustomButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>Formato: recurso.accion (ej: stock.read)</Text>
            </View>

            {/* Permissions List Grouped by Module */}
            <View style={styles.permissionsSection}>
              <Text style={styles.sectionTitle}>
                Permisos del Sistema ({filteredPermissions.length})
              </Text>

              {loadingPermissions ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#667eea" />
                </View>
              ) : filteredPermissions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No se encontraron permisos</Text>
                </View>
              ) : (
                <View style={styles.permissionsList}>
                  {Object.entries(groupedPermissions).map(([module, permissions]) => (
                    <View key={module} style={styles.moduleGroup}>
                      {/* Module Header */}
                      <TouchableOpacity
                        style={styles.moduleHeader}
                        onPress={() => handleToggleModule(module)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.moduleHeaderLeft}>
                          <View
                            style={[
                              styles.moduleCheckbox,
                              isModuleFullySelected(module) && styles.moduleCheckboxSelected,
                              isModulePartiallySelected(module) && styles.moduleCheckboxPartial,
                            ]}
                          >
                            {isModuleFullySelected(module) ? (
                              <Text style={styles.moduleCheckmark}>✓</Text>
                            ) : isModulePartiallySelected(module) ? (
                              <Text style={styles.moduleCheckmark}>−</Text>
                            ) : null}
                          </View>
                          <View>
                            <Text style={styles.moduleTitle}>{module}</Text>
                            <Text style={styles.moduleCount}>
                              {permissions.filter((p) => selectedPermissions.has(p.key)).length} de{' '}
                              {permissions.length} seleccionados
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.moduleToggleText}>
                          {isModuleFullySelected(module)
                            ? 'Deseleccionar todos'
                            : 'Seleccionar todos'}
                        </Text>
                      </TouchableOpacity>

                      {/* Module Permissions */}
                      <View style={styles.modulePermissions}>
                        {permissions.map((p) => renderPermissionItem(p.key, p.description))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Selected Custom Permissions (not in system) */}
            {Array.from(selectedPermissions).some(
              (p) => !allPermissions.find((ap) => ap.key === p)
            ) && (
              <View style={styles.permissionsSection}>
                <Text style={styles.sectionTitle}>Permisos Personalizados</Text>
                <View style={styles.permissionsList}>
                  {Array.from(selectedPermissions)
                    .filter((p) => !allPermissions.find((ap) => ap.key === p))
                    .map((p) => renderPermissionItem(p))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  infoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  infoText: {
    fontSize: 14,
    color: '#4F46E5',
    lineHeight: 20,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  clearIcon: {
    fontSize: 16,
    color: '#94A3B8',
    paddingHorizontal: 8,
  },
  customPermissionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  customPermissionInput: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addCustomButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  hint: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  permissionsSection: {
    marginBottom: 24,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  permissionsList: {
    gap: 8,
  },
  permissionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  permissionItemSelected: {
    borderColor: '#667eea',
    backgroundColor: '#F5F3FF',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  permissionKeyContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionKey: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'monospace',
  },
  permissionKeySelected: {
    color: '#667eea',
  },
  assignedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  assignedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
  },
  permissionDescription: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: '#667eea',
    backgroundColor: '#667eea',
  },
  checkmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#667eea',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  moduleFilter: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  moduleScroll: {
    flexGrow: 0,
  },
  moduleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moduleChipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  moduleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  moduleChipTextActive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
  moduleGroup: {
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  moduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moduleCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moduleCheckboxSelected: {
    borderColor: '#667eea',
    backgroundColor: '#667eea',
  },
  moduleCheckboxPartial: {
    borderColor: '#667eea',
    backgroundColor: '#EEF2FF',
  },
  moduleCheckmark: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  moduleCount: {
    fontSize: 12,
    color: '#64748B',
  },
  moduleToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  modulePermissions: {
    padding: 12,
    gap: 8,
  },
});

export default PermissionsManagementModal;
