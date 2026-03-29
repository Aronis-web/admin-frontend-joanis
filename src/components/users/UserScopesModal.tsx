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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
      const response = await scopesApi.getUserScopes(userId, selectedAppId, { limit: 100 });
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
    // Usar los datos que vienen del API (scope.company, scope.site, etc.)
    // Si no están disponibles, buscar en los arrays locales como fallback
    const company = scope.company || companies.find((c) => c.id === scope.companyId);
    const site = scope.site || sites.find((s) => s.id === scope.siteId);
    const warehouse = scope.warehouse || warehouses.find((w) => w.id === scope.warehouseId);
    const area = scope.area || areas.find((a) => a.id === scope.areaId);

    switch (scope.level) {
      case 'AREA':
        return `📦 Área: ${area?.name || scope.areaId || 'Sin nombre'} - ${warehouse?.name || scope.warehouseId || 'Sin almacén'}`;
      case 'WAREHOUSE':
        return `🏢 Almacén: ${warehouse?.name || scope.warehouseId || 'Sin nombre'} - ${site?.name || scope.siteId || 'Sin sede'}`;
      case 'SITE':
        return `📍 Sede: ${site?.name || scope.siteId || 'Sin nombre'} - ${company?.name || scope.companyId || 'Sin compañía'}`;
      case 'COMPANY':
        return `🏢 Compañía: ${company?.name || scope.companyId || 'Sin nombre'}`;
      default:
        return '🌍 Global';
    }
  };

  const getLevelColor = (level: string): string => {
    const levelColors: Record<string, string> = {
      COMPANY: colors.primary[500],
      SITE: colors.success[500],
      WAREHOUSE: colors.warning[500],
      AREA: colors.accent[600],
    };
    return levelColors[level] || colors.neutral[500];
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
            trackColor={{ false: colors.neutral[300], true: colors.success[500] }}
            thumbColor={scope.canRead ? colors.neutral[0] : colors.neutral[400]}
          />
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Escritura:</Text>
          <Switch
            value={scope.canWrite}
            onValueChange={(value) =>
              handleUpdateScope(scope.id, { canRead: scope.canRead, canWrite: value })
            }
            trackColor={{ false: colors.neutral[300], true: colors.primary[500] }}
            thumbColor={scope.canWrite ? colors.neutral[0] : colors.neutral[400]}
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
                      trackColor={{ false: colors.neutral[300], true: colors.success[500] }}
                      thumbColor={canRead ? colors.neutral[0] : colors.neutral[400]}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Permitir Escritura</Text>
                    <Switch
                      value={canWrite}
                      onValueChange={setCanWrite}
                      trackColor={{ false: colors.neutral[300], true: colors.primary[500] }}
                      thumbColor={canWrite ? colors.neutral[0] : colors.neutral[400]}
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
                      <ActivityIndicator color={colors.neutral[0]} />
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
                  <ActivityIndicator size="large" color={colors.primary[500]} />
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
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius['2xl'],
    width: '90%',
    maxWidth: 600,
    height: '85%',
    shadowColor: colors.neutral[950],
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
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.neutral[500],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: spacing[5],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  pickerContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    marginBottom: spacing[4],
  },
  picker: {
    height: 50,
    color: colors.neutral[800],
  },
  addButton: {
    backgroundColor: colors.primary[500],
    padding: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  addButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
  addForm: {
    backgroundColor: colors.neutral[50],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[6],
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[4],
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  switchLabel: {
    fontSize: 14,
    color: colors.neutral[700],
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  formButton: {
    flex: 1,
    padding: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.neutral[500],
  },
  cancelButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.success[500],
  },
  submitButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.neutral[500],
  },
  scopesList: {
    gap: spacing[3],
  },
  scopeCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    marginBottom: spacing[3],
  },
  scopeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  scopeLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral[700],
    fontWeight: '500',
  },
  levelBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.xl,
  },
  levelText: {
    fontSize: 12,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  scopePermissions: {
    marginBottom: spacing[3],
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  permissionLabel: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  revokeButton: {
    backgroundColor: colors.danger[500],
    padding: 10,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  revokeButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.neutral[400],
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: colors.primary[50],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[800],
    marginBottom: spacing[3],
  },
  infoText: {
    fontSize: 14,
    color: colors.primary[800],
    marginBottom: spacing[2],
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
  },
  footer: {
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  closeFooterButton: {
    backgroundColor: colors.neutral[500],
    padding: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserScopesModal;
