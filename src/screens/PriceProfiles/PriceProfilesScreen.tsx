import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { priceProfilesApi } from '@/services/api';
import {
  PriceProfile,
  CreatePriceProfileRequest,
  UpdatePriceProfileRequest,
} from '@/types/price-profiles';
import Alert from '@/utils/alert';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import { AddButton } from '@/components/Navigation/AddButton';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface PriceProfilesScreenProps {
  navigation: any;
}

export const PriceProfilesScreen: React.FC<PriceProfilesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
    if (!selectedProfile) {
      return;
    }

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
                <Text style={styles.metricValue}>
                  {getNumericFactor(item.factorToCost).toFixed(4)}x
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Margen</Text>
                <Text style={styles.metricValue}>{calculateMargin(item.factorToCost)}%</Text>
              </View>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.isActive ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: item.isActive
                    ? theme.color.state.success.text
                    : theme.color.state.danger.text,
                },
              ]}
            >
              {item.isActive ? 'Activo' : 'Inactivo'}
            </Text>
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

  const renderModal = (
    visible: boolean,
    onClose: () => void,
    onSave: () => void,
    title: string
  ) => (
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
                Factor {formData.factorToCost} ={' '}
                {calculateMargin(parseFloat(formData.factorToCost) || 1)}% de margen
              </Text>
              <Text style={styles.helperText}>
                Ejemplo: Costo S/ 10.00 → Venta S/{' '}
                {(10 * (parseFloat(formData.factorToCost) || 1)).toFixed(2)}
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
        <ActivityIndicator size="large" color={theme.color.icon.accent} />
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
          Los perfiles de precio definen diferentes estrategias de precios (Mayorista, Franquicia,
          Público, etc.)
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
  },
  loadingText: {
    marginTop: theme.space[4],
    fontSize: 16,
    color: theme.color.text.muted,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: theme.color.text.heading,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.brand.primarySoft,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  infoBannerIcon: {
    fontSize: 20,
    marginRight: theme.space[3],
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: theme.color.brand.primary,
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    gap: theme.space[2],
  },
  searchInput: {
    flex: 1,
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    color: theme.color.text.body,
  },
  searchButton: {
    backgroundColor: theme.color.brand.accent,
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 20,
  },
  listContainer: {
    padding: theme.space[4],
    paddingBottom: 100,
  },
  listContainerLandscape: {
    paddingBottom: 70,
  },
  profileCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    padding: theme.space[4],
    marginBottom: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.space[4],
  },
  profileInfo: {
    flex: 1,
    marginRight: theme.space[3],
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[3],
    gap: theme.space[2],
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
    flex: 1,
  },
  codeBadge: {
    backgroundColor: theme.color.surface.muted,
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.color.border.default,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.text.body,
    letterSpacing: 0.5,
  },
  profileMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: theme.color.text.muted,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.success,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.color.border.subtle,
  },
  statusBadge: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1.5],
    borderRadius: theme.radii.xl,
  },
  statusActive: {
    backgroundColor: theme.color.state.success.background,
  },
  statusInactive: {
    backgroundColor: theme.color.state.danger.background,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exampleSection: {
    backgroundColor: theme.color.background.subtle,
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    marginBottom: theme.space[4],
  },
  exampleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: 6,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exampleLabel: {
    fontSize: 13,
    color: theme.color.text.body,
  },
  examplePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text.success,
  },
  profileActions: {
    flexDirection: 'row',
    gap: theme.space[2],
    marginBottom: theme.space[3],
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: theme.color.state.info.border,
  },
  deleteButton: {
    backgroundColor: theme.color.state.danger.border,
  },
  actionButtonText: {
    color: theme.color.text.inverse,
    fontSize: 13,
    fontWeight: '600',
  },
  profileDate: {
    fontSize: 11,
    color: theme.color.text.placeholder,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.space[4],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: theme.space[2],
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.color.text.placeholder,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    padding: theme.space[6],
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[6],
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: theme.space[5],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  input: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.xl,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    color: theme.color.text.body,
  },
  inputDisabled: {
    backgroundColor: theme.color.surface.muted,
    color: theme.color.text.placeholder,
  },
  helperText: {
    fontSize: 12,
    color: theme.color.text.muted,
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
    borderRadius: theme.radii.sm,
    borderWidth: 2,
    borderColor: theme.color.border.default,
    marginRight: theme.space[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.color.state.success.border,
    borderColor: theme.color.state.success.border,
  },
  checkboxIcon: {
    color: theme.color.text.inverse,
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 15,
    color: theme.color.text.heading,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[6],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.color.surface.muted,
    paddingVertical: theme.space[3.5],
    borderRadius: theme.radii.xl,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.color.text.body,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.color.state.success.border,
    paddingVertical: theme.space[3.5],
    borderRadius: theme.radii.xl,
    alignItems: 'center',
  },
  saveButtonText: {
    color: theme.color.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PriceProfilesScreen;
