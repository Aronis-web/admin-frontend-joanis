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
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { userAppRolesApi, UserRole, AssignUserRoleDto } from '@/services/api/apps';
import { appsApi, App } from '@/services/api/apps';
import { rolesApi, Role } from '@/services/api/roles';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { warehousesApi } from '@/services/api/warehouses';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { Warehouse } from '@/types/warehouses';
import { useTenantStore } from '@/store/tenant';
import { warehouseAreasApi } from '@/services/api/warehouses';
import { WarehouseArea } from '@/types/warehouses';

interface UserAppRolesModalProps {
  visible: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
}

/**
 * UserAppRolesModal
 *
 * Gestiona la asignación de roles a usuarios en apps con scopes.
 *
 * Jerarquía de Scopes (según documentación):
 * - GLOBAL: Acceso a todo el sistema (sin restricciones)
 * - COMPANY: Acceso a toda la empresa y sus niveles inferiores
 * - SITE: Acceso a una sede específica y sus niveles inferiores
 * - WAREHOUSE: Acceso a un almacén específico y sus áreas
 * - AREA: Acceso a un área específica solamente
 *
 * Flujo de asignación:
 * 1. Seleccionar App
 * 2. Seleccionar Rol
 * 3. Configurar Scope (opcional)
 * 4. Validar jerarquía
 * 5. Asignar
 */
