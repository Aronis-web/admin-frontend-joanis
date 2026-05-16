import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { transfersApi } from '@/services/api/transfers';
import { TransportSelectionModal } from '@/components/Transport';
import { warehousesApi, warehouseAreasApi } from '@/services/api';
import { downloadRemissionGuidePdf } from '@/utils/remissionGuideDownload';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { Driver, Transporter, Vehicle } from '@/types/transport';
import {
  Transfer,
  TransferItem,
  TransferReception,
  TransferStatus,
  ReceptionStatus,
  ValidateItemDto,
  CompleteReceptionDto,
} from '@/types/transfers';

interface ReceptionsScreenProps {
  navigation: any;
}

interface ItemValidation {
  transferItemId: string;
  quantityReceived: number;
  quantityDamaged?: number;
  notes?: string;
  damageNotes?: string;
  destinationWarehouseId: string;
  destinationAreaId: string;
  damagedWarehouseId?: string;
  damagedAreaId?: string;
  hasDamaged: boolean;
  hasError: boolean;
  isFullEntry: boolean;
  isValidated: boolean;
}

interface ErrorModalForm {
  transferItemId: string;
  quantityReceived: string;
  quantityDamaged: string;
  notes: string;
  damageNotes: string;
  hasDamaged: boolean;
  destinationWarehouseId: string;
  destinationAreaId: string;
  damagedWarehouseId: string;
  damagedAreaId: string;
}

interface PersistedReceptionForm {
  transferId: string;
  receptionId: string;
  qualityCheckNotes: string;
  itemValidationsById: Record<string, ItemValidation>;
}

const getReceptionFormStorageKey = (transferId: string) => `reception-form:${transferId}`;

