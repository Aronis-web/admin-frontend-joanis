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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { warehousesApi } from '@/services/api';
import { Warehouse, CreateWarehouseRequest, UpdateWarehouseRequest } from '@/types/warehouses';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';

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
        <ProtectedTouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(warehouse)}
          requiredPermissions={[PERMISSIONS.WAREHOUSES.UPDATE]}
          hideIfNoPermission={true}
        >
          <Text style={styles.editButtonText}>✏️</Text>
        </ProtectedTouchableOpacity>
        <ProtectedTouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteWarehouse(warehouse)}
          requiredPermissions={[PERMISSIONS.WAREHOUSES.DELETE]}
          hideIfNoPermission={true}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </ProtectedTouchableOpacity>
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
          <ActivityIndicator size="large" color={colors.primary[500]} />
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
        <ProtectedTouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={styles.addButton}
          requiredPermissions={[PERMISSIONS.WAREHOUSES.CREATE]}
          hideIfNoPermission={false}
          fallback={<View style={styles.placeholder} />}
        >
          <Text style={styles.addButtonText}>+</Text>
        </ProtectedTouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar almacenes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.neutral[400]}
          keyboardType="default"
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

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonIcon}>+</Text>
      </TouchableOpacity>

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
                keyboardType="default"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={warehouseForm.name}
                onChangeText={(text) => setWarehouseForm({ ...warehouseForm, name: text })}
                placeholder="Almacén Principal"
                keyboardType="default"
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
                keyboardType="default"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={warehouseForm.name}
                onChangeText={(text) => setWarehouseForm({ ...warehouseForm, name: text })}
                placeholder="Almacén Principal"
                keyboardType="default"
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
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: colors.neutral[0],
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
    color: colors.neutral[500],
  },
  searchContainer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  searchInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
  },
  warehousesList: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
  warehouseCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  warehouseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  warehouseIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
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
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  warehouseCode: {
    fontSize: 13,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  warehouseAreas: {
    fontSize: 13,
    color: colors.primary[500],
    fontWeight: '500',
  },
  warehouseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  areasButton: {
    flex: 1,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  areasButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: colors.warning[500],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: colors.danger[500],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
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
    marginBottom: spacing[4],
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.neutral[400],
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  statsFooter: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  statsText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[5],
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: 10,
    fontSize: 16,
    color: colors.neutral[800],
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[6],
    gap: spacing[3],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.neutral[500],
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    right: spacing[5],
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingButtonIcon: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.neutral[0],
    lineHeight: 32,
  },
});

export default WarehousesScreen;
