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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

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
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
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
          placeholderTextColor={theme.color.text.placeholder}
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: theme.color.text.muted,
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.color.text.muted,
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
    backgroundColor: theme.color.brand.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: theme.color.text.onAction,
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
    color: theme.color.text.muted,
  },
  searchContainer: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  searchInput: {
    backgroundColor: theme.color.background.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.xl,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    fontSize: 16,
    color: theme.color.text.heading,
  },
  areasList: {
    flex: 1,
    paddingHorizontal: theme.space[5],
  },
  areaCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginTop: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[3],
  },
  areaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.color.state.warning.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
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
    color: theme.color.text.heading,
    marginBottom: 2,
  },
  areaName: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  areaActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.space[2],
  },
  editButton: {
    backgroundColor: theme.color.state.warning.border,
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[4],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
  },
  editButtonText: {
    color: theme.color.text.onAction,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: theme.color.action.danger.background,
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[4],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: theme.color.text.onAction,
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
    marginBottom: theme.space[4],
  },
  emptyText: {
    fontSize: 16,
    color: theme.color.text.muted,
    textAlign: 'center',
    marginBottom: theme.space[2],
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.color.text.placeholder,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  statsFooter: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  statsText: {
    fontSize: 14,
    color: theme.color.text.muted,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.color.surface.elevated,
    borderRadius: theme.radii['2xl'],
    padding: theme.space[6],
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[5],
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: theme.space[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: theme.space[2],
  },
  input: {
    backgroundColor: theme.color.background.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2.5],
    fontSize: 16,
    color: theme.color.text.heading,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.space[6],
    gap: theme.space[3],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.color.surface.muted,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.color.text.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.color.brand.accent,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    color: theme.color.text.onAction,
    fontSize: 16,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    right: theme.space[5],
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.color.brand.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.color.brand.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingButtonIcon: {
    fontSize: 32,
    fontWeight: '600',
    color: theme.color.text.onAction,
    lineHeight: 32,
  },
});

export default WarehouseAreasScreen;
