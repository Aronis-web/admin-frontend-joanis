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
  CreatePresentationDto,
  UpdatePresentationDto,
} from '@/services/api';
import type { Presentation } from '@/services/api/presentations';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface PresentationsScreenProps {
  navigation: any;
}

export const PresentationsScreen: React.FC<PresentationsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
          placeholderTextColor={theme.color.text.placeholder}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.color.state.info.background }]}>
          <Text style={styles.statValue}>{filteredPresentations.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.color.state.success.background }]}>
          <Text style={styles.statValue}>
            {filteredPresentations.filter((p) => p.isBase).length}
          </Text>
          <Text style={styles.statLabel}>Base</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.color.state.warning.background }]}>
          <Text style={styles.statValue}>
            {filteredPresentations.filter((p) => !p.isBase).length}
          </Text>
          <Text style={styles.statLabel}>No Base</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <ProtectedElement
        requiredPermissions={[PERMISSIONS.PRESENTATIONS.CREATE]}
        requireAll={false}
        fallback={null}
      >
        <ProtectedFAB
          actions={[
            {
              icon: 'easel-outline',
              label: 'Crear Presentaci\u00f3n',
              onPress: handleCreatePresentation,
              requiredPermissions: ['presentations.create'],
            },
          ]}
        />
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
                            {
                              backgroundColor: presentation.isBase
                                ? theme.color.state.success.border
                                : theme.color.text.muted,
                            },
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
                  <ProtectedTouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditPresentation(presentation)}
                    requiredPermissions={[PERMISSIONS.PRESENTATIONS.UPDATE]}
                    hideIfNoPermission={true}
                  >
                    <Text style={styles.actionButtonText}>✏️ Editar</Text>
                  </ProtectedTouchableOpacity>

                  <ProtectedTouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeletePresentation(presentation)}
                    requiredPermissions={[PERMISSIONS.PRESENTATIONS.DELETE]}
                    hideIfNoPermission={true}
                  >
                    <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                      🗑️ Eliminar
                    </Text>
                  </ProtectedTouchableOpacity>
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
                  placeholderTextColor={theme.color.text.placeholder}
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
                  placeholderTextColor={theme.color.text.placeholder}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Descripción opcional de la presentación"
                  placeholderTextColor={theme.color.text.placeholder}
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
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
    fontSize: 24,
    color: theme.color.text.heading,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: theme.color.brand.primarySoft,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    marginBottom: theme.space[3],
    padding: theme.space[4],
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  infoBannerIcon: {
    fontSize: 32,
    marginRight: theme.space[3],
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.brand.primary,
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 12,
    color: theme.color.text.muted,
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginBottom: theme.space[3],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: theme.space[2],
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.color.text.body,
  },
  clearIcon: {
    fontSize: 18,
    color: theme.color.text.placeholder,
    paddingHorizontal: theme.space[2],
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.space[4],
    marginBottom: theme.space[3],
    gap: theme.space[2],
  },
  statCard: {
    flex: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: theme.color.text.muted,
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
    color: theme.color.text.muted,
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
    marginBottom: theme.space[4],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[2],
  },
  emptyText: {
    fontSize: 15,
    color: theme.color.text.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  presentationsList: {
    paddingHorizontal: theme.space[4],
    paddingBottom: theme.space[4],
  },
  presentationCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    marginBottom: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  presentationCardContent: {
    padding: theme.space[4],
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
    marginBottom: theme.space[2],
    gap: theme.space[3],
  },
  presentationCode: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.brand.accent,
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
  presentationName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  presentationDescription: {
    fontSize: 14,
    color: theme.color.text.muted,
    lineHeight: 20,
  },
  presentationActions: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.space[4],
    paddingBottom: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    paddingTop: theme.space[3],
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.color.surface.muted,
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  deleteButton: {
    backgroundColor: theme.color.state.danger.background,
  },
  deleteButtonText: {
    color: theme.color.state.danger.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: theme.color.text.heading,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  modalContent: {
    flex: 1,
    padding: theme.space[4],
  },
  modalSection: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[4],
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[4],
  },
  formGroup: {
    marginBottom: theme.space[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  required: {
    color: theme.color.text.danger,
  },
  input: {
    backgroundColor: theme.color.background.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2.5],
    fontSize: 15,
    color: theme.color.text.body,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: theme.color.text.muted,
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: theme.space[3],
    padding: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  button: {
    flex: 1,
    paddingVertical: theme.space[3.5],
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.color.surface.muted,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  submitButton: {
    backgroundColor: theme.color.brand.accent,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
});

export default PresentationsScreen;