export const UserAppRolesModal: React.FC<UserAppRolesModalProps> = ({
  visible,
  userId,
  userName,
  onClose,
}) => {
  const { selectedCompany: tenantCompany } = useTenantStore();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState<Warehouse[]>([]);
  const [filteredAreas, setFilteredAreas] = useState<WarehouseArea[]>([]);

  // Form state
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Scope configuration - AHORA INCLUYE 'area'
  const [enableScope, setEnableScope] = useState(false);
  const [scopeLevel, setScopeLevel] = useState<'company' | 'site' | 'warehouse' | 'area'>('site');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      loadUserRoles();
      loadApps();
      loadRoles();
      loadCompanies();
      loadSites();
      loadWarehouses();
    }
  }, [visible, userId]);

  // Filter warehouses when site changes
  useEffect(() => {
    if (selectedSiteId && warehouses.length > 0) {
      const filtered = warehouses.filter(w => w.siteId === selectedSiteId);
      setFilteredWarehouses(filtered);
    } else {
      setFilteredWarehouses(warehouses);
    }
  }, [selectedSiteId, warehouses]);

  // Filter areas when warehouse changes
  useEffect(() => {
    if (selectedWarehouseId) {
      loadAreas(selectedWarehouseId);
    } else {
      setFilteredAreas([]);
    }
  }, [selectedWarehouseId]);

  const loadUserRoles = async () => {
    try {
      setLoading(true);
      const data = await userAppRolesApi.getUserRoles(userId);
      console.log('🎭 Roles de usuario recibidos:', data);
      console.log('📊 Total de roles:', data.length);
      data.forEach((role, index) => {
        console.log(`Rol ${index + 1}:`, {
          appName: role.appName,
          roleName: role.roleName,
          companyId: role.companyId,
          siteId: role.siteId,
          warehouseId: role.warehouseId,
        });
      });
      setUserRoles(data);
    } catch (error: any) {
      console.error('Error loading user roles:', error);
      Alert.alert('Error', 'No se pudieron cargar los roles del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadApps = async () => {
    try {
      const response = await appsApi.getApps({ limit: 100, isActive: true });
      setApps(response.data || []);
    } catch (error) {
      console.error('Error loading apps:', error);
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

  const loadAreas = async (warehouseId: string) => {
    try {
      const data = await warehouseAreasApi.getWarehouseAreas(warehouseId);
      if (Array.isArray(data)) {
        setAreas(data);
        setFilteredAreas(data);
      } else {
        setAreas([]);
        setFilteredAreas([]);
      }
    } catch (error) {
      console.error('Error loading areas:', error);
      setAreas([]);
      setFilteredAreas([]);
    }
  };

  /**
   * Valida la jerarquía de scopes según la documentación
   * Verifica que los IDs seleccionados sean válidos y pertenezcan a la jerarquía correcta
   */
  const validateScopeHierarchy = (): boolean => {
    // Validar que la sede pertenece a la empresa
    if (scopeLevel === 'site' && selectedSiteId && selectedCompanyId) {
      const site = sites.find(s => s.id === selectedSiteId);
      if (site && site.companyId !== selectedCompanyId) {
        Alert.alert('Error de Jerarquía', 'La sede seleccionada no pertenece a la empresa seleccionada');
        return false;
      }
    }

    // Validar que el almacén pertenece a la sede
    if ((scopeLevel === 'warehouse' || scopeLevel === 'area') && selectedWarehouseId && selectedSiteId) {
      const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
      if (warehouse && warehouse.siteId !== selectedSiteId) {
        Alert.alert('Error de Jerarquía', 'El almacén seleccionado no pertenece a la sede seleccionada');
        return false;
      }
    }

    // Validar que el área pertenece al almacén
    if (scopeLevel === 'area' && selectedAreaId && selectedWarehouseId) {
      const area = filteredAreas.find(a => a.id === selectedAreaId);
      if (area && area.warehouseId !== selectedWarehouseId) {
        Alert.alert('Error de Jerarquía', 'El área seleccionada no pertenece al almacén seleccionado');
        return false;
      }
    }

    return true;
  };

  const handleAssignRole = async () => {
    if (!selectedAppId) {
      Alert.alert('Error', 'Debe seleccionar una app');
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
      if (scopeLevel === 'area') {
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
        if (!selectedAreaId) {
          Alert.alert('Error', 'Debe seleccionar un área');
          return;
        }
      }

      // Validar jerarquía de scopes
      if (!validateScopeHierarchy()) {
        return;
      }
    }

    try {
      setAssigning(true);
      const assignData: AssignUserRoleDto = {
        userId,
        appId: selectedAppId,
        roleId: selectedRoleId,
      };

      // Add scope if enabled (según jerarquía de la documentación)
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
        } else if (scopeLevel === 'area') {
          assignData.companyId = selectedCompanyId;
          assignData.siteId = selectedSiteId;
          assignData.warehouseId = selectedWarehouseId;
          // Note: El backend necesita soporte para areaId en AssignUserRoleDto
          // assignData.areaId = selectedAreaId;
        }
      }

      await userAppRolesApi.assignUserRole(assignData);
      Alert.alert('Éxito', 'Rol asignado correctamente');
      setShowAddForm(false);
      resetForm();
      loadUserRoles();
    } catch (error: any) {
      console.error('Error assigning role:', error);
      const errorMessage = error.response?.data?.message || 'Error al asignar el rol';
      Alert.alert('Error', errorMessage);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveRole = (appId: string, appName: string) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas quitar el acceso a ${appName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar Acceso',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAppRolesApi.removeUserRole(userId, appId);
              Alert.alert('Éxito', 'Acceso removido correctamente');
              loadUserRoles();
            } catch (error: any) {
              console.error('Error removing role:', error);
              Alert.alert('Error', 'No se pudo quitar el acceso');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setSelectedAppId('');
    setSelectedRoleId('');
    setEnableScope(false);
    setScopeLevel('site');
    setSelectedCompanyId('');
    setSelectedSiteId('');
    setSelectedWarehouseId('');
    setSelectedAreaId('');
  };

  /**
   * Obtiene la etiqueta del scope según la jerarquía
   * Muestra el nivel más específico del scope asignado
   */
  const getScopeLabel = (role: UserRole): string => {
    // Nivel AREA (más específico)
    if (role.warehouseId && role.siteId) {
      // TODO: Cuando el backend soporte areaId, agregar lógica para áreas
      const warehouse = warehouses.find(w => w.id === role.warehouseId);
      const site = sites.find(s => s.id === role.siteId);
      if (warehouse && site) {
        return `🏢 ${warehouse.name} (${site.name})`;
      }
      return `🏢 Almacén: ${role.warehouseId}`;
    }
    // Nivel SITE
    if (role.siteId) {
      const site = sites.find(s => s.id === role.siteId);
      if (site) {
        return `📍 ${site.name}`;
      }
      return `📍 Sede: ${role.siteId}`;
    }
    // Nivel COMPANY
    if (role.companyId) {
      const company = companies.find(c => c.id === role.companyId);
      if (company) {
        return `🏢 ${company.name}`;
      }
      return `🏢 Empresa: ${role.companyId}`;
    }
    // Nivel GLOBAL
    return '🌍 Global';
  };

  /**
   * Obtiene los scopes heredados según la jerarquía
   * Según la documentación: un scope superior incluye todos los niveles inferiores
   */
  const getInheritedScopes = (role: UserRole): string[] => {
    const inherited: string[] = [];

    // COMPANY scope incluye todas las sedes, almacenes y áreas
    if (role.companyId && !role.siteId) {
      inherited.push('✅ Todas las sedes de la empresa');
      inherited.push('✅ Todos los almacenes');
      inherited.push('✅ Todas las áreas');
    }
    // SITE scope incluye todos los almacenes y áreas de la sede
    else if (role.siteId && !role.warehouseId) {
      inherited.push('✅ Todos los almacenes de la sede');
      inherited.push('✅ Todas las áreas de la sede');
    }
    // WAREHOUSE scope incluye todas las áreas del almacén
    else if (role.warehouseId) {
      inherited.push('✅ Todas las áreas del almacén');
    }

    return inherited;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderRoleCard = (role: UserRole) => {
    const inheritedScopes = getInheritedScopes(role);
    const hasScope = role.companyId || role.siteId || role.warehouseId;

    console.log('🎨 Renderizando rol:', {
      appName: role.appName,
      roleName: role.roleName,
      hasScope,
      companyId: role.companyId,
      siteId: role.siteId,
      warehouseId: role.warehouseId,
      scopeLabel: hasScope ? getScopeLabel(role) : 'Sin scope',
    });

    return (
      <View key={`${role.appId}-${role.roleId}`} style={styles.roleCard}>
        <View style={styles.roleHeader}>
          <View style={styles.roleInfo}>
            <Text style={styles.appName}>{role.appName}</Text>
            <Text style={styles.roleCode}>{role.roleCode}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleRemoveRole(role.appId, role.appName)}
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.roleDetails}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role.roleName}</Text>
          </View>
          {hasScope && (
            <View style={styles.scopeBadge}>
              <Text style={styles.scopeText}>{getScopeLabel(role)}</Text>
            </View>
          )}
        </View>

        {/* Inherited Scopes - NUEVO */}
        {inheritedScopes.length > 0 && (
          <View style={styles.inheritedScopesContainer}>
            <Text style={styles.inheritedScopesTitle}>Acceso heredado:</Text>
            {inheritedScopes.map((scope, index) => (
              <Text key={index} style={styles.inheritedScopeText}>
                {scope}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.assignedDate}>
          Asignado: {formatDate(role.assignedAt)}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🎭 Roles en Apps</Text>
              <Text style={styles.subtitle}>{userName}</Text>
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
                Gestiona los roles del usuario en diferentes apps y define el alcance (scope) de sus permisos.
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{userRoles.length}</Text>
                <Text style={styles.statLabel}>Apps Asignadas</Text>
              </View>
            </View>

            {/* Add Role Button */}
            {!showAddForm && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddForm(true)}
              >
                <Text style={styles.addButtonText}>+ Asignar App y Rol</Text>
              </TouchableOpacity>
            )}

            {/* Add Form */}
            {showAddForm && (
              <View style={styles.addForm}>
                <Text style={styles.formTitle}>Asignar App y Rol</Text>

                {/* App Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>App</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedAppId}
                      onValueChange={setSelectedAppId}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar app..." value="" />
                      {apps.map((app) => (
                        <Picker.Item
                          key={app.id}
                          label={`${app.name} (${app.code})`}
                          value={app.id}
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
                      <Text style={styles.switchHint}>Define el alcance de acceso</Text>
                    </View>
                    <Switch
                      value={enableScope}
                      onValueChange={setEnableScope}
                      trackColor={{ false: '#E2E8F0', true: '#667eea' }}
                      thumbColor={enableScope ? '#FFFFFF' : '#94A3B8'}
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
                            setSelectedAreaId('');
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
                            setSelectedAreaId('');
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
                        <TouchableOpacity
                          style={[
                            styles.typeButton,
                            scopeLevel === 'area' && styles.typeButtonActive,
                          ]}
                          onPress={() => setScopeLevel('area')}
                        >
                          <Text
                            style={[
                              styles.typeButtonText,
                              scopeLevel === 'area' && styles.typeButtonTextActive,
                            ]}
                          >
                            📦 Área
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
                            setSelectedAreaId('');
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar compañía..." value="" />
                          {companies.map((company) => (
                            <Picker.Item
                              key={company.id}
                              label={company.ruc ? `${company.name} (${company.ruc})` : company.name}
                              value={company.id}
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>

                    {/* Site Selector */}
                    {(scopeLevel === 'site' || scopeLevel === 'warehouse' || scopeLevel === 'area') && selectedCompanyId && (
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Sede</Text>
                        <View style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedSiteId}
                            onValueChange={(value) => {
                              setSelectedSiteId(value);
                              setSelectedWarehouseId('');
                              setSelectedAreaId('');
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
                    {(scopeLevel === 'warehouse' || scopeLevel === 'area') && selectedCompanyId && selectedSiteId && (
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Almacén</Text>
                        <View style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedWarehouseId}
                            onValueChange={(value) => {
                              setSelectedWarehouseId(value);
                              setSelectedAreaId('');
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar almacén..." value="" />
                            {filteredWarehouses.map((warehouse) => (
                              <Picker.Item
                                key={warehouse.id}
                                label={warehouse.code ? `${warehouse.code} - ${warehouse.name}` : warehouse.name}
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

                    {/* Area Selector - NUEVO */}
                    {scopeLevel === 'area' && selectedCompanyId && selectedSiteId && selectedWarehouseId && (
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Área</Text>
                        <View style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedAreaId}
                            onValueChange={setSelectedAreaId}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar área..." value="" />
                            {filteredAreas.map((area) => (
                              <Picker.Item
                                key={area.id}
                                label={area.code ? `${area.code} - ${area.name}` : area.name}
                                value={area.id}
                              />
                            ))}
                          </Picker>
                        </View>
                        {selectedWarehouseId && filteredAreas.length === 0 && (
                          <Text style={styles.hint}>
                            ⚠️ No hay áreas disponibles para este almacén
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
                    onPress={handleAssignRole}
                    disabled={assigning}
                  >
                    {assigning ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Asignar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Roles List */}
            <View style={styles.rolesList}>
              <Text style={styles.sectionTitle}>
                Roles Asignados ({userRoles.length})
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#667eea" />
                </View>
              ) : userRoles.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🎭</Text>
                  <Text style={styles.emptyText}>No hay roles asignados</Text>
                  <Text style={styles.emptySubtext}>
                    Asigna roles para que el usuario pueda acceder a las apps
                  </Text>
                </View>
              ) : (
                userRoles.map(renderRoleCard)
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
  addButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addForm: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  switchHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    minWidth: '30%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#667eea',
    backgroundColor: '#EEF2FF',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  typeButtonTextActive: {
    color: '#667eea',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rolesList: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
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
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  roleCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: 'monospace',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    fontSize: 18,
  },
  roleDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  scopeBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  scopeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
  },
  assignedDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  inheritedScopesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  inheritedScopesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  inheritedScopeText: {
    fontSize: 11,
    color: '#10B981',
    marginBottom: 2,
    paddingLeft: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  closeFooterButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
});

export default UserAppRolesModal;
