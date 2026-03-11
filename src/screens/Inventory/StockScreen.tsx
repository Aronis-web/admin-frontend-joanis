import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { StockAdjustmentModal } from '@/components/Inventory/StockAdjustmentModal';
import { StockByAreasModal } from '@/components/Inventory/StockByAreasModal';
import { StockMovementHistoryModal } from '@/components/Inventory/StockMovementHistoryModal';
import { BulkUploadModal } from '@/components/Inventory/BulkUploadModal';
import { StockExportModal } from '@/components/Inventory/StockExportModal';
import { inventoryApi, StockItem } from '@/services/api/inventory';
import { warehousesApi, warehouseAreasApi } from '@/services/api/warehouses';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { useStock, useWarehouses, useWarehouseAreas, useSearchStockV2, useStockV2 } from '@/hooks/api/useStock';

interface StockScreenProps {
  navigation: any;
}

export const StockScreen: React.FC<StockScreenProps> = ({ navigation }) => {
  const { user, logout, currentSite, currentCompany } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  // New modals state
  const [isStockByAreasModalVisible, setIsStockByAreasModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isBulkUploadModalVisible, setIsBulkUploadModalVisible] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductTitle, setSelectedProductTitle] = useState<string>('');
  const [selectedProductSku, setSelectedProductSku] = useState<string>('');

  // Warehouse filter state
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [showWarehousePicker, setShowWarehousePicker] = useState(false);

  // Area filter state
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  // ✅ Stock level filter state
  const [stockLevelFilter, setStockLevelFilter] = useState<'all' | 'normal' | 'no-stock'>('normal');
  const [showStockLevelPicker, setShowStockLevelPicker] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Get effective site and company (prefer tenant store, fallback to auth store)
  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  // ✅ React Query: Cargar warehouses
  const {
    data: warehouses = [],
    isLoading: loadingWarehouses,
    refetch: refetchWarehouses,
  } = useWarehouses(effectiveCompany?.id, effectiveSite?.id);

  // ✅ React Query: Cargar áreas del warehouse seleccionado
  const {
    data: areas = [],
    isLoading: loadingAreas,
  } = useWarehouseAreas(selectedWarehouseId, selectedWarehouseId !== 'all');

  // ✅ Debounce search query (800ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 800);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ✅ React Query: Búsqueda V2 optimizada (cuando hay query)
  const {
    data: searchResultsV2,
    isLoading: isSearchingV2,
    refetch: refetchSearchV2,
  } = useSearchStockV2(debouncedSearchQuery, {
    warehouseId: selectedWarehouseId !== 'all' ? selectedWarehouseId : undefined,
    areaId: selectedAreaId !== 'all' ? selectedAreaId : undefined,
    lowStockOnly: stockLevelFilter === 'no-stock' ? false : undefined,
    limit: 50,
    enabled: debouncedSearchQuery.length >= 2,
  });

  // ✅ React Query: Cargar stock paginado con V2 (cuando NO hay búsqueda)
  const {
    data: stockResponseV2,
    isLoading: isLoadingStock,
    isRefetching,
    refetch: refetchStock,
  } = useStockV2({
    page,
    limit,
    warehouseId: selectedWarehouseId !== 'all' ? selectedWarehouseId : undefined,
    areaId: selectedAreaId !== 'all' ? selectedAreaId : undefined,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  // ✅ Determinar qué datos usar (búsqueda V2 o listado completo)
  const isUsingSearch = debouncedSearchQuery.length >= 2;
  const isLoading = isUsingSearch ? isSearchingV2 : isLoadingStock;

  // Transformar StockItemResponse a StockItem
  const stockItems = useMemo(() => {
    // ✅ Si hay búsqueda activa, usar resultados V2
    if (isUsingSearch && searchResultsV2) {
      const searchData = (searchResultsV2 as any).data || (searchResultsV2 as any).results || [];
      return searchData.map((item: any) => ({
        productId: item.productId,
        warehouseId: item.warehouseId,
        areaId: item.areaId || undefined,
        quantityBase: item.quantityBase,
        reservedQuantityBase: item.reservedQuantityBase,
        availableQuantityBase: item.availableQuantityBase,
        updatedAt: item.updatedAt,
        productTitle: item.product?.title,
        productSku: item.product?.sku,
        warehouseName: item.warehouse?.name,
        areaName: item.area?.name || item.area?.code,
        minStockAlert: undefined,
      }));
    }

    // ✅ Si no hay búsqueda, usar listado paginado V2
    // Backend retorna "results" después del mapeo en inventory.ts
    const stockData = (stockResponseV2 as any)?.results || (stockResponseV2 as any)?.data || [];
    if (!stockData || stockData.length === 0) return [];

    return stockData.map((item: any) => ({
      productId: item.productId,
      warehouseId: item.warehouseId,
      areaId: item.areaId || undefined,
      quantityBase: item.quantityBase,
      reservedQuantityBase: item.reservedQuantityBase,
      availableQuantityBase: item.availableQuantityBase,
      updatedAt: item.updatedAt,
      productTitle: item.product?.title,
      productSku: item.product?.sku,
      warehouseName: item.warehouse?.name,
      areaName: item.area?.name || item.area?.code,
      minStockAlert: undefined, // No viene en la respuesta
    }));
  }, [stockResponseV2, searchResultsV2, isUsingSearch]);

  // Auto-reload stock when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 StockScreen focused - refetching stock and warehouses...');
      refetchWarehouses();
      if (isUsingSearch) {
        refetchSearchV2();
      } else {
        refetchStock();
      }
    }, [refetchWarehouses, refetchStock, refetchSearchV2, isUsingSearch])
  );

  // Reset area filter when warehouse changes
  useEffect(() => {
    setSelectedAreaId('all');
  }, [selectedWarehouseId]);

  // ✅ Ya no necesitamos filtrado local - V2 lo hace en el backend
  const filteredStockItems = useMemo(() => {
    if (!Array.isArray(stockItems)) {
      return [];
    }
    return stockItems;
  }, [stockItems]);

  // ✅ Convertir stock items a formato de producto individual (sin agrupar)
  // Cada ubicación se muestra como un producto separado para que coincida con la paginación
  const getGroupedProducts = useMemo(() => {
    const products = filteredStockItems.map((item) => {
      const quantity =
        typeof item.availableQuantityBase === 'number'
          ? item.availableQuantityBase
          : typeof item.quantityBase === 'string'
            ? parseFloat(item.quantityBase)
            : item.quantityBase || 0;

      return {
        productId: item.productId,
        productTitle: item.productTitle || 'Sin nombre',
        productSku: item.productSku || 'Sin SKU',
        totalStock: quantity,
        locations: 1, // Cada item es una ubicación
        warehouseName: item.warehouseName,
        areaName: item.areaName,
        items: [item],
        minStockAlert: item.minStockAlert,
      };
    });

    // ✅ Aplicar filtro de nivel de stock
    if (stockLevelFilter === 'normal') {
      return products.filter((p) => p.totalStock > 0);
    } else if (stockLevelFilter === 'no-stock') {
      return products.filter((p) => p.totalStock === 0);
    }
    return products;
  }, [filteredStockItems, stockLevelFilter]);

  // Calculate pagination
  const pagination = useMemo(() => {
    // Backend retorna directamente en el objeto
    if (!stockResponseV2 || !stockResponseV2.total) {
      return { page: 1, limit: 50, total: 0, totalPages: 0 };
    }
    return {
      page: stockResponseV2.page || 1,
      limit: stockResponseV2.limit || 50,
      total: stockResponseV2.total || 0,
      totalPages: stockResponseV2.totalPages || 0,
    };
  }, [stockResponseV2]);

  // ✅ Handlers simplificados
  const onRefresh = useCallback(() => {
    setPage(1);
    refetchStock();
  }, [refetchStock]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.page > 1) {
      setPage(pagination.page - 1);
    }
  }, [pagination.page]);

  const handleNextPage = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      setPage(pagination.page + 1);
    }
  }, [pagination.page, pagination.totalPages]);

  const getStockLevelColor = (quantityBase: number, minStockAlert: number) => {
    if (quantityBase === 0) {
      return '#EF4444';
    } // Red - Sin stock
    if (quantityBase <= minStockAlert) {
      return '#F59E0B';
    } // Orange - Stock bajo
    return '#10B981'; // Green - Stock normal
  };

  const getStockLevelText = (quantityBase: number, minStockAlert: number) => {
    if (quantityBase === 0) {
      return 'Sin Stock';
    }
    if (quantityBase <= minStockAlert) {
      return 'Stock Bajo';
    }
    return 'Stock Normal';
  };

  const handleAdjustStock = (stockItem?: StockItem) => {
    setSelectedStockItem(stockItem || null);
    setIsStockModalVisible(true);
  };

  const handleDeleteStock = (item: StockItem) => {
    Alert.alert(
      'Eliminar Stock',
      `¿Estás seguro de que deseas eliminar el stock de "${item.productTitle}" en "${item.warehouseName}"?\n\nEsta acción no se puede deshacer.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting stock:', {
                productId: item.productId,
                warehouseId: item.warehouseId,
                areaId: item.areaId,
              });

              await inventoryApi.deleteStock(item.productId, item.warehouseId, item.areaId);

              console.log('✅ Stock deleted successfully');
              Alert.alert('Éxito', 'Stock eliminado correctamente');

              // Reload stock list
              refetchStock();
            } catch (error: any) {
              console.error('❌ Error deleting stock:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message ||
                  'No se pudo eliminar el stock. Por favor, intenta nuevamente.'
              );
            }
          },
        },
      ]
    );
  };

  const handleStockSuccess = useCallback(() => {
    refetchStock();
  }, [refetchStock]);

  const handleViewStockByAreas = (productId: string, productTitle: string, productSku: string) => {
    setSelectedProductId(productId);
    setSelectedProductTitle(productTitle);
    setSelectedProductSku(productSku);
    setIsStockByAreasModalVisible(true);
  };

  const handleViewHistory = (productId: string, productTitle: string, productSku: string) => {
    setSelectedProductId(productId);
    setSelectedProductTitle(productTitle);
    setSelectedProductSku(productSku);
    setIsHistoryModalVisible(true);
  };

  const handleBulkUploadSuccess = useCallback(() => {
    refetchStock();
  }, [refetchStock]);

  if (isLoading && !stockResponseV2) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inventario</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando inventario...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventario</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.container}>
        {/* Filters Container */}
        <View style={styles.filtersWrapper}>
          {/* Stock Level Filter */}
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Nivel de Stock:</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowStockLevelPicker(true)}
            >
              <Text style={styles.filterButtonText}>
                {stockLevelFilter === 'all'
                  ? 'Todos'
                  : stockLevelFilter === 'normal'
                    ? 'Stock Normal'
                    : 'Sin Stock'}
              </Text>
              <Text style={styles.filterButtonIcon}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Warehouse Filter */}
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Almacén:</Text>
            {loadingWarehouses ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator size="small" color="#667eea" />
                <Text style={styles.pickerLoadingText}>Cargando...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.customPickerButton}
                onPress={() => setShowWarehousePicker(true)}
              >
                <Text style={styles.customPickerText}>
                  {selectedWarehouseId === 'all'
                    ? 'Todos'
                    : warehouses.find((w) => w.id === selectedWarehouseId)?.name ||
                      'Seleccionar...'}
                </Text>
                <Text style={styles.customPickerArrow}>▼</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Area Filter - Only show when a warehouse is selected */}
          {selectedWarehouseId !== 'all' && (
            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Área:</Text>
              {loadingAreas ? (
                <View style={styles.pickerLoading}>
                  <ActivityIndicator size="small" color="#667eea" />
                  <Text style={styles.pickerLoadingText}>Cargando...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.customPickerButton}
                  onPress={() => setShowAreaPicker(true)}
                >
                  <Text style={styles.customPickerText}>
                    {selectedAreaId === 'all'
                      ? 'Todas'
                      : areas.find((a: WarehouseArea) => a.id === selectedAreaId)?.name ||
                        areas.find((a: WarehouseArea) => a.id === selectedAreaId)?.code ||
                        'Seleccionar...'}
                  </Text>
                  <Text style={styles.customPickerArrow}>▼</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Custom Warehouse Picker Modal */}
        <Modal
          visible={showWarehousePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowWarehousePicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowWarehousePicker(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar Almacén</Text>
                <TouchableOpacity onPress={() => setShowWarehousePicker(false)}>
                  <Text style={styles.modalCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalList}>
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedWarehouseId === 'all' && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedWarehouseId('all');
                    setShowWarehousePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedWarehouseId === 'all' && styles.modalItemTextSelected,
                    ]}
                  >
                    Todos los almacenes
                  </Text>
                  {selectedWarehouseId === 'all' && <Text style={styles.modalItemCheck}>✓</Text>}
                </TouchableOpacity>
                {warehouses.map((warehouse) => (
                  <TouchableOpacity
                    key={warehouse.id}
                    style={[
                      styles.modalItem,
                      selectedWarehouseId === warehouse.id && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedWarehouseId(warehouse.id);
                      setShowWarehousePicker(false);
                    }}
                  >
                    <View style={styles.modalItemContent}>
                      <Text
                        style={[
                          styles.modalItemText,
                          selectedWarehouseId === warehouse.id && styles.modalItemTextSelected,
                        ]}
                      >
                        {warehouse.name}
                      </Text>
                      <Text style={styles.modalItemSubtext}>Código: {warehouse.code}</Text>
                    </View>
                    {selectedWarehouseId === warehouse.id && (
                      <Text style={styles.modalItemCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Custom Area Picker Modal */}
        <Modal
          visible={showAreaPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAreaPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAreaPicker(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar Área</Text>
                <TouchableOpacity onPress={() => setShowAreaPicker(false)}>
                  <Text style={styles.modalCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalList}>
                <TouchableOpacity
                  style={[styles.modalItem, selectedAreaId === 'all' && styles.modalItemSelected]}
                  onPress={() => {
                    setSelectedAreaId('all');
                    setShowAreaPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedAreaId === 'all' && styles.modalItemTextSelected,
                    ]}
                  >
                    Todas las áreas
                  </Text>
                  {selectedAreaId === 'all' && <Text style={styles.modalItemCheck}>✓</Text>}
                </TouchableOpacity>
                {areas.length === 0 ? (
                  <View style={styles.modalItem}>
                    <Text style={styles.modalItemSubtext}>
                      No hay áreas disponibles para este almacén
                    </Text>
                  </View>
                ) : (
                  areas.map((area: WarehouseArea) => (
                    <TouchableOpacity
                      key={area.id}
                      style={[
                        styles.modalItem,
                        selectedAreaId === area.id && styles.modalItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedAreaId(area.id);
                        setShowAreaPicker(false);
                      }}
                    >
                      <View style={styles.modalItemContent}>
                        <Text
                          style={[
                            styles.modalItemText,
                            selectedAreaId === area.id && styles.modalItemTextSelected,
                          ]}
                        >
                          {area.name || area.code || `Área ${area.id.substring(0, 8)}`}
                        </Text>
                        {area.code && area.name && (
                          <Text style={styles.modalItemSubtext}>Código: {area.code}</Text>
                        )}
                      </View>
                      {selectedAreaId === area.id && <Text style={styles.modalItemCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Stock Level Picker Modal */}
        <Modal
          visible={showStockLevelPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowStockLevelPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStockLevelPicker(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar Nivel de Stock</Text>
                <TouchableOpacity onPress={() => setShowStockLevelPicker(false)}>
                  <Text style={styles.modalCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalList}>
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    stockLevelFilter === 'normal' && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setStockLevelFilter('normal');
                    setShowStockLevelPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      stockLevelFilter === 'normal' && styles.modalItemTextSelected,
                    ]}
                  >
                    Stock Normal (con stock)
                  </Text>
                  {stockLevelFilter === 'normal' && <Text style={styles.modalItemCheck}>✓</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    stockLevelFilter === 'no-stock' && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setStockLevelFilter('no-stock');
                    setShowStockLevelPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      stockLevelFilter === 'no-stock' && styles.modalItemTextSelected,
                    ]}
                  >
                    Sin Stock
                  </Text>
                  {stockLevelFilter === 'no-stock' && <Text style={styles.modalItemCheck}>✓</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalItem, stockLevelFilter === 'all' && styles.modalItemSelected]}
                  onPress={() => {
                    setStockLevelFilter('all');
                    setShowStockLevelPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      stockLevelFilter === 'all' && styles.modalItemTextSelected,
                    ]}
                  >
                    Todos
                  </Text>
                  {stockLevelFilter === 'all' && <Text style={styles.modalItemCheck}>✓</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por producto, SKU o bodega..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {isSearchingV2 && (
            <ActivityIndicator size="small" color="#6366F1" style={styles.searchLoader} />
          )}
          {searchQuery.length > 0 && !isSearchingV2 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ✅ Indicador de búsqueda V2 optimizada */}
        {isUsingSearch && searchResultsV2 && (
          <View style={styles.searchInfoBanner}>
            <Text style={styles.searchInfoText}>
              {searchResultsV2.cached ? '⚡ Búsqueda desde caché' : '🔍 Búsqueda optimizada'}
              {' • '}
              {searchResultsV2.total} resultados
              {searchResultsV2.searchTime && ` • ${searchResultsV2.searchTime}ms`}
            </Text>
          </View>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
            <Text style={styles.statValue}>{getGroupedProducts.length}</Text>
            <Text style={styles.statLabel}>Productos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
            <Text style={styles.statValue}>{filteredStockItems.length}</Text>
            <Text style={styles.statLabel}>Ubicaciones</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.statValue}>
              {
                getGroupedProducts.filter(
                  (p) => p.totalStock > 0 && p.totalStock <= (p.minStockAlert || 0)
                ).length
              }
            </Text>
            <Text style={styles.statLabel}>Stock Bajo</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
            <Text style={styles.statValue}>
              {getGroupedProducts.filter((p) => p.totalStock === 0).length}
            </Text>
            <Text style={styles.statLabel}>Sin Stock</Text>
          </View>
        </View>

        {/* Stock List - Grouped by Product */}
        <ScrollView
          style={[styles.content, isLandscape && styles.contentLandscape]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        >
          {!isLoading && getGroupedProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>No hay registros de inventario</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No se encontraron registros con ese criterio de búsqueda'
                  : 'El inventario está vacío o no tienes permisos para verlo.\n\nSi crees que deberías tener acceso, contacta al administrador.'}
              </Text>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => navigation.navigate('PermissionsDebug')}
              >
                <Text style={styles.debugButtonText}>🔍 Ver Mis Permisos</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.stockList}>
              {getGroupedProducts.map((product, index) => (
                <View key={product.productId || index} style={styles.productCard}>
                  <View style={styles.productCardContent}>
                    <View style={styles.productHeader}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productTitle}>{product.productTitle}</Text>
                        <Text style={styles.productSku}>SKU: {product.productSku}</Text>
                      </View>
                      <View
                        style={[
                          styles.stockLevelBadge,
                          {
                            backgroundColor: getStockLevelColor(
                              product.totalStock,
                              product.minStockAlert || 0
                            ),
                          },
                        ]}
                      >
                        <Text style={styles.stockLevelText}>
                          {getStockLevelText(product.totalStock, product.minStockAlert || 0)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.productDetails}>
                      <View style={styles.productDetailRow}>
                        <View style={styles.productDetailItem}>
                          <Text style={styles.productDetailLabel}>Stock Disponible:</Text>
                          <Text style={[styles.productDetailValue, styles.stockQuantity]}>
                            {(product.totalStock || 0).toFixed(2)} unidades
                          </Text>
                        </View>
                      </View>

                      <View style={styles.productDetailRow}>
                        <View style={styles.productDetailItem}>
                          <Text style={styles.productDetailLabel}>📍 Ubicación:</Text>
                          <Text style={styles.productDetailValue}>
                            {product.warehouseName || 'Sin almacén'}
                            {product.areaName ? ` / ${product.areaName}` : ''}
                          </Text>
                        </View>
                      </View>

                      {product.minStockAlert && (
                        <View style={styles.productDetailRow}>
                          <View style={styles.productDetailItem}>
                            <Text style={styles.productDetailLabel}>Alerta Mínima:</Text>
                            <Text style={styles.productDetailValue}>
                              {product.minStockAlert} unidades
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.productActions}>
                    <TouchableOpacity
                      style={styles.viewAreasButton}
                      onPress={() =>
                        handleViewStockByAreas(
                          product.productId,
                          product.productTitle,
                          product.productSku
                        )
                      }
                    >
                      <Text style={styles.viewAreasButtonText}>📊 Ver Stock por Áreas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.viewHistoryButton}
                      onPress={() =>
                        handleViewHistory(
                          product.productId,
                          product.productTitle,
                          product.productSku
                        )
                      }
                    >
                      <Text style={styles.viewHistoryButtonText}>📜 Ver Historial</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* ✅ Paginación - Solo mostrar si NO hay búsqueda activa */}
        {!isUsingSearch && pagination.total > 0 && (
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
                {getGroupedProducts.length} de {pagination.total} ubicaciones
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
      </View>

      {/* Floating Action Buttons - Above drawer menu */}
      <View style={styles.floatingButtonsContainer} pointerEvents="box-none">
        {/* Export Button */}
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => setIsExportModalVisible(true)}
          activeOpacity={0.9}
        >
          <Ionicons name="download-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Bulk Upload Button */}
        <TouchableOpacity
          style={styles.bulkUploadButton}
          onPress={() => setIsBulkUploadModalVisible(true)}
          activeOpacity={0.9}
        >
          <Ionicons name="cloud-upload" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        visible={isStockModalVisible}
        onClose={() => setIsStockModalVisible(false)}
        onSuccess={handleStockSuccess}
        productId={selectedStockItem?.productId}
        productTitle={selectedStockItem?.productTitle}
        productSku={selectedStockItem?.productSku}
      />

      {/* Stock by Areas Modal */}
      <StockByAreasModal
        visible={isStockByAreasModalVisible}
        onClose={() => setIsStockByAreasModalVisible(false)}
        productId={selectedProductId}
        productTitle={selectedProductTitle}
        productSku={selectedProductSku}
      />

      {/* Stock Movement History Modal */}
      <StockMovementHistoryModal
        visible={isHistoryModalVisible}
        onClose={() => setIsHistoryModalVisible(false)}
        productId={selectedProductId}
        productTitle={selectedProductTitle}
        productSku={selectedProductSku}
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        visible={isBulkUploadModalVisible}
        onClose={() => setIsBulkUploadModalVisible(false)}
        onSuccess={handleBulkUploadSuccess}
      />

      {/* Stock Export Modal */}
      {effectiveSite && (
        <StockExportModal
          visible={isExportModalVisible}
          onClose={() => setIsExportModalVisible(false)}
          siteId={effectiveSite.id}
          siteName={effectiveSite.name}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 12,
    minWidth: 70,
  },
  customPickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customPickerText: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  customPickerArrow: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#64748B',
    fontWeight: '300',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalItemSelected: {
    backgroundColor: '#EEF2FF',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  modalItemTextSelected: {
    color: '#667eea',
    fontWeight: '600',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalItemCheck: {
    fontSize: 20,
    color: '#667eea',
    fontWeight: '700',
  },
  searchLoader: {
    marginRight: 8,
  },
  searchInfoBanner: {
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  searchInfoText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
    textAlign: 'center',
  },
  pickerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  pickerLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#64748B',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
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
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  adjustButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  adjustButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentLandscape: {
    paddingBottom: 20,
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
  stockList: {
    paddingHorizontal: 16,
    paddingBottom: 140,
  },
  productCard: {
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
  productCardContent: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 13,
    color: '#64748B',
  },
  stockLevelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockLevelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  productDetailRow: {
    marginBottom: 8,
  },
  productDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productDetailLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  productDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  stockQuantity: {
    color: '#667eea',
    fontSize: 15,
  },
  areaValue: {
    color: '#10B981',
    fontWeight: '700',
  },
  productActions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  viewAreasButton: {
    flex: 1,
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewAreasButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewHistoryButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewHistoryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  debugButton: {
    marginTop: 20,
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
    zIndex: 999,
    elevation: 999,
  },
  exportButton: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 999,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 999,
  },
  bulkUploadButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 999,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 999,
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
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 120,
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
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  filterButtonIcon: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 8,
  },
});

export default StockScreen;
