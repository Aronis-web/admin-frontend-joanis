import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { priceProfilesApi } from '@/services/api';
import { PriceProfile, CreatePriceProfileRequest, UpdatePriceProfileRequest } from '@/types/price-profiles';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import { AddButton } from '@/components/Navigation/AddButton';

interface PriceProfilesScreenProps {
  navigation: any;
}

export const PriceProfilesScreen: React.FC<PriceProfilesScreenProps> = ({ navigation }) => {
  const [profiles, setProfiles] = useState<PriceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PriceProfile | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    factorToCost: '1.00',
    isActive: true,
  });
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading price profiles...');
      const response = await priceProfilesApi.getPriceProfiles({
        q: searchQuery,
        page: 1,
        limit: 100,
        orderBy: 'name',
        orderDir: 'ASC',
      });
      console.log('📊 Price profiles response:', response);
      console.log('📊 Setting profiles data:', response.data);
      console.log('📊 Number of profiles:', response.data?.length);
      setProfiles(response.data);
    } catch (error: any) {
      console.error('❌ Error loading price profiles:', error);
      Alert.alert('Error', 'No se pudieron cargar los perfiles de precio');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfiles();
  };

  const handleSearch = () => {
    loadProfiles();
  };

  const handleCreateProfile = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      Alert.alert('Error', 'El código y nombre son requeridos');
      return;
    }

    const factor = parseFloat(formData.factorToCost);
    if (isNaN(factor) || factor <= 0) {
      Alert.alert('Error', 'El factor debe ser un número mayor a 0');
      return;
    }

    try {
      const createData: CreatePriceProfileRequest = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        factorToCost: factor,
        isActive: formData.isActive,
      };

      await priceProfilesApi.createPriceProfile(createData);
      Alert.alert('Éxito', 'Perfil de precio creado correctamente');
      setShowCreateModal(false);
      resetForm();
      loadProfiles();
    } catch (error: any) {
      console.error('Error creating price profile:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el perfil de precio');
    }
  };

  const handleUpdateProfile = async () => {
    if (!selectedProfile) return;

    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    const factor = parseFloat(formData.factorToCost);
    if (isNaN(factor) || factor <= 0) {
      Alert.alert('Error', 'El factor debe ser un número mayor a 0');
      return;
    }

    try {
      const updateData: UpdatePriceProfileRequest = {
        name: formData.name.trim(),
        factorToCost: factor,
        isActive: formData.isActive,
      };

      await priceProfilesApi.updatePriceProfile(selectedProfile.id, updateData);
      Alert.alert('Éxito', 'Perfil de precio actualizado correctamente');
      setShowEditModal(false);
      resetForm();
      loadProfiles();
    } catch (error: any) {
      console.error('Error updating price profile:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el perfil de precio');
    }
  };

  const handleDeleteProfile = (profile: PriceProfile) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar el perfil "${profile.name}"? Esto eliminará todos los precios asociados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await priceProfilesApi.deletePriceProfile(profile.id);
              Alert.alert('Éxito', 'Perfil de precio eliminado correctamente');
              loadProfiles();
            } catch (error: any) {
              console.error('Error deleting price profile:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar el perfil de precio');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (profile: PriceProfile) => {
    setSelectedProfile(profile);
    setFormData({
      code: profile.code,
      name: profile.name,
      factorToCost: profile.factorToCost.toString(),
      isActive: profile.isActive,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      factorToCost: '1.00',
      isActive: true,
    });
    setSelectedProfile(null);
  };

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Use the shared navigation hook for consistent menu navigation
  const navigateFromMenu = useMenuNavigation(navigation);

  const handleMenuSelect = (menuId: string) => {
    setIsMenuVisible(false);
    navigateFromMenu(menuId);
  };

  const calculateMargin = (factor: number | string): string => {
    const numericFactor = typeof factor === 'string' ? parseFloat(factor) : factor;
    const margin = priceProfilesApi.getMarginFromFactor(numericFactor);
    return margin.toFixed(2);
  };

  const getNumericFactor = (factor: number | string): number => {
    return typeof factor === 'string' ? parseFloat(factor) : factor;
  };

  const renderProfileItem = ({ item }: { item: PriceProfile }) => {
    console.log('🎨 Rendering profile item:', item);
    return (
    <View style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <View style={styles.profileInfo}>
          <View style={styles.profileTitleRow}>
            <Text style={styles.profileName}>{item.name}</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
          </View>
          <View style={styles.profileMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Factor</Text>
              <Text style={styles.metricValue}>{getNumericFactor(item.factorToCost).toFixed(4)}x</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Margen</Text>
              <Text style={styles.metricValue}>{calculateMargin(item.factorToCost)}%</Text>
            </View>
          </View>
        </View>
        <View style={[styles.statusBadge, item.isActive ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusText}>{item.isActive ? 'Activo' : 'Inactivo'}</Text>
        </View>
      </View>

      <View style={styles.profileActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.actionButtonText}>✏️ Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteProfile(item)}
        >
          <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.profileDate}>
        Creado: {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
    );
  };

  const renderModal = (visible: boolean, onClose: () => void, onSave: () => void, title: string) => (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{title}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Código *</Text>
              <TextInput
                style={[styles.input, selectedProfile && styles.inputDisabled]}
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
                placeholder="Ej: MAYORISTA"
                editable={!selectedProfile}
                autoCapitalize="characters"
              />
              {selectedProfile && (
                <Text style={styles.helperText}>El código no se puede modificar</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre del Perfil *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Ej: Precio Mayorista"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Factor sobre Costo *</Text>
              <TextInput
                style={styles.input}
                value={formData.factorToCost}
                onChangeText={(text) => setFormData({ ...formData, factorToCost: text })}
                placeholder="Ej: 1.5"
                keyboardType="decimal-pad"
              />
              <Text style={styles.helperText}>
                Factor {formData.factorToCost} = {calculateMargin(parseFloat(formData.factorToCost) || 1)}% de margen
              </Text>
              <Text style={styles.helperText}>
                Ejemplo: Costo S/ 10.00 → Venta S/ {(10 * (parseFloat(formData.factorToCost) || 1)).toFixed(2)}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setFormData({ ...formData, isActive: !formData.isActive })}
              >
                <View style={[styles.checkbox, formData.isActive && styles.checkboxChecked]}>
                  {formData.isActive && <Text style={styles.checkboxIcon}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Perfil Activo</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Solo los perfiles activos se usan para calcular precios automáticamente
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={onSave}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  console.log('🖼️ Rendering PriceProfilesScreen - profiles count:', profiles.length);
  console.log('🖼️ Loading state:', loading);
  console.log('🖼️ Profiles data:', profiles);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando perfiles de precio...</Text>
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
        <Text style={styles.headerTitle}>Perfiles de Precio</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerIcon}>💡</Text>
        <Text style={styles.infoBannerText}>
          Los perfiles de precio definen diferentes estrategias de precios (Mayorista, Franquicia, Público, etc.)
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por código o nombre..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Profiles List */}
      <FlatList
        data={profiles}
        renderItem={renderProfileItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContainer, isLandscape && styles.listContainerLandscape]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No hay perfiles de precio registrados</Text>
            <Text style={styles.emptySubtext}>Presiona "+ Nuevo" para crear uno</Text>
          </View>
        }
      />

      {/* Create Modal */}
      {renderModal(
        showCreateModal,
        () => {
          setShowCreateModal(false);
          resetForm();
        },
        handleCreateProfile,
        'Nuevo Perfil de Precio'
      )}

      {/* Edit Modal */}
      {renderModal(
        showEditModal,
        () => {
          setShowEditModal(false);
          resetForm();
        },
        handleUpdateProfile,
        'Editar Perfil de Precio'
      )}

      {/* Add Button */}
      <AddButton
        onPress={() => {
          resetForm();
          setShowCreateModal(true);
        }}
        icon="💰"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#1E293B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoBannerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchButton: {
    backgroundColor: '#667eea',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 20,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  listContainerLandscape: {
    paddingBottom: 70,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
    marginRight: 12,
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  profileMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exampleSection: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  exampleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exampleLabel: {
    fontSize: 13,
    color: '#475569',
  },
  examplePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  profileDate: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 24,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#1E293B',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    fontStyle: 'italic',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PriceProfilesScreen;
