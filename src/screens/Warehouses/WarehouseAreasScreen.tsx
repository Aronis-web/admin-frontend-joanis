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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { warehouseAreasApi } from '@/services/api';
import {
  WarehouseArea,
  CreateWarehouseAreaRequest,
  UpdateWarehouseAreaRequest,
} from '@/types/warehouses';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface WarehouseAreasScreenProps {
  navigation: any;
  route: {
    params: {
      companyId: string;
      companyName: string;
      siteId: string;
      siteName: string;
      siteCode: string;
      warehouseId: string;
      warehouseName: string;
      warehouseCode: string;
    };
  };
}

export const WarehouseAreasScreen: React.FC<WarehouseAreasScreenProps> = ({
  navigation,
  route,
}) => {
  const {
    companyId,
    companyName,
    siteId,
    siteName,
    siteCode,
    warehouseId,
    warehouseName,
    warehouseCode,
  } = route.params;

  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAreas, setFilteredAreas] = useState<WarehouseArea[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState<WarehouseArea | null>(null);

  // Form states
  const [areaForm, setAreaForm] = useState({
    code: '',
    name: '',
  });

  useEffect(() => {
    loadAreas();
  }, [warehouseId]);

  useEffect(() => {
    if (!areas) {
      setFilteredAreas([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredAreas(areas);
    } else {
      const filtered = areas.filter(
        (area) =>
          area.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (area.name && area.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredAreas(filtered);
    }
  }, [searchQuery, areas]);

  const loadAreas = async () => {
    try {
      setLoading(true);
      const data = await warehouseAreasApi.getWarehouseAreas(warehouseId);
      setAreas(data);
      setFilteredAreas(data);
    } catch (error: any) {
      console.error('Error loading areas:', error);
      Alert.alert('Error', 'No se pudieron cargar las áreas');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAreas();
    setRefreshing(false);
  };

  const handleCreateArea = async () => {
    if (!areaForm.code) {
      Alert.alert('Error', 'El código es requerido');
      return;
    }

    try {
      // Note: companyId, siteId, and warehouseId are sent via headers/URL
      // so we don't include them in the body
      const data = {
        code: areaForm.code.toUpperCase(),
        name: areaForm.name || undefined,
      };

      await warehouseAreasApi.createWarehouseArea(warehouseId, data as CreateWarehouseAreaRequest);
      Alert.alert('Éxito', 'Área creada correctamente');
      setShowCreateModal(false);
      resetAreaForm();
      loadAreas();
    } catch (error: any) {
      console.error('Error creating area:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el área');
    }
  };

  const handleEditArea = async () => {
    if (!selectedArea || !areaForm.code) {
      Alert.alert('Error', 'El código es requerido');
      return;
    }

    try {
      const data = {
        code: areaForm.code.toUpperCase(),
        name: areaForm.name || undefined,
      };

      await warehouseAreasApi.updateWarehouseArea(
        selectedArea.id,
        data as UpdateWarehouseAreaRequest
      );
      Alert.alert('Éxito', 'Área actualizada correctamente');
      setShowEditModal(false);
      setSelectedArea(null);
      resetAreaForm();
      loadAreas();
    } catch (error: any) {
      console.error('Error updating area:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el área');
    }
  };

  const handleDeleteArea = (area: WarehouseArea) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar el área "${area.code}"${area.name ? ` - ${area.name}` : ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await warehouseAreasApi.deleteWarehouseArea(area.id);
              Alert.alert('Éxito', 'Área eliminada correctamente');
              loadAreas();
            } catch (error: any) {
              console.error('Error deleting area:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar el área');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (area: WarehouseArea) => {
    setSelectedArea(area);
    setAreaForm({
      code: area.code,
      name: area.name || '',
    });
    setShowEditModal(true);
  };

  const resetAreaForm = () => {
    setAreaForm({
      code: '',
      name: '',
    });
  };

  const renderAreaItem = (area: WarehouseArea) => (
    <View key={area.id} style={styles.areaCard}>
      <View style={styles.areaHeader}>
        <View style={styles.areaIcon}>
          <Text style={styles.iconText}>📍</Text>
        </View>
        <View style={styles.areaInfo}>
          <Text style={styles.areaCode}>{area.code}</Text>
          {area.name && <Text style={styles.areaName}>{area.name}</Text>}
        </View>
      </View>

      <View style={styles.areaActions}>
        <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(area)}>
          <Text style={styles.editButtonText}>✏️ Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteArea(area)}>
          <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
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
            <Text style={styles.headerTitle}>Áreas</Text>
            <Text style={styles.headerSubtitle}>📦 {warehouseName}</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Cargando áreas...</Text>
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
          <Text style={styles.headerTitle}>Áreas</Text>
          <Text style={styles.headerSubtitle}>📦 {warehouseName}</Text>
        </View>
        <ProtectedElement
          requiredPermissions={['areas.create']}
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
          placeholder="Buscar áreas..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.neutral[400]}
          keyboardType="default"
        />
      </View>

      {/* Areas List */}
      <ScrollView
        style={styles.areasList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredAreas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron áreas' : 'No hay áreas registradas'}
            </Text>
            <Text style={styles.emptySubtext}>
              Las áreas te permiten organizar tu almacén en secciones específicas
            </Text>
          </View>
        ) : (
          filteredAreas.map(renderAreaItem)
        )}
      </ScrollView>

      {/* Stats Footer */}
      <View style={styles.statsFooter}>
        <Text style={styles.statsText}>
          Total: {filteredAreas.length} área{filteredAreas.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Create Area Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva Área</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Código *</Text>
              <TextInput
                style={styles.input}
                value={areaForm.code}
                onChangeText={(text) => setAreaForm({ ...areaForm, code: text.toUpperCase() })}
                placeholder="A-01"
                autoCapitalize="characters"
                keyboardType="default"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={areaForm.name}
                onChangeText={(text) => setAreaForm({ ...areaForm, name: text })}
                placeholder="Zona de Refrigerados"
                keyboardType="default"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  resetAreaForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleCreateArea}>
                <Text style={styles.saveButtonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Area Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Área</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Código *</Text>
              <TextInput
                style={styles.input}
                value={areaForm.code}
                onChangeText={(text) => setAreaForm({ ...areaForm, code: text.toUpperCase() })}
                placeholder="A-01"
                autoCapitalize="characters"
                keyboardType="default"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={areaForm.name}
                onChangeText={(text) => setAreaForm({ ...areaForm, name: text })}
                placeholder="Zona de Refrigerados"
                keyboardType="default"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedArea(null);
                  resetAreaForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleEditArea}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonIcon}>+</Text>
      </TouchableOpacity>
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
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: 20,
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
    backgroundColor: colors.surface.primary,
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
  areasList: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
  areaCard: {
    backgroundColor: colors.surface.primary,
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
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  areaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warning[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  iconText: {
    fontSize: 24,
  },
  areaInfo: {
    flex: 1,
  },
  areaCode: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  areaName: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  areaActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    backgroundColor: colors.warning[500],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.danger[500],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: colors.surface.primary,
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
    backgroundColor: colors.surface.primary,
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
    marginBottom: 16,
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
    paddingVertical: spacing[2.5],
    fontSize: 16,
    color: colors.neutral[800],
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
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

export default WarehouseAreasScreen;
