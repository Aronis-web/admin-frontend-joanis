import React, { useState, useEffect, useCallback } from 'react';
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
  useWindowDimensions,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';

import { TransferCard } from '@/components/Transfers/TransferCard';
import { TransferItemsList } from '@/components/Transfers/TransferItemsList';
import { ProductAutocomplete } from '@/components/Transfers/ProductAutocomplete';
import { transfersApi } from '@/services/api/transfers';
import { warehousesApi, warehouseAreasApi } from '@/services/api/warehouses';
import { productsApi, Product } from '@/services/api/products';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { Site } from '@/types/sites';
import { AddButton } from '@/components/Navigation/AddButton';
import {
  Transfer,
  TransferType,
  TransferStatus,
  CreateExternalTransferDto,
  ShipTransferDto,
} from '@/types/transfers';

interface ExternalTransfersScreenProps {
  navigation: any;
}

interface TransferItemInput {
  productId: string;
  quantity: string;
  notes: string;
  product?: Product;
  selectedStockLocation?: {
    warehouseId: string;
    areaId: string | null;
    availableStock: number;
  };
}

export const ExternalTransfersScreen: React.FC<ExternalTransfersScreenProps> = ({ navigation }) => {
  const { user, currentSite, currentCompany, logout } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTransfers, setFilteredTransfers] = useState<Transfer[]>([]);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);
  const [selectedStatus, setSelectedStatus] = useState<TransferStatus | 'ALL'>('ALL');

  // Create transfer modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [originWarehouses, setOriginWarehouses] = useState<Warehouse[]>([]);
  const [destinationWarehouses, setDestinationWarehouses] = useState<Warehouse[]>([]);
  const [originAreas, setOriginAreas] = useState<WarehouseArea[]>([]);
  const [destinationAreas, setDestinationAreas] = useState<WarehouseArea[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [originWarehouseId, setOriginWarehouseId] = useState('');
  const [originAreaId, setOriginAreaId] = useState('');
  const [destinationSiteId, setDestinationSiteId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [destinationAreaId, setDestinationAreaId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState<TransferItemInput[]>([
    { productId: '', quantity: '', notes: '', product: undefined, selectedStockLocation: undefined },
  ]);

  // Detail modal states
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Ship modal states
  const [showShipModal, setShowShipModal] = useState(false);
  const [shippingNotes, setShippingNotes] = useState('');

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  const statusFilters = [
    { key: 'ALL', label: 'Todos', color: '#64748B' },
    { key: TransferStatus.DRAFT, label: 'Borrador', color: '#94A3B8' },
    { key: TransferStatus.APPROVED, label: 'Aprobado', color: '#3B82F6' },
    { key: TransferStatus.IN_TRANSIT, label: 'En Tránsito', color: '#F59E0B' },
    { key: TransferStatus.RECEIVED, label: 'Recibido', color: '#8B5CF6' },
    { key: TransferStatus.COMPLETED, label: 'Completado', color: '#10B981' },
  ];

  // Auto-reload transfers when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 ExternalTransfersScreen focused - reloading transfers...');
      loadTransfers();
    }, [selectedStatus, effectiveSite?.id, effectiveCompany?.id])
  );

  useEffect(() => {
    if (effectiveSite?.id || effectiveCompany?.id) {
      loadTransfers();
    }
  }, [effectiveSite?.id, effectiveCompany?.id]);

  useEffect(() => {
    if (!Array.isArray(transfers)) {
      setFilteredTransfers([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredTransfers(transfers);
    } else {
      const filtered = transfers.filter(
        (transfer) =>
          transfer.transferNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transfer.originWarehouse?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transfer.destinationWarehouse?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTransfers(filtered);
    }
  }, [searchQuery, transfers]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const params: any = {
        type: TransferType.EXTERNAL,
        currentSiteId: effectiveSite?.id,
        page: 1,
        limit: 100,
      };
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      const response = await transfersApi.getTransfers(params);

      // Debug: Log first transfer to see structure
      if (response.data && response.data.length > 0) {
        console.log('🔍 ExternalTransfers - First transfer data:', {
          id: response.data[0].id,
          transferNumber: response.data[0].transferNumber,
          hasOriginArea: !!response.data[0].originArea,
          hasDestinationArea: !!response.data[0].destinationArea,
          originAreaId: response.data[0].originAreaId,
          destinationAreaId: response.data[0].destinationAreaId,
          originArea: response.data[0].originArea,
          destinationArea: response.data[0].destinationArea,
        });
      }

      setTransfers(response.data || []);
    } catch (error: any) {
      console.error('Error loading external transfers:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar los traslados externos');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransfers();
    setRefreshing(false);
  };

  const handleTransferPress = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setShowDetailModal(true);
  };

  const handleCreateTransfer = () => {
    setShowCreateModal(true);
    loadModalData();
  };

  const loadModalData = async () => {
    try {
      // Load sites, warehouses, and products
      const sitesApi = await import('@/services/api/sites');
      const sitesData = await sitesApi.sitesApi.getSites({ companyId: effectiveCompany?.id });
      setSites(sitesData.data || []);

      const warehousesData = await warehousesApi.getWarehouses(effectiveCompany?.id);
      setWarehouses(warehousesData || []);

      // Filter origin warehouses for current site
      if (effectiveSite?.id) {
        const originWhs = warehousesData.filter((w) => w.siteId === effectiveSite.id);
        setOriginWarehouses(originWhs);
      }

      // ✅ Usar endpoint v2 optimizado con paginación
      const productsData = await productsApi.getProductsV2({
        limit: 100, // Límite máximo permitido por el endpoint v2
        status: 'active,preliminary',
      });
      setProducts(productsData.products || []);

      if (productsData.hasMore) {
        console.log('⚠️ Hay más productos disponibles. Total:', productsData.total);
        // TODO: Implementar carga paginada si es necesario
      }
    } catch (error) {
      console.error('Error loading modal data:', error);
    }
  };

  const resetCreateForm = () => {
    setOriginWarehouseId('');
    setOriginAreaId('');
    setDestinationSiteId('');
    setDestinationWarehouseId('');
    setDestinationAreaId('');
    setTransferNotes('');
    setTransferItems([{ productId: '', quantity: '', notes: '', product: undefined, selectedStockLocation: undefined }]);
  };

  const addTransferItem = () => {
    setTransferItems([
      ...transferItems,
      { productId: '', quantity: '', notes: '', product: undefined, selectedStockLocation: undefined },
    ]);
  };

  const removeTransferItem = (index: number) => {
    if (transferItems.length > 1) {
      const newItems = transferItems.filter((_, i) => i !== index);
      setTransferItems(newItems);
    }
  };

  const updateTransferItem = (index: number, field: keyof TransferItemInput, value: string) => {
    const newItems = [...transferItems];
    if (field === 'productId' || field === 'quantity' || field === 'notes') {
      newItems[index][field] = value;
    }
    setTransferItems(newItems);
  };

  const updateTransferItemProduct = (index: number, product: Product) => {
    console.log('═══════════════════════════════════════════════════');
    console.log('📦 PRODUCTO SELECCIONADO:', product.title);
    console.log('🆔 Product ID:', product.id);
    console.log('📍 Stock items (RAW):', JSON.stringify(product.stockItems, null, 2));
    console.log('🔢 Cantidad de ubicaciones (total):', product.stockItems?.length || 0);

    // Mostrar detalle de cada ubicación
    if (product.stockItems && product.stockItems.length > 0) {
      product.stockItems.forEach((item, idx) => {
        console.log(`\n  Ubicación ${idx + 1}:`);
        console.log(`    - Warehouse ID: ${item.warehouseId}`);
        console.log(`    - Warehouse Name: ${(item.warehouse as any)?.name}`);
        console.log(`    - Warehouse SiteId: ${(item.warehouse as any)?.siteId}`);
        console.log(`    - Area ID: ${item.areaId}`);
        console.log(`    - Area Name: ${(item.area as any)?.name}`);
        console.log(`    - Stock Disponible: ${item.availableQuantityBase}`);
        console.log(`    - Stock Total: ${item.quantityBase}`);
        console.log(`    - Stock Reservado: ${item.reservedQuantityBase}`);
      });
    }

    // Filtrar solo ubicaciones de la sede actual
    const currentSiteStockItems = product.stockItems?.filter(
      (stockItem) => (stockItem.warehouse as any)?.siteId === effectiveSite?.id
    ) || [];
    console.log('\n🏢 Sede actual ID:', effectiveSite?.id);
    console.log('🏢 Ubicaciones en sede actual (filtradas):', currentSiteStockItems.length);
    console.log('📋 Detalle ubicaciones filtradas:', JSON.stringify(currentSiteStockItems, null, 2));
    console.log('═══════════════════════════════════════════════════\n');

    const newItems = [...transferItems];
    newItems[index].productId = product.id;
    newItems[index].product = product;
    newItems[index].selectedStockLocation = undefined; // Reset location when product changes
    setTransferItems(newItems);
  };

  const updateTransferItemLocation = (index: number, stockItem: any) => {
    const newItems = [...transferItems];
    // Usar availableQuantityBase (stock disponible = total - reservado)
    const availableStock = stockItem.availableQuantityBase ?? stockItem.quantityBase ?? 0;
    const parsedStock = typeof availableStock === 'number' ? availableStock : parseFloat(availableStock) || 0;

    newItems[index].selectedStockLocation = {
      warehouseId: stockItem.warehouseId,
      areaId: stockItem.areaId,
      availableStock: parsedStock,
    };
    setTransferItems(newItems);
  };

  const handleOriginWarehouseChange = async (warehouseId: string) => {
    setOriginWarehouseId(warehouseId);
    setOriginAreaId('');

    if (warehouseId) {
      try {
        const areas = await warehouseAreasApi.getWarehouseAreas(warehouseId);
        setOriginAreas(areas || []);
      } catch (error) {
        console.error('Error loading origin areas:', error);
        setOriginAreas([]);
      }
    } else {
      setOriginAreas([]);
    }
  };

  const handleDestinationSiteChange = async (siteId: string) => {
    setDestinationSiteId(siteId);
    setDestinationWarehouseId('');
    setDestinationAreaId('');
    setDestinationAreas([]);

    if (siteId) {
      const filtered = warehouses.filter((w) => w.siteId === siteId);
      setDestinationWarehouses(filtered);
    } else {
      setDestinationWarehouses([]);
    }
  };

  const handleDestinationWarehouseChange = async (warehouseId: string) => {
    setDestinationWarehouseId(warehouseId);
    setDestinationAreaId('');

    if (warehouseId) {
      try {
        const areas = await warehouseAreasApi.getWarehouseAreas(warehouseId);
        setDestinationAreas(areas || []);
      } catch (error) {
        console.error('Error loading destination areas:', error);
        setDestinationAreas([]);
      }
    } else {
      setDestinationAreas([]);
    }
  };

  const validateCreateForm = (): boolean => {
    if (!destinationSiteId) {
      Alert.alert('Error', 'Selecciona una sede de destino');
      return false;
    }

    if (!destinationWarehouseId) {
      Alert.alert('Error', 'Selecciona un almacén de destino');
      return false;
    }

    // Validate different sites
    const destinationWarehouse = warehouses.find((w) => w.id === destinationWarehouseId);

    if (destinationWarehouse?.siteId === effectiveSite?.id) {
      Alert.alert(
        'Error',
        'Los traslados externos deben ser entre sedes diferentes. Usa traslados internos para la misma sede.'
      );
      return false;
    }

    const validItems = transferItems.filter(
      (item) => item.productId && item.selectedStockLocation && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      Alert.alert('Error', 'Agrega al menos un producto con ubicación de origen y cantidad válida');
      return false;
    }

    // Validar que cada item tenga ubicación seleccionada
    for (let i = 0; i < transferItems.length; i++) {
      const item = transferItems[i];
      if (item.productId && !item.selectedStockLocation) {
        Alert.alert(
          'Error de Validación',
          `Producto ${i + 1} (${item.product?.title || 'Sin nombre'}):\nSelecciona la ubicación de origen`
        );
        return false;
      }
      if (item.productId && item.selectedStockLocation && !item.quantity) {
        Alert.alert(
          'Error de Validación',
          `Producto ${i + 1} (${item.product?.title || 'Sin nombre'}):\nIngresa la cantidad a trasladar`
        );
        return false;
      }
      if (item.productId && item.selectedStockLocation && parseFloat(item.quantity) <= 0) {
        Alert.alert(
          'Error de Validación',
          `Producto ${i + 1} (${item.product?.title || 'Sin nombre'}):\nLa cantidad debe ser mayor a 0`
        );
        return false;
      }
      if (item.productId && item.selectedStockLocation && parseFloat(item.quantity) > item.selectedStockLocation.availableStock) {
        Alert.alert(
          'Error de Validación',
          `Producto ${i + 1} (${item.product?.title || 'Sin nombre'}):\n\n` +
          `Cantidad ingresada: ${parseFloat(item.quantity).toFixed(2)}\n` +
          `Stock disponible: ${item.selectedStockLocation.availableStock.toFixed(2)}\n\n` +
          `La cantidad excede el stock disponible`
        );
        return false;
      }
    }

    return true;
  };

  const handleCreateExternalTransfer = async () => {
    if (!validateCreateForm()) {
      return;
    }

    try {
      if (!user?.id) {
        Alert.alert('Error', 'No se pudo identificar el usuario actual');
        return;
      }

      // Agrupar items por ubicación de origen (warehouse + area)
      const itemsByOrigin = new Map<string, typeof transferItems>();

      transferItems
        .filter((item) => item.productId && item.selectedStockLocation && parseFloat(item.quantity) > 0)
        .forEach((item) => {
          const key = `${item.selectedStockLocation!.warehouseId}-${item.selectedStockLocation!.areaId || 'null'}`;
          if (!itemsByOrigin.has(key)) {
            itemsByOrigin.set(key, []);
          }
          itemsByOrigin.get(key)!.push(item);
        });

      // Crear un traslado por cada ubicación de origen
      const createdTransfers: any[] = [];

      for (const [key, items] of itemsByOrigin.entries()) {
        const firstItem = items[0];
        const originWarehouseId = firstItem.selectedStockLocation!.warehouseId;
        const originAreaId = firstItem.selectedStockLocation!.areaId;

        const validItems = items.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          notes: item.notes || undefined,
        }));

        const createDto: CreateExternalTransferDto = {
          originWarehouseId,
          originAreaId: originAreaId || undefined,
          destinationWarehouseId,
          destinationAreaId: destinationAreaId || undefined,
          requestedBy: user.id,
          items: validItems,
          notes: transferNotes || undefined,
        };

        const newTransfer = await transfersApi.createExternalTransfer(createDto);
        createdTransfers.push(newTransfer);
      }

      if (createdTransfers.length === 1) {
        Alert.alert(
          'Éxito',
          `Traslado externo ${createdTransfers[0].transferNumber} creado exitosamente en estado BORRADOR.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowCreateModal(false);
                resetCreateForm();
                loadTransfers();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Traslados Creados',
          `Se crearon ${createdTransfers.length} traslados externos exitosamente (agrupados por ubicación de origen).`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowCreateModal(false);
                resetCreateForm();
                loadTransfers();
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error creating external transfer:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el traslado externo');
    }
  };

  const handleApproveTransfer = async (transferId: string) => {
    Alert.alert('Aprobar Traslado', '¿Estás seguro de aprobar este traslado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar',
        onPress: async () => {
          try {
            const userId = user?.id;
            console.log('🔄 Approving transfer...');
            console.log('📋 Transfer ID:', transferId);
            console.log('👤 User ID:', userId);

            if (!userId) {
              Alert.alert(
                'Error',
                'No se pudo identificar el usuario. Por favor, inicia sesión nuevamente.'
              );
              return;
            }

            await transfersApi.approveTransfer(transferId, userId);
            Alert.alert('Éxito', 'Traslado aprobado exitosamente');
            loadTransfers();
            if (selectedTransfer?.id === transferId) {
              const updated = await transfersApi.getTransferById(transferId);
              setSelectedTransfer(updated);
            }
          } catch (error: any) {
            console.error('Error approving transfer:', error);
            Alert.alert('Error', error.message || 'No se pudo aprobar el traslado');
          }
        },
      },
    ]);
  };

  const handleShipTransfer = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setShowShipModal(true);
    setShippingNotes('');
  };

  const handleConfirmShip = async () => {
    if (!selectedTransfer) {
      return;
    }

    try {
      // Validate that all items have valid quantities
      const items =
        selectedTransfer.items?.map((item) => {
          const quantity = Number(item.quantityRequested);

          if (isNaN(quantity) || quantity < 0) {
            throw new Error(
              `Cantidad inválida para el producto ${item.product?.title || item.productId}`
            );
          }

          return {
            transferItemId: item.id,
            quantityShipped: quantity,
          };
        }) || [];

      if (items.length === 0) {
        Alert.alert('Error', 'No hay productos para despachar');
        return;
      }

      const shipDto: ShipTransferDto = {
        items,
        shippingNotes: shippingNotes || undefined,
      };

      console.log('🚚 Shipping transfer with data:', JSON.stringify(shipDto, null, 2));

      await transfersApi.shipTransfer(selectedTransfer.id, shipDto);
      Alert.alert(
        'Éxito',
        'Traslado despachado exitosamente. Stock descontado del almacén origen.'
      );
      setShowShipModal(false);
      setShowDetailModal(false);
      loadTransfers();
    } catch (error: any) {
      console.error('Error shipping transfer:', error);
      Alert.alert('Error', error.message || 'No se pudo despachar el traslado');
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    Alert.alert(
      'Cancelar Traslado',
      '¿Estás seguro de cancelar este traslado? Esta acción no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transfersApi.cancelTransfer(transferId, { reason: 'Cancelado por usuario' });
              Alert.alert('Éxito', 'Traslado cancelado exitosamente');
              setShowDetailModal(false);
              loadTransfers();
            } catch (error: any) {
              console.error('Error canceling transfer:', error);
              Alert.alert('Error', error.message || 'No se pudo cancelar el traslado');
            }
          },
        },
      ]
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando traslados externos...</Text>
        </View>
      );
    }

    if (filteredTransfers.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🚛</Text>
          <Text style={styles.emptyText}>No hay traslados externos</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'No se encontraron resultados'
              : selectedStatus === 'ALL'
                ? 'Crea tu primer traslado externo'
                : `No hay traslados en estado ${statusFilters.find((f) => f.key === selectedStatus)?.label}`}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {filteredTransfers.map((transfer) => (
          <TransferCard key={transfer.id} transfer={transfer} onPress={handleTransferPress} />
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Traslados Externos</Text>
          <Text style={styles.headerSubtitle}>
            Entre sedes diferentes • {filteredTransfers.length} traslado
            {filteredTransfers.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por número, almacén..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Status Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filtersContent}>
          {statusFilters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                selectedStatus === filter.key && {
                  backgroundColor: filter.color,
                  borderColor: filter.color,
                },
              ]}
              onPress={() => setSelectedStatus(filter.key as TransferStatus | 'ALL')}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedStatus === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {renderContent()}

      {/* Create Button */}
      <AddButton onPress={handleCreateTransfer} icon="🚚" />

      {/* Create Transfer Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo Traslado Externo</Text>
            <TouchableOpacity
              onPress={() => {
                setShowCreateModal(false);
                resetCreateForm();
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            {/* Sede Origen (solo informativa) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📤 Sede de Origen</Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>{effectiveSite?.name || 'No seleccionada'}</Text>
              </View>
            </View>

            {/* Items Section - PRIMERO */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📦 Productos</Text>
                <TouchableOpacity onPress={addTransferItem} style={styles.addItemButton}>
                  <Text style={styles.addItemButtonText}>+ Agregar Producto</Text>
                </TouchableOpacity>
              </View>

              {transferItems.map((item, index) => (
                <View key={index} style={styles.itemContainer}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemNumber}>Producto {index + 1}</Text>
                    {transferItems.length > 1 && (
                      <TouchableOpacity onPress={() => removeTransferItem(index)}>
                        <Text style={styles.removeItemText}>✕ Eliminar</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.label}>Producto *</Text>
                  <ProductAutocomplete
                    products={products}
                    selectedProductId={item.productId}
                    onSelectProduct={(product) => updateTransferItemProduct(index, product)}
                    placeholder="Buscar producto por nombre, SKU o código de barras..."
                  />

                  {/* Mostrar foto del producto si existe */}
                  {item.product && item.product.imageUrl && (
                    <View style={styles.productImageContainer}>
                      <Text style={styles.productImageLabel}>Producto:</Text>
                      <View style={styles.productImageWrapper}>
                        <Image
                          source={{ uri: item.product.imageUrl }}
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                        <Text style={styles.productImageTitle} numberOfLines={2}>
                          {item.product.title}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Mostrar ubicaciones disponibles del producto */}
                  {item.product && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Ubicación de Origen *</Text>
                      <Text style={styles.formHint}>Selecciona de dónde deseas trasladar este producto (solo de tu sede actual)</Text>

                      {item.product.stockItems && item.product.stockItems.length > 0 ? (
                        item.product.stockItems
                          .filter((stockItem) => (stockItem.warehouse as any)?.siteId === effectiveSite?.id)
                          .map((stockItem, stockIndex) => {
                          const isSelected =
                            item.selectedStockLocation?.warehouseId === stockItem.warehouseId &&
                            item.selectedStockLocation?.areaId === stockItem.areaId;

                          // Usar availableQuantityBase (stock disponible = total - reservado)
                          const availableStock = stockItem.availableQuantityBase ?? stockItem.quantityBase ?? 0;
                          const parsedStock = typeof availableStock === 'number' ? availableStock : parseFloat(availableStock) || 0;
                          const totalStock = typeof stockItem.quantityBase === 'number' ? stockItem.quantityBase : parseFloat(stockItem.quantityBase || '0') || 0;
                          const reservedStock = typeof stockItem.reservedQuantityBase === 'number' ? stockItem.reservedQuantityBase : parseFloat(stockItem.reservedQuantityBase || '0') || 0;

                          return (
                            <TouchableOpacity
                              key={stockIndex}
                              style={[
                                styles.locationCard,
                                isSelected && styles.locationCardSelected,
                                parsedStock === 0 && styles.locationCardDisabled,
                              ]}
                              onPress={() => {
                                if (parsedStock > 0) {
                                  updateTransferItemLocation(index, stockItem);
                                }
                              }}
                              disabled={parsedStock === 0}
                            >
                              <View style={styles.locationInfo}>
                                <Text style={styles.locationWarehouse}>
                                  📦 Almacén: {stockItem.warehouse?.name || 'Sin nombre'}
                                </Text>
                                <Text style={styles.locationArea}>
                                  📍 Área: {stockItem.area?.name || 'Sin área asignada'}
                                </Text>
                                <Text style={[
                                  styles.locationStock,
                                  parsedStock === 0 && styles.locationStockZero,
                                ]}>
                                  ✅ Disponible: {parsedStock.toFixed(2)}
                                </Text>
                                {reservedStock > 0 && (
                                  <Text style={styles.locationReserved}>
                                    🔒 Reservado: {reservedStock.toFixed(2)} | Total: {totalStock.toFixed(2)}
                                  </Text>
                                )}
                              </View>
                              {isSelected && (
                                <Text style={styles.locationSelectedIcon}>✓</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <View style={styles.noStockContainer}>
                          <Text style={styles.noStockIcon}>⚠️</Text>
                          <Text style={styles.noStockText}>
                            {item.product.stockItems && item.product.stockItems.length > 0
                              ? 'Este producto no tiene stock disponible en tu sede actual'
                              : 'Este producto no tiene stock disponible en ninguna ubicación'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Cantidad - solo habilitado si se seleccionó ubicación */}
                  <View>
                    <Text style={styles.label}>Cantidad *</Text>
                    <TextInput
                      style={[
                        styles.input,
                        !item.selectedStockLocation && styles.inputDisabled,
                        item.selectedStockLocation &&
                        item.quantity &&
                        parseFloat(item.quantity) > item.selectedStockLocation.availableStock &&
                        styles.inputError
                      ]}
                      placeholder={item.selectedStockLocation ? `Cantidad (máx: ${item.selectedStockLocation.availableStock})` : 'Selecciona ubicación primero'}
                      keyboardType="numeric"
                      value={item.quantity}
                      onChangeText={(value) => updateTransferItem(index, 'quantity', value)}
                      placeholderTextColor="#94A3B8"
                      editable={!!item.selectedStockLocation}
                    />
                    {item.selectedStockLocation &&
                     item.quantity &&
                     parseFloat(item.quantity) > item.selectedStockLocation.availableStock && (
                      <Text style={styles.errorText}>
                        ⚠️ La cantidad excede el stock disponible ({item.selectedStockLocation.availableStock})
                      </Text>
                    )}
                  </View>

                  <Text style={styles.label}>Notas (Opcional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Notas del producto..."
                    value={item.notes}
                    onChangeText={(value) => updateTransferItem(index, 'notes', value)}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              ))}
            </View>

            {/* Destination Section - AL FINAL */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>📍 Destino del Traslado</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Sede Destino *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={destinationSiteId}
                  onValueChange={handleDestinationSiteChange}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar sede..." value="" />
                  {sites.map((site) => (
                    <Picker.Item key={site.id} label={site.name} value={site.id} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Almacén Destino *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={destinationWarehouseId}
                  onValueChange={handleDestinationWarehouseChange}
                  style={styles.picker}
                  enabled={destinationWarehouses.length > 0}
                >
                  <Picker.Item label="Seleccionar almacén..." value="" />
                  {destinationWarehouses.map((warehouse) => (
                    <Picker.Item key={warehouse.id} label={warehouse.name} value={warehouse.id} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Área Destino (Opcional)</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={destinationAreaId}
                  onValueChange={setDestinationAreaId}
                  style={styles.picker}
                  enabled={destinationAreas.length > 0}
                >
                  <Picker.Item label="Seleccionar área..." value="" />
                  {destinationAreas.map((area) => (
                    <Picker.Item key={area.id} label={area.name || area.code} value={area.id} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Notes Section */}
            <View style={styles.section}>
              <Text style={styles.label}>Notas del Traslado (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notas generales del traslado..."
                value={transferNotes}
                onChangeText={setTransferNotes}
                multiline
                numberOfLines={4}
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={styles.modalCreateButton}
              onPress={handleCreateExternalTransfer}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCreateButtonText}>Crear Traslado Externo</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedTransfer?.transferNumber || 'Detalle'}</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            {selectedTransfer && (
              <>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Estado</Text>
                  <Text style={styles.detailValue}>{selectedTransfer.status}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Origen</Text>
                  <Text style={styles.detailValue}>{selectedTransfer.originWarehouse?.name}</Text>
                  <Text style={styles.detailSubvalue}>{selectedTransfer.originSite?.name}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Destino</Text>
                  <Text style={styles.detailValue}>
                    {selectedTransfer.destinationWarehouse?.name}
                  </Text>
                  <Text style={styles.detailSubvalue}>
                    {selectedTransfer.destinationSite?.name}
                  </Text>
                </View>

                {selectedTransfer.expectedArrivalDate && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Fecha Estimada de Llegada</Text>
                    <Text style={styles.detailValue}>{selectedTransfer.expectedArrivalDate}</Text>
                  </View>
                )}

                {selectedTransfer.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Notas</Text>
                    <Text style={styles.detailValue}>{selectedTransfer.notes}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Productos</Text>
                  {selectedTransfer.items && selectedTransfer.items.length > 0 && (
                    <TransferItemsList items={selectedTransfer.items} transfer={selectedTransfer} />
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {selectedTransfer.status === TransferStatus.DRAFT && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApproveTransfer(selectedTransfer.id)}
                      >
                        <Text style={styles.actionButtonText}>✓ Aprobar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => handleCancelTransfer(selectedTransfer.id)}
                      >
                        <Text style={styles.actionButtonText}>✕ Cancelar</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {selectedTransfer.status === TransferStatus.APPROVED && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.shipButton]}
                        onPress={() => handleShipTransfer(selectedTransfer)}
                      >
                        <Text style={styles.actionButtonText}>📦 Despachar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => handleCancelTransfer(selectedTransfer.id)}
                      >
                        <Text style={styles.actionButtonText}>✕ Cancelar</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {selectedTransfer.status === TransferStatus.IN_TRANSIT && (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}>
                        ℹ️ Este traslado está en tránsito. Debe ser recibido en la sede destino.
                      </Text>
                    </View>
                  )}

                  {selectedTransfer.status === TransferStatus.RECEIVED && (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}>
                        ℹ️ Este traslado ha sido recibido y está pendiente de validación.
                      </Text>
                    </View>
                  )}

                  {selectedTransfer.status === TransferStatus.COMPLETED && (
                    <View style={styles.successBox}>
                      <Text style={styles.successText}>✓ Traslado completado exitosamente</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Ship Modal */}
      <Modal visible={showShipModal} animationType="slide" transparent>
        <View style={styles.shipModalOverlay}>
          <View style={styles.shipModalContainer}>
            <Text style={styles.shipModalTitle}>Despachar Traslado</Text>
            <Text style={styles.shipModalSubtitle}>
              Se despachará el traslado {selectedTransfer?.transferNumber}
            </Text>

            <Text style={styles.label}>Notas de Envío (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ej: Enviado con transportista XYZ - Guía #12345"
              value={shippingNotes}
              onChangeText={setShippingNotes}
              multiline
              numberOfLines={3}
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.shipModalButtons}>
              <TouchableOpacity
                style={[styles.shipModalButton, styles.shipModalCancelButton]}
                onPress={() => setShowShipModal(false)}
              >
                <Text style={styles.shipModalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shipModalButton, styles.shipModalConfirmButton]}
                onPress={handleConfirmShip}
              >
                <Text style={styles.shipModalConfirmButtonText}>Confirmar Despacho</Text>
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filtersContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  filterTextActive: {
    color: '#FFFFFF',
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
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
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
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
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
  addItemButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addItemButtonText: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '600',
  },
  itemContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  removeItemText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  modalCreateButton: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCreateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Detail Modal Styles
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  detailSubvalue: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  actionButtons: {
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  approveButton: {
    backgroundColor: '#3B82F6',
  },
  shipButton: {
    backgroundColor: '#F59E0B',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    color: '#1E40AF',
    fontSize: 14,
    lineHeight: 20,
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBoxText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  // Ship Modal Styles
  shipModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  shipModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  shipModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  shipModalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  shipModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  shipModalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  shipModalCancelButton: {
    backgroundColor: '#F1F5F9',
  },
  shipModalCancelButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  shipModalConfirmButton: {
    backgroundColor: '#F59E0B',
  },
  shipModalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Nuevos estilos para ubicaciones y validación
  formGroup: {
    marginBottom: 16,
  },
  formHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  productImageContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  productImageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  productImageWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  productImageTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  locationCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#F8FAFC',
  },
  locationInfo: {
    flex: 1,
  },
  locationWarehouse: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  locationArea: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  locationStock: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  locationStockZero: {
    color: '#EF4444',
  },
  locationReserved: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  locationSelectedIcon: {
    fontSize: 24,
    color: '#6366F1',
    fontWeight: 'bold',
  },
  noStockContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 16,
    alignItems: 'center',
  },
  noStockIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noStockText: {
    fontSize: 13,
    color: '#991B1B',
    textAlign: 'center',
    fontWeight: '500',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  sectionDivider: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
  },
});

export default ExternalTransfersScreen;
