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
} from 'react-native';
import { balancesApi, filesApi } from '@/services/api';
import {
  Balance,
  BalanceOperation,
  OperationType,
  CreateBalanceOperationRequest,
  UpdateBalanceOperationRequest,
  getOperationTypeLabel,
  getOperationTypeColor,
  formatCentsToCurrency,
  currencyToCents,
  areFilesAllowed,
} from '@/types/balances';
import { useAuthStore } from '@/store/auth';
import { BalanceOperationDetailModal } from '@/components/Balances/BalanceOperationDetailModal';
import { EditBalanceOperationModal } from '@/components/Balances/EditBalanceOperationModal';
import { getTodayString } from '@/utils/dateHelpers';
import {
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  MediaTypeOptions
} from '@/utils/filePicker';
import { Pagination } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface BalanceOperationsScreenProps {
  navigation: any;
  route: any;
}

export const BalanceOperationsScreen: React.FC<BalanceOperationsScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { balanceId, balance } = route.params || {};
  const { currentSite } = useAuthStore();

  const [operations, setOperations] = useState<BalanceOperation[]>([]);
  const [balanceData, setBalanceData] = useState<Balance | null>(balance || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<BalanceOperation | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    operationType: OperationType.DISTRIBUTED,
    emitterCompanyId: '',
    emitterSiteId: '',
    amount: '',
    currency: 'PEN',
    operationDate: getTodayString(),
    description: '',
    reference: '',
    notes: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<
    Array<{ uri: string; filename: string; mimeType: string }>
  >([]);

  // Filter states
  const [filterType, setFilterType] = useState<OperationType | ''>('');

  useEffect(() => {
    console.log('🔄 BalanceOperationsScreen useEffect:', { balanceId, balanceData });
    if (balanceId) {
      loadOperations();
      if (!balanceData) {
        loadBalance();
      }
    } else {
      console.error('❌ No balanceId provided to BalanceOperationsScreen');
      setLoading(false);
    }
  }, [balanceId]);

  const loadBalance = async () => {
    try {
      console.log('📥 Loading balance for balanceId:', balanceId);
      const data = await balancesApi.getBalanceById(balanceId);
      console.log('✅ Balance loaded:', data);
      setBalanceData(data);
    } catch (error: any) {
      console.error('❌ Error loading balance:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
    }
  };

  const loadOperations = async (page: number = 1) => {
    try {
      console.log('📥 Loading operations for balanceId:', balanceId, 'page:', page);
      setLoading(true);
      const response = await balancesApi.getBalanceOperations(balanceId, {
        page,
        limit: pagination.limit,
        sortBy: 'operationDate',
        sortOrder: 'DESC',
      });
      console.log('✅ Operations loaded:', response);
      setOperations(response.data || []);

      // Update pagination info
      const totalPages = Math.ceil(response.total / response.limit);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: totalPages,
      });
    } catch (error: any) {
      console.error('❌ Error loading operations:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      Alert.alert('Error', 'No se pudieron cargar las operaciones');
      setOperations([]); // Set empty array on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOperations(1);
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      loadOperations(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      loadOperations(pagination.page + 1);
    }
  };

  const handleCreateOperation = async () => {
    if (!formData.amount) {
      Alert.alert('Error', 'El monto es requerido');
      return;
    }

    if (!formData.operationDate) {
      Alert.alert('Error', 'La fecha de operación es requerida');
      return;
    }

    // Auto-set emitter to current site if operation requires emitter and none is set
    const emitterCompanyId = formData.emitterCompanyId;
    let emitterSiteId = formData.emitterSiteId;

    if (
      (formData.operationType === OperationType.DISTRIBUTED ||
        formData.operationType === OperationType.RETURNED) &&
      !emitterCompanyId &&
      !emitterSiteId
    ) {
      // Automatically set current site as emitter
      if (currentSite?.id) {
        emitterSiteId = currentSite.id;
        console.log('✅ Auto-setting emitter to current site:', currentSite.name);
      } else {
        Alert.alert(
          'Error',
          'Para operaciones tipo Repartido o Devuelto se requiere un emisor. No se pudo detectar la sede actual.'
        );
        return;
      }
    }

    try {
      // 1. Create the operation first (without files)
      const createData: CreateBalanceOperationRequest = {
        balanceId,
        emitterCompanyId: emitterCompanyId || undefined,
        emitterSiteId: emitterSiteId || undefined,
        operationType: formData.operationType,
        amountCents: currencyToCents(parseFloat(formData.amount)),
        currency: formData.currency,
        operationDate: formData.operationDate,
        description: formData.description || undefined,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      };

      console.log('📤 Creating balance operation...');
      const createdOperation = await balancesApi.createBalanceOperation(balanceId, createData);
      console.log('✅ Operation created:', createdOperation.id);

      // 2. Upload files if any were selected
      if (selectedFiles.length > 0) {
        try {
          console.log(`📎 Uploading ${selectedFiles.length} file(s)...`);
          await filesApi.uploadBalanceOperationFiles(selectedFiles, createdOperation.id);
          console.log('✅ Files uploaded successfully');
          Alert.alert(
            'Éxito',
            `Operación creada con ${selectedFiles.length} archivo(s) adjunto(s)`
          );
        } catch (fileError: any) {
          console.error('❌ Error uploading files:', fileError);
          Alert.alert(
            'Advertencia',
            'La operación se creó correctamente, pero hubo un error al subir los archivos. Puedes intentar subirlos más tarde editando la operación.'
          );
        }
      } else {
        Alert.alert('Éxito', 'Operación creada correctamente');
      }

      setShowCreateModal(false);
      resetForm();
      loadOperations();
    } catch (error: any) {
      console.error('❌ Error creating operation:', error);
      Alert.alert('Error', error.message || 'No se pudo crear la operación');
    }
  };

  const openDetailModal = (operation: BalanceOperation) => {
    setSelectedOperation(operation);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setFormData({
      operationType: OperationType.DISTRIBUTED,
      emitterCompanyId: '',
      emitterSiteId: '',
      amount: '',
      currency: 'PEN',
      operationDate: getTodayString(),
      description: '',
      reference: '',
      notes: '',
    });
    setSelectedFiles([]);
  };

  const validateFiles = (files: Array<{ uri: string; filename: string; mimeType: string }>) => {
    const MAX_FILES = 10;
    const ALLOWED_TYPES = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/heic',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (files.length > MAX_FILES) {
      throw new Error(`Máximo ${MAX_FILES} archivos permitidos`);
    }

    files.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.mimeType)) {
        throw new Error(`Tipo de archivo no permitido: ${file.mimeType}`);
      }
    });
  };

  const handlePickFile = async () => {
    try {
      const { status } = await requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Requerido', 'Se necesita permiso para acceder a las fotos.');
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map((asset) => ({
          uri: asset.uri,
          filename: asset.fileName || `archivo_${Date.now()}.${asset.uri.split('.').pop()}`,
          mimeType:
            asset.mimeType ||
            (asset.uri.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        }));

        try {
          validateFiles([...selectedFiles, ...newFiles]);
          setSelectedFiles([...selectedFiles, ...newFiles]);
        } catch (validationError: any) {
          Alert.alert('Error de Validación', validationError.message);
        }
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Requerido', 'Se necesita permiso para usar la cámara.');
        return;
      }

      const result = await launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newFile = {
          uri: asset.uri,
          filename: asset.fileName || `foto_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        };

        try {
          validateFiles([...selectedFiles, newFile]);
          setSelectedFiles([...selectedFiles, newFile]);
        } catch (validationError: any) {
          Alert.alert('Error de Validación', validationError.message);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handleFileOptions = () => {
    Alert.alert('Seleccionar Archivo', 'Elige una opción', [
      {
        text: 'Tomar Foto',
        onPress: handleTakePhoto,
      },
      {
        text: 'Seleccionar de Galería',
        onPress: handlePickFile,
      },
      {
        text: 'Cancelar',
        style: 'cancel',
      },
    ]);
  };

  const filteredOperations = operations.filter((operation) => {
    const matchesSearch =
      operation.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      operation.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (operation.emitterCompany?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (operation.emitterSite?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = !filterType || operation.operationType === filterType;

    return matchesSearch && matchesType;
  });

  const renderOperationItem = ({ item }: { item: BalanceOperation }) => (
    <TouchableOpacity style={styles.operationItem} onPress={() => openDetailModal(item)}>
      <View style={styles.operationHeader}>
        <View style={styles.operationInfo}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: getOperationTypeColor(item.operationType) },
            ]}
          >
            <Text style={styles.typeBadgeText}>{getOperationTypeLabel(item.operationType)}</Text>
          </View>
          <Text style={styles.operationDate}>
            {new Date(item.operationDate).toLocaleDateString('es-ES')}
          </Text>
        </View>
        <Text style={styles.operationAmount}>{formatCentsToCurrency(item.amountCents)}</Text>
      </View>

      {item.emitterCompany && (
        <Text style={styles.operationEmitter}>Emisor: {item.emitterCompany.name}</Text>
      )}
      {item.emitterSite && (
        <Text style={styles.operationEmitter}>Emisor: {item.emitterSite.name}</Text>
      )}

      {item.description && <Text style={styles.operationDescription}>{item.description}</Text>}

      {item.reference && <Text style={styles.operationReference}>Ref: {item.reference}</Text>}
    </TouchableOpacity>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Nueva Operación</Text>

          <ScrollView style={styles.modalForm}>
            <Text style={styles.label}>Tipo de Operación</Text>
            <View style={styles.typeButtons}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.operationType === OperationType.DISTRIBUTED && styles.typeButtonActive,
                ]}
                onPress={() =>
                  setFormData({ ...formData, operationType: OperationType.DISTRIBUTED })
                }
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.operationType === OperationType.DISTRIBUTED &&
                      styles.typeButtonTextActive,
                  ]}
                >
                  Repartido
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.operationType === OperationType.SOLD && styles.typeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, operationType: OperationType.SOLD })}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.operationType === OperationType.SOLD && styles.typeButtonTextActive,
                  ]}
                >
                  Vendido
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.operationType === OperationType.TO_PAY && styles.typeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, operationType: OperationType.TO_PAY })}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.operationType === OperationType.TO_PAY && styles.typeButtonTextActive,
                  ]}
                >
                  Por Pagar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.operationType === OperationType.PAID && styles.typeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, operationType: OperationType.PAID })}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.operationType === OperationType.PAID && styles.typeButtonTextActive,
                  ]}
                >
                  Pagado
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.operationType === OperationType.RETURNED && styles.typeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, operationType: OperationType.RETURNED })}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.operationType === OperationType.RETURNED &&
                      styles.typeButtonTextActive,
                  ]}
                >
                  Devuelto
                </Text>
              </TouchableOpacity>
            </View>

            {(formData.operationType === OperationType.DISTRIBUTED ||
              formData.operationType === OperationType.RETURNED) && (
              <>
                <Text style={styles.label}>Emisor (Empresa o Sede)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ID de la empresa emisora"
                  value={formData.emitterCompanyId}
                  onChangeText={(text) => setFormData({ ...formData, emitterCompanyId: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="ID de la sede emisora"
                  value={formData.emitterSiteId}
                  onChangeText={(text) => setFormData({ ...formData, emitterSiteId: text })}
                />
              </>
            )}

            <Text style={styles.label}>Monto</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={formData.amount}
              onChangeText={(text) => setFormData({ ...formData, amount: text })}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Fecha de Operación</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={formData.operationDate}
              onChangeText={(text) => setFormData({ ...formData, operationDate: text })}
            />

            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descripción de la operación"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              maxLength={100}
            />

            <Text style={styles.label}>Referencia (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Número de factura, guía, etc."
              value={formData.reference}
              onChangeText={(text) => setFormData({ ...formData, reference: text })}
              maxLength={100}
            />

            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notas adicionales"
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              multiline
              numberOfLines={2}
              maxLength={100}
            />

            {/* Files - Only show if allowed */}
            {areFilesAllowed(formData.operationType) && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Archivos Adjuntos</Text>
                <Text style={styles.helperText}>
                  {formData.operationType === OperationType.PAID
                    ? '📎 Adjunta comprobantes de pago, transferencias, etc.'
                    : formData.operationType === OperationType.SOLD
                      ? '📎 Adjunta facturas, tickets de venta, etc.'
                      : formData.operationType === OperationType.DISTRIBUTED
                        ? '📎 Adjunta guías de remisión, comprobantes de entrega, fotos, etc.'
                        : formData.operationType === OperationType.RETURNED
                          ? '📎 Adjunta comprobantes de devolución, fotos, etc.'
                          : '📎 Puedes adjuntar comprobantes, facturas, fotos, etc.'}
                </Text>
                <TouchableOpacity style={styles.fileUploadButton} onPress={handleFileOptions}>
                  <Text style={styles.fileUploadButtonText}>📎 Seleccionar Archivos</Text>
                </TouchableOpacity>
                {selectedFiles.length > 0 && (
                  <View style={styles.filesContainer}>
                    {selectedFiles.map((file, index) => (
                      <View key={index} style={styles.fileItem}>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {file.filename}
                          </Text>
                          <Text style={styles.fileType}>
                            {file.mimeType.split('/')[0] === 'image' ? '📷 Imagen' : '📄 Documento'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                          }}
                        >
                          <Text style={styles.fileRemove}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              <Text style={styles.modalButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleCreateOperation}
            >
              <Text style={styles.modalButtonText}>Crear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Operaciones {balanceData ? `- ${balanceData.code}` : ''}
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.addButtonText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {!balanceId ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: No se proporcionó un ID de balance válido.</Text>
          <Text style={styles.errorSubtext}>
            Por favor, navegue a esta pantalla desde la lista de balances.
          </Text>
        </View>
      ) : (
        <>
          {/* Search and Filters */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por descripción, referencia o emisor..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filtersContainer}>
            <TouchableOpacity
              style={[styles.filterButton, !filterType && styles.filterButtonActive]}
              onPress={() => setFilterType('')}
            >
              <Text style={[styles.filterButtonText, !filterType && styles.filterButtonTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.DISTRIBUTED && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.DISTRIBUTED)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.DISTRIBUTED && styles.filterButtonTextActive,
                ]}
              >
                Repartido
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.SOLD && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.SOLD)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.SOLD && styles.filterButtonTextActive,
                ]}
              >
                Vendido
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.TO_PAY && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.TO_PAY)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.TO_PAY && styles.filterButtonTextActive,
                ]}
              >
                Por Pagar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.PAID && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.PAID)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.PAID && styles.filterButtonTextActive,
                ]}
              >
                Pagado
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.RETURNED && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.RETURNED)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.RETURNED && styles.filterButtonTextActive,
                ]}
              >
                Devuelto
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
              <Text style={styles.loadingText}>Cargando operaciones...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredOperations}
              renderItem={renderOperationItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay operaciones registradas</Text>
                </View>
              }
            />
          )}

          {/* Pagination Controls */}
          {!loading && pagination.total > 0 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={loadOperations}
              loading={loading}
            />
          )}
        </>
      )}

      {renderCreateModal()}

      {/* Operation Detail Modal */}
      <BalanceOperationDetailModal
        visible={showDetailModal}
        operation={selectedOperation}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedOperation(null);
        }}
        onEdit={(operation) => {
          setSelectedOperation(operation);
          setShowDetailModal(false);
          setShowEditModal(true);
        }}
        onOperationUpdated={() => {
          loadOperations();
        }}
      />

      {/* Edit Operation Modal */}
      <EditBalanceOperationModal
        visible={showEditModal}
        operation={selectedOperation}
        onClose={() => {
          setShowEditModal(false);
          // Keep selectedOperation so we can go back to detail modal if needed
        }}
        onSuccess={() => {
          loadOperations();
          setShowEditModal(false);
          setSelectedOperation(null);
        }}
      />
    </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.color.brand.accent,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: theme.color.state.success.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: theme.color.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.color.surface.base,
  },
  searchInput: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.color.text.heading,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.color.surface.base,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.color.surface.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  filterButtonActive: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },
  filterButtonText: {
    fontSize: 12,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: theme.color.text.inverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.color.text.muted,
  },
  listContent: {
    padding: 20,
  },
  operationItem: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  operationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  operationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
  operationDate: {
    fontSize: 13,
    color: theme.color.text.muted,
  },
  operationAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  operationEmitter: {
    fontSize: 14,
    color: theme.color.text.body,
    marginBottom: 4,
  },
  operationDescription: {
    fontSize: 14,
    color: theme.color.text.muted,
    marginBottom: 4,
  },
  operationReference: {
    fontSize: 13,
    color: theme.color.text.subtle,
    fontStyle: 'italic',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: theme.color.text.muted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.state.danger.border,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: theme.color.text.muted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  modalForm: {
    padding: 20,
    maxHeight: '60%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.color.text.heading,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.color.surface.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  typeButtonTextActive: {
    color: theme.color.text.inverse,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
  cancelButton: {
    backgroundColor: theme.color.text.muted,
  },
  confirmButton: {
    backgroundColor: theme.color.brand.accent,
  },
  // Detail Modal Styles
  detailModalContent: {
    backgroundColor: theme.color.surface.base,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  operationBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  operationBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.text.inverse,
    textAlign: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 6,
  },
  detailModalAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.state.success.border,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.color.surface.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: theme.color.text.muted,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: theme.color.text.heading,
    fontWeight: '500',
  },
  detailModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionButton: {
    backgroundColor: theme.color.surface.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  closeActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  // File upload styles
  formGroup: {
    marginBottom: 16,
  },
  helperText: {
    fontSize: 13,
    color: theme.color.text.muted,
    marginBottom: 12,
    lineHeight: 18,
  },
  fileUploadButton: {
    backgroundColor: theme.color.brand.accentSoft,
    borderWidth: 1,
    borderColor: theme.color.brand.accent,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  fileUploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.brand.accent,
  },
  filesContainer: {
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  fileInfo: {
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: 2,
  },
  fileType: {
    fontSize: 12,
    color: theme.color.text.muted,
  },
  fileRemove: {
    fontSize: 20,
    color: theme.color.state.danger.border,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  paginationContainer: {
    backgroundColor: theme.color.surface.base,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  paginationSubtext: {
    fontSize: 12,
    color: theme.color.text.placeholder,
    marginTop: 2,
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: theme.color.brand.accent,
    minWidth: 110,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: theme.color.surface.disabled,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
  paginationButtonTextDisabled: {
    color: theme.color.text.placeholder,
  },
});
