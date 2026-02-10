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
import { useTenantStore } from '@/store/tenant';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import {
  billingApi,
  DocumentSeries,
  DocumentType,
  CreateDocumentSeriesDto,
  UpdateDocumentSeriesDto,
} from '@/services/api';
import { AddButton } from '@/components/Navigation/AddButton';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';

interface DocumentSeriesScreenProps {
  navigation: any;
}

export const DocumentSeriesScreen: React.FC<DocumentSeriesScreenProps> = ({ navigation }) => {
  const { logout } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const [series, setSeries] = useState<DocumentSeries[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSeries, setFilteredSeries] = useState<DocumentSeries[]>([]);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedSeries, setSelectedSeries] = useState<DocumentSeries | null>(null);
  const [formData, setFormData] = useState({
    documentTypeId: '',
    series: '',
    description: '',
    startNumber: 1,
    maxNumber: 99999999,
    isActive: true,
    isDefault: false,
  });
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    loadData();
  }, [selectedSite]);

  useEffect(() => {
    if (!Array.isArray(series)) {
      setFilteredSeries([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredSeries(series);
    } else {
      const filtered = series.filter(
        (s) =>
          (s.series && s.series.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.documentType?.name && s.documentType.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredSeries(filtered);
    }
  }, [searchQuery, series]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load document types
      const types = await billingApi.getDocumentTypes({ isActive: true });
      setDocumentTypes(types);

      // Load series for current site
      if (selectedSite?.id) {
        const seriesData = await billingApi.getDocumentSeries({
          siteId: selectedSite.id,
          page: 1,
          limit: 100
        });
        console.log('📋 Series loaded:', seriesData.length);
        setSeries(seriesData);
        setFilteredSeries(seriesData);
      } else {
        setSeries([]);
        setFilteredSeries([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading data:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar las series';
      Alert.alert('Error', errorMessage);
      setSeries([]);
      setFilteredSeries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const navigateFromMenu = useMenuNavigation(navigation);

  const handleMenuSelect = (menuId: string) => {
    setIsMenuVisible(false);
    navigateFromMenu(menuId);
  };

  const handleLogout = () => {
    setIsMenuVisible(false);
    logout();
  };

  const openCreateModal = () => {
    if (!selectedSite?.id) {
      Alert.alert('Error', 'Debes seleccionar una sede primero');
      return;
    }

    setModalMode('create');
    setFormData({
      documentTypeId: '',
      series: '',
      description: '',
      startNumber: 1,
      maxNumber: 99999999,
      isActive: true,
      isDefault: false,
    });
    setSelectedSeries(null);
    setIsModalVisible(true);
  };

  const openEditModal = (seriesItem: DocumentSeries) => {
    setModalMode('edit');
    setFormData({
      documentTypeId: seriesItem.documentTypeId,
      series: seriesItem.series,
      description: seriesItem.description || '',
      startNumber: seriesItem.startNumber,
      maxNumber: seriesItem.maxNumber,
      isActive: seriesItem.isActive,
      isDefault: seriesItem.isDefault,
    });
    setSelectedSeries(seriesItem);
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    try {
      // Validations
      if (!formData.documentTypeId) {
        Alert.alert('Error', 'Debes seleccionar un tipo de documento');
        return;
      }
      if (!formData.series.trim()) {
        Alert.alert('Error', 'La serie es requerida');
        return;
      }

      // Validate series format (4 characters, uppercase alphanumeric)
      if (!/^[A-Z0-9]{4}$/.test(formData.series)) {
        Alert.alert('Error', 'La serie debe tener exactamente 4 caracteres alfanuméricos en mayúsculas (ej: F001, B001, NC01)');
        return;
      }

      if (formData.startNumber < 1) {
        Alert.alert('Error', 'El número inicial debe ser mayor a 0');
        return;
      }

      if (formData.maxNumber <= formData.startNumber) {
        Alert.alert('Error', 'El número máximo debe ser mayor al número inicial');
        return;
      }

      if (modalMode === 'create') {
        const dto: CreateDocumentSeriesDto = {
          siteId: selectedSite!.id,
          documentTypeId: formData.documentTypeId,
          series: formData.series.trim().toUpperCase(),
          description: formData.description.trim() || undefined,
          startNumber: formData.startNumber,
          maxNumber: formData.maxNumber,
          isActive: formData.isActive,
          isDefault: formData.isDefault,
        };
        await billingApi.createDocumentSeries(dto);
        Alert.alert('Éxito', 'Serie creada correctamente');
      } else {
        if (!selectedSeries) return;
        const dto: UpdateDocumentSeriesDto = {
          series: formData.series.trim().toUpperCase(),
          description: formData.description.trim() || undefined,
          maxNumber: formData.maxNumber,
          isActive: formData.isActive,
          isDefault: formData.isDefault,
        };
        await billingApi.updateDocumentSeries(selectedSeries.id, dto);
        Alert.alert('Éxito', 'Serie actualizada correctamente');
      }

      setIsModalVisible(false);
      loadData();
    } catch (error: any) {
      console.error('❌ Error saving series:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Error al guardar la serie';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleDelete = (seriesItem: DocumentSeries) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar la serie "${seriesItem.series}"?\n\nSolo se puede eliminar si no tiene correlativos generados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await billingApi.deleteDocumentSeries(seriesItem.id);
              Alert.alert('Éxito', 'Serie eliminada correctamente');
              loadData();
            } catch (error: any) {
              console.error('❌ Error deleting series:', error);
              const errorMessage =
                error.response?.data?.message || error.message || 'Error al eliminar la serie';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const renderSeriesCard = (seriesItem: DocumentSeries) => (
    <View key={seriesItem.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardSeries}>{seriesItem.series}</Text>
          <Text style={styles.cardType}>{seriesItem.documentType?.name || 'N/A'}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          {seriesItem.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Por defecto</Text>
            </View>
          )}
          {seriesItem.isActive ? (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Activo</Text>
            </View>
          ) : (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactivo</Text>
            </View>
          )}
        </View>
      </View>

      {seriesItem.description && (
        <Text style={styles.cardDescription}>{seriesItem.description}</Text>
      )}

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Número actual:</Text>
          <Text style={styles.detailValue}>{seriesItem.currentNumber.toString().padStart(8, '0')}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Rango:</Text>
          <Text style={styles.detailValue}>
            {seriesItem.startNumber} - {seriesItem.maxNumber.toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Disponibles:</Text>
          <Text style={styles.detailValue}>
            {(seriesItem.maxNumber - seriesItem.currentNumber).toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sede:</Text>
          <Text style={styles.detailValue}>{seriesItem.site?.name || selectedSite?.name || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <ProtectedTouchableOpacity
          requiredPermissions={['billing.series.update']}
          style={styles.editButton}
          onPress={() => openEditModal(seriesItem)}
        >
          <Text style={styles.editButtonText}>✏️ Editar</Text>
        </ProtectedTouchableOpacity>

        <ProtectedTouchableOpacity
          requiredPermissions={['billing.series.delete']}
          style={styles.deleteButton}
          onPress={() => handleDelete(seriesItem)}
        >
          <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
        </ProtectedTouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Series de Documentos</Text>
            {selectedSite && (
              <Text style={styles.headerSubtitle}>{selectedSite.name}</Text>
            )}
          </View>
          <TouchableOpacity onPress={handleMenuToggle} style={styles.menuButton}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por serie, tipo o descripción..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {!selectedSite ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>🏢</Text>
            <Text style={styles.emptyTitle}>No hay sede seleccionada</Text>
            <Text style={styles.emptySubtitle}>Selecciona una sede para ver sus series</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando series...</Text>
          </View>
        ) : filteredSeries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📋</Text>
            <Text style={styles.emptyTitle}>No hay series</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No se encontraron resultados' : 'Agrega la primera serie de documentos'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {filteredSeries.map(renderSeriesCard)}
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      <ProtectedElement requiredPermissions={['billing.series.create']}>
        <AddButton onPress={openCreateModal} />
      </ProtectedElement>

      {/* Create/Edit Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'create' ? 'Nueva Serie' : 'Editar Serie'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Documento *</Text>
                <View style={styles.pickerContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {documentTypes.map((type) => (
                      <TouchableOpacity
                        key={type.id}
                        style={[
                          styles.typeChip,
                          formData.documentTypeId === type.id && styles.typeChipSelected,
                        ]}
                        onPress={() => setFormData({ ...formData, documentTypeId: type.id })}
                        disabled={modalMode === 'edit'}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            formData.documentTypeId === type.id && styles.typeChipTextSelected,
                          ]}
                        >
                          {type.code} - {type.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                {modalMode === 'edit' && (
                  <Text style={styles.hint}>No se puede cambiar el tipo de documento</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Serie *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.series}
                  onChangeText={(text) => setFormData({ ...formData, series: text.toUpperCase() })}
                  placeholder="Ej: F001, B001, NC01"
                  maxLength={4}
                  autoCapitalize="characters"
                />
                <Text style={styles.hint}>4 caracteres alfanuméricos en mayúsculas</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Descripción de la serie"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {modalMode === 'create' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Número Inicial</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.startNumber.toString()}
                    onChangeText={(text) => setFormData({ ...formData, startNumber: parseInt(text) || 1 })}
                    placeholder="1"
                    keyboardType="number-pad"
                  />
                  <Text style={styles.hint}>Número desde el cual comenzará la serie</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Número Máximo</Text>
                <TextInput
                  style={styles.input}
                  value={formData.maxNumber.toString()}
                  onChangeText={(text) => setFormData({ ...formData, maxNumber: parseInt(text) || 99999999 })}
                  placeholder="99999999"
                  keyboardType="number-pad"
                />
                <Text style={styles.hint}>Número máximo permitido (default: 99,999,999)</Text>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Serie por defecto</Text>
                  <Switch
                    value={formData.isDefault}
                    onValueChange={(value) => setFormData({ ...formData, isDefault: value })}
                  />
                </View>
                <Text style={styles.hint}>
                  Se usará automáticamente para este tipo de documento en esta sede
                </Text>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Activo</Text>
                  <Switch
                    value={formData.isActive}
                    onValueChange={(value) => setFormData({ ...formData, isActive: value })}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>
                  {modalMode === 'create' ? 'Crear' : 'Guardar'}
                </Text>
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
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#6366F1',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#6366F1',
  },
  searchContainer: {
    marginTop: 8,
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  cardsContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    marginLeft: 12,
    gap: 4,
  },
  cardSeries: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 4,
  },
  cardType: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  cardDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  defaultBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultBadgeText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inactiveBadgeText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  pickerContainer: {
    marginBottom: 8,
  },
  typeChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  typeChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  typeChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  typeChipTextSelected: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