export const ReceptionsScreen: React.FC<ReceptionsScreenProps> = ({ navigation }) => {
  const { currentSite } = useAuthStore();
  const { selectedSite } = useTenantStore();

  const [receptions, setReceptions] = useState<TransferReception[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalReceptions, setTotalReceptions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [showBultosModal, setShowBultosModal] = useState(false);
  const [generatingRemissionGuide, setGeneratingRemissionGuide] = useState(false);
  const [downloadingGuideId, setDownloadingGuideId] = useState<string | null>(null);
  const [numeroBultos, setNumeroBultos] = useState('1');
  const [pendingTransportData, setPendingTransportData] = useState<{
    vehicle: Vehicle | null;
    driver: Driver | null;
    transporter: Transporter | null;
  } | null>(null);
  const pendingBultosModalRef = useRef(false);
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);
  const [showItemErrorModal, setShowItemErrorModal] = useState(false);
  const [showItemViewModal, setShowItemViewModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [currentReception, setCurrentReception] = useState<TransferReception | null>(null);
  const [itemValidationsById, setItemValidationsById] = useState<Record<string, ItemValidation>>({});
  const [qualityCheckNotes, setQualityCheckNotes] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const [errorModalForm, setErrorModalForm] = useState<ErrorModalForm | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [areasByWarehouse, setAreasByWarehouse] = useState<Record<string, WarehouseArea[]>>({});

  const effectiveSite = selectedSite || currentSite;

  const loadData = useCallback(
    async (page = currentPage) => {
      try {
        setLoading(true);
        const currentSiteId = effectiveSite?.id;

        const response = await transfersApi.getPendingReceptions({
          currentSiteId,
          page,
          limit: pageSize,
        });

        const data = response.data || [];
        const total = response.total ?? response.meta?.total ?? 0;
        const resolvedPage = response.page ?? response.meta?.page ?? page;
        const resolvedLimit = response.limit ?? response.meta?.limit ?? pageSize;
        const resolvedTotalPages =
          response.totalPages ??
          response.meta?.totalPages ??
          Math.max(1, Math.ceil(total / Math.max(1, resolvedLimit)));

        setReceptions(data);
        setTotalReceptions(total);
        setTotalPages(resolvedTotalPages);

        if (resolvedPage !== currentPage) {
          setCurrentPage(resolvedPage);
        }
      } catch (error: any) {
        console.error('❌ Error loading receptions:', error);
        Alert.alert('Error', error.message || 'No se pudieron cargar las recepciones');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, effectiveSite?.id, pageSize]
  );

  const loadWarehouseAreas = useCallback(
    async (warehouseId: string): Promise<WarehouseArea[]> => {
      if (!warehouseId) {
        return [];
      }

      if (areasByWarehouse[warehouseId]) {
        return areasByWarehouse[warehouseId];
      }

      try {
        const response: any = await warehouseAreasApi.getWarehouseAreas(warehouseId);
        const resolvedAreas = Array.isArray(response) ? response : response?.data || [];
        setAreasByWarehouse((prev) => ({ ...prev, [warehouseId]: resolvedAreas }));
        return resolvedAreas;
      } catch (error) {
        console.error('Error loading warehouse areas:', error);
        setAreasByWarehouse((prev) => ({ ...prev, [warehouseId]: [] }));
        return [];
      }
    },
    [areasByWarehouse]
  );

  const loadWarehouses = useCallback(
    async (siteId?: string): Promise<Warehouse[]> => {
      try {
        const response = await warehousesApi.getWarehouses(undefined, siteId);
        const loaded = response || [];
        setWarehouses(loaded);
        return loaded;
      } catch (error) {
        console.error('Error loading warehouses:', error);
        setWarehouses([]);
        return [];
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void loadData(currentPage);
    }, [loadData, currentPage])
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveSite?.id]);

  useEffect(() => {
    if (!showTransportModal && pendingBultosModalRef.current) {
      const timer = setTimeout(() => {
        pendingBultosModalRef.current = false;
        setShowBultosModal(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [showTransportModal]);

  const persistCurrentForm = useCallback(
    async (overrides?: Partial<PersistedReceptionForm>) => {
      if (!selectedTransfer?.id || !currentReception?.id) return;

      try {
        const payload: PersistedReceptionForm = {
          transferId: selectedTransfer.id,
          receptionId: currentReception.id,
          qualityCheckNotes,
          itemValidationsById,
          ...overrides,
        };

        await AsyncStorage.setItem(
          getReceptionFormStorageKey(selectedTransfer.id),
          JSON.stringify(payload)
        );
      } catch (error) {
        console.error('Error persisting reception form:', error);
      }
    },
    [selectedTransfer?.id, currentReception?.id, qualityCheckNotes, itemValidationsById]
  );

  useEffect(() => {
    if (!showValidateModal || !selectedTransfer?.id || !currentReception?.id) return;
    void persistCurrentForm();
  }, [
    showValidateModal,
    selectedTransfer?.id,
    currentReception?.id,
    qualityCheckNotes,
    itemValidationsById,
    persistCurrentForm,
  ]);

  const clearPersistedForm = useCallback(async (transferId?: string) => {
    if (!transferId) return;

    try {
      await AsyncStorage.removeItem(getReceptionFormStorageKey(transferId));
    } catch (error) {
      console.error('Error clearing persisted reception form:', error);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(currentPage);
    setRefreshing(false);
  };

  const handleRemissionGuidePress = async (target: Transfer | TransferReception) => {
    const guide = 'transferNumber' in target
      ? target.remissionGuide
      : target.remissionGuide || target.transfer?.remissionGuide;

    const transferId = 'transferNumber' in target ? target.id : target.transferId || target.transfer?.id;
    if (!transferId) {
      Alert.alert('Error', 'No se encontró el traslado asociado a esta recepción');
      return;
    }

    if (!guide) {
      const transfer = 'transferNumber' in target ? target : target.transfer || null;
      if (transfer) {
        setSelectedTransfer(transfer as Transfer);
      } else {
        try {
          const detail = await transfersApi.getReceptionDetail(transferId);
          setSelectedTransfer(detail);
        } catch {
          setSelectedTransfer({ id: transferId } as Transfer);
        }
      }
      setShowTransportModal(true);
      return;
    }

    try {
      setDownloadingGuideId(transferId);
      await downloadRemissionGuidePdf({ transferId, guide });
    } finally {
      setDownloadingGuideId(null);
    }
  };

  const handleTransportModalClose = useCallback(() => {
    setShowTransportModal(false);
    pendingBultosModalRef.current = false;
  }, []);

  const handleTransportConfirm = useCallback((vehicle: Vehicle | null, driver: Driver | null, transporter: Transporter | null) => {
    setPendingTransportData({ vehicle, driver, transporter });
    setNumeroBultos('1');
    pendingBultosModalRef.current = true;
    setShowTransportModal(false);
  }, []);

  const handleGenerateGuideConfirm = async () => {
    if (!selectedTransfer?.id || !pendingTransportData) {
      Alert.alert('Error', 'No se encontraron los datos necesarios para generar la guía');
      return;
    }

    const bultosNum = parseInt(numeroBultos, 10);
    if (Number.isNaN(bultosNum) || bultosNum < 1) {
      Alert.alert('Error', 'La cantidad de bultos debe ser un número mayor a 0');
      return;
    }

    const { vehicle, driver, transporter } = pendingTransportData;
    const isPublicTransport = transporter !== null && !vehicle && !driver;
    const transferNumber = selectedTransfer.transferNumber || selectedTransfer.id;

    let confirmMessage = `¿Deseas generar la guía de remisión para ${transferNumber}?\n\n`;
    if (isPublicTransport) {
      confirmMessage += `Transporte: Público\nTransportista: ${transporter!.razonSocial}\nRUC: ${transporter!.numeroRuc}\n`;
    } else {
      confirmMessage += `Transporte: Privado\nVehículo: ${vehicle!.numeroPlaca} (${vehicle!.marca} ${vehicle!.modelo})\nConductor: ${driver!.nombre} ${driver!.apellido}\nLicencia: ${driver!.numeroLicencia}\n`;
    }
    confirmMessage += `Bultos: ${bultosNum}\n\nLa guía quedará anexada al traslado.`;

    setShowBultosModal(false);

    Alert.alert('Generar Guía de Remisión', confirmMessage, [
      {
        text: 'Cancelar',
        style: 'cancel',
        onPress: () => setPendingTransportData(null),
      },
      {
        text: 'Generar',
        onPress: async () => {
          try {
            setGeneratingRemissionGuide(true);
            const response = await transfersApi.generateRemissionGuide(
              selectedTransfer.id,
              isPublicTransport
                ? {
                    transporterId: transporter!.id,
                    numeroBultos: bultosNum,
                  }
                : {
                    vehicleId: vehicle!.id,
                    driverId: driver!.id,
                    numeroBultos: bultosNum,
                  }
            );

            const updatedTransfer = await transfersApi.getReceptionDetail(selectedTransfer.id);
            setSelectedTransfer(updatedTransfer);
            await loadData(currentPage);

            Alert.alert(
              'Éxito',
              response.message || `Guía ${response.remissionGuide.serieNumero || response.remissionGuide.number || ''} generada exitosamente`
            );
          } catch (error: any) {
            console.error('Error generating remission guide:', error);
            Alert.alert(
              'Error',
              error.response?.data?.message || error.message || 'No se pudo generar la guía de remisión'
            );
          } finally {
            setGeneratingRemissionGuide(false);
            setPendingTransportData(null);
          }
        },
      },
    ]);
  };

  const getExistingReception = (detail: any): TransferReception | null => {
    if (detail?.reception?.id) return detail.reception as TransferReception;
    if (Array.isArray(detail?.receptions) && detail.receptions.length > 0) {
      return detail.receptions[0] as TransferReception;
    }
    return null;
  };

  const buildDefaultValidation = (
    item: TransferItem,
    defaults?: { destinationWarehouseId?: string; destinationAreaId?: string }
  ): ItemValidation => ({
    transferItemId: item.id,
    quantityReceived: Number(item.quantityShipped ?? item.quantityRequested ?? 0),
    quantityDamaged: 0,
    notes: '',
    damageNotes: '',
    destinationWarehouseId: defaults?.destinationWarehouseId || '',
    destinationAreaId: defaults?.destinationAreaId || '',
    damagedWarehouseId: '',
    damagedAreaId: '',
    hasDamaged: false,
    hasError: false,
    isFullEntry: false,
    isValidated: false,
  });

  const handleReceptionPress = async (reception: TransferReception) => {
    try {
      const transferId = reception.transferId || reception.transfer?.id;
      if (!transferId) {
        Alert.alert('Error', 'No se encontró el traslado asociado a esta recepción');
        return;
      }

      let transfer = await transfersApi.getReceptionDetail(transferId);
      let existingReception = getExistingReception(transfer as any);

      const isSyntheticReception = reception.id?.startsWith('synthetic-');
      const needsRealReception = isSyntheticReception || !existingReception?.id;

      if (needsRealReception) {
        try {
          await transfersApi.receiveTransfer(transfer.id, undefined, 'Inicio de recepción');
          transfer = await transfersApi.getReceptionDetail(transferId);
          existingReception = getExistingReception(transfer as any);
        } catch (receiveError: any) {
          console.warn('Receive transfer failed while opening reception:', receiveError);
          transfer = await transfersApi.getReceptionDetail(transferId);
          existingReception = getExistingReception(transfer as any);
        }
      }

      if (!existingReception?.id) {
        Alert.alert('Error', 'No se pudo obtener una recepción válida para este traslado');
        return;
      }

      setSelectedTransfer(transfer);
      setCurrentReception(existingReception);

      const isCompletedTransfer = transfer.status === TransferStatus.COMPLETED;
      const isCompletedReception = existingReception.status === ReceptionStatus.COMPLETE;
      setIsReadOnlyMode(isCompletedTransfer || isCompletedReception);

      const loadedWarehouses = await loadWarehouses(effectiveSite?.id);
      const defaultWarehouseId = loadedWarehouses[0]?.id || '';
      const defaultAreas = defaultWarehouseId ? await loadWarehouseAreas(defaultWarehouseId) : [];
      const defaultAreaId = defaultAreas[0]?.id || '';

      const fallbackValidations = (transfer.items || []).reduce<Record<string, ItemValidation>>(
        (acc, item) => {
          acc[item.id] = buildDefaultValidation(item, {
            destinationWarehouseId: defaultWarehouseId,
            destinationAreaId: defaultAreaId,
          });
          return acc;
        },
        {}
      );

      const persistedRaw = await AsyncStorage.getItem(getReceptionFormStorageKey(transfer.id));
      if (persistedRaw) {
        try {
          const persisted: PersistedReceptionForm = JSON.parse(persistedRaw);
          setItemValidationsById(persisted.itemValidationsById || fallbackValidations);
          setQualityCheckNotes(persisted.qualityCheckNotes || '');
        } catch {
          setItemValidationsById(fallbackValidations);
          setQualityCheckNotes('');
        }
      } else {
        setItemValidationsById(fallbackValidations);
        setQualityCheckNotes('');
      }

      setProductSearchTerm('');
      setErrorModalForm(null);
      setShowValidateModal(true);
    } catch (error: any) {
      console.error('Error opening reception:', error);
      Alert.alert('Error', error.message || 'No se pudo abrir la recepción');
    }
  };

  const openItemErrorModal = (item: TransferItem) => {
    const local = itemValidationsById[item.id] || buildDefaultValidation(item);

    const quantityReceivedFromApi = Number(item.quantityReceived ?? local.quantityReceived ?? 0);
    const quantityDamagedFromApi = Number(item.quantityDamaged ?? local.quantityDamaged ?? 0);
    const destinationWarehouseId = String(item.destinationWarehouseId || local.destinationWarehouseId || '');
    const destinationAreaId = String(item.destinationAreaId || local.destinationAreaId || '');
    const damagedWarehouseId = String(item.damagedWarehouseId || local.damagedWarehouseId || '');
    const damagedAreaId = String(item.damagedAreaId || local.damagedAreaId || '');
    const hasDamaged = quantityDamagedFromApi > 0 || Boolean(item.damageNotes || local.damageNotes);

    if (destinationWarehouseId) {
      void loadWarehouseAreas(destinationWarehouseId);
    }

    if (damagedWarehouseId) {
      void loadWarehouseAreas(damagedWarehouseId);
    }

    setErrorModalForm({
      transferItemId: item.id,
      quantityReceived: quantityReceivedFromApi.toString(),
      quantityDamaged: quantityDamagedFromApi.toString(),
      notes: String(item.notes || local.notes || ''),
      damageNotes: String(item.damageNotes || local.damageNotes || ''),
      hasDamaged,
      destinationWarehouseId,
      destinationAreaId,
      damagedWarehouseId,
      damagedAreaId,
    });

    setShowItemViewModal(false);
    setShowItemErrorModal(true);
  };

  const openItemViewModal = (item: TransferItem) => {
    const local = itemValidationsById[item.id] || buildDefaultValidation(item);

    const quantityReceivedFromApi = Number(item.quantityReceived ?? local.quantityReceived ?? 0);
    const quantityDamagedFromApi = Number(item.quantityDamaged ?? local.quantityDamaged ?? 0);

    const destinationWarehouseId = String(item.destinationWarehouseId || local.destinationWarehouseId || '');
    const destinationAreaId = String(item.destinationAreaId || local.destinationAreaId || '');
    const damagedWarehouseId = String(item.damagedWarehouseId || local.damagedWarehouseId || '');
    const damagedAreaId = String(item.damagedAreaId || local.damagedAreaId || '');

    if (destinationWarehouseId) {
      void loadWarehouseAreas(destinationWarehouseId);
    }

    if (damagedWarehouseId) {
      void loadWarehouseAreas(damagedWarehouseId);
    }

    setErrorModalForm({
      transferItemId: item.id,
      quantityReceived: quantityReceivedFromApi.toString(),
      quantityDamaged: quantityDamagedFromApi.toString(),
      notes: String(item.notes || local.notes || ''),
      damageNotes: String(item.damageNotes || local.damageNotes || ''),
      hasDamaged: quantityDamagedFromApi > 0 || Boolean(item.damageNotes || local.damageNotes),
      destinationWarehouseId,
      destinationAreaId,
      damagedWarehouseId,
      damagedAreaId,
    });

    setShowItemErrorModal(false);
    setShowItemViewModal(true);
  };

  const updateErrorModalForm = (field: keyof ErrorModalForm, value: string | boolean) => {
    setErrorModalForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value } as ErrorModalForm;
    });
  };

  const saveItemError = () => {
    if (!errorModalForm) return;

    const quantityReceived = Number(errorModalForm.quantityReceived || 0);
    if (Number.isNaN(quantityReceived) || quantityReceived < 0) {
      Alert.alert('Dato inválido', 'La cantidad recibida debe ser un número mayor o igual a 0');
      return;
    }

    const quantityDamaged = Number(errorModalForm.quantityDamaged || 0);
    if (errorModalForm.hasDamaged) {
      if (Number.isNaN(quantityDamaged) || quantityDamaged < 0) {
        Alert.alert('Dato inválido', 'La cantidad dañada debe ser un número mayor o igual a 0');
        return;
      }

      if (quantityDamaged > quantityReceived) {
        Alert.alert('Dato inválido', 'La cantidad dañada no puede ser mayor a la cantidad recibida');
        return;
      }

      if (!errorModalForm.damagedWarehouseId || !errorModalForm.damagedAreaId) {
        Alert.alert('Destino incompleto', 'Selecciona almacén y área para los productos dañados');
        return;
      }
    }

    setItemValidationsById((prev) => {
      const existing = prev[errorModalForm.transferItemId];
      return {
        ...prev,
        [errorModalForm.transferItemId]: {
          transferItemId: errorModalForm.transferItemId,
          quantityReceived,
          quantityDamaged: errorModalForm.hasDamaged ? quantityDamaged : 0,
          notes: errorModalForm.notes || undefined,
          damageNotes: errorModalForm.hasDamaged ? errorModalForm.damageNotes || undefined : undefined,
          destinationWarehouseId: errorModalForm.destinationWarehouseId || existing?.destinationWarehouseId || '',
          destinationAreaId: errorModalForm.destinationAreaId || existing?.destinationAreaId || '',
          damagedWarehouseId: errorModalForm.hasDamaged ? errorModalForm.damagedWarehouseId : '',
          damagedAreaId: errorModalForm.hasDamaged ? errorModalForm.damagedAreaId : '',
          hasDamaged: errorModalForm.hasDamaged,
          hasError: errorModalForm.hasDamaged,
          isFullEntry: !errorModalForm.hasDamaged,
          isValidated: true,
        },
      };
    });

    setShowItemErrorModal(false);
    setErrorModalForm(null);
  };

  const validateSingleItem = async () => {
    if (!selectedTransfer || !currentReception || !errorModalForm) {
      return;
    }

    const quantityReceived = Number(errorModalForm.quantityReceived || 0);
    if (Number.isNaN(quantityReceived) || quantityReceived < 0) {
      Alert.alert('Dato inválido', 'La cantidad recibida debe ser un número mayor o igual a 0');
      return;
    }

    if (!errorModalForm.destinationWarehouseId || !errorModalForm.destinationAreaId) {
      Alert.alert('Destino incompleto', 'Selecciona almacén y área destino del producto');
      return;
    }

    const quantityDamaged = Number(errorModalForm.quantityDamaged || 0);
    if (errorModalForm.hasDamaged) {
      if (Number.isNaN(quantityDamaged) || quantityDamaged < 0 || quantityDamaged > quantityReceived) {
        Alert.alert('Dato inválido', 'La cantidad dañada debe ser válida y no mayor a la recibida');
        return;
      }

      if (!errorModalForm.damagedWarehouseId || !errorModalForm.damagedAreaId) {
        Alert.alert('Destino incompleto', 'Selecciona almacén y área para los dañados');
        return;
      }
    }

    try {
      const validateItemDto: ValidateItemDto = {
        receptionId: currentReception.id,
        item: {
          transferItemId: errorModalForm.transferItemId,
          quantityReceived,
          quantityDamaged: errorModalForm.hasDamaged ? quantityDamaged : undefined,
          destinationWarehouseId: errorModalForm.destinationWarehouseId,
          destinationAreaId: errorModalForm.destinationAreaId,
          damagedWarehouseId: errorModalForm.hasDamaged
            ? errorModalForm.damagedWarehouseId
            : undefined,
          damagedAreaId: errorModalForm.hasDamaged ? errorModalForm.damagedAreaId : undefined,
          notes: errorModalForm.notes || undefined,
          damageNotes: errorModalForm.hasDamaged ? errorModalForm.damageNotes || undefined : undefined,
        },
      };

      await transfersApi.validateItem(selectedTransfer.id, validateItemDto);
      saveItemError();

      const refreshedTransfer = await transfersApi.getReceptionDetail(selectedTransfer.id);
      setSelectedTransfer(refreshedTransfer);

      Alert.alert('Validado', 'Producto validado correctamente');
    } catch (error: any) {
      console.error('Error validating item:', error);
      Alert.alert('Error', error.message || 'No se pudo validar el producto');
    }
  };

  const resetValidationState = () => {
    setShowValidateModal(false);
    setShowItemErrorModal(false);
    setShowItemViewModal(false);
    setIsReadOnlyMode(false);
    setSelectedTransfer(null);
    setCurrentReception(null);
    setItemValidationsById({});
    setQualityCheckNotes('');
    setProductSearchTerm('');
    setErrorModalForm(null);
  };

  const handleCloseValidationModal = async () => {
    await persistCurrentForm();
    setShowItemErrorModal(false);
    setShowItemViewModal(false);
    setErrorModalForm(null);
    setShowValidateModal(false);
  };


  const handleCompleteReception = async () => {
    if (!selectedTransfer || !currentReception) {
      return;
    }

    Alert.alert(
      'Completar Recepción',
      '¿Estás seguro de completar esta recepción? El stock se actualizará en el almacén destino.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          onPress: async () => {
            try {
              const completeDto: CompleteReceptionDto = {
                receptionId: currentReception.id,
                qualityCheckNotes: qualityCheckNotes || undefined,
              };

              await transfersApi.completeReception(selectedTransfer.id, completeDto);
              await clearPersistedForm(selectedTransfer.id);

              Alert.alert(
                'Recepción Completada',
                'La recepción ha sido completada exitosamente. El stock ha sido actualizado.',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      resetValidationState();
                      await loadData(currentPage);
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error completing reception:', error);
              Alert.alert('Error', error.message || 'No se pudo completar la recepción');
            }
          },
        },
      ]
    );
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const renderList = () => {
    if (receptions.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📥</Text>
          <Text style={styles.emptyText}>No hay recepciones</Text>
          <Text style={styles.emptySubtext}>No se encontraron recepciones para esta sede</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {receptions.map((reception) => {
          const transfer = reception.transfer;
          const displayNumber = reception.receptionNumber || transfer?.transferNumber || 'N/A';
          const displayDate = reception.receivedAt || reception.createdAt || new Date().toISOString();
          const guide = reception.remissionGuide || transfer?.remissionGuide;

          const statusConfig =
            reception.status === ReceptionStatus.PENDING
              ? { label: 'Pendiente', backgroundColor: '#FEF3C7', borderColor: '#F59E0B', textColor: '#F59E0B' }
              : reception.status === ReceptionStatus.PARTIAL
                ? { label: 'Parcial', backgroundColor: '#EDE9FE', borderColor: '#8B5CF6', textColor: '#8B5CF6' }
                : reception.status === ReceptionStatus.WITH_DIFFERENCES
                  ? {
                      label: 'Con diferencias',
                      backgroundColor: '#FFEDD5',
                      borderColor: '#EA580C',
                      textColor: '#C2410C',
                    }
                  : { label: 'Completo', backgroundColor: '#D1FAE5', borderColor: '#10B981', textColor: '#10B981' };
          const expectedItemsCount =
            Number(
              reception.totalItemsExpected ??
                (reception as any)?.totalItemsExpected ??
                (reception as any)?.totalItems ??
                (reception as any)?.transfer?.totalItemsExpected ??
                (reception as any)?.transfer?.totalItems ??
                (reception as any)?.transfer?.itemsCount ??
                0
            ) || 0;
          const receivedItemsCount =
            Number(
              reception.totalItemsReceived ??
                (reception as any)?.receivedItems ??
                (reception as any)?.transfer?.totalItemsReceived ??
                0
            ) || 0;

          return (
            <TouchableOpacity
              key={reception.id}
              style={styles.receptionCard}
              onPress={() => handleReceptionPress(reception)}
            >
              <View style={styles.receptionHeader}>
                <View style={styles.receptionInfo}>
                  <Text style={styles.receptionNumber}>{displayNumber}</Text>
                  {transfer && (
                    <Text style={styles.transferInfoText}>Traslado: {transfer.transferNumber}</Text>
                  )}
                  <Text style={styles.receptionDate}>
                    {new Date(displayDate).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusConfig.backgroundColor,
                      borderColor: statusConfig.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>

              <View style={styles.receptionStats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Esperados</Text>
                  <Text style={styles.statValue}>{expectedItemsCount}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Recibidos</Text>
                  <Text style={styles.statValue}>{receivedItemsCount}</Text>
                </View>
                {reception.hasDifferences && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Diferencias</Text>
                      <Text style={[styles.statValue, { color: '#F59E0B' }]}>Sí</Text>
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity
                disabled={downloadingGuideId === transfer.id}
                style={[
                  styles.guideActionButton,
                  guide ? styles.downloadGuideButton : styles.createGuideButton,
                  downloadingGuideId === transfer.id && styles.guideActionButtonDisabled,
                ]}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleRemissionGuidePress(reception);
                }}
              >
                <Text style={styles.guideActionButtonText}>
                  {downloadingGuideId === transfer.id
                    ? 'Descargando guía...'
                    : guide
                      ? `Descargar guía ${guide.number || ''}`.trim()
                      : 'Crear guía'}
                </Text>
              </TouchableOpacity>

              {reception.notes && (
                <View style={styles.receptionNotes}>
                  <Text style={styles.notesLabel}>Notas:</Text>
                  <Text style={styles.notesText}>{reception.notes}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[styles.paginationButton, currentPage <= 1 && styles.paginationButtonDisabled]}
            onPress={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <Text style={styles.paginationButtonText}>Anterior</Text>
          </TouchableOpacity>

          <Text style={styles.paginationInfo}>
            Página {currentPage} de {Math.max(totalPages, 1)} • Total: {totalReceptions}
          </Text>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage >= totalPages && styles.paginationButtonDisabled,
            ]}
            onPress={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <Text style={styles.paginationButtonText}>Siguiente</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const allItemsValidated = (selectedTransfer?.items || []).every(
    (item) => item.quantityReceived !== null && item.quantityReceived !== undefined
  );

  const renderValidationItem = ({ item }: { item: TransferItem }) => {
    const local = itemValidationsById[item.id] || buildDefaultValidation(item);

    const shippedQty = Number(item.quantityShipped ?? item.quantityRequested ?? 0);
    const receivedQty = Number(item.quantityReceived ?? local.quantityReceived ?? 0);

    const isValidatedFromApi = item.quantityReceived !== null && item.quantityReceived !== undefined;
    const hasDamagedFromApi =
      Number(item.quantityDamaged ?? local.quantityDamaged ?? 0) > 0 ||
      Boolean(item.damageNotes || local.damageNotes);

    const statusLabel = isValidatedFromApi
      ? hasDamagedFromApi
        ? 'Validado con dañados'
        : Number(item.quantityDifference ?? 0) !== 0
          ? 'Validado con diferencias'
          : 'Validado'
      : 'Pendiente';

    const statusColor = isValidatedFromApi ? '#10B981' : '#64748B';

    return (
      <View style={styles.validateItemCard}>
        <View style={styles.validateItemTopRow}>
          <View style={styles.validateItemHeader}>
            <Text style={styles.validateItemTitle}>{item.product?.title || 'Producto sin nombre'}</Text>
            <Text style={styles.validateItemSku}>Código: {item.product?.sku || 'N/A'}</Text>
            <Text style={styles.validateItemSku}>
              Correlativo: {item.product?.correlativeNumber ? `#${item.product.correlativeNumber}` : 'N/A'}
            </Text>
          </View>
          <View style={[styles.itemStatusBadge, { borderColor: statusColor }]}> 
            <Text style={[styles.itemStatusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.quantityInfo}>
          <View style={styles.quantityBox}>
            <Text style={styles.quantityLabel}>Despachado</Text>
            <Text style={styles.quantityValue}>{shippedQty}</Text>
          </View>
          <View style={styles.quantityBox}>
            <Text style={styles.quantityLabel}>Recibido</Text>
            <Text style={styles.quantityValue}>{receivedQty}</Text>
          </View>
        </View>

        {(isValidatedFromApi || !isReadOnlyMode) && (
          <View style={styles.itemActionsRow}>
            <TouchableOpacity
              style={[
                styles.itemActionButton,
                isValidatedFromApi ? styles.fullEntryDoneButton : styles.validateFixedButton,
              ]}
              onPress={() => (isValidatedFromApi ? openItemViewModal(item) : openItemErrorModal(item))}
              disabled={isReadOnlyMode && !isValidatedFromApi}
            >
              <Text style={styles.itemActionText}>{isValidatedFromApi ? 'Ver' : 'Validar'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Recepciones</Text>
          <Text style={styles.headerSubtitle}>Lista única paginada</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando recepciones...</Text>
        </View>
      ) : (
        renderList()
      )}

      <Modal visible={showValidateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.validateModalContainer} edges={['top']}>
          <View style={styles.validateHeader}>
            <Text style={styles.validateTitle}>
              {isReadOnlyMode ? 'Detalle de Recepción' : 'Validar Items Recibidos'}
            </Text>
            <TouchableOpacity onPress={() => void handleCloseValidationModal()} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={[...(selectedTransfer?.items || [])]
              .filter((item) => {
                const search = productSearchTerm.trim().toLowerCase();
                if (!search) return true;

                const title = item.product?.title?.toLowerCase() || '';
                const sku = item.product?.sku?.toLowerCase() || '';
                const correlative = String(item.product?.correlativeNumber || '').toLowerCase();

                return title.includes(search) || sku.includes(search) || correlative.includes(search);
              })
              .sort((a, b) => {
                const aName = (a.product?.title || a.product?.sku || '').toLowerCase();
                const bName = (b.product?.title || b.product?.sku || '').toLowerCase();
                return aName.localeCompare(bName, 'es');
              })}
            keyExtractor={(item) => item.id}
            renderItem={renderValidationItem}
            style={styles.validateList}
            contentContainerStyle={styles.validateListContent}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews
            ListHeaderComponent={
              <>
                <View style={styles.validateInfo}>
                  <Text style={styles.validateInfoText}>📦 Traslado: {selectedTransfer?.transferNumber}</Text>
                  <Text style={styles.validateInfoText}>
                    📥 Recepción: {currentReception?.receptionNumber || currentReception?.id}
                  </Text>
                </View>

                <View style={styles.guideDetailCard}>
                  <Text style={styles.guideDetailTitle}>Guía de remisión</Text>
                  {selectedTransfer?.remissionGuide ? (
                    <>
                      <Text style={styles.guideDetailValue}>{selectedTransfer.remissionGuide.number}</Text>
                      <Text style={styles.guideDetailMeta}>
                        Estado: {selectedTransfer.remissionGuide.status}
                        {selectedTransfer.remissionGuide.isDevelopment ? ' • Desarrollo' : ''}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.guideDetailMeta}>Este traslado aún no tiene guía de remisión.</Text>
                  )}
                  {selectedTransfer && (
                    <TouchableOpacity
                      disabled={downloadingGuideId === selectedTransfer.id}
                      style={[
                        styles.guideActionButton,
                        selectedTransfer.remissionGuide ? styles.downloadGuideButton : styles.createGuideButton,
                        downloadingGuideId === selectedTransfer.id && styles.guideActionButtonDisabled,
                      ]}
                      onPress={() => void handleRemissionGuidePress(selectedTransfer)}
                    >
                      <Text style={styles.guideActionButtonText}>
                        {downloadingGuideId === selectedTransfer.id
                          ? 'Descargando guía...'
                          : selectedTransfer.remissionGuide
                            ? 'Descargar guía'
                            : 'Crear guía'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.sectionTitle}>
                  {isReadOnlyMode ? 'Productos Recibidos' : 'Productos a Validar'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {isReadOnlyMode
                    ? 'Modo solo lectura para traslados completados'
                    : 'Valida producto por producto desde el botón de acción'}
                </Text>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre, código o correlativo"
                  value={productSearchTerm}
                  onChangeText={setProductSearchTerm}
                  placeholderTextColor="#94A3B8"
                />
              </>
            }
            ListFooterComponent={
              <View style={styles.qualityCheckSectionInline}>
                <Text style={styles.label}>Notas de Control de Calidad (Opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ej: Todos los productos inspeccionados y en buen estado..."
                  value={qualityCheckNotes}
                  onChangeText={setQualityCheckNotes}
                  multiline
                  numberOfLines={3}
                  editable={!isReadOnlyMode}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            }
          />

          <View style={styles.fixedActionsBar}>
            <TouchableOpacity
              style={[styles.fixedActionButton, styles.cancelFixedButton]}
              onPress={() => void handleCloseValidationModal()}
            >
              <Text style={styles.fixedActionText}>Cerrar</Text>
            </TouchableOpacity>

            {!isReadOnlyMode && allItemsValidated && (
              <TouchableOpacity
                style={[styles.fixedActionButton, styles.validateFixedButton]}
                onPress={handleCompleteReception}
              >
                <Text style={styles.fixedActionText}>Completar recepción</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <TransportSelectionModal
        visible={showTransportModal}
        onClose={handleTransportModalClose}
        onConfirm={handleTransportConfirm}
      />

      <Modal
        visible={showBultosModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowBultosModal(false);
          setPendingTransportData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.itemErrorModalCard}>
            <Text style={styles.itemErrorModalTitle}>Cantidad de bultos</Text>
            <Text style={styles.viewRowValue}>
              Ingresa la cantidad de bultos para la guía de remisión.
            </Text>

            <Text style={styles.label}>Número de bultos *</Text>
            <TextInput
              style={styles.input}
              value={numeroBultos}
              onChangeText={setNumeroBultos}
              keyboardType="numeric"
              placeholder="Ej: 10"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowBultosModal(false);
                  setPendingTransportData(null);
                }}
              >
                <Text style={styles.modalActionTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalSaveButton]}
                onPress={handleGenerateGuideConfirm}
                disabled={generatingRemissionGuide}
              >
                <Text style={styles.modalActionText}>
                  {generatingRemissionGuide ? 'Generando...' : 'Continuar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showItemErrorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.itemErrorModalCard}>
            <Text style={styles.itemErrorModalTitle}>Validar producto</Text>

            <ScrollView
              style={styles.itemModalScroll}
              contentContainerStyle={styles.itemModalScrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.label}>Cantidad recibida *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={errorModalForm?.quantityReceived || ''}
                onChangeText={(value) => updateErrorModalForm('quantityReceived', value)}
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Almacén destino *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={errorModalForm?.destinationWarehouseId || ''}
                  onValueChange={(value) => {
                    const warehouseId = String(value);
                    updateErrorModalForm('destinationWarehouseId', warehouseId);
                    updateErrorModalForm('destinationAreaId', '');
                    void loadWarehouseAreas(warehouseId);
                  }}
                >
                  <Picker.Item label="Seleccione almacén" value="" />
                  {warehouses.map((warehouse) => (
                    <Picker.Item key={warehouse.id} label={warehouse.name} value={warehouse.id} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Área destino *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={errorModalForm?.destinationAreaId || ''}
                  onValueChange={(value) => updateErrorModalForm('destinationAreaId', String(value))}
                >
                  <Picker.Item label="Seleccione área" value="" />
                  {(areasByWarehouse[errorModalForm?.destinationWarehouseId || ''] || []).map((area) => (
                    <Picker.Item key={area.id} label={area.name || area.code} value={area.id} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Notas del Item (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.modalTextArea]}
                placeholder="Ej: faltaron 2 unidades"
                value={errorModalForm?.notes || ''}
                onChangeText={(value) => updateErrorModalForm('notes', value)}
                multiline
                numberOfLines={2}
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.damagedToggleRow}>
                <Text style={styles.damagedToggleLabel}>¿Registrar productos dañados?</Text>
                <Switch
                  value={Boolean(errorModalForm?.hasDamaged)}
                  onValueChange={(value) => {
                    updateErrorModalForm('hasDamaged', value);
                    if (!value) {
                      updateErrorModalForm('quantityDamaged', '0');
                      updateErrorModalForm('damageNotes', '');
                      updateErrorModalForm('damagedWarehouseId', '');
                      updateErrorModalForm('damagedAreaId', '');
                    }
                  }}
                />
              </View>

              {errorModalForm?.hasDamaged && (
                <>
                  <Text style={styles.label}>Cantidad dañada *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={errorModalForm?.quantityDamaged || ''}
                    onChangeText={(value) => updateErrorModalForm('quantityDamaged', value)}
                    placeholderTextColor="#94A3B8"
                  />

                  <Text style={styles.label}>Almacén de dañados *</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={errorModalForm?.damagedWarehouseId || ''}
                      onValueChange={(value) => {
                        const warehouseId = String(value);
                        updateErrorModalForm('damagedWarehouseId', warehouseId);
                        updateErrorModalForm('damagedAreaId', '');
                        void loadWarehouseAreas(warehouseId);
                      }}
                    >
                      <Picker.Item label="Seleccione almacén" value="" />
                      {warehouses.map((warehouse) => (
                        <Picker.Item key={warehouse.id} label={warehouse.name} value={warehouse.id} />
                      ))}
                    </Picker>
                  </View>

                  <Text style={styles.label}>Área de dañados *</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={errorModalForm?.damagedAreaId || ''}
                      onValueChange={(value) => updateErrorModalForm('damagedAreaId', String(value))}
                    >
                      <Picker.Item label="Seleccione área" value="" />
                      {(areasByWarehouse[errorModalForm?.damagedWarehouseId || ''] || []).map((area) => (
                        <Picker.Item key={area.id} label={area.name || area.code} value={area.id} />
                      ))}
                    </Picker>
                  </View>

                  <Text style={styles.label}>Notas de daños (Opcional)</Text>
                  <TextInput
                    style={[styles.input, styles.modalTextArea]}
                    placeholder="Ej: caja dañada"
                    value={errorModalForm?.damageNotes || ''}
                    onChangeText={(value) => updateErrorModalForm('damageNotes', value)}
                    multiline
                    numberOfLines={2}
                    placeholderTextColor="#94A3B8"
                  />
                </>
              )}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowItemErrorModal(false);
                  setErrorModalForm(null);
                }}
              >
                <Text style={styles.modalActionTextCancel}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalSaveButton]}
                onPress={validateSingleItem}
              >
                <Text style={styles.modalActionText}>Guardar validación</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showItemViewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.itemErrorModalCard}>
            <Text style={styles.itemErrorModalTitle}>Detalle de validación</Text>

            <Text style={styles.viewRowLabel}>Cantidad recibida</Text>
            <Text style={styles.viewRowValue}>{errorModalForm?.quantityReceived || '0'}</Text>

            <Text style={styles.viewRowLabel}>Almacén destino</Text>
            <Text style={styles.viewRowValue}>
              {warehouses.find((w) => w.id === errorModalForm?.destinationWarehouseId)?.name || 'N/A'}
            </Text>

            <Text style={styles.viewRowLabel}>Área destino</Text>
            <Text style={styles.viewRowValue}>
              {(areasByWarehouse[errorModalForm?.destinationWarehouseId || ''] || []).find(
                (a) => a.id === errorModalForm?.destinationAreaId
              )?.name || 'N/A'}
            </Text>

            <Text style={styles.viewRowLabel}>Tiene dañados</Text>
            <Text style={styles.viewRowValue}>{errorModalForm?.hasDamaged ? 'Sí' : 'No'}</Text>

            {errorModalForm?.hasDamaged && (
              <>
                <Text style={styles.viewRowLabel}>Cantidad dañada</Text>
                <Text style={styles.viewRowValue}>{errorModalForm?.quantityDamaged || '0'}</Text>

                <Text style={styles.viewRowLabel}>Almacén dañados</Text>
                <Text style={styles.viewRowValue}>
                  {warehouses.find((w) => w.id === errorModalForm?.damagedWarehouseId)?.name || 'N/A'}
                </Text>

                <Text style={styles.viewRowLabel}>Área dañados</Text>
                <Text style={styles.viewRowValue}>
                  {(areasByWarehouse[errorModalForm?.damagedWarehouseId || ''] || []).find(
                    (a) => a.id === errorModalForm?.damagedAreaId
                  )?.name || 'N/A'}
                </Text>

                <Text style={styles.viewRowLabel}>Notas de daños</Text>
                <Text style={styles.viewRowValue}>{errorModalForm?.damageNotes || '-'}</Text>
              </>
            )}

            <Text style={styles.viewRowLabel}>Notas del item</Text>
            <Text style={styles.viewRowValue}>{errorModalForm?.notes || '-'}</Text>

            <TouchableOpacity
              style={[styles.modalActionButton, styles.modalSaveButton, { marginTop: 14 }]}
              onPress={() => {
                setShowItemViewModal(false);
                setErrorModalForm(null);
              }}
            >
              <Text style={styles.modalActionText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    padding: 16,
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
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    color: '#334155',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  receptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  receptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  receptionInfo: {
    flex: 1,
  },
  receptionNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  receptionDate: {
    fontSize: 12,
    color: '#64748B',
  },
  transferInfoText: {
    fontSize: 13,
    color: '#475569',
    marginVertical: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  receptionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  receptionNotes: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  guideActionButton: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  downloadGuideButton: {
    backgroundColor: '#6366F1',
  },
  createGuideButton: {
    backgroundColor: '#F59E0B',
  },
  guideActionButtonDisabled: {
    opacity: 0.7,
  },
  guideActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  paginationContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  paginationButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  paginationInfo: {
    flex: 1,
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  validateModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  validateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  validateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: 'bold',
  },
  validateList: {
    flex: 1,
  },
  validateListContent: {
    padding: 16,
    paddingBottom: 120,
  },
  validateInfo: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  validateInfoText: {
    fontSize: 13,
    color: '#4338CA',
    fontWeight: '500',
    marginBottom: 4,
  },
  guideDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guideDetailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  guideDetailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  guideDetailMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 16,
  },
  qualityCheckSectionInline: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  validateItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  validateItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  validateItemHeader: {
    flex: 1,
  },
  validateItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  validateItemSku: {
    fontSize: 12,
    color: '#64748B',
  },
  itemStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  itemStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quantityInfo: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  quantityBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  inlineDestinationSection: {
    marginBottom: 10,
  },
  inlineDestinationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 8,
  },
  destinationInfoText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 10,
  },
  itemActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  itemActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  fullEntryButton: {
    backgroundColor: '#10B981',
  },
  fullEntryDoneButton: {
    backgroundColor: '#047857',
  },
  errorEntryButton: {
    backgroundColor: '#F59E0B',
  },
  itemActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  fixedActionsBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  fixedActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelFixedButton: {
    backgroundColor: '#475569',
  },
  validateFixedButton: {
    backgroundColor: '#8B5CF6',
  },
  fixedActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 18,
  },
  itemErrorModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  itemModalScroll: {
    maxHeight: 520,
  },
  itemModalScrollContent: {
    paddingBottom: 8,
  },
  itemErrorModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalTextArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  damagedToggleRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  damagedToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalActionButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E2E8F0',
  },
  modalSaveButton: {
    backgroundColor: '#6D28D9',
  },
  modalActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  modalActionTextCancel: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 14,
  },
  viewRowLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  viewRowValue: {
    marginTop: 2,
    fontSize: 14,
    color: '#1E293B',
  },
});

export default ReceptionsScreen;
