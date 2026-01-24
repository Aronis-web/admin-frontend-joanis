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

interface StockScreenProps {
  navigation: any;
}

export const StockScreen: React.FC<StockScreenProps> = ({ navigation }) => {
  const { user, logout, currentSite, currentCompany } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStockItems, setFilteredStockItems] = useState<StockItem[]>([]);
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);

  // New modals state
  const [isStockByAreasModalVisible, setIsStockByAreasModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isBulkUploadModalVisible, setIsBulkUploadModalVisible] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductTitle, setSelectedProductTitle] = useState<string>('');
  const [selectedProductSku, setSelectedProductSku] = useState<string>('');

  // Warehouse filter state
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [showWarehousePicker, setShowWarehousePicker] = useState(false);

  // Area filter state
  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Get effective site and company (prefer tenant store, fallback to auth store)
  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  // Auto-reload stock when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 StockScreen focused - reloading stock and warehouses...');
      loadWarehouses();
      loadStock();
    }, [])
  );

  // Reload warehouses and stock when site/company changes
  useEffect(() => {
    if (effectiveSite?.id || effectiveCompany?.id) {
      console.log('🔄 Site/Company changed, reloading warehouses and stock...');
      loadWarehouses();
      loadStock();
    }
  }, [effectiveSite?.id, effectiveCompany?.id]);

  useEffect(() => {
    // Reload stock when warehouse filter changes
    loadStock();
    // Reset area filter when warehouse changes
    setSelectedAreaId('all');
  }, [selectedWarehouseId]);

  useEffect(() => {
    // Reload stock when area filter changes
    loadStock();
  }, [selectedAreaId]);

  // Load areas when warehouse is selected
  useEffect(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'all') {
      loadAreasForWarehouse(selectedWarehouseId);
    } else {
      setAreas([]);
      setSelectedAreaId('all');
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (!Array.isArray(stockItems)) {
      setFilteredStockItems([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredStockItems(stockItems);
    } else {
      const filtered = stockItems.filter(
        (item) =>
          (item.productTitle && item.productTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.productSku && item.productSku.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.warehouseName && item.warehouseName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredStockItems(filtered);
    }
  }, [searchQuery, stockItems]);

  // Group stock items by product
  const getGroupedProducts = () => {
    const grouped: { [key: string]: StockItem[] } = {};

    filteredStockItems.forEach((item) => {
      if (!grouped[item.productId]) {
        grouped[item.productId] = [];
      }
      grouped[item.productId].push(item);
    });

    return Object.entries(grouped).map(([productId, items]) => ({
      productId,
      productTitle: items[0].productTitle || 'Sin nombre',
      productSku: items[0].productSku || 'Sin SKU',
      totalStock: items.reduce((sum, item) => {
        // Use availableQuantityBase (stock disponible) instead of quantityBase (stock total)
        const quantity = typeof item.availableQuantityBase === 'number'
          ? item.availableQuantityBase
          : (typeof item.quantityBase === 'string'
            ? parseFloat(item.quantityBase)
            : (item.quantityBase || 0));
        return sum + quantity;
      }, 0),
      locations: items.length,
      items,
      minStockAlert: items[0].minStockAlert,
    }));
  };

  const loadWarehouses = async () => {
    try {
      setLoadingWarehouses(true);

      console.log('🔍 Loading warehouses...');
      console.log('🏢 Current site:', effectiveSite?.name, '(ID:', effectiveSite?.id, ')');
      console.log('🏢 Current company:', effectiveCompany?.name, '(ID:', effectiveCompany?.id, ')');

      // Use warehousesApi instead of inventoryApi to avoid admin permission requirements
      // This API already filters by company and site based on headers
      const warehousesData = await warehousesApi.getWarehouses(
        effectiveCompany?.id,
        effectiveSite?.id
      );

      console.log('📦 Raw warehouses data received:', warehousesData?.length || 0, 'warehouses');
      console.log('📦 All warehouses:', warehousesData?.map(w => ({
        id: w.id,
        name: w.name,
        code: w.code,
        siteId: w.siteId,
        isActive: w.isActive
      })));

      // Filter active warehouses from current site
      // The API should already filter by site, but we double-check here
      let filteredWarehouses = warehousesData.filter((w) => w.isActive !== false);
      console.log('✅ After isActive filter:', filteredWarehouses.length, 'warehouses');

      // CRITICAL: Additional filter by current site to ensure only current site warehouses are shown
      if (effectiveSite?.id) {
        const beforeCount = filteredWarehouses.length;
        filteredWarehouses = filteredWarehouses.filter((w) => w.siteId === effectiveSite.id);
        console.log('🎯 After site filter:', filteredWarehouses.length, 'warehouses (removed', beforeCount - filteredWarehouses.length, 'from other sites)');
      } else {
        console.warn('⚠️ No effective site ID found! Cannot filter warehouses by site.');
      }

      console.log('🏢 Final warehouses to display:', filteredWarehouses.map(w => ({
        id: w.id,
        name: w.name,
        code: w.code,
        siteId: w.siteId
      })));

      setWarehouses(filteredWarehouses);
    } catch (error: any) {
      console.error('❌ Error loading warehouses:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setWarehouses([]);
      // Don't show alert, just log the error
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const loadAreasForWarehouse = async (warehouseId: string) => {
    if (!warehouseId || warehouseId === 'all') {
      console.log('⚠️ No warehouse ID provided or "all" selected, clearing areas');
      setAreas([]);
      return;
    }

    try {
      setLoadingAreas(true);
      console.log('🔄 Loading areas for warehouse:', warehouseId);

      // Find the warehouse in the warehouses array
      const selectedWarehouse = warehouses.find(w => w.id === warehouseId);

      if (selectedWarehouse && selectedWarehouse.areas && selectedWarehouse.areas.length > 0) {
        console.log('✅ Warehouse found in cache:', selectedWarehouse.name);
        console.log('📦 Warehouse has areas:', selectedWarehouse.areas.length);

        const areasData = selectedWarehouse.areas || [];
        setAreas(areasData);
        console.log('📍 Available areas loaded from warehouse:', areasData.length);
      } else {
        console.log('⚠️ Warehouse not found in cache or no areas, fetching from API...');

        // Fallback: fetch from API if warehouse not in cache
        const areasData = await warehouseAreasApi.getWarehouseAreas(warehouseId);

        console.log('✅ Areas received from API:', areasData?.length || 0);
        setAreas(areasData || []);
        console.log('📍 Available areas loaded from API:', areasData?.length || 0);
      }
    } catch (error: any) {
      console.error('❌ Error loading areas:', error);
      setAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  };

  const loadStock = async () => {
    try {
      setLoading(true);

      // Build params with available context (use effective site/company)
      const params: { siteId?: string; warehouseId?: string; areaId?: string } = {};
      if (effectiveSite?.id) {
        params.siteId = effectiveSite.id;
        console.log(`📍 Loading stock for site: ${effectiveSite.name} (${effectiveSite.id})`);
      }
      // Only add warehouseId if a specific warehouse is selected (not "all")
      if (selectedWarehouseId !== 'all') {
        params.warehouseId = selectedWarehouseId;
        console.log(`🏢 Filtering by warehouse: ${selectedWarehouseId}`);
      }
      // Only add areaId if a specific area is selected (not "all")
      if (selectedAreaId !== 'all') {
        params.areaId = selectedAreaId;
        console.log(`📍 Filtering by area: ${selectedAreaId}`);
      }

      console.log('📦 Loading stock with params:', params);
      const stockItemsResponse = await inventoryApi.getAllStock(params);

      // Transform backend response to match our StockItem interface
      const transformedStockItems: StockItem[] = (stockItemsResponse || []).map((item) => {
        console.log('📦 Stock item from backend:', {
          productTitle: item.product?.title,
          warehouseName: item.warehouse?.name,
          areaId: item.areaId,
          areaObject: item.area,
          areaName: item.area?.name,
          areaCode: item.area?.code,
          quantityBase: item.quantityBase,
          quantityBaseType: typeof item.quantityBase,
        });

        // Convert quantityBase to number if it's a string
        const quantityBase = typeof item.quantityBase === 'string'
          ? parseFloat(item.quantityBase)
          : item.quantityBase;

        return {
          productId: item.productId,
          warehouseId: item.warehouseId,
          areaId: item.areaId || undefined,
          quantityBase: quantityBase,
          reservedQuantityBase: item.reservedQuantityBase,
          availableQuantityBase: item.availableQuantityBase,
          updatedAt: item.updatedAt,
          productTitle: item.product?.title,
          productSku: item.product?.sku,
          warehouseName: item.warehouse?.name,
          areaName: item.area?.name || item.area?.code || (item.areaId ? `Área ${item.areaId.substring(0, 8)}` : undefined),
        };
      });

      console.log('📦 Loaded stock items:', transformedStockItems.length);
      setStockItems(transformedStockItems);
      setFilteredStockItems(transformedStockItems);
    } catch (error: any) {
      console.error('Error loading stock:', error);
      const errorMessage = error.response?.data?.message || error.message || 'No se pudo cargar el inventario';

      // If it's a 403 error, show a more helpful message
      if (error.response?.status === 403) {
        const missingPermissions = error.response?.data?.message?.match(/Missing: (.+)/)?.[1] || 'stock.read';

        Alert.alert(
          'Permisos Insuficientes',
          `No tienes los permisos necesarios para ver el inventario.\n\n` +
          `Permisos faltantes: ${missingPermissions}\n\n` +
          `Contacta al administrador del sistema para que te asigne uno de estos permisos:\n` +
          `• stock.read (para ver stock filtrado)\n` +
          `• inventory.read (para ver todo el inventario)`,
          [
            {
              text: 'Ir a Debug de Permisos',
              onPress: () => navigation.navigate('PermissionsDebug'),
            },
            { text: 'Cerrar', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }

      setStockItems([]);
      setFilteredStockItems([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStock();
    setRefreshing(false);
  };

  const getStockLevelColor = (quantityBase: number, minStockAlert: number) => {
    if (quantityBase === 0) return '#EF4444'; // Red - Sin stock
    if (quantityBase <= minStockAlert) return '#F59E0B'; // Orange - Stock bajo
    return '#10B981'; // Green - Stock normal
  };

  const getStockLevelText = (quantityBase: number, minStockAlert: number) => {
    if (quantityBase === 0) return 'Sin Stock';
    if (quantityBase <= minStockAlert) return 'Stock Bajo';
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

              await inventoryApi.deleteStock(
                item.productId,
                item.warehouseId,
                item.areaId
              );

              console.log('✅ Stock deleted successfully');
              Alert.alert('Éxito', 'Stock eliminado correctamente');

              // Reload stock list
              loadStock();
            } catch (error: any) {
              console.error('❌ Error deleting stock:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo eliminar el stock. Por favor, intenta nuevamente.'
              );
            }
          },
        },
      ]
    );
  };

  const handleStockSuccess = () => {
    loadStock();
  };

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

  const handleBulkUploadSuccess = () => {
    loadStock();
  };

  if (loading) {
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
                  : warehouses.find((w) => w.id === selectedWarehouseId)?.name || 'Seleccionar...'}
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
                    : areas.find((a) => a.id === selectedAreaId)?.name ||
                      areas.find((a) => a.id === selectedAreaId)?.code ||
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
                {selectedWarehouseId === 'all' && (
                  <Text style={styles.modalItemCheck}>✓</Text>
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
                      style={[
                        styles.modalItemText,
                        selectedWarehouseId === warehouse.id && styles.modalItemTextSelected,
                      ]}
                    >
                      {warehouse.name}
                    </Text>
                    <Text style={styles.modalItemSubtext}>
                      Código: {warehouse.code}
                    </Text>
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
                style={[
                  styles.modalItem,
                  selectedAreaId === 'all' && styles.modalItemSelected,
                ]}
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
                {selectedAreaId === 'all' && (
                  <Text style={styles.modalItemCheck}>✓</Text>
                )}
              </TouchableOpacity>
              {areas.length === 0 ? (
                <View style={styles.modalItem}>
                  <Text style={styles.modalItemSubtext}>
                    No hay áreas disponibles para este almacén
                  </Text>
                </View>
              ) : (
                areas.map((area) => (
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
                        <Text style={styles.modalItemSubtext}>
                          Código: {area.code}
                        </Text>
                      )}
                    </View>
                    {selectedAreaId === area.id && (
                      <Text style={styles.modalItemCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
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
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
          <Text style={styles.statValue}>{getGroupedProducts().length}</Text>
          <Text style={styles.statLabel}>Productos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
          <Text style={styles.statValue}>{filteredStockItems.length}</Text>
          <Text style={styles.statLabel}>Ubicaciones</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.statValue}>
            {getGroupedProducts().filter(p => p.totalStock > 0 && p.totalStock <= (p.minStockAlert || 0)).length}
          </Text>
          <Text style={styles.statLabel}>Stock Bajo</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
          <Text style={styles.statValue}>
            {getGroupedProducts().filter(p => p.totalStock === 0).length}
          </Text>
          <Text style={styles.statLabel}>Sin Stock</Text>
        </View>
      </View>



      {/* Stock List - Grouped by Product */}
      <ScrollView
        style={[styles.content, isLandscape && styles.contentLandscape]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!loading && getGroupedProducts().length === 0 ? (
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
            {getGroupedProducts().map((product, index) => (
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
                        { backgroundColor: getStockLevelColor(product.totalStock, product.minStockAlert || 0) },
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
                        <Text style={styles.productDetailLabel}>📍 Ubicaciones:</Text>
                        <Text style={styles.productDetailValue}>
                          {product.locations} almacén(es)/área(s)
                        </Text>
                      </View>
                    </View>

                    {product.minStockAlert && (
                      <View style={styles.productDetailRow}>
                        <View style={styles.productDetailItem}>
                          <Text style={styles.productDetailLabel}>Alerta Mínima:</Text>
                          <Text style={styles.productDetailValue}>{product.minStockAlert} unidades</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.productActions}>
                  <TouchableOpacity
                    style={styles.viewAreasButton}
                    onPress={() => handleViewStockByAreas(product.productId, product.productTitle, product.productSku)}
                  >
                    <Text style={styles.viewAreasButtonText}>📊 Ver Stock por Áreas</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewHistoryButton}
                    onPress={() => handleViewHistory(product.productId, product.productTitle, product.productSku)}
                  >
                    <Text style={styles.viewHistoryButtonText}>📜 Ver Historial</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
});

export default StockScreen;

