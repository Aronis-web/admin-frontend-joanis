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
  billingApi,
  DocumentType,
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
} from '@/services/api';
import { AddButton } from '@/components/Navigation/AddButton';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';

interface DocumentTypesScreenProps {
  navigation: any;
}

export const DocumentTypesScreen: React.FC<DocumentTypesScreenProps> = ({ navigation }) => {
  const { logout } = useAuthStore();
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDocumentTypes, setFilteredDocumentTypes] = useState<DocumentType[]>([]);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    requiresRuc: false,
    allowsDeduction: false,
    isActive: true,
  });
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  useEffect(() => {
    if (!Array.isArray(documentTypes)) {
      setFilteredDocumentTypes([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredDocumentTypes(documentTypes);
    } else {
      const filtered = documentTypes.filter(
        (type) =>
          (type.code && type.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (type.name && type.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredDocumentTypes(filtered);
    }
  }, [searchQuery, documentTypes]);

  const loadDocumentTypes = async () => {
    try {
      setLoading(true);
      const types = await billingApi.getDocumentTypes();
      console.log('📄 Document types loaded:', types.length);
      setDocumentTypes(types);
      setFilteredDocumentTypes(types);
    } catch (error: any) {
      console.error('❌ Error loading document types:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar los tipos de documento';
      Alert.alert('Error', errorMessage);
      setDocumentTypes([]);
      setFilteredDocumentTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDocumentTypes();
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
    setModalMode('create');
    setFormData({
      code: '',
      name: '',
      description: '',
      requiresRuc: false,
      allowsDeduction: false,
      isActive: true,
    });
    setSelectedDocumentType(null);
    setIsModalVisible(true);
  };

  const openEditModal = (documentType: DocumentType) => {
    setModalMode('edit');
    setFormData({
      code: documentType.code,
      name: documentType.name,
      description: documentType.description || '',
      requiresRuc: documentType.requiresRuc,
      allowsDeduction: documentType.allowsDeduction,
      isActive: documentType.isActive,
    });
    setSelectedDocumentType(documentType);
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    try {
      // Validations
      if (!formData.code.trim()) {
        Alert.alert('Error', 'El código es requerido');
        return;
      }
      if (!formData.name.trim()) {
        Alert.alert('Error', 'El nombre es requerido');
        return;
      }

      // Validate code format (2 digits)
      if (!/^\d{2}$/.test(formData.code)) {
        Alert.alert('Error', 'El código debe ser de 2 dígitos (ej: 01, 03, 07)');
        return;
      }

      if (modalMode === 'create') {
        const dto: CreateDocumentTypeDto = {
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          requiresRuc: formData.requiresRuc,
          allowsDeduction: formData.allowsDeduction,
          isActive: formData.isActive,
        };
        await billingApi.createDocumentType(dto);
        Alert.alert('Éxito', 'Tipo de documento creado correctamente');
      } else {
        if (!selectedDocumentType) return;
        const dto: UpdateDocumentTypeDto = {
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          requiresRuc: formData.requiresRuc,
          allowsDeduction: formData.allowsDeduction,
          isActive: formData.isActive,
        };
        await billingApi.updateDocumentType(selectedDocumentType.id, dto);
        Alert.alert('Éxito', 'Tipo de documento actualizado correctamente');
      }

      setIsModalVisible(false);
      loadDocumentTypes();
    } catch (error: any) {
      console.error('❌ Error saving document type:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Error al guardar el tipo de documento';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleDelete = (documentType: DocumentType) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar el tipo de documento "${documentType.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await billingApi.deleteDocumentType(documentType.id);
              Alert.alert('Éxito', 'Tipo de documento eliminado correctamente');
              loadDocumentTypes();
            } catch (error: any) {
              console.error('❌ Error deleting document type:', error);
              const errorMessage =
                error.response?.data?.message || error.message || 'Error al eliminar el tipo de documento';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const renderDocumentTypeCard = (documentType: DocumentType) => (
    <View key={documentType.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardCode}>{documentType.code}</Text>
          <Text style={styles.cardTitle}>{documentType.name}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          {documentType.isActive ? (
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

      {documentType.description && (
        <Text style={styles.cardDescription}>{documentType.description}</Text>
      )}

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Requiere RUC/DNI:</Text>
          <Text style={styles.detailValue}>{documentType.requiresRuc ? 'Sí' : 'No'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Permite deducción:</Text>
          <Text style={styles.detailValue}>{documentType.allowsDeduction ? 'Sí' : 'No'}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <ProtectedTouchableOpacity
          requiredPermissions={[PERMISSIONS.BILLING.DOCUMENT_TYPES.MANAGE]}
          style={styles.editButton}
          onPress={() => openEditModal(documentType)}
        >
          <Text style={styles.editButtonText}>✏️ Editar</Text>
        </ProtectedTouchableOpacity>

        <ProtectedTouchableOpacity
          requiredPermissions={[PERMISSIONS.BILLING.DOCUMENT_TYPES.MANAGE]}
          style={styles.deleteButton}
          onPress={() => handleDelete(documentType)}
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
          <Text style={styles.headerTitle}>Tipos de Documentos</Text>
          <TouchableOpacity onPress={handleMenuToggle} style={styles.menuButton}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por código o nombre..."
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando tipos de documento...</Text>
          </View>
        ) : filteredDocumentTypes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📄</Text>
            <Text style={styles.emptyTitle}>No hay tipos de documento</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No se encontraron resultados' : 'Agrega el primer tipo de documento'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {filteredDocumentTypes.map(renderDocumentTypeCard)}
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      <ProtectedElement requiredPermissions={[PERMISSIONS.BILLING.DOCUMENT_TYPES.MANAGE]}>
        <AddButton onPress={openCreateModal} />
      </ProtectedElement>

      {/* Create/Edit Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'create' ? 'Nuevo Tipo de Documento' : 'Editar Tipo de Documento'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Código SUNAT *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.code}
                  onChangeText={(text) => setFormData({ ...formData, code: text })}
                  placeholder="Ej: 01, 03, 07"
                  maxLength={2}
                  keyboardType="number-pad"
                />
                <Text style={styles.hint}>2 dígitos según catálogo SUNAT</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Ej: Factura Electrónica"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Descripción del tipo de documento"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Requiere RUC/DNI</Text>
                  <Switch
                    value={formData.requiresRuc}
                    onValueChange={(value) => setFormData({ ...formData, requiresRuc: value })}
                  />
                </View>
                <Text style={styles.hint}>¿El documento requiere RUC o DNI del cliente?</Text>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Permite deducción</Text>
                  <Switch
                    value={formData.allowsDeduction}
                    onValueChange={(value) => setFormData({ ...formData, allowsDeduction: value })}
                  />
                </View>
                <Text style={styles.hint}>¿Permite deducción de impuestos?</Text>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
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
  },
  cardCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
