import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { scopesApi, UserScope, AssignUserScopeDto, ScopeLevel } from '@/services/api/scopes';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { warehousesApi } from '@/services/api/warehouses';
import { warehouseAreasApi } from '@/services/api/warehouses';
import { appsApi, App } from '@/services/api/apps';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { Warehouse } from '@/types/warehouses';
import { WarehouseArea } from '@/types/warehouses';

interface UserScopesModalProps {
  visible: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
}

/**
 * UserScopesModal
 *
 * Gestiona los scopes (alcances) de un usuario por aplicación:
 * - Asignación de scopes a usuarios
 * - Visualización de scopes existentes
 * - Actualización de permisos (lectura/escritura)
 * - Revocación de scopes
 *
 * Basado en la nueva API de scopes:
 * - POST /scopes/users/:userId/apps/:appId - Asignar scope
 * - GET /scopes/users/:userId/apps/:appId - Obtener scopes
 * - PUT /scopes/users/:userScopeId - Actualizar scope
 * - DELETE /scopes/users/:userScopeId - Revocar scope
 */
export const UserScopesModal: React.FC<UserScopesModalProps> = ({
  visible,
  userId,
  userName,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingScopes, setLoadingScopes] = useState(false);

  // App selection
  const [apps, setApps] = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [userScopes, setUserScopes] = useState<UserScope[]>([]);

  // Add scope form
  const [showAddForm, setShowAddForm] = useState(false);
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>('WAREHOUSE');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);

  // Data for selectors
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [areas, setAreas] = useState<WarehouseArea[]>([]);

  const loadApps = async () => {
    try {
      const response = await appsApi.getApps({ limit: 100 });
      const appsList = response.data || [];
      setApps(appsList);

      // Select the first app by default
      if (appsList.length > 0 && !selectedAppId) {
        setSelectedAppId(appsList[0].id);
      }
    } catch (error) {
      console.error('Error loading apps:', error);
      Alert.alert('Error', 'No se pudieron cargar las aplicaciones');
    }
  };

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadApps();
      loadCompanies();
    }
  }, [visible]);

  // Load user scopes when app changes
  useEffect(() => {
    if (visible && selectedAppId) {
      loadUserScopes();
    }
  }, [visible, userId, selectedAppId]);

  // Load sites when company changes
  useEffect(() => {
    if (selectedCompany) {
      loadSites(selectedCompany);
    } else {
      setSites([]);
      setSelectedSite('');
      setWarehouses([]);
      setSelectedWarehouse('');
      setAreas([]);
      setSelectedArea('');
    }
  }, [selectedCompany]);

  // Load warehouses when site changes
  useEffect(() => {
    if (selectedSite) {
      loadWarehouses(selectedSite);
    } else {
      setWarehouses([]);
      setSelectedWarehouse('');
      setAreas([]);
      setSelectedArea('');
    }
  }, [selectedSite]);

  // Load areas when warehouse changes
  useEffect(() => {
    if (selectedWarehouse) {
      loadAreas(selectedWarehouse);
    } else {
      setAreas([]);
      setSelectedArea('');
    }
  }, [selectedWarehouse]);

  const loadCompanies = async () => {
    try {
      const response = await companiesApi.getCompanies({ limit: 100, isActive: true });
      setCompanies(response.data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadSites = async (companyId: string) => {
    try {
      const response = await sitesApi.getSites({ companyId, limit: 100 });
      setSites(response.data || []);
    } catch (error) {
      console.error('Error loading sites:', error);
    }
  };

  const loadWarehouses = async (siteId: string) => {
    try {
      const response = await warehousesApi.getWarehouses(undefined, siteId);
      setWarehouses(response || []);
    } catch (error) {
      console.error('Error loading warehouses:', error);
    }
  };

  const loadAreas = async (warehouseId: string) => {
    try {
      const response = await warehouseAreasApi.getWarehouseAreas(warehouseId);
      setAreas(response.data || []);
    } catch (error) {
      console.error('Error loading areas:', error);
    }
  };

  const loadUserScopes = async () => {
    if (!selectedAppId) {
      return;
    }

    setLoadingScopes(true);
    try {
      const response = await scopesApi.getUserScopes(userId, selectedAppId);
      setUserScopes(response.items);
      console.log('🎯 User scopes loaded:', response.items);
    } catch (error) {
      console.error('Error loading user scopes:', error);
      Alert.alert('Error', 'No se pudieron cargar los scopes del usuario');
      setUserScopes([]);
    } finally {
      setLoadingScopes(false);
    }
  };

  const handleAssignScope = async () => {
    // Validar según el nivel de scope
    if (scopeLevel === 'WAREHOUSE' && !selectedWarehouse) {
      // Si es nivel WAREHOUSE pero no seleccionó almacén, es opcional
      // Se puede asignar scope a nivel de sede o compañía
    }
    if (scopeLevel === 'AREA' && !selectedArea) {
      Alert.alert('Error', 'Debes seleccionar un área para el nivel Área');
      return;
    }

    setLoading(true);
    try {
      const scopeData: AssignUserScopeDto = {
        level: scopeLevel,
        canRead,
        canWrite,
      };

      // Agregar IDs según lo que se haya seleccionado (todos opcionales)
      if (selectedCompany) {
        scopeData.companyId = selectedCompany;
      }
      if (selectedSite) {
        scopeData.siteId = selectedSite;
      }
      if (selectedWarehouse) {
        scopeData.warehouseId = selectedWarehouse;
      }
      if (selectedArea) {
        scopeData.areaId = selectedArea;
      }

      await scopesApi.assignUserScope(userId, selectedAppId, scopeData);
      Alert.alert('Éxito', 'Scope asignado correctamente');
      setShowAddForm(false);
      resetForm();
      loadUserScopes();
    } catch (error: any) {
      console.error('Error assigning scope:', error);
      Alert.alert('Error', error.message || 'No se pudo asignar el scope');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateScope = async (
    userScopeId: string,
    updates: { canRead: boolean; canWrite: boolean }
  ) => {
    try {
      await scopesApi.updateUserScope(userScopeId, updates);
      Alert.alert('Éxito', 'Scope actualizado correctamente');
      loadUserScopes();
    } catch (error: any) {
      console.error('Error updating scope:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el scope');
    }
  };

  const handleRevokeScope = (userScopeId: string) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas revocar este scope?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revocar',
        style: 'destructive',
        onPress: async () => {
          try {
            await scopesApi.revokeUserScope(userScopeId);
            Alert.alert('Éxito', 'Scope revocado correctamente');
            loadUserScopes();
          } catch (error: any) {
            console.error('Error revoking scope:', error);
            Alert.alert('Error', error.message || 'No se pudo revocar el scope');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setScopeLevel('WAREHOUSE');
    setSelectedCompany('');
    setSelectedSite('');
    setSelectedWarehouse('');
    setSelectedArea('');
    setCanRead(true);
    setCanWrite(false);
  };

  const getScopeLabel = (scope: UserScope): string => {
    const company = companies.find((c) => c.id === scope.companyId);
    const site = sites.find((s) => s.id === scope.siteId);
    const warehouse = warehouses.find((w) => w.id === scope.warehouseId);
    const area = areas.find((a) => a.id === scope.areaId);

    switch (scope.level) {
      case 'AREA':
        return `📦 Área: ${area?.name || scope.areaId} - ${warehouse?.name || scope.warehouseId}`;
      case 'WAREHOUSE':
        return `🏢 Almacén: ${warehouse?.name || scope.warehouseId} - ${site?.name || scope.siteId}`;
      case 'SITE':
        return `📍 Sede: ${site?.name || scope.siteId} - ${company?.name || scope.companyId}`;
      case 'COMPANY':
        return `🏢 Compañía: ${company?.name || scope.companyId}`;
      default:
        return '🌍 Global';
    }
  };

  const getLevelColor = (level: string): string => {
    const colors: Record<string, string> = {
      COMPANY: '#3B82F6',
      SITE: '#10B981',
      WAREHOUSE: '#F59E0B',
      AREA: '#8B5CF6',
    };
    return colors[level] || '#6B7280';
  };

  const renderScopeCard = (scope: UserScope) => (
    <View key={scope.id} style={styles.scopeCard}>
      <View style={styles.scopeHeader}>
        <Text style={styles.scopeLabel}>{getScopeLabel(scope)}</Text>
        <View style={[styles.levelBadge, { backgroundColor: getLevelColor(scope.level) }]}>
          <Text style={styles.levelText}>{scope.level}</Text>
        </View>
      </View>

      <View style={styles.scopePermissions}>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Lectura:</Text>
          <Switch
            value={scope.canRead}
            onValueChange={(value) =>
              handleUpdateScope(scope.id, { canRead: value, canWrite: scope.canWrite })
            }
            trackColor={{ false: '#CBD5E1', true: '#10B981' }}
            thumbColor={scope.canRead ? '#FFFFFF' : '#94A3B8'}
          />
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Escritura:</Text>
          <Switch
            value={scope.canWrite}
            onValueChange={(value) =>
              handleUpdateScope(scope.id, { canRead: scope.canRead, canWrite: value })
            }
            trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
            thumbColor={scope.canWrite ? '#FFFFFF' : '#94A3B8'}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.revokeButton} onPress={() => handleRevokeScope(scope.id)}>
        <Text style={styles.revokeButtonText}>🗑️ Revocar Scope</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>🎯 Gestión de Scopes</Text>
              <Text style={styles.modalSubtitle}>Usuario: {userName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* App Selector */}
            <View style={styles.section}>
              <Text style={styles.label}>Seleccionar Aplicación:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedAppId}
                  onValueChange={setSelectedAppId}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar aplicación..." value="" />
                  {apps.map((app) => (
                    <Picker.Item key={app.id} label={app.name} value={app.id} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Add Scope Button */}
            {!showAddForm && (
              <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(true)}>
                <Text style={styles.addButtonText}>+ Asignar Nuevo Scope</Text>
              </TouchableOpacity>
            )}

            {/* Add Scope Form */}
            {showAddForm && (
              <View style={styles.addForm}>
                <Text style={styles.formTitle}>Asignar Scope</Text>

                {/* Scope Level */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Nivel de Scope:</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={scopeLevel}
                      onValueChange={(value: ScopeLevel) => {
                        setScopeLevel(value);
                        // Reset selections when changing level
                        if (value === 'COMPANY') {
                          setSelectedSite('');
                          setSelectedWarehouse('');
                          setSelectedArea('');
                        } else if (value === 'SITE') {
                          setSelectedWarehouse('');
                          setSelectedArea('');
                        } else if (value === 'WAREHOUSE') {
                          setSelectedArea('');
                        }
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Compañía" value="COMPANY" />
                      <Picker.Item label="Sede" value="SITE" />
                      <Picker.Item label="Almacén" value="WAREHOUSE" />
                      <Picker.Item label="Área" value="AREA" />
                    </Picker>
                  </View>
                </View>

                {/* Company Selector - Always visible */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Compañía:</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedCompany}
                      onValueChange={setSelectedCompany}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar compañía..." value="" />
                      {companies.map((company) => (
                        <Picker.Item
                          key={company.id}
                          label={`${company.name} (${company.code})`}
                          value={company.id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Site Selector - Optional, visible if company selected or level is SITE+ */}
                {(selectedCompany ||
                  scopeLevel === 'SITE' ||
                  scopeLevel === 'WAREHOUSE' ||
                  scopeLevel === 'AREA') && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Sede (Opcional):</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedSite}
                        onValueChange={setSelectedSite}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todas las sedes" value="" />
                        {sites.map((site) => (
                          <Picker.Item
                            key={site.id}
                            label={`${site.name} (${site.code})`}
                            value={site.id}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                {/* Warehouse Selector - Optional, visible if site selected or level is WAREHOUSE+ */}
                {(selectedSite || scopeLevel === 'WAREHOUSE' || scopeLevel === 'AREA') && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Almacén (Opcional):</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedWarehouse}
                        onValueChange={setSelectedWarehouse}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todos los almacenes" value="" />
                        {warehouses.map((warehouse) => (
                          <Picker.Item
                            key={warehouse.id}
                            label={warehouse.name}
                            value={warehouse.id}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                {/* Area Selector - Only for AREA level */}
                {scopeLevel === 'AREA' && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Área:</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedArea}
                        onValueChange={setSelectedArea}
                        style={styles.picker}
                      >
                        <Picker.Item label="Seleccionar área..." value="" />
                        {areas.map((area) => (
                          <Picker.Item key={area.id} label={area.name} value={area.id} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                {/* Permissions */}
                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Permitir Lectura</Text>
                    <Switch
                      value={canRead}
                      onValueChange={setCanRead}
                      trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                      thumbColor={canRead ? '#FFFFFF' : '#94A3B8'}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Permitir Escritura</Text>
                    <Switch
                      value={canWrite}
                      onValueChange={setCanWrite}
                      trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                      thumbColor={canWrite ? '#FFFFFF' : '#94A3B8'}
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.formButton, styles.cancelButton]}
                    onPress={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formButton, styles.submitButton]}
                    onPress={handleAssignScope}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>Asignar Scope</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* User Scopes List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Scopes Asignados ({userScopes.length})</Text>

              {loadingScopes ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.loadingText}>Cargando scopes...</Text>
                </View>
              ) : userScopes.length > 0 ? (
                <View style={styles.scopesList}>{userScopes.map(renderScopeCard)}</View>
              ) : selectedAppId ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>🎯</Text>
                  <Text style={styles.emptyStateText}>Este usuario no tiene scopes asignados</Text>
                  <Text style={styles.emptyStateSubtext}>Asigna un scope para comenzar</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>📱</Text>
                  <Text style={styles.emptyStateText}>Selecciona una aplicación</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Elige una app para ver o asignar scopes
                  </Text>
                </View>
              )}
            </View>

            {/* Info Section */}
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>ℹ️ Información sobre Scopes</Text>
              <Text style={styles.infoText}>
                • <Text style={styles.infoBold}>Niveles:</Text> Compañía, Sede, Almacén y Área
              </Text>
              <Text style={styles.infoText}>
                • <Text style={styles.infoBold}>Sede y Almacén:</Text> Son opcionales, puedes
                asignar scope a nivel de compañía
              </Text>
              <Text style={styles.infoText}>
                • <Text style={styles.infoBold}>Permisos:</Text> Lectura y Escritura independientes
              </Text>
              <Text style={styles.infoText}>
                • <Text style={styles.infoBold}>Jerarquía:</Text> Compañía {'>'} Sede {'>'} Almacén{' '}
                {'>'} Área
              </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 16,
  },
  picker: {
    height: 50,
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addForm: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  formButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  scopesList: {
    gap: 12,
  },
  scopeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  scopeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scopeLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scopePermissions: {
    marginBottom: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  revokeButton: {
    backgroundColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  revokeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 8,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  closeFooterButton: {
    backgroundColor: '#6B7280',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserScopesModal;
