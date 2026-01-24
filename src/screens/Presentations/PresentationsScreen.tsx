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
  Switch,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import {
  presentationsApi,
  Presentation,
  CreatePresentationDto,
  UpdatePresentationDto,
} from '@/services/api';
import { AddButton } from '@/components/Navigation/AddButton';

interface PresentationsScreenProps {
  navigation: any;
}

export const PresentationsScreen: React.FC<PresentationsScreenProps> = ({ navigation }) => {
  const { logout } = useAuthStore();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPresentations, setFilteredPresentations] = useState<Presentation[]>([]);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);

  // Modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    isBase: true,
  });
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    loadPresentations();
  }, []);

  useEffect(() => {
    if (!Array.isArray(presentations)) {
      setFilteredPresentations([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredPresentations(presentations);
    } else {
      const filtered = presentations.filter(
        (presentation) =>
          (presentation.code &&
            presentation.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (presentation.name && presentation.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredPresentations(filtered);
    }
  }, [searchQuery, presentations]);

  const loadPresentations = async () => {
    try {
      setLoading(true);
      const presentations = await presentationsApi.getPresentations({ page: 1, limit: 100 });
      console.log('📦 Presentations loaded:', presentations.length);
      setPresentations(presentations);
      setFilteredPresentations(presentations);
    } catch (error: any) {
      console.error('❌ Error loading presentations:', error);
      console.error('❌ Error response:', error.response?.data);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'No se pudieron cargar las presentaciones';
      Alert.alert('Error', errorMessage);
      setPresentations([]);
      setFilteredPresentations([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPresentations();
    setRefreshing(false);
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

  const handleLogout = async () => {
    setIsMenuVisible(false);
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleCreatePresentation = () => {
    setSelectedPresentation(null);
    setModalMode('create');
    setFormData({
      code: '',
      name: '',
      description: '',
      isBase: true,
    });
    setIsModalVisible(true);
  };

  const handleEditPresentation = (presentation: Presentation) => {
    setSelectedPresentation(presentation);
    setModalMode('edit');
    setFormData({
      code: presentation.code,
      name: presentation.name,
      description: presentation.description || '',
      isBase: presentation.isBase,
    });
    setIsModalVisible(true);
  };

  const handleDeletePresentation = (presentation: Presentation) => {
    Alert.alert(
      'Eliminar Presentación',
      `¿Estás seguro de que deseas eliminar "${presentation.name}" (${presentation.code})?\n\n⚠️ Esta acción puede afectar a los productos que usan esta presentación.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await presentationsApi.deletePresentation(presentation.id);
              Alert.alert('Éxito', 'Presentación eliminada correctamente');
              loadPresentations();
            } catch (error: any) {
              console.error('Error deleting presentation:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar la presentación');
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!formData.code.trim()) {
      Alert.alert('Error', 'El código es obligatorio');
      return;
    }

    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    try {
      if (modalMode === 'create') {
        const createData: CreatePresentationDto = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          description: formData.description || undefined,
          isBase: formData.isBase,
        };
        await presentationsApi.createPresentation(createData);
        Alert.alert('Éxito', 'Presentación creada correctamente');
      } else {
        const updateData: UpdatePresentationDto = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          description: formData.description || undefined,
          isBase: formData.isBase,
        };
        await presentationsApi.updatePresentation(selectedPresentation!.id, updateData);
        Alert.alert('Éxito', 'Presentación actualizada correctamente');
      }
      setIsModalVisible(false);
      loadPresentations();
    } catch (error: any) {
      console.error('Error saving presentation:', error);
      Alert.alert('Error', error.message || 'No se pudo guardar la presentación');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Presentaciones</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando presentaciones...</Text>
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
        <Text style={styles.headerTitle}>Presentaciones</Text>
        <View style={styles.backButton} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerIcon}>📦</Text>
        <View style={styles.infoBannerContent}>
          <Text style={styles.infoBannerTitle}>Catálogo Global de Presentaciones</Text>
          <Text style={styles.infoBannerText}>
            Las presentaciones son globales y compartidas por todos los productos. Cada producto
            elige cuáles usar y define sus factores de conversión.
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por código o nombre..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
          <Text style={styles.statValue}>{filteredPresentations.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
          <Text style={styles.statValue}>
            {filteredPresentations.filter((p) => p.isBase).length}
          </Text>
          <Text style={styles.statLabel}>Base</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.statValue}>
            {filteredPresentations.filter((p) => !p.isBase).length}
          </Text>
          <Text style={styles.statLabel}>No Base</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <ProtectedElement
        requiredPermissions={['presentations.create']}
        requireAll={false}
        fallback={null}
      >
        <AddButton onPress={handleCreatePresentation} icon="📋" />
      </ProtectedElement>

      {/* Presentations List */}
      <ScrollView
        style={[styles.content, isLandscape && styles.contentLandscape]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredPresentations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No hay presentaciones</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'No se encontraron presentaciones con ese criterio de búsqueda'
                : 'Comienza creando tu primera presentación global'}
            </Text>
          </View>
        ) : (
          <View style={styles.presentationsList}>
            {filteredPresentations.map((presentation, index) => (
              <View key={presentation.id || index} style={styles.presentationCard}>
                <View style={styles.presentationCardContent}>
                  <View style={styles.presentationHeader}>
                    <View style={styles.presentationInfo}>
                      <View style={styles.presentationTitleRow}>
                        <Text style={styles.presentationCode}>{presentation.code}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: presentation.isBase ? '#10B981' : '#6B7280' },
                          ]}
                        >
                          <Text style={styles.statusText}>
                            {presentation.isBase ? 'Base' : 'No Base'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.presentationName}>{presentation.name}</Text>
                      {presentation.description && (
                        <Text style={styles.presentationDescription}>
                          {presentation.description}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.presentationActions}>
                  <ProtectedElement
                    requiredPermissions={['presentations.update']}
                    requireAll={false}
                    fallback={null}
                  >
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditPresentation(presentation)}
                    >
                      <Text style={styles.actionButtonText}>✏️ Editar</Text>
                    </TouchableOpacity>
                  </ProtectedElement>

                  <ProtectedElement
                    requiredPermissions={['presentations.delete']}
                    requireAll={false}
                    fallback={null}
                  >
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeletePresentation(presentation)}
                    >
                      <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                        🗑️ Eliminar
                      </Text>
                    </TouchableOpacity>
                  </ProtectedElement>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>
              {modalMode === 'create' ? 'Nueva Presentación' : 'Editar Presentación'}
            </Text>
            <View style={styles.closeButton} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Información de la Presentación</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Código <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.code}
                  onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
                  placeholder="UN, PK, CJ, BX"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  maxLength={10}
                />
                <Text style={styles.helpText}>
                  Código único de la presentación (ej: UN, PK, CJ, BX)
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Nombre <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Unidad, Paquete, Caja, Box"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Descripción opcional de la presentación"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <View>
                    <Text style={styles.label}>Es Presentación Base</Text>
                    <Text style={styles.helpText}>
                      Marca si esta es la presentación base para conversiones
                    </Text>
                  </View>
                  <Switch
                    value={formData.isBase}
                    onValueChange={(value) => setFormData({ ...formData, isBase: value })}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>
                {modalMode === 'create' ? 'Crear' : 'Actualizar'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 24,
    color: '#1E293B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  infoBannerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 12,
    color: '#6366F1',
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  clearIcon: {
    fontSize: 18,
    color: '#94A3B8',
    paddingHorizontal: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingBottom: 100,
  },
  contentLandscape: {
    paddingBottom: 70,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  presentationsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  presentationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  presentationCardContent: {
    padding: 16,
  },
  presentationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  presentationInfo: {
    flex: 1,
  },
  presentationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  presentationCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  presentationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  presentationDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  presentationActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#DC2626',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#1E293B',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PresentationsScreen;
