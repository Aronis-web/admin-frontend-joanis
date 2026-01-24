import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { warehousesApi } from '@/services/api';
import { Warehouse, CreateWarehouseRequest, UpdateWarehouseRequest } from '@/types/warehouses';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface WarehousesScreenProps {
  navigation: any;
  route: {
    params: {
      companyId: string;
      companyName: string;
      siteId: string;
      siteName: string;
      siteCode: string;
    };
  };
}

export const WarehousesScreen: React.FC<WarehousesScreenProps> = ({ navigation, route }) => {
  const { companyId, companyName, siteId, siteName, siteCode } = route.params;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredWarehouses, setFilteredWarehouses] = useState<Warehouse[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  // Form states
  const [warehouseForm, setWarehouseForm] = useState({
    code: '',
    name: '',
  });

  useEffect(() => {
    loadWarehouses();
  }, [companyId, siteId]);

  useEffect(() => {
    if (!warehouses) {
      setFilteredWarehouses([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredWarehouses(warehouses);
    } else {
      const filtered = warehouses.filter(
        (warehouse) =>
          warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          warehouse.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredWarehouses(filtered);
    }
  }, [searchQuery, warehouses]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const data = await warehousesApi.getWarehouses(companyId, siteId);
      setWarehouses(data);
      setFilteredWarehouses(data);
    } catch (error: any) {
      console.error('Error loading warehouses:', error);
      Alert.alert('Error', 'No se pudieron cargar los almacenes');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWarehouses();
    setRefreshing(false);
  };

  const handleCreateWarehouse = async () => {
    if (!warehouseForm.code || !warehouseForm.name) {
      Alert.alert('Error', 'El código y nombre son requeridos');
      return;
    }

    try {
      // Note: companyId and siteId are sent via headers (X-Company-Id, X-Site-Id)
      // so we don't include them in the body
      const data = {
        code: warehouseForm.code.toUpperCase(),
        siteCode: siteCode, // Legacy field
        name: warehouseForm.name,
      };

      await warehousesApi.createWarehouse(data as CreateWarehouseRequest);
      Alert.alert('Éxito', 'Almacén creado correctamente');
      setShowCreateModal(false);
      resetWarehouseForm();
      loadWarehouses();
    } catch (error: any) {
      console.error('Error creating warehouse:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el almacén');
    }
  };

  const handleEditWarehouse = async () => {
    if (!selectedWarehouse || !warehouseForm.code || !warehouseForm.name) {
      Alert.alert('Error', 'El código y nombre son requeridos');
      return;
    }

    try {
      const data = {
        code: warehouseForm.code.toUpperCase(),
        siteCode: siteCode, // Legacy field
        name: warehouseForm.name,
      };

      await warehousesApi.updateWarehouse(selectedWarehouse.id, data as UpdateWarehouseRequest);
      Alert.alert('Éxito', 'Almacén actualizado correctamente');
      setShowEditModal(false);
      setSelectedWarehouse(null);
      resetWarehouseForm();
      loadWarehouses();
    } catch (error: any) {
      console.error('Error updating warehouse:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el almacén');
    }
  };

  const handleDeleteWarehouse = (warehouse: Warehouse) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar el almacén "${warehouse.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await warehousesApi.deleteWarehouse(warehouse.id);
              Alert.alert('Éxito', 'Almacén eliminado correctamente');
              loadWarehouses();
            } catch (error: any) {
              console.error('Error deleting warehouse:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar el almacén');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setWarehouseForm({
      code: warehouse.code,
      name: warehouse.name,
    });
    setShowEditModal(true);
  };

  const openAreasScreen = (warehouse: Warehouse) => {
    navigation.navigate('WarehouseAreas', {
      companyId,
      companyName,
      siteId,
      siteName,
      siteCode,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      warehouseCode: warehouse.code,
    });
  };

  const resetWarehouseForm = () => {
    setWarehouseForm({
      code: '',
      name: '',
    });
  };

  const renderWarehouseItem = (warehouse: Warehouse) => (
    <View key={warehouse.id} style={styles.warehouseCard}>
      <View style={styles.warehouseHeader}>
        <View style={styles.warehouseIcon}>
          <Text style={styles.iconText}>📦</Text>
        </View>
        <View style={styles.warehouseInfo}>
          <Text style={styles.warehouseName}>{warehouse.name}</Text>
          <Text style={styles.warehouseCode}>Código: {warehouse.code}</Text>
          {warehouse.areas && warehouse.areas.length > 0 && (
            <Text style={styles.warehouseAreas}>
              📍 {warehouse.areas.length} área{warehouse.areas.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.warehouseActions}>
        <TouchableOpacity style={styles.areasButton} onPress={() => openAreasScreen(warehouse)}>
          <Text style={styles.areasButtonText}>📍 Áreas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(warehouse)}>
          <Text style={styles.editButtonText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteWarehouse(warehouse)}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Almacenes</Text>
            <Text style={styles.headerSubtitle}>🏪 {siteName}</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Cargando almacenes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Almacenes</Text>
          <Text style={styles.headerSubtitle}>🏪 {siteName}</Text>
        </View>
        <ProtectedElement
          requiredPermissions={['warehouses.create']}
          fallback={<View style={styles.placeholder} />}
        >
          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </ProtectedElement>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar almacenes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Warehouses List */}
      <ScrollView
        style={styles.warehousesList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredWarehouses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron almacenes' : 'No hay almacenes registrados'}
            </Text>
            <Text style={styles.emptySubtext}>
              Los almacenes te permiten organizar tu inventario dentro de cada sede
            </Text>
          </View>
        ) : (
          filteredWarehouses.map(renderWarehouseItem)
        )}
      </ScrollView>

      {/* Stats Footer */}
      <View style={styles.statsFooter}>
        <Text style={styles.statsText}>
          Total: {filteredWarehouses.length} almacén{filteredWarehouses.length !== 1 ? 'es' : ''}
        </Text>
      </View>

      {/* Create Warehouse Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Almacén</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Código *</Text>
              <TextInput
                style={styles.input}
                value={warehouseForm.code}
                onChangeText={(text) =>
                  setWarehouseForm({ ...warehouseForm, code: text.toUpperCase() })
                }
                placeholder="ALM-01"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={warehouseForm.name}
                onChangeText={(text) => setWarehouseForm({ ...warehouseForm, name: text })}
                placeholder="Almacén Principal"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  resetWarehouseForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleCreateWarehouse}>
                <Text style={styles.saveButtonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Warehouse Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Almacén</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Código *</Text>
              <TextInput
                style={styles.input}
                value={warehouseForm.code}
                onChangeText={(text) =>
                  setWarehouseForm({ ...warehouseForm, code: text.toUpperCase() })
                }
                placeholder="ALM-01"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={warehouseForm.name}
                onChangeText={(text) => setWarehouseForm({ ...warehouseForm, name: text })}
                placeholder="Almacén Principal"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedWarehouse(null);
                  resetWarehouseForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleEditWarehouse}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748B',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  warehousesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  warehouseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  warehouseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warehouseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  warehouseInfo: {
    flex: 1,
  },
  warehouseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  warehouseCode: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  warehouseAreas: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  warehouseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  areasButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  areasButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  statsFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statsText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1E293B',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WarehousesScreen;
