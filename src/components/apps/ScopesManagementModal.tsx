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
import { scopesApi, Scope, CreateScopeDto, ScopesPaginatedResponse } from '@/services/api/scopes';
import { warehousesApi } from '@/services/api/warehouses';
import { sitesApi } from '@/services/api/sites';
import { companiesApi } from '@/services/api/companies';
import { Site } from '@/types/sites';
import { Warehouse } from '@/types/warehouses';
import { Company } from '@/types/companies';
import { useTenantStore } from '@/store/tenant';
import { warehouseAreasApi } from '@/services/api/warehouses';
import { WarehouseArea } from '@/types/warehouses';

interface ScopesManagementModalProps {
  visible: boolean;
  appId: string;
  appName: string;
  onClose: () => void;
}

/**
 * ScopesManagementModal
 *
 * Gestiona los scopes (alcances) de una aplicación.
 * Define a qué datos puede acceder la app según la jerarquía organizacional.
 *
 * Jerarquía de Scopes:
 * - GLOBAL: Acceso a todo el sistema
 * - COMPANY: Acceso a toda la empresa
 * - SITE: Acceso a una sede específica
 * - WAREHOUSE: Acceso a un almacén específico
 * - AREA: Acceso a un área específica
 */
export const ScopesManagementModal: React.FC<ScopesManagementModalProps> = ({
  visible,
  appId,
  appName,
  onClose,
}) => {
  const { selectedCompany: tenantCompany } = useTenantStore();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [areas, setAreas] = useState<WarehouseArea[]>([]);

  // Form state
  const [scopeType, setScopeType] = useState<'global' | 'company' | 'site' | 'warehouse' | 'area'>('warehouse');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [filteredWarehouses, setFilteredWarehouses] = useState<Warehouse[]>([]);
  const [filteredAreas, setFilteredAreas] = useState<WarehouseArea[]>([]);
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(true);

  useEffect(() => {
    if (visible) {
      console.log('🚀 Modal abierto - Cargando datos...');
      loadScopes();
      loadCompanies();
      loadSites();
      loadWarehouses();
    }
  }, [visible, appId]);

  // Debug: Mostrar estado actual cuando cambian los datos
  useEffect(() => {
    if (visible) {
      console.log('📊 Estado actual del modal:');
      console.log('  - Compañías:', companies.length);
      console.log('  - Sedes:', sites.length);
      console.log('  - Almacenes totales:', warehouses.length);
      console.log('  - Almacenes filtrados:', filteredWarehouses.length);
      console.log('  - Compañía seleccionada:', selectedCompany);
      console.log('  - Sede seleccionada:', selectedSite);
    }
  }, [visible, companies, sites, warehouses, filteredWarehouses, selectedCompany, selectedSite]);

  // Filtrar almacenes cuando cambia la sede seleccionada
  useEffect(() => {
    console.log('🔍 Filtrando almacenes...');
    console.log('  - Sede seleccionada:', selectedSite);
    console.log('  - Total almacenes disponibles:', warehouses.length);

    if (selectedSite && warehouses.length > 0) {
      const filtered = warehouses.filter(w => {
        console.log(`    Comparando: w.siteId="${w.siteId}" === selectedSite="${selectedSite}"`, w.siteId === selectedSite);
        return w.siteId === selectedSite;
      });
      setFilteredWarehouses(filtered);
      console.log(`✅ Almacenes filtrados para la sede ${selectedSite}:`, filtered.length);
      filtered.forEach((w, i) => {
        console.log(`    ${i + 1}. ${w.name} (ID: ${w.id})`);
      });
    } else {
      setFilteredWarehouses(warehouses);
      console.log(`📦 Mostrando todos los almacenes:`, warehouses.length);
    }
  }, [selectedSite, warehouses]);

  // Filtrar áreas cuando cambia el almacén seleccionado
  useEffect(() => {
    if (selectedWarehouse) {
      loadAreas(selectedWarehouse);
    } else {
      setFilteredAreas([]);
    }
  }, [selectedWarehouse]);

  const loadScopes = async () => {
    try {
      setLoading(true);
      const response = await scopesApi.getAppScopes(appId);
      console.log('🎯 Scopes recibidos del backend:', response);
      console.log('📊 Total de scopes:', response.items.length);
      console.log('📊 Total páginas:', response.totalPages);
      response.items.forEach((scope, index) => {
        console.log(`Scope ${index + 1}:`, {
          id: scope.id,
          companyId: scope.companyId,
          siteId: scope.siteId,
          warehouseId: scope.warehouseId,
          areaId: scope.areaId,
          level: scope.level,
          canRead: scope.canRead,
          canWrite: scope.canWrite,
        });
      });
      setScopes(response.items);
    } catch (error: any) {
      console.error('Error loading scopes:', error);
      Alert.alert('Error', 'No se pudieron cargar los scopes');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await companiesApi.getCompanies({ limit: 100, isActive: true });
      setCompanies(response.data || []);
      console.log('🏢 Compañías cargadas:', response.data?.length || 0);
    } catch (error) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'No se pudieron cargar las compañías');
    }
  };

  const loadWarehouses = async () => {
    try {
      // Obtener el companyId del tenant actual
      const companyId = tenantCompany?.id;

      console.log('📦 Cargando almacenes...');
      console.log('  - Company ID del tenant:', companyId);

      // Cargar almacenes filtrando por companyId del tenant
      const data = await warehousesApi.getWarehouses(companyId);
      console.log('📦 Respuesta de API warehouses:', data);

      // warehousesApi.getWarehouses() retorna un array directamente
      if (Array.isArray(data)) {
        setWarehouses(data);
        console.log('📦 Almacenes cargados exitosamente:', data.length);
        data.forEach((w, i) => {
          console.log(`  ${i + 1}. ${w.name} (ID: ${w.id}, SiteID: ${w.siteId})`);
        });
      } else {
        console.warn('⚠️ La respuesta no es un array:', data);
        setWarehouses([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading warehouses:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudieron cargar los almacenes');
      setWarehouses([]);
    }
  };

  const loadSites = async () => {
    try {
      const response = await sitesApi.getSites({ limit: 100, isActive: true });
      setSites(response.data || []);
      console.log('📍 Sedes cargadas:', response.data?.length || 0);
    } catch (error) {
      console.error('Error loading sites:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    }
  };

  const loadAreas = async (warehouseId: string) => {
    try {
      console.log('📦 Cargando áreas del almacén:', warehouseId);
      const data = await warehouseAreasApi.getWarehouseAreas(warehouseId);
      console.log('✅ Áreas cargadas:', data.length);

      if (Array.isArray(data)) {
        setAreas(data);
        setFilteredAreas(data);
      } else {
        setAreas([]);
        setFilteredAreas([]);
      }
    } catch (error) {
      console.error('❌ Error loading areas:', error);
      setAreas([]);
      setFilteredAreas([]);
    }
  };

  const handleAddScope = async () => {
    // Validaciones según el tipo de scope
    if (scopeType === 'company' && !selectedCompany) {
      Alert.alert('Error', 'Debe seleccionar una compañía');
      return;
    }

    if (scopeType === 'site') {
      if (!selectedCompany) {
        Alert.alert('Error', 'Debe seleccionar una compañía primero');
        return;
      }
      if (!selectedSite) {
        Alert.alert('Error', 'Debe seleccionar una sede');
        return;
      }
    }

    if (scopeType === 'warehouse') {
      if (!selectedCompany) {
        Alert.alert('Error', 'Debe seleccionar una compañía primero');
        return;
      }
      if (!selectedSite) {
        Alert.alert('Error', 'Debe seleccionar una sede primero');
        return;
      }
      if (!selectedWarehouse) {
        Alert.alert('Error', 'Debe seleccionar un almacén');
        return;
      }
    }

    if (scopeType === 'area') {
      if (!selectedCompany) {
        Alert.alert('Error', 'Debe seleccionar una compañía primero');
        return;
      }
      if (!selectedSite) {
        Alert.alert('Error', 'Debe seleccionar una sede primero');
        return;
      }
      if (!selectedWarehouse) {
        Alert.alert('Error', 'Debe seleccionar un almacén primero');
        return;
      }
      if (!selectedArea) {
        Alert.alert('Error', 'Debe seleccionar un área');
        return;
      }
    }

    try {
      const scopeData: CreateScopeDto = {
        canRead,
        canWrite,
      };

      // Configurar según el tipo de scope (jerarquía completa)
      if (scopeType === 'global') {
        // Scope global: sin IDs, solo permisos
        // No se agrega companyId, siteId, warehouseId, ni areaId
      } else if (scopeType === 'company') {
        scopeData.companyId = selectedCompany;
        scopeData.level = 'COMPANY';
      } else if (scopeType === 'site') {
        scopeData.companyId = selectedCompany;
        scopeData.siteId = selectedSite;
        scopeData.level = 'SITE';
      } else if (scopeType === 'warehouse') {
        scopeData.companyId = selectedCompany;
        scopeData.siteId = selectedSite;
        scopeData.warehouseId = selectedWarehouse;
        scopeData.level = 'WAREHOUSE';
      } else if (scopeType === 'area') {
        scopeData.companyId = selectedCompany;
        scopeData.siteId = selectedSite;
        scopeData.warehouseId = selectedWarehouse;
        scopeData.areaId = selectedArea;
        scopeData.level = 'AREA';
      }

      console.log('📤 Enviando scope data:', scopeData);
      await scopesApi.createScope(appId, scopeData);
      Alert.alert('Éxito', 'Scope creado correctamente');
      setShowAddForm(false);
      resetForm();
      loadScopes();
    } catch (error: any) {
      console.error('Error creating scope:', error);
      const errorMessage = error.response?.data?.message || 'Error al crear el scope';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleDeleteScope = (scopeId: string) => {
    Alert.alert(
      'Confirmar Eliminación',
      '¿Estás seguro de que deseas eliminar este scope?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await scopesApi.deleteScope(scopeId);
              Alert.alert('Éxito', 'Scope eliminado correctamente');
              loadScopes();
            } catch (error: any) {
              console.error('Error deleting scope:', error);
              Alert.alert('Error', 'No se pudo eliminar el scope');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setScopeType('warehouse');
    setSelectedCompany('');
    setSelectedSite('');
    setSelectedWarehouse('');
    setSelectedArea('');
    setFilteredWarehouses(warehouses);
    setFilteredAreas([]);
    setCanRead(true);
    setCanWrite(true);
  };

  const getScopeLabel = (scope: Scope): string => {
    // Usar el nivel del scope para determinar la etiqueta
    // La nueva API de scopes incluye el nivel directamente

    switch (scope.level) {
      case 'AREA':
        if (scope.areaId) {
          // Buscar el área en la lista cargada
          const area = areas.find(a => a.id === scope.areaId);
          if (area) {
            const warehouse = warehouses.find(w => w.id === area.warehouseId);
            const site = sites.find(s => s.id === warehouse?.siteId);
            const company = companies.find(c => c.id === site?.companyId);
            return `📦 Área: ${area.name} - ${warehouse?.name || scope.warehouseId} - ${site?.name || scope.siteId} - ${company?.name || scope.companyId}`;
          }
          return `📦 Área: ${scope.areaId}`;
        }
        return '📦 Área';

      case 'WAREHOUSE':
        if (scope.warehouseId) {
          const warehouse = warehouses.find(w => w.id === scope.warehouseId);
          if (warehouse) {
            const site = sites.find(s => s.id === warehouse.siteId);
            const company = companies.find(c => c.id === site?.companyId);
            return `🏢 Almacén: ${warehouse.name} - ${site?.name || scope.siteId} - ${company?.name || scope.companyId}`;
          }
          return `🏢 Almacén: ${scope.warehouseId}`;
        }
        return '🏢 Almacén';

      case 'SITE':
        if (scope.siteId) {
          const site = sites.find(s => s.id === scope.siteId);
          if (site) {
            const company = companies.find(c => c.id === site.companyId);
            return `📍 Sede: ${site.name} (${site.code}) - ${company?.name || scope.companyId}`;
          }
          return `📍 Sede: ${scope.siteId}`;
        }
        return '📍 Sede';

      case 'COMPANY':
        if (scope.companyId) {
          const company = companies.find(c => c.id === scope.companyId);
          if (company) {
            return `🏢 Compañía: ${company.name} (${company.code})`;
          }
          return `🏢 Compañía: ${scope.companyId}`;
        }
        return '🏢 Compañía';

      default:
        return '🌍 Global (Acceso a todo)';
    }
  };

  const renderScope = (scope: Scope) => (
    <View key={scope.id} style={styles.scopeCard}>
      <View style={styles.scopeHeader}>
        <Text style={styles.scopeLabel}>{getScopeLabel(scope)}</Text>
        <TouchableOpacity
          onPress={() => handleDeleteScope(scope.id)}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scopePermissions}>
        <View style={styles.permissionBadge}>
          <Text style={[styles.permissionText, scope.canRead && styles.permissionActive]}>
            {scope.canRead ? '✓' : '✗'} Lectura
          </Text>
        </View>
        <View style={styles.permissionBadge}>
          <Text style={[styles.permissionText, scope.canWrite && styles.permissionActive]}>
            {scope.canWrite ? '✓' : '✗'} Escritura
          </Text>
        </View>
      </View>
    </View>
  );

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
              <Text style={styles.title}>🎯 Gestión de Scopes</Text>
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
                Los scopes definen a qué datos puede acceder esta app. Puedes configurar acceso global, por compañía, sede, almacén o área.
              </Text>
            </View>

            {/* Add Scope Button */}
            {!showAddForm && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddForm(true)}
              >
                <Text style={styles.addButtonText}>+ Agregar Scope</Text>
              </TouchableOpacity>
            )}

            {/* Add Form */}
            {showAddForm && (
              <View style={styles.addForm}>
                <Text style={styles.formTitle}>Nuevo Scope</Text>

                {/* Scope Type */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Tipo de Scope</Text>
                  <View style={styles.typeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        scopeType === 'global' && styles.typeButtonActive,
                      ]}
                      onPress={() => {
                        setScopeType('global');
                        setSelectedCompany('');
                        setSelectedSite('');
                        setSelectedWarehouse('');
                        setSelectedArea('');
                      }}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          scopeType === 'global' && styles.typeButtonTextActive,
                        ]}
                      >
                        🌍 Global
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        scopeType === 'company' && styles.typeButtonActive,
                      ]}
                      onPress={() => {
                        setScopeType('company');
                        setSelectedSite('');
                        setSelectedWarehouse('');
                        setSelectedArea('');
                      }}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          scopeType === 'company' && styles.typeButtonTextActive,
                        ]}
                      >
                        🏢 Compañía
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.typeButtons, { marginTop: 8 }]}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        scopeType === 'site' && styles.typeButtonActive,
                      ]}
                      onPress={() => {
                        setScopeType('site');
                        setSelectedWarehouse('');
                        setSelectedArea('');
                      }}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          scopeType === 'site' && styles.typeButtonTextActive,
                        ]}
                      >
                        📍 Sede
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        scopeType === 'warehouse' && styles.typeButtonActive,
                      ]}
                      onPress={() => setScopeType('warehouse')}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          scopeType === 'warehouse' && styles.typeButtonTextActive,
                        ]}
                      >
                        🏢 Almacén
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        scopeType === 'area' && styles.typeButtonActive,
                      ]}
                      onPress={() => setScopeType('area')}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          scopeType === 'area' && styles.typeButtonTextActive,
                        ]}
                      >
                        📦 Área
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Company Selector */}
                {(scopeType === 'company' || scopeType === 'site' || scopeType === 'warehouse' || scopeType === 'area') && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Compañía</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedCompany}
                        onValueChange={(value) => {
                          setSelectedCompany(value);
                          setSelectedSite('');
                          setSelectedWarehouse('');
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
                )}

                {/* Site Selector */}
                {(scopeType === 'site' || scopeType === 'warehouse' || scopeType === 'area') && selectedCompany && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Sede</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedSite}
                        onValueChange={(value) => {
                          setSelectedSite(value);
                          setSelectedWarehouse('');
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

                {/* Warehouse Selector - Requiere seleccionar sede primero */}
                {(scopeType === 'warehouse' || scopeType === 'area') && selectedCompany && selectedSite && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Almacén</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedWarehouse}
                        onValueChange={(value) => {
                          setSelectedWarehouse(value);
                          setSelectedArea('');
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
                    {selectedSite && filteredWarehouses.length === 0 && (
                      <Text style={styles.hint}>
                        ⚠️ No hay almacenes disponibles para esta sede.
                        {warehouses.length > 0 && ` (Total almacenes: ${warehouses.length})`}
                      </Text>
                    )}
                    {selectedSite && filteredWarehouses.length > 0 && (
                      <Text style={styles.hint}>
                        ✅ {filteredWarehouses.length} almacén(es) disponible(s)
                      </Text>
                    )}
                  </View>
                )}

                {/* Area Selector - NUEVO - Requiere seleccionar almacén primero */}
                {scopeType === 'area' && selectedCompany && selectedSite && selectedWarehouse && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Área</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedArea}
                        onValueChange={setSelectedArea}
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
                    {selectedWarehouse && filteredAreas.length === 0 && (
                      <Text style={styles.hint}>
                        ⚠️ No hay áreas disponibles para este almacén
                      </Text>
                    )}
                    {selectedWarehouse && filteredAreas.length > 0 && (
                      <Text style={styles.hint}>
                        ✅ {filteredAreas.length} área(s) disponible(s)
                      </Text>
                    )}
                  </View>
                )}

                {/* Permissions */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Permisos</Text>

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Lectura (canRead)</Text>
                    <Switch
                      value={canRead}
                      onValueChange={setCanRead}
                      trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                      thumbColor={canRead ? '#FFFFFF' : '#94A3B8'}
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Escritura (canWrite)</Text>
                    <Switch
                      value={canWrite}
                      onValueChange={setCanWrite}
                      trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                      thumbColor={canWrite ? '#FFFFFF' : '#94A3B8'}
                    />
                  </View>
                </View>

                {/* Form Actions */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleAddScope}
                  >
                    <Text style={styles.saveButtonText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Scopes List */}
            <View style={styles.scopesList}>
              <Text style={styles.sectionTitle}>
                Scopes Configurados ({scopes.length})
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#667eea" />
                </View>
              ) : scopes.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🎯</Text>
                  <Text style={styles.emptyText}>No hay scopes configurados</Text>
                  <Text style={styles.emptySubtext}>
                    Agrega scopes para definir el acceso a datos
                  </Text>
                </View>
              ) : (
                scopes.map(renderScope)
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  infoText: {
    fontSize: 14,
    color: '#4F46E5',
    lineHeight: 20,
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
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  typeButtonTextActive: {
    color: '#667eea',
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
  hint: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
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
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scopesList: {
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
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  scopeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scopeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scopeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  scopePermissions: {
    flexDirection: 'row',
    gap: 8,
  },
  permissionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  permissionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  permissionActive: {
    color: '#10B981',
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

export default ScopesManagementModal;
