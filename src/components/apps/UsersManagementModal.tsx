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
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { userAppRolesApi, AppUser, AssignUserRoleDto } from '@/services/api/apps';
import { usersApi, User } from '@/services/api/users';
import { rolesApi, Role } from '@/services/api/roles';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { warehousesApi } from '@/services/api/warehouses';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { Warehouse } from '@/types/warehouses';
import { useTenantStore } from '@/store/tenant';

interface UsersManagementModalProps {
  visible: boolean;
  appId: string;
  appName: string;
  onClose: () => void;
}

export const UsersManagementModal: React.FC<UsersManagementModalProps> = ({
  visible,
  appId,
  appName,
  onClose,
}) => {
  const { selectedCompany: tenantCompany } = useTenantStore();
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState<Warehouse[]>([]);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Scope configuration
  const [enableScope, setEnableScope] = useState(false);
  const [scopeLevel, setScopeLevel] = useState<'company' | 'site' | 'warehouse'>('site');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      loadAppUsers();
      loadAllUsers();
      loadRoles();
      loadCompanies();
      loadSites();
      loadWarehouses();
    }
  }, [visible, appId]);

  // Filter warehouses when site changes
  useEffect(() => {
    if (selectedSiteId && warehouses.length > 0) {
      const filtered = warehouses.filter((w) => w.siteId === selectedSiteId);
      setFilteredWarehouses(filtered);
    } else {
      setFilteredWarehouses(warehouses);
    }
  }, [selectedSiteId, warehouses]);

  const loadAppUsers = async () => {
    try {
      setLoading(true);
      const data = await userAppRolesApi.getAppUsers(appId);
      setAppUsers(data);
    } catch (error: any) {
      console.error('Error loading app users:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await usersApi.getUsers({ limit: 100 });
      setAllUsers(response.data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadRoles = async () => {
    try {
      const roles = await rolesApi.getRoles();
      setRoles(Array.isArray(roles) ? roles : []);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await companiesApi.getCompanies({ limit: 100, isActive: true });
      setCompanies(response.data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadSites = async () => {
    try {
      const response = await sitesApi.getSites({ limit: 100, isActive: true });
      setSites(response.data || []);
    } catch (error) {
      console.error('Error loading sites:', error);
    }
  };

  const loadWarehouses = async () => {
    try {
      const companyId = tenantCompany?.id;
      const data = await warehousesApi.getWarehouses(companyId);
      if (Array.isArray(data)) {
        setWarehouses(data);
      } else {
        setWarehouses([]);
      }
    } catch (error) {
      console.error('Error loading warehouses:', error);
      setWarehouses([]);
    }
  };

  const handleAssignUser = async () => {
    if (!selectedUserId) {
      Alert.alert('Error', 'Debe seleccionar un usuario');
      return;
    }

    if (!selectedRoleId) {
      Alert.alert('Error', 'Debe seleccionar un rol');
      return;
    }

    // Validate scope configuration if enabled
    if (enableScope) {
      if (scopeLevel === 'company' && !selectedCompanyId) {
        Alert.alert('Error', 'Debe seleccionar una compañía');
        return;
      }
      if (scopeLevel === 'site') {
        if (!selectedCompanyId) {
          Alert.alert('Error', 'Debe seleccionar una compañía');
          return;
        }
        if (!selectedSiteId) {
          Alert.alert('Error', 'Debe seleccionar una sede');
          return;
        }
      }
      if (scopeLevel === 'warehouse') {
        if (!selectedCompanyId) {
          Alert.alert('Error', 'Debe seleccionar una compañía');
          return;
        }
        if (!selectedSiteId) {
          Alert.alert('Error', 'Debe seleccionar una sede');
          return;
        }
        if (!selectedWarehouseId) {
          Alert.alert('Error', 'Debe seleccionar un almacén');
          return;
        }
      }
    }

    try {
      setAssigning(true);
      const assignData: AssignUserRoleDto = {
        userId: selectedUserId,
        appId,
        roleId: selectedRoleId,
      };

      // Add scope if enabled
      if (enableScope) {
        if (scopeLevel === 'company') {
          assignData.companyId = selectedCompanyId;
        } else if (scopeLevel === 'site') {
          assignData.companyId = selectedCompanyId;
          assignData.siteId = selectedSiteId;
        } else if (scopeLevel === 'warehouse') {
          assignData.companyId = selectedCompanyId;
          assignData.siteId = selectedSiteId;
          assignData.warehouseId = selectedWarehouseId;
        }
      }

      await userAppRolesApi.assignUserRole(assignData);
      Alert.alert('Éxito', 'Usuario asignado correctamente');
      setShowAddForm(false);
      resetForm();
      loadAppUsers();
    } catch (error: any) {
      console.error('Error assigning user:', error);
      const errorMessage = error.response?.data?.message || 'Error al asignar el usuario';
      Alert.alert('Error', errorMessage);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveUser = (userId: string, username: string) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas quitar el acceso de ${username} a esta app?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar Acceso',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAppRolesApi.removeUserRole(userId, appId);
              Alert.alert('Éxito', 'Acceso removido correctamente');
              loadAppUsers();
            } catch (error: any) {
              console.error('Error removing user:', error);
              Alert.alert('Error', 'No se pudo quitar el acceso');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setSelectedUserId('');
    setSelectedRoleId('');
    setEnableScope(false);
    setScopeLevel('site');
    setSelectedCompanyId('');
    setSelectedSiteId('');
    setSelectedWarehouseId('');
  };

  const filteredUsers = appUsers.filter(
    (user) =>
      searchQuery === '' ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.roleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableUsers = allUsers.filter(
    (user) => !appUsers.some((appUser) => appUser.userId === user.id)
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderUserCard = (user: AppUser) => (
    <View key={user.userId} style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{user.username.substring(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.username}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveUser(user.userId, user.username)}
          style={styles.removeButton}
        >
          <Text style={styles.removeButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.userFooter}>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user.roleName}</Text>
        </View>
        <Text style={styles.assignedDate}>Asignado: {formatDate(user.assignedAt)}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>👥 Gestión de Usuarios</Text>
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
                Asigna usuarios a esta app y define sus roles. Los usuarios solo podrán acceder a
                esta app si tienen un rol asignado.
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{appUsers.length}</Text>
                <Text style={styles.statLabel}>Usuarios</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{availableUsers.length}</Text>
                <Text style={styles.statLabel}>Disponibles</Text>
              </View>
            </View>

            {/* Add User Button */}
            {!showAddForm && (
              <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(true)}>
                <Text style={styles.addButtonText}>+ Asignar Usuario</Text>
              </TouchableOpacity>
            )}

            {/* Add Form */}
            {showAddForm && (
              <View style={styles.addForm}>
                <Text style={styles.formTitle}>Asignar Usuario</Text>

                {/* User Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Usuario</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedUserId}
                      onValueChange={setSelectedUserId}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar usuario..." value="" />
                      {availableUsers.map((user) => (
                        <Picker.Item
                          key={user.id}
                          label={`${user.username || user.email} - ${user.email}`}
                          value={user.id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Role Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Rol</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedRoleId}
                      onValueChange={setSelectedRoleId}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar rol..." value="" />
                      {roles.map((role) => (
                        <Picker.Item
                          key={role.id}
                          label={`${role.name} (${role.code})`}
                          value={role.id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Scope Configuration */}
                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <View>
                      <Text style={styles.switchLabel}>Configurar Scope (Alcance)</Text>
                      <Text style={styles.switchHint}>Define el alcance de acceso del usuario</Text>
                    </View>
                    <Switch
                      value={enableScope}
                      onValueChange={setEnableScope}
                      trackColor={{ false: colors.neutral[200], true: colors.accent[500] }}
                      thumbColor={enableScope ? colors.neutral[0] : colors.neutral[400]}
                    />
                  </View>
                </View>

                {/* Scope Level Selection */}
                {enableScope && (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Nivel de Scope</Text>
                      <View style={styles.typeButtons}>
                        <TouchableOpacity
                          style={[
                            styles.typeButton,
                            scopeLevel === 'company' && styles.typeButtonActive,
                          ]}
                          onPress={() => {
                            setScopeLevel('company');
                            setSelectedSiteId('');
                            setSelectedWarehouseId('');
                          }}
                        >
                          <Text
                            style={[
                              styles.typeButtonText,
                              scopeLevel === 'company' && styles.typeButtonTextActive,
                            ]}
                          >
                            🏢 Empresa
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.typeButton,
                            scopeLevel === 'site' && styles.typeButtonActive,
                          ]}
                          onPress={() => {
                            setScopeLevel('site');
                            setSelectedWarehouseId('');
                          }}
                        >
                          <Text
                            style={[
                              styles.typeButtonText,
                              scopeLevel === 'site' && styles.typeButtonTextActive,
                            ]}
                          >
                            📍 Sede
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.typeButton,
                            scopeLevel === 'warehouse' && styles.typeButtonActive,
                          ]}
                          onPress={() => setScopeLevel('warehouse')}
                        >
                          <Text
                            style={[
                              styles.typeButtonText,
                              scopeLevel === 'warehouse' && styles.typeButtonTextActive,
                            ]}
                          >
                            🏢 Almacén
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Company Selector */}
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Compañía</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={selectedCompanyId}
                          onValueChange={(value) => {
                            setSelectedCompanyId(value);
                            setSelectedSiteId('');
                            setSelectedWarehouseId('');
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar compañía..." value="" />
                          {companies.map((company) => (
                            <Picker.Item
                              key={company.id}
                              label={
                                company.ruc ? `${company.name} (${company.ruc})` : company.name
                              }
                              value={company.id}
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>

                    {/* Site Selector */}
                    {(scopeLevel === 'site' || scopeLevel === 'warehouse') && selectedCompanyId && (
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Sede</Text>
                        <View style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedSiteId}
                            onValueChange={(value) => {
                              setSelectedSiteId(value);
                              setSelectedWarehouseId('');
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar sede..." value="" />
                            {sites.map((site) => (
                              <Picker.Item
                                key={site.id}
                                label={`${site.code} - ${site.name}`}
                                value={site.id}
                              />
                            ))}
                          </Picker>
                        </View>
                      </View>
                    )}

                    {/* Warehouse Selector */}
                    {scopeLevel === 'warehouse' && selectedCompanyId && selectedSiteId && (
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Almacén</Text>
                        <View style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedWarehouseId}
                            onValueChange={setSelectedWarehouseId}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar almacén..." value="" />
                            {filteredWarehouses.map((warehouse) => (
                              <Picker.Item
                                key={warehouse.id}
                                label={
                                  warehouse.code
                                    ? `${warehouse.code} - ${warehouse.name}`
                                    : warehouse.name
                                }
                                value={warehouse.id}
                              />
                            ))}
                          </Picker>
                        </View>
                        {selectedSiteId && filteredWarehouses.length === 0 && (
                          <Text style={styles.hint}>
                            ⚠️ No hay almacenes disponibles para esta sede
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                )}

                {/* Form Actions */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    disabled={assigning}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, assigning && styles.saveButtonDisabled]}
                    onPress={handleAssignUser}
                    disabled={assigning}
                  >
                    {assigning ? (
                      <ActivityIndicator color={colors.neutral[0]} />
                    ) : (
                      <Text style={styles.saveButtonText}>Asignar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Search */}
            {appUsers.length > 0 && (
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar usuarios..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={colors.neutral[400]}
                  keyboardType="default"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={styles.clearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Users List */}
            <View style={styles.usersList}>
              <Text style={styles.sectionTitle}>Usuarios Asignados ({filteredUsers.length})</Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.accent[500]} />
                </View>
              ) : filteredUsers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'No se encontraron usuarios' : 'No hay usuarios asignados'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {searchQuery
                      ? 'Intenta con otros términos de búsqueda'
                      : 'Asigna usuarios para que puedan acceder a esta app'}
                  </Text>
                </View>
              ) : (
                filteredUsers.map(renderUserCard)
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
              <Text style={styles.closeFooterButtonText}>Cerrar</Text>
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
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
  },
  infoCard: {
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  infoText: {
    fontSize: 14,
    color: colors.primary[600],
    lineHeight: 20,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent[500],
    marginBottom: spacing[1],
  },
  statLabel: {
    fontSize: 13,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing[4],
  },
  addButton: {
    backgroundColor: colors.accent[500],
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing[5],
    shadowColor: colors.accent[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  addForm: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[4],
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  pickerContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: colors.neutral[800],
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  switchHint: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: colors.accent[500],
    backgroundColor: colors.accent[50],
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  typeButtonTextActive: {
    color: colors.accent[500],
  },
  hint: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[1],
    fontStyle: 'italic',
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.success[500],
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  searchIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.neutral[800],
  },
  clearIcon: {
    fontSize: 16,
    color: colors.neutral[400],
    paddingHorizontal: spacing[2],
  },
  usersList: {
    marginTop: spacing[2],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[1],
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    fontSize: 18,
  },
  userFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleBadge: {
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent[500],
  },
  assignedDate: {
    fontSize: 12,
    color: colors.neutral[400],
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  closeFooterButton: {
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
});

export default UsersManagementModal;
