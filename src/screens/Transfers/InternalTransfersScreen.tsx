import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
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
import { productsApi } from '@/services/api/products';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { Product } from '@/services/api/products';
import { AddButton } from '@/components/Navigation/AddButton';
import {
  Transfer,
  TransferType,
  TransferStatus,
  CreateInternalTransferDto,
} from '@/types/transfers';

interface InternalTransfersScreenProps {
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

export const InternalTransfersScreen: React.FC<InternalTransfersScreenProps> = ({ navigation }) => {
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

  // Create transfer modal
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [originWarehouseId, setOriginWarehouseId] = useState('');
  const [originAreaId, setOriginAreaId] = useState('');
  const [originAreas, setOriginAreas] = useState<WarehouseArea[]>([]);
  const [loadingOriginAreas, setLoadingOriginAreas] = useState(false);

  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [destinationAreaId, setDestinationAreaId] = useState('');
  const [destinationAreas, setDestinationAreas] = useState<WarehouseArea[]>([]);
  const [loadingDestinationAreas, setLoadingDestinationAreas] = useState(false);

  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState<TransferItemInput[]>([
    { productId: '', quantity: '', notes: '', product: undefined, selectedStockLocation: undefined },
  ]);

  // Detail modal
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  // Auto-reload transfers when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 InternalTransfersScreen focused - reloading transfers...');
      loadTransfers();
    }, [effectiveSite?.id, effectiveCompany?.id])
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
      const response = await transfersApi.getTransfers({
        type: TransferType.INTERNAL,
        currentSiteId: effectiveSite?.id,
        page: 1,
        limit: 100,
      });
      setTransfers(response.data || []);
    } catch (error: any) {
      console.error('Error loading internal transfers:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar los traslados internos');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransfers();
    setRefreshing(false);
  };

  const loadWarehouses = async () => {
    try {
      setLoadingWarehouses(true);

      // Filter warehouses by current site
      const companyId = effectiveCompany?.id;
      const siteId = effectiveSite?.id;

      if (!companyId || !siteId) {
        Alert.alert('Error', 'No se ha seleccionado una sede');
        setWarehouses([]);
        return;
      }

      const response = await warehousesApi.getWarehouses(companyId, siteId);
      // warehousesApi.getWarehouses() returns Warehouse[] directly, not { data: Warehouse[] }
      setWarehouses(Array.isArray(response) ? response : []);
    } catch (error: any) {
      console.error('Error loading warehouses:', error);
      Alert.alert('Error', 'No se pudieron cargar los almacenes');
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      // ✅ Usar endpoint v2 optimizado con paginación
      // Nota: Para cargar todos los productos, usar múltiples páginas o aumentar el límite
      const response = await productsApi.getProductsV2({
        limit: 100, // Límite máximo permitido por el endpoint v2
        status: 'active,preliminary',
      });
      setProducts(response.products || []);

      // Si hay más productos, cargar páginas adicionales
      if (response.hasMore) {
        console.log('⚠️ Hay más productos disponibles. Total:', response.total);
        // TODO: Implementar carga paginada si es necesario
      }
    } catch (error: any) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadOriginAreas = async (warehouseId: string) => {
    try {
      setLoadingOriginAreas(true);
      const areas = await warehouseAreasApi.getWarehouseAreas(warehouseId);
      setOriginAreas(Array.isArray(areas) ? areas : []);
    } catch (error: any) {
      console.error('Error loading origin areas:', error);
      Alert.alert('Error', 'No se pudieron cargar las áreas del almacén de origen');
      setOriginAreas([]);
    } finally {
      setLoadingOriginAreas(false);
    }
  };

  const loadDestinationAreas = async (warehouseId: string) => {
    try {
      setLoadingDestinationAreas(true);
      const areas = await warehouseAreasApi.getWarehouseAreas(warehouseId);
      setDestinationAreas(Array.isArray(areas) ? areas : []);
    } catch (error: any) {
      console.error('Error loading destination areas:', error);
      Alert.alert('Error', 'No se pudieron cargar las áreas del almacén de destino');
      setDestinationAreas([]);
    } finally {
      setLoadingDestinationAreas(false);
    }
  };

  const openCreateModal = () => {
    setIsCreateModalVisible(true);
    loadWarehouses();
    loadProducts();
  };

  const closeCreateModal = () => {
    setIsCreateModalVisible(false);
    setOriginWarehouseId('');
    setOriginAreaId('');
    setOriginAreas([]);
    setDestinationWarehouseId('');
    setDestinationAreaId('');
    setDestinationAreas([]);
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
    newItems[index] = { ...newItems[index], [field]: value };

    // If updating productId, find and attach the product
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      newItems[index].product = product;
    }

    setTransferItems(newItems);
  };

  const updateTransferItemProduct = (index: number, product: Product) => {
    console.log('📦 Producto seleccionado:', product.title);
    console.log('📍 Stock items:', product.stockItems);
    console.log('🔢 Cantidad de ubicaciones:', product.stockItems?.length || 0);

    const newItems = [...transferItems];
    newItems[index] = {
      ...newItems[index],
      productId: product.id,
      product: product,
      selectedStockLocation: undefined, // Reset location when product changes
    };
    setTransferItems(newItems);
  };

  const updateTransferItemLocation = (index: number, stockItem: any) => {
    const newItems = [...transferItems];
    // Usar availableQuantityBase (stock disponible = total - reservado)
    const availableStock = stockItem.availableQuantityBase ?? stockItem.quantityBase ?? 0;
    const parsedStock = typeof availableStock === 'number' ? availableStock : parseFloat(availableStock) || 0;

    newItems[index] = {
      ...newItems[index],
      selectedStockLocation: {
        warehouseId: stockItem.warehouseId,
        areaId: stockItem.areaId,
        availableStock: parsedStock,
      },
    };
    setTransferItems(newItems);
  };

  const validateForm = (): boolean => {
    if (!destinationWarehouseId) {
      Alert.alert('Error', 'Selecciona un almacén de destino');
      return false;
    }

    if (!destinationAreaId) {
      Alert.alert('Error', 'Selecciona un área de destino');
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

  const handleCreateTransfer = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setCreating(true);

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

        const createDto: CreateInternalTransferDto = {
          originWarehouseId,
          originAreaId,
          destinationWarehouseId,
          destinationAreaId,
          requestedBy: user.id,
          items: validItems,
          notes: transferNotes || undefined,
        };

        const newTransfer = await transfersApi.createInternalTransfer(createDto);
        createdTransfers.push(newTransfer);
      }

      if (createdTransfers.length === 1) {
        Alert.alert(
          'Traslado Creado',
          `Traslado ${createdTransfers[0].transferNumber} creado exitosamente. ¿Deseas ejecutarlo ahora?`,
          [
            {
              text: 'Más tarde',
              style: 'cancel',
              onPress: () => {
                closeCreateModal();
                loadTransfers();
              },
            },
            {
              text: 'Ejecutar',
              onPress: () => handleExecuteTransfer(createdTransfers[0].id),
            },
          ]
        );
      } else {
        Alert.alert(
          'Traslados Creados',
          `Se crearon ${createdTransfers.length} traslados exitosamente (agrupados por ubicación de origen). ¿Deseas ejecutarlos ahora?`,
          [
            {
              text: 'Más tarde',
              style: 'cancel',
              onPress: () => {
                closeCreateModal();
                loadTransfers();
              },
            },
            {
              text: 'Ejecutar Todos',
              onPress: async () => {
                for (const transfer of createdTransfers) {
                  await handleExecuteTransfer(transfer.id);
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error creating transfer:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el traslado');
    } finally {
      setCreating(false);
    }
  };

  const handleExecuteTransfer = async (transferId: string) => {
    try {
      setCreating(true);
      const userId = user?.id;
      console.log('🔄 Executing transfer...');
      console.log('📋 Transfer ID:', transferId);
      console.log('👤 User object:', user);
      console.log('👤 User ID:', userId);

      if (!userId) {
        Alert.alert(
          'Error',
          'No se pudo identificar el usuario. Por favor, inicia sesión nuevamente.'
        );
        return;
      }

      await transfersApi.executeInternalTransfer(transferId, userId);
      Alert.alert('Éxito', 'Traslado ejecutado exitosamente');
      closeCreateModal();
      loadTransfers();
    } catch (error: any) {
      console.error('❌ Error executing transfer:', error);
      console.error('❌ Error details:', error.response?.data);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'No se pudo ejecutar el traslado'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleTransferPress = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setIsDetailModalVisible(true);
  };

  const handleExecuteFromDetail = () => {
    if (selectedTransfer && selectedTransfer.status === TransferStatus.DRAFT) {
      Alert.alert(
        'Confirmar Ejecución',
        '¿Estás seguro de ejecutar este traslado? Esta acción moverá el stock inmediatamente.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ejecutar',
            onPress: async () => {
              try {
                const userId = user?.id;
                console.log('🔄 Executing transfer from detail...');
                console.log('📋 Transfer ID:', selectedTransfer.id);
                console.log('👤 User ID:', userId);

                if (!userId) {
                  Alert.alert(
                    'Error',
                    'No se pudo identificar el usuario. Por favor, inicia sesión nuevamente.'
                  );
                  return;
                }

                await transfersApi.executeInternalTransfer(selectedTransfer.id, userId);
                Alert.alert('Éxito', 'Traslado ejecutado exitosamente');
                setIsDetailModalVisible(false);
                loadTransfers();
              } catch (error: any) {
                console.error('❌ Error executing transfer:', error);
                console.error('❌ Error details:', error.response?.data);
                Alert.alert(
                  'Error',
                  error.response?.data?.message ||
                    error.message ||
                    'No se pudo ejecutar el traslado'
                );
              }
            },
          },
        ]
      );
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando traslados internos...</Text>
        </View>
      );
    }

    if (filteredTransfers.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>No hay traslados internos</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? 'No se encontraron resultados' : 'Crea tu primer traslado interno'}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredTransfers}
        renderItem={({ item }) => <TransferCard transfer={item} onPress={handleTransferPress} />}
        keyExtractor={(item) => item.id}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />
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
          <Text style={styles.headerTitle}>Traslados Internos</Text>
          <Text style={styles.headerSubtitle}>{effectiveSite?.name || 'Todas las sedes'}</Text>
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

      {/* Content */}
      {renderContent()}

      {/* Create Button */}
      <AddButton onPress={openCreateModal} icon="🔄" />

      {/* Create Transfer Modal */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeCreateModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeCreateModal}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo Traslado Interno</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Items - PRIMERO */}
            <View style={styles.formGroup}>
              <View style={styles.itemsHeader}>
                <Text style={styles.formLabel}>Productos *</Text>
                <TouchableOpacity onPress={addTransferItem} style={styles.addItemButton}>
                  <Text style={styles.addItemButtonText}>+ Agregar</Text>
                </TouchableOpacity>
              </View>

              {transferItems.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemRowHeader}>
                    <Text style={styles.itemRowTitle}>Producto {index + 1}</Text>
                    {transferItems.length > 1 && (
                      <TouchableOpacity onPress={() => removeTransferItem(index)}>
                        <Text style={styles.removeItemText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

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
                      <Text style={styles.formLabel}>Ubicación de Origen *</Text>
                      <Text style={styles.formHint}>Selecciona de dónde deseas trasladar este producto</Text>

                      {item.product.stockItems && item.product.stockItems.length > 0 ? (
                        item.product.stockItems.map((stockItem, stockIndex) => {
                          const isSelected =
                            item.selectedStockLocation?.warehouseId === stockItem.warehouseId &&
                            item.selectedStockLocation?.areaId === stockItem.areaId;

                          // Usar availableQuantityBase (stock disponible = total - reservado)
                          const availableStock = stockItem.availableQuantityBase ?? stockItem.quantityBase ?? 0;
                          const parsedStock = typeof availableStock === 'number' ? availableStock : parseFloat(availableStock) || 0;
                          const totalStock = typeof stockItem.quantityBase === 'number' ? stockItem.quantityBase : parseFloat(stockItem.quantityBase) || 0;
                          const reservedStock = typeof stockItem.reservedQuantityBase === 'number' ? stockItem.reservedQuantityBase : parseFloat(stockItem.reservedQuantityBase) || 0;

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
                            Este producto no tiene stock disponible en ninguna ubicación
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Cantidad - solo habilitado si se seleccionó ubicación */}
                  <View>
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
                      value={item.quantity}
                      onChangeText={(value) => updateTransferItem(index, 'quantity', value)}
                      keyboardType="numeric"
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

                  <TextInput
                    style={styles.input}
                    placeholder="Notas (opcional)"
                    value={item.notes}
                    onChangeText={(value) => updateTransferItem(index, 'notes', value)}
                    multiline
                  />
                </View>
              ))}
            </View>

            {/* Destination Warehouse and Area - AL FINAL */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>📍 Destino del Traslado</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Almacén de Destino *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={destinationWarehouseId}
                  onValueChange={(value) => {
                    setDestinationWarehouseId(value);
                    setDestinationAreaId('');
                    if (value) {
                      loadDestinationAreas(value);
                    } else {
                      setDestinationAreas([]);
                    }
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar almacén..." value="" />
                  {warehouses.map((wh) => (
                    <Picker.Item key={wh.id} label={wh.name} value={wh.id} />
                  ))}
                </Picker>
              </View>
            </View>

            {destinationWarehouseId && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Área de Destino *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={destinationAreaId}
                    onValueChange={setDestinationAreaId}
                    style={styles.picker}
                    enabled={!loadingDestinationAreas}
                  >
                    <Picker.Item
                      label={loadingDestinationAreas ? 'Cargando áreas...' : 'Seleccionar área...'}
                      value=""
                    />
                    {destinationAreas.map((area) => (
                      <Picker.Item key={area.id} label={area.name || area.code} value={area.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notas del Traslado</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notas generales..."
                value={transferNotes}
                onChangeText={setTransferNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.submitButton, creating && styles.submitButtonDisabled]}
              onPress={handleCreateTransfer}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Crear Traslado</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={isDetailModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsDetailModalVisible(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedTransfer?.transferNumber || 'Detalle'}</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedTransfer && (
            <ScrollView style={styles.modalContent}>
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
                <Text style={styles.detailSubvalue}>{selectedTransfer.destinationSite?.name}</Text>
              </View>

              {selectedTransfer.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Notas</Text>
                  <Text style={styles.detailValue}>{selectedTransfer.notes}</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Items</Text>
                {selectedTransfer.items && selectedTransfer.items.length > 0 && (
                  <TransferItemsList items={selectedTransfer.items} />
                )}
              </View>

              {selectedTransfer.status === TransferStatus.DRAFT && (
                <TouchableOpacity style={styles.executeButton} onPress={handleExecuteFromDetail}>
                  <Text style={styles.executeButtonText}>⚡ Ejecutar Traslado</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#64748B',
    width: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  sectionDivider: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
    marginTop: 8,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addItemButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  itemRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  removeItemText: {
    fontSize: 18,
    color: '#EF4444',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  detailSubvalue: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  executeButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  executeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default InternalTransfersScreen;
