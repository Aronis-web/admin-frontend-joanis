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
} from 'react-native';
import { balancesApi, filesApi } from '@/services/api';
import {
  Balance,
  BalanceOperation,
  OperationType,
  BalanceStatus,
  BalanceType,
  PaymentMethod,
  CreateBalanceOperationRequest,
  getOperationTypeLabel,
  getOperationTypeColor,
  getPaymentMethodLabel,
  isPaymentMethodRequired,
  getAllowedPaymentMethods,
  areFilesAllowed,
  formatCentsToCurrency,
  currencyToCents,
} from '@/types/balances';
import { useAuthStore } from '@/store/auth';
import { BalanceOperationsFAB } from '@/components/Balances/BalanceOperationsFAB';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { BalanceOperationDetailModal } from '@/components/Balances/BalanceOperationDetailModal';
import { EditBalanceOperationModal } from '@/components/Balances/EditBalanceOperationModal';
import * as ImagePicker from 'expo-image-picker';

interface AllBalanceOperationsScreenProps {
  navigation: any;
  route: any;
}

export const AllBalanceOperationsScreen: React.FC<AllBalanceOperationsScreenProps> = ({
  navigation,
  route,
}) => {
  const { currentSite } = useAuthStore();
  const [operations, setOperations] = useState<BalanceOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filter states
  const [filterType, setFilterType] = useState<OperationType | ''>('');
  const [filterReceiver, setFilterReceiver] = useState<string>(''); // Filter by receiver (company or site)

  // Modal and form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<BalanceOperation | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [selectedBalance, setSelectedBalance] = useState<Balance | null>(null);
  const [formData, setFormData] = useState({
    operationType: OperationType.DISTRIBUTED,
    emitterCompanyId: '',
    emitterSiteId: '',
    amount: '',
    currency: 'PEN',
    operationDate: new Date().toISOString().split('T')[0],
    paymentMethod: '' as PaymentMethod | '',
    description: '',
    reference: '',
    notes: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<
    Array<{ uri: string; filename: string; mimeType: string }>
  >([]);
  const [showOperationDatePicker, setShowOperationDatePicker] = useState(false);

  useEffect(() => {
    console.log('🔄 AllBalanceOperationsScreen useEffect');
    console.log('🔵 Initial showCreateModal state:', showCreateModal);
    loadOperations();
    loadBalances();
  }, []);

  useEffect(() => {
    console.log('🔵 showCreateModal changed to:', showCreateModal);
  }, [showCreateModal]);

  const loadOperations = async (page: number = 1) => {
    try {
      console.log('📥 Loading all operations, page:', page);
      setLoading(true);
      const response = await balancesApi.getAllBalanceOperations({
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
      setOperations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadBalances = async () => {
    try {
      console.log('📥 Loading balances for selection');
      const response = await balancesApi.getBalances({
        page: 1,
        limit: 100,
        status: BalanceStatus.ACTIVE, // Only load active balances
      });
      console.log('✅ Balances loaded:', response);
      setBalances(response.data || []);
    } catch (error: any) {
      console.error('❌ Error loading balances:', error);
      Alert.alert('Error', 'No se pudieron cargar los balances');
      setBalances([]);
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

  const handleOperationPress = (operation: BalanceOperation) => {
    // Open detail modal to view operation details
    setSelectedOperation(operation);
    setShowDetailModal(true);
  };

  const handleCreateOperation = async () => {
    if (!selectedBalance) {
      Alert.alert('Error', 'Debe seleccionar un balance');
      return;
    }

    if (!formData.amount) {
      Alert.alert('Error', 'El monto es requerido');
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

    // Validate that SOLD and TO_PAY are not allowed for external balances
    if (
      selectedBalance.balanceType === 'EXTERNO' &&
      (formData.operationType === OperationType.SOLD ||
        formData.operationType === OperationType.TO_PAY)
    ) {
      Alert.alert(
        'Operación No Permitida',
        `La operación "${getOperationTypeLabel(formData.operationType)}" no se registra para balances externos.`
      );
      return;
    }

    // Validate payment method if required
    if (
      isPaymentMethodRequired(selectedBalance.balanceType as BalanceType, formData.operationType)
    ) {
      if (!formData.paymentMethod) {
        Alert.alert('Error', 'El método de pago es requerido para este tipo de operación');
        return;
      }
    }

    try {
      // 1. Create the operation first (without files)
      const createData: CreateBalanceOperationRequest = {
        balanceId: selectedBalance.id,
        emitterCompanyId: emitterCompanyId || undefined,
        emitterSiteId: emitterSiteId || undefined,
        operationType: formData.operationType,
        amountCents: currencyToCents(parseFloat(formData.amount)),
        currency: formData.currency,
        operationDate: formData.operationDate,
        paymentMethod: formData.paymentMethod || undefined,
        description: formData.description || undefined,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      };

      console.log('📤 Creating balance operation...');
      const createdOperation = await balancesApi.createBalanceOperation(
        selectedBalance.id,
        createData
      );
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

  const resetForm = () => {
    setSelectedBalance(null);
    setFormData({
      operationType: OperationType.DISTRIBUTED,
      emitterCompanyId: '',
      emitterSiteId: '',
      amount: '',
      currency: 'PEN',
      operationDate: new Date().toISOString().split('T')[0],
      paymentMethod: '' as PaymentMethod | '',
      description: '',
      reference: '',
      notes: '',
    });
    setSelectedFiles([]);
  };

  const openCreateModal = (operationType?: OperationType) => {
    console.log('🟢 openCreateModal called with operationType:', operationType);
    resetForm();
    if (operationType) {
      setFormData((prev) => ({ ...prev, operationType }));
    }
    console.log('🟢 Setting showCreateModal to true');
    setShowCreateModal(true);
  };

  const handleOperationTypeSelect = (operationType: OperationType) => {
    console.log('🟢 handleOperationTypeSelect called with:', operationType);
    openCreateModal(operationType);
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
      // Validar tipo
      if (!ALLOWED_TYPES.includes(file.mimeType)) {
        throw new Error(`Tipo de archivo no permitido: ${file.mimeType}`);
      }
    });
  };

  const handlePickFile = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Requerido', 'Se necesita permiso para acceder a las fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
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

        // Validate files before adding
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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Requerido', 'Se necesita permiso para usar la cámara.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
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

        // Validate files before adding
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
      (operation.emitterSite?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      operation.balanceId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = !filterType || operation.operationType === filterType;

    const matchesReceiver =
      !filterReceiver ||
      (operation.balance?.receiverCompany?.name || '')
        .toLowerCase()
        .includes(filterReceiver.toLowerCase()) ||
      (operation.balance?.receiverSite?.name || '')
        .toLowerCase()
        .includes(filterReceiver.toLowerCase());

    return matchesSearch && matchesType && matchesReceiver;
  });

  const renderOperationItem = ({ item }: { item: BalanceOperation }) => (
    <TouchableOpacity style={styles.operationItem} onPress={() => handleOperationPress(item)}>
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

      <Text style={styles.operationBalance}>Balance ID: {item.balanceId}</Text>

      {item.emitterCompany && (
        <Text style={styles.operationEmitter}>Emisor: {item.emitterCompany.name}</Text>
      )}
      {item.emitterSite && (
        <Text style={styles.operationEmitter}>Emisor: {item.emitterSite.name}</Text>
      )}

      {item.description && <Text style={styles.operationDescription}>{item.description}</Text>}

      {item.reference && <Text style={styles.operationReference}>Ref: {item.reference}</Text>}

      <View style={styles.operationFooter}>
        <Text style={styles.viewDetailsText}>Ver detalles del balance →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Todas las Operaciones</Text>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por descripción, referencia, emisor o balance..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Receptor Filter */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filtrar por receptor (empresa o sede)..."
          value={filterReceiver}
          onChangeText={setFilterReceiver}
        />
        {filterReceiver !== '' && (
          <TouchableOpacity style={styles.clearFilterButton} onPress={() => setFilterReceiver('')}>
            <Text style={styles.clearFilterText}>✕</Text>
          </TouchableOpacity>
        )}
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
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Cargando operaciones...</Text>
        </View>
      ) : (
        <>
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

          {/* Pagination Controls */}
          {pagination.total > 0 && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  pagination.page === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={handlePreviousPage}
                disabled={pagination.page === 1}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    pagination.page === 1 && styles.paginationButtonTextDisabled,
                  ]}
                >
                  ← Anterior
                </Text>
              </TouchableOpacity>

              <View style={styles.paginationInfo}>
                <Text style={styles.paginationText}>
                  Pág. {pagination.page}/{pagination.totalPages}
                </Text>
                <Text style={styles.paginationSubtext}>
                  {operations.length} de {pagination.total}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  pagination.page >= pagination.totalPages && styles.paginationButtonDisabled,
                ]}
                onPress={handleNextPage}
                disabled={pagination.page >= pagination.totalPages}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    pagination.page >= pagination.totalPages && styles.paginationButtonTextDisabled,
                  ]}
                >
                  Siguiente →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Floating Action Button with Operation Type Selection */}
          <BalanceOperationsFAB onOperationSelect={handleOperationTypeSelect} />
        </>
      )}

      {/* Create Operation Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          console.log('🔵 Modal onRequestClose called');
          setShowCreateModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nueva Operación</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Text style={styles.modalCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Balance Type Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Balance *</Text>
                <View style={styles.balanceTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.balanceTypeButton,
                      selectedBalance?.balanceType === 'INTERNO' && styles.balanceTypeButtonActive,
                    ]}
                    onPress={() => {
                      // Filter balances by type
                      const internalBalance = balances.find((b) => b.balanceType === 'INTERNO');
                      if (internalBalance) {
                        setSelectedBalance(internalBalance);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.balanceTypeButtonText,
                        selectedBalance?.balanceType === 'INTERNO' &&
                          styles.balanceTypeButtonTextActive,
                      ]}
                    >
                      🏢 Interna (Sede)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.balanceTypeButton,
                      selectedBalance?.balanceType === 'EXTERNO' && styles.balanceTypeButtonActive,
                    ]}
                    onPress={() => {
                      // Filter balances by type
                      const externalBalance = balances.find((b) => b.balanceType === 'EXTERNO');
                      if (externalBalance) {
                        setSelectedBalance(externalBalance);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.balanceTypeButtonText,
                        selectedBalance?.balanceType === 'EXTERNO' &&
                          styles.balanceTypeButtonTextActive,
                      ]}
                    >
                      🏭 Externa (Empresa)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Balance Selection - Only show after selecting type */}
              {selectedBalance && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {selectedBalance.balanceType === 'INTERNO'
                      ? 'Seleccionar Sede *'
                      : 'Seleccionar Empresa *'}
                  </Text>
                  <Text style={styles.helperText}>
                    Selecciona{' '}
                    {selectedBalance.balanceType === 'INTERNO' ? 'la sede' : 'la empresa'} para esta
                    operación
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.balanceSelector}
                  >
                    {balances
                      .filter((b) => b.balanceType === selectedBalance.balanceType)
                      .map((balance) => (
                        <TouchableOpacity
                          key={balance.id}
                          style={[
                            styles.balanceOption,
                            selectedBalance?.id === balance.id && styles.balanceOptionSelected,
                          ]}
                          onPress={() => setSelectedBalance(balance)}
                        >
                          <Text
                            style={[
                              styles.balanceOptionTitle,
                              selectedBalance?.id === balance.id &&
                                styles.balanceOptionTitleSelected,
                            ]}
                          >
                            {balance.receiverCompany?.name || balance.receiverSite?.name}
                          </Text>
                          <Text
                            style={[
                              styles.balanceOptionCode,
                              selectedBalance?.id === balance.id &&
                                styles.balanceOptionCodeSelected,
                            ]}
                          >
                            {balance.code}
                          </Text>
                          <Text
                            style={[
                              styles.balanceOptionSubtext,
                              selectedBalance?.id === balance.id &&
                                styles.balanceOptionSubtextSelected,
                            ]}
                          >
                            {balance.balanceType}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              {/* Operation Type - Display only (selected from FAB) */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Operación</Text>
                <View
                  style={[
                    styles.operationTypeBadge,
                    { backgroundColor: getOperationTypeColor(formData.operationType) },
                  ]}
                >
                  <Text style={styles.operationTypeBadgeText}>
                    {getOperationTypeLabel(formData.operationType)}
                  </Text>
                </View>
                {selectedBalance && (
                  <View style={styles.operationInfoBox}>
                    <Text style={styles.operationInfoTitle}>ℹ️ Información de la operación:</Text>
                    {selectedBalance.balanceType === 'EXTERNO' ? (
                      <>
                        {formData.operationType === OperationType.PAID && (
                          <Text style={styles.operationInfoText}>
                            • Requiere método de pago: Solo Transferencia Bancaria{'\n'}• Permite
                            adjuntar archivos (comprobantes)
                          </Text>
                        )}
                        {formData.operationType === OperationType.DISTRIBUTED && (
                          <Text style={styles.operationInfoText}>
                            • No requiere método de pago{'\n'}• Permite adjuntar archivos (guías,
                            comprobantes)
                          </Text>
                        )}
                        {formData.operationType === OperationType.RETURNED && (
                          <Text style={styles.operationInfoText}>
                            • No requiere método de pago{'\n'}• Permite adjuntar archivos
                            (comprobantes de devolución)
                          </Text>
                        )}
                        {(formData.operationType === OperationType.SOLD ||
                          formData.operationType === OperationType.TO_PAY) && (
                          <Text style={styles.operationInfoText}>
                            ⚠️ Esta operación no se registra para balances externos
                          </Text>
                        )}
                      </>
                    ) : (
                      <>
                        {(formData.operationType === OperationType.SOLD ||
                          formData.operationType === OperationType.TO_PAY ||
                          formData.operationType === OperationType.PAID) && (
                          <Text style={styles.operationInfoText}>
                            • Requiere método de pago: Izipay, Prosegur o Transferencia{'\n'}•
                            Permite adjuntar archivos (comprobantes, facturas)
                          </Text>
                        )}
                        {formData.operationType === OperationType.DISTRIBUTED && (
                          <Text style={styles.operationInfoText}>
                            • No requiere método de pago{'\n'}• Permite adjuntar archivos (guías,
                            comprobantes)
                          </Text>
                        )}
                        {formData.operationType === OperationType.RETURNED && (
                          <Text style={styles.operationInfoText}>
                            • No requiere método de pago{'\n'}• Permite adjuntar archivos
                            (comprobantes de devolución)
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>

              {/* Payment Method - Only show if required */}
              {selectedBalance &&
                isPaymentMethodRequired(
                  selectedBalance.balanceType as BalanceType,
                  formData.operationType
                ) && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Método de Pago *</Text>
                    <Text style={styles.helperText}>
                      {selectedBalance.balanceType === 'EXTERNO' &&
                      formData.operationType === OperationType.PAID
                        ? '⚠️ Solo se permite Transferencia Bancaria para pagos en balances externos'
                        : selectedBalance.balanceType === 'INTERNO'
                          ? `Selecciona el método de pago para ${getOperationTypeLabel(formData.operationType).toLowerCase()}`
                          : 'Selecciona el método de pago'}
                    </Text>
                    <View style={styles.paymentMethodContainer}>
                      {getAllowedPaymentMethods(
                        selectedBalance.balanceType as BalanceType,
                        formData.operationType
                      ).map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[
                            styles.paymentMethodButton,
                            formData.paymentMethod === method && styles.paymentMethodButtonActive,
                          ]}
                          onPress={() => setFormData({ ...formData, paymentMethod: method })}
                        >
                          <Text
                            style={[
                              styles.paymentMethodButtonText,
                              formData.paymentMethod === method &&
                                styles.paymentMethodButtonTextActive,
                            ]}
                          >
                            {getPaymentMethodLabel(method)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {!formData.paymentMethod && (
                      <Text style={styles.errorText}>
                        ⚠️ Debes seleccionar un método de pago para continuar
                      </Text>
                    )}
                  </View>
                )}

              {/* Amount */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Monto *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={formData.amount}
                  onChangeText={(text) => setFormData({ ...formData, amount: text })}
                />
              </View>

              {/* Operation Date */}
              <View style={styles.formGroup}>
                <DatePickerButton
                  label="Fecha de Operación *"
                  value={formData.operationDate}
                  onPress={() => setShowOperationDatePicker(true)}
                  placeholder="Seleccionar fecha"
                />
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Descripción de la operación"
                  multiline
                  numberOfLines={3}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  maxLength={100}
                />
              </View>

              {/* Reference */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Referencia</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: FAC-2026-001"
                  value={formData.reference}
                  onChangeText={(text) => setFormData({ ...formData, reference: text })}
                  maxLength={100}
                />
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Notas</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Notas adicionales"
                  multiline
                  numberOfLines={3}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  maxLength={100}
                />
              </View>

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
                              {file.mimeType.split('/')[0] === 'image'
                                ? '📷 Imagen'
                                : '📄 Documento'}
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

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSubmit]}
                  onPress={handleCreateOperation}
                >
                  <Text style={styles.modalButtonTextSubmit}>Crear Operación</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      <DatePicker
        visible={showOperationDatePicker}
        date={new Date(formData.operationDate)}
        onConfirm={(date) => {
          setFormData({ ...formData, operationDate: date.toISOString().split('T')[0] });
          setShowOperationDatePicker(false);
        }}
        onCancel={() => setShowOperationDatePicker(false)}
        title="Fecha de Operación"
      />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  clearFilterButton: {
    position: 'absolute',
    right: 30,
    top: '50%',
    transform: [{ translateY: -12 }],
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearFilterText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    padding: 20,
  },
  operationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#FFFFFF',
  },
  operationDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  operationAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  operationBalance: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '600',
    marginBottom: 4,
  },
  operationEmitter: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  operationDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  operationReference: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  operationFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  viewDetailsText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalCloseButton: {
    fontSize: 28,
    color: '#6B7280',
    fontWeight: '300',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  balanceSelector: {
    flexDirection: 'row',
  },
  balanceOption: {
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginRight: 12,
    minWidth: 180,
  },
  balanceOptionSelected: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  balanceOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  balanceOptionTitleSelected: {
    color: '#FFFFFF',
  },
  balanceOptionCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  balanceOptionCodeSelected: {
    color: '#E0F2FE',
  },
  balanceOptionSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  balanceOptionSubtextSelected: {
    color: '#DBEAFE',
  },
  operationTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  operationTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  operationTypeButtonActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  operationTypeButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  operationTypeButtonTextActive: {
    color: '#FFFFFF',
  },
  operationTypeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  operationTypeBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  operationInfoBox: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
  },
  operationInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 6,
  },
  operationInfoText: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
    fontWeight: '500',
  },
  balanceTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  balanceTypeButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  balanceTypeButtonActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  balanceTypeButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  balanceTypeButtonTextActive: {
    color: '#FFFFFF',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
    minWidth: '30%',
  },
  paymentMethodButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  paymentMethodButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  paymentMethodButtonTextActive: {
    color: '#FFFFFF',
  },
  fileUploadButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  fileUploadButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filesContainer: {
    marginTop: 12,
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileInfo: {
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 2,
  },
  fileType: {
    fontSize: 11,
    color: '#6B7280',
  },
  fileRemove: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalButtonSubmit: {
    backgroundColor: '#38BDF8',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 80,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    minWidth: 110,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
});
