import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useTenantStore } from '@/store/tenant';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { StockAdjustmentModal } from '@/components/Inventory/StockAdjustmentModal';
import { StockByAreasModal } from '@/components/Inventory/StockByAreasModal';
import { StockMovementHistoryModal } from '@/components/Inventory/StockMovementHistoryModal';
import { BulkUploadModal } from '@/components/Inventory/BulkUploadModal';
import { StockExportModal } from '@/components/Inventory/StockExportModal';
import { ProductBulkUploadV2Modal } from '@/components/Inventory/ProductBulkUploadV2Modal';
import { StockFAB } from '@/components/Inventory/StockFAB';
import { inventoryApi, StockItem } from '@/services/api/inventory';
import { WarehouseArea } from '@/types/warehouses';
import { useWarehouses, useWarehouseAreas, useSearchStockV2, useStockV2 } from '@/hooks/api/useStock';
import { logger } from '@/utils/logger';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
} from '@/design-system/tokens';
import {
  Text,
  Caption,
  Button,
  Card,
  EmptyState,
  Pagination,
  Divider,
} from '@/design-system/components';

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
  const [isProductBulkUploadV2ModalVisible, setIsProductBulkUploadV2ModalVisible] = useState(false);
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

  // ✅ Debounce search query (300ms - optimizado)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

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
      logger.debug('📱 StockScreen focused - refetching stock and warehouses...');
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
              logger.info('🗑️ Deleting stock:', {
                productId: item.productId,
                warehouseId: item.warehouseId,
                areaId: item.areaId,
              });

              await inventoryApi.deleteStock(item.productId, item.warehouseId, item.areaId);

              logger.info('✅ Stock deleted successfully');
              Alert.alert('Éxito', 'Stock eliminado correctamente');

              // Reload stock list
              refetchStock();
            } catch (error: any) {
              logger.error('❌ Error deleting stock:', error);
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

  const handleProductBulkUploadV2Success = useCallback(() => {
    refetchStock();
  }, [refetchStock]);

  if (isLoading && !stockResponseV2) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <LinearGradient
            colors={[colors.primary[900], colors.primary[800]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerTop}>
              <View style={styles.headerTitleContainer}>
                <View style={styles.headerIconRow}>
                  <View style={styles.headerIconContainer}>
                    <Ionicons name="stats-chart" size={22} color={colors.neutral[0]} />
                  </View>
                  <Text style={styles.title}>Inventario</Text>
                </View>
                <Text style={styles.subtitle}>Control de stock por ubicación</Text>
              </View>
            </View>
          </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[900]} />
            <Text variant="bodyMedium" color="secondary" style={styles.loadingText}>
              Cargando inventario...
            </Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header con gradiente */}
      <LinearGradient
        colors={[colors.primary[900], colors.primary[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="stats-chart" size={22} color={colors.neutral[0]} />
              </View>
              <Text style={styles.title}>Inventario</Text>
            </View>
            <Text style={styles.subtitle}>Control de stock por ubicación</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsHeaderContainer}>
            <View style={styles.statHeaderItem}>
              <Text style={styles.statHeaderValue}>{getGroupedProducts.length}</Text>
              <Text style={styles.statHeaderLabel}>Productos</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por producto, SKU o bodega..."
              placeholderTextColor={colors.neutral[400]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
        {/* Filters Container */}
        <View style={styles.filtersWrapper}>
          {/* Stock Level Filter */}
          <View style={styles.filterContainer}>
            <Text variant="labelMedium" color="secondary" style={styles.filterLabel}>Nivel de Stock:</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowStockLevelPicker(true)}
            >
              <Text variant="bodyMedium" color="primary" style={styles.filterButtonText}>
                {stockLevelFilter === 'all'
                  ? 'Todos'
                  : stockLevelFilter === 'normal'
                    ? 'Stock Normal'
                    : 'Sin Stock'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.icon.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Warehouse Filter */}
          <View style={styles.filterContainer}>
            <Text variant="labelMedium" color="secondary" style={styles.filterLabel}>Almacén:</Text>
            {loadingWarehouses ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator size="small" color={colors.primary[900]} />
                <Caption color="tertiary" style={styles.pickerLoadingText}>Cargando...</Caption>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.customPickerButton}
                onPress={() => setShowWarehousePicker(true)}
              >
                <Text variant="bodyMedium" color="primary" style={styles.customPickerText}>
                  {selectedWarehouseId === 'all'
                    ? 'Todos'
                    : warehouses.find((w) => w.id === selectedWarehouseId)?.name ||
                      'Seleccionar...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.icon.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Area Filter - Only show when a warehouse is selected */}
          {selectedWarehouseId !== 'all' && (
            <View style={styles.filterContainer}>
              <Text variant="labelMedium" color="secondary" style={styles.filterLabel}>Área:</Text>
              {loadingAreas ? (
                <View style={styles.pickerLoading}>
                  <ActivityIndicator size="small" color={colors.primary[900]} />
                  <Caption color="tertiary" style={styles.pickerLoadingText}>Cargando...</Caption>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.customPickerButton}
                  onPress={() => setShowAreaPicker(true)}
                >
                  <Text variant="bodyMedium" color="primary" style={styles.customPickerText}>
                    {selectedAreaId === 'all'
                      ? 'Todas'
                      : areas.find((a: WarehouseArea) => a.id === selectedAreaId)?.name ||
                        areas.find((a: WarehouseArea) => a.id === selectedAreaId)?.code ||
                        'Seleccionar...'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.icon.tertiary} />
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
                <Text variant="titleMedium" color="primary">Seleccionar Almacén</Text>
                <TouchableOpacity onPress={() => setShowWarehousePicker(false)}>
                  <Ionicons name="close" size={24} color={colors.icon.secondary} />
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
                    variant="bodyMedium"
                    color={selectedWarehouseId === 'all' ? colors.accent[600] : 'primary'}
                  >
                    Todos los almacenes
                  </Text>
                  {selectedWarehouseId === 'all' && (
                    <Ionicons name="checkmark" size={20} color={colors.accent[600]} />
                  )}
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
                        variant="bodyMedium"
                        color={selectedWarehouseId === warehouse.id ? colors.accent[600] : 'primary'}
                      >
                        {warehouse.name}
                      </Text>
                      <Caption color="tertiary">Código: {warehouse.code}</Caption>
                    </View>
                    {selectedWarehouseId === warehouse.id && (
                      <Ionicons name="checkmark" size={20} color={colors.accent[600]} />
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
                <Text variant="titleMedium" color="primary">Seleccionar Área</Text>
                <TouchableOpacity onPress={() => setShowAreaPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.icon.secondary} />
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
                    variant="bodyMedium"
                    color={selectedAreaId === 'all' ? colors.accent[600] : 'primary'}
                  >
                    Todas las áreas
                  </Text>
                  {selectedAreaId === 'all' && (
                    <Ionicons name="checkmark" size={20} color={colors.accent[600]} />
                  )}
                </TouchableOpacity>
                {areas.length === 0 ? (
                  <View style={styles.modalItem}>
                    <Caption color="tertiary">
                      No hay áreas disponibles para este almacén
                    </Caption>
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
                          variant="bodyMedium"
                          color={selectedAreaId === area.id ? colors.accent[600] : 'primary'}
                        >
                          {area.name || area.code || `Área ${area.id.substring(0, 8)}`}
                        </Text>
                        {area.code && area.name && (
                          <Caption color="tertiary">Código: {area.code}</Caption>
                        )}
                      </View>
                      {selectedAreaId === area.id && (
                        <Ionicons name="checkmark" size={20} color={colors.accent[600]} />
                      )}
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
                <Text variant="titleMedium" color="primary">Seleccionar Nivel de Stock</Text>
                <TouchableOpacity onPress={() => setShowStockLevelPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.icon.secondary} />
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
                    variant="bodyMedium"
                    color={stockLevelFilter === 'normal' ? colors.accent[600] : 'primary'}
                  >
                    Stock Normal (con stock)
                  </Text>
                  {stockLevelFilter === 'normal' && (
                    <Ionicons name="checkmark" size={20} color={colors.accent[600]} />
                  )}
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
                    variant="bodyMedium"
                    color={stockLevelFilter === 'no-stock' ? colors.accent[600] : 'primary'}
                  >
                    Sin Stock
                  </Text>
                  {stockLevelFilter === 'no-stock' && (
                    <Ionicons name="checkmark" size={20} color={colors.accent[600]} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalItem, stockLevelFilter === 'all' && styles.modalItemSelected]}
                  onPress={() => {
                    setStockLevelFilter('all');
                    setShowStockLevelPicker(false);
                  }}
                >
                  <Text
                    variant="bodyMedium"
                    color={stockLevelFilter === 'all' ? colors.accent[600] : 'primary'}
                  >
                    Todos
                  </Text>
                  {stockLevelFilter === 'all' && (
                    <Ionicons name="checkmark" size={20} color={colors.accent[600]} />
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ✅ Indicador de búsqueda V2 optimizada */}
        {isUsingSearch && searchResultsV2 && (
          <View style={styles.searchInfoBanner}>
            <Text variant="labelSmall" color={colors.accent[700]} style={styles.searchInfoText}>
              {searchResultsV2.cached ? '⚡ Búsqueda desde caché' : '🔍 Búsqueda optimizada'}
              {' • '}
              {searchResultsV2.total} resultados
              {searchResultsV2.searchTime && ` • ${searchResultsV2.searchTime}ms`}
            </Text>
          </View>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.accent[50] }]}>
            <Text variant="numericMedium" color="primary">{getGroupedProducts.length}</Text>
            <Caption color="tertiary">Productos</Caption>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success[50] }]}>
            <Text variant="numericMedium" color="primary">{filteredStockItems.length}</Text>
            <Caption color="tertiary">Ubicaciones</Caption>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warning[50] }]}>
            <Text variant="numericMedium" color="primary">
              {
                getGroupedProducts.filter(
                  (p) => p.totalStock > 0 && p.totalStock <= (p.minStockAlert || 0)
                ).length
              }
            </Text>
            <Caption color="tertiary">Stock Bajo</Caption>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.danger[50] }]}>
            <Text variant="numericMedium" color="primary">
              {getGroupedProducts.filter((p) => p.totalStock === 0).length}
            </Text>
            <Caption color="tertiary">Sin Stock</Caption>
          </View>
        </View>

        {/* Stock List - Grouped by Product */}
        <ScrollView
          style={[styles.content, isLandscape && styles.contentLandscape]}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary[900]}
              colors={[colors.primary[900]]}
            />
          }
        >
          {!isLoading && getGroupedProducts.length === 0 ? (
            <EmptyState
              emoji="📊"
              title="No hay registros de inventario"
              description={
                searchQuery
                  ? 'No se encontraron registros con ese criterio de búsqueda'
                  : 'El inventario está vacío o no tienes permisos para verlo.'
              }
              actionLabel={!searchQuery ? '🔍 Ver Mis Permisos' : undefined}
              onAction={!searchQuery ? () => navigation.navigate('PermissionsDebug') : undefined}
            />
          ) : (
            <View style={styles.stockList}>
              {getGroupedProducts.map((product, index) => (
                <Card key={product.productId || index} variant="outlined" padding="none" style={styles.productCard}>
                  <View style={styles.productCardContent}>
                    <View style={styles.productHeader}>
                      <View style={styles.productInfo}>
                        <Text variant="titleSmall" color="primary" numberOfLines={2}>
                          {product.productTitle}
                        </Text>
                        <Caption color="tertiary">SKU: {product.productSku}</Caption>
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
                        <Text variant="labelSmall" color={colors.text.inverse}>
                          {getStockLevelText(product.totalStock, product.minStockAlert || 0)}
                        </Text>
                      </View>
                    </View>

                    <Divider spacing="none" style={styles.productDivider} />

                    <View style={styles.productDetails}>
                      <View style={styles.productDetailRow}>
                        <Caption color="tertiary">Stock Disponible:</Caption>
                        <Text variant="numericMedium" color={colors.accent[600]}>
                          {(product.totalStock || 0).toFixed(2)} unidades
                        </Text>
                      </View>

                      <View style={styles.productDetailRow}>
                        <Caption color="tertiary">📍 Ubicación:</Caption>
                        <Text variant="labelMedium" color="primary">
                          {product.warehouseName || 'Sin almacén'}
                          {product.areaName ? ` / ${product.areaName}` : ''}
                        </Text>
                      </View>

                      {product.minStockAlert && (
                        <View style={styles.productDetailRow}>
                          <Caption color="tertiary">Alerta Mínima:</Caption>
                          <Text variant="labelMedium" color="primary">
                            {product.minStockAlert} unidades
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.productActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.viewAreasButton]}
                      onPress={() =>
                        handleViewStockByAreas(
                          product.productId,
                          product.productTitle,
                          product.productSku
                        )
                      }
                    >
                      <Text variant="labelMedium" color={colors.text.inverse}>📊 Stock por Áreas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.viewHistoryButton]}
                      onPress={() =>
                        handleViewHistory(
                          product.productId,
                          product.productTitle,
                          product.productSku
                        )
                      }
                    >
                      <Text variant="labelMedium" color={colors.text.inverse}>📜 Historial</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>

        {/* ✅ Paginación - Solo mostrar si NO hay búsqueda activa */}
        {!isUsingSearch && pagination.total > 0 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={setPage}
            loading={isLoading}
          />
        )}
      </View>

      {/* Floating Action Button with animations */}
      <StockFAB
        onDownloadTemplate={() => setIsProductBulkUploadV2ModalVisible(true)}
        onUploadFile={() => setIsBulkUploadModalVisible(true)}
        onExportStock={() => setIsExportModalVisible(true)}
      />

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

      {/* Product Bulk Upload V2 Modal */}
      <ProductBulkUploadV2Modal
        visible={isProductBulkUploadV2ModalVisible}
        onClose={() => setIsProductBulkUploadV2ModalVisible(false)}
        onSuccess={handleProductBulkUploadV2Success}
      />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  // Header con gradiente
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  statsHeaderContainer: {
    alignItems: 'flex-end',
  },
  statHeaderItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  statHeaderValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  statHeaderLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.neutral[800],
  },
  clearButton: {
    padding: spacing[1],
  },

  contentWrapper: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
  },

  // Filters
  filtersWrapper: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[3],
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    marginRight: spacing[3],
    minWidth: 90,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterButtonText: {
    flex: 1,
  },
  customPickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  customPickerText: {
    flex: 1,
  },
  pickerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  pickerLoadingText: {
    marginLeft: spacing[2],
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.secondary,
  },
  modalItemSelected: {
    backgroundColor: colors.accent[50],
  },
  modalItemContent: {
    flex: 1,
  },

  // Search Section
  searchSection: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  searchInfoBanner: {
    backgroundColor: colors.accent[50],
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent[200],
  },
  searchInfoText: {
    textAlign: 'center',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  statCard: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },

  // Content
  content: {
    flex: 1,
  },
  contentLandscape: {
    paddingBottom: spacing[5],
  },
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[24],
  },

  // Stock List
  stockList: {
    gap: spacing[3],
  },
  productCard: {
    marginBottom: spacing[3],
  },
  productCardContent: {
    padding: spacing[4],
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  productInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  stockLevelBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  productDivider: {
    marginVertical: spacing[3],
  },
  productDetails: {
    gap: spacing[2],
  },
  productDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Action Buttons
  productActions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAreasButton: {
    backgroundColor: colors.accent[600],
  },
  viewHistoryButton: {
    backgroundColor: colors.success[600],
  },
});

export default StockScreen;
