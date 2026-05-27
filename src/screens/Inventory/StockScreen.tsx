import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { BulkUploadModal } from '@/components/Inventory/BulkUploadModal';
import { ProductBulkUploadV2Modal } from '@/components/Inventory/ProductBulkUploadV2Modal';
import { StockExportModal } from '@/components/Inventory/StockExportModal';
import { StockFAB } from '@/components/Inventory/StockFAB';
import { StockProductDetailModal } from '@/components/Inventory/StockProductDetailModal';
import {
  ProductStockSortBy,
  ProductStockStatus,
  ProductStockSummaryItem,
} from '@/services/api/inventory';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { WarehouseArea } from '@/types/warehouses';
import { useProductsStock, useWarehouseAreas, useWarehouses } from '@/hooks/api/useStock';
import { logger } from '@/utils/logger';
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';
import { Caption, Card, Divider, EmptyState, Pagination, Text } from '@/design-system/components';

interface StockScreenProps {
  navigation: any;
}

type PickerType = 'warehouse' | 'area' | 'stockStatus' | 'sortBy' | null;

const STOCK_STATUS_OPTIONS: Array<{ value: 'all' | ProductStockStatus; label: string; helper: string }> = [
  { value: 'all', label: 'Todos', helper: 'Respeta la regla por defecto del backend' },
  { value: 'with_stock', label: 'Con stock físico', helper: 'Stock total mayor a cero' },
  { value: 'without_stock', label: 'Sin stock físico', helper: 'Stock total igual a cero' },
  { value: 'available', label: 'Disponible', helper: 'Disponible mayor a cero' },
  { value: 'reserved', label: 'Reservado', helper: 'Reservado mayor a cero' },
  { value: 'low_stock', label: 'Stock bajo', helper: 'Disponible menor o igual al mínimo' },
  { value: 'negative', label: 'Negativo', helper: 'Disponible negativo' },
];

const SORT_OPTIONS: Array<{ value: ProductStockSortBy; label: string }> = [
  { value: 'name', label: 'Nombre' },
  { value: 'sku', label: 'SKU' },
  { value: 'totalStock', label: 'Stock total' },
  { value: 'reservedStock', label: 'Stock reservado' },
  { value: 'availableStock', label: 'Stock disponible' },
  { value: 'updatedAt', label: 'Actualización' },
];

const limit = 50;

const formatQuantity = (value?: number) => {
  const numericValue = Number(value || 0);
  return Number.isInteger(numericValue)
    ? numericValue.toString()
    : numericValue.toLocaleString('es-PE', { maximumFractionDigits: 2 });
};

const getProductStockState = (product: ProductStockSummaryItem) => {
  if (product.availableStock < 0) {
    return { label: 'Negativo', color: colors.danger[700], icon: 'trending-down' as const };
  }
  if (product.totalStock === 0) {
    return { label: 'Sin stock', color: colors.danger[600], icon: 'alert-circle' as const };
  }
  if (product.minStockAlert && product.minStockAlert > 0 && product.availableStock <= product.minStockAlert) {
    return { label: 'Stock bajo', color: colors.warning[600], icon: 'warning' as const };
  }
  if (product.reservedStock > 0 && product.availableStock <= 0) {
    return { label: 'Reservado', color: colors.accent[700], icon: 'lock-closed' as const };
  }
  return { label: 'Disponible', color: colors.success[600], icon: 'checkmark-circle' as const };
};

export const StockScreen: React.FC<StockScreenProps> = ({ navigation }) => {
  const { currentSite, currentCompany } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [stockStatus, setStockStatus] = useState<'all' | ProductStockStatus>('available');
  const [sortBy, setSortBy] = useState<ProductStockSortBy>('availableStock');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [includeZeroStock, setIncludeZeroStock] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerType>(null);

  const [selectedDetailProduct, setSelectedDetailProduct] = useState<ProductStockSummaryItem | null>(null);
  const [isBulkUploadModalVisible, setIsBulkUploadModalVisible] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [isProductBulkUploadV2ModalVisible, setIsProductBulkUploadV2ModalVisible] = useState(false);

  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  const {
    data: warehouses = [],
    isLoading: loadingWarehouses,
    refetch: refetchWarehouses,
  } = useWarehouses(effectiveCompany?.id, effectiveSite?.id);

  const { data: areas = [], isLoading: loadingAreas } = useWarehouseAreas(
    selectedWarehouseId,
    selectedWarehouseId !== 'all'
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setSelectedAreaId('all');
    setPage(1);
  }, [selectedWarehouseId]);

  useEffect(() => {
    setPage(1);
  }, [selectedAreaId, stockStatus, sortBy, sortOrder, includeZeroStock]);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      q: debouncedSearchQuery || undefined,
      warehouseId: selectedWarehouseId !== 'all' ? selectedWarehouseId : undefined,
      areaId: selectedAreaId !== 'all' ? selectedAreaId : undefined,
      stockStatus: stockStatus !== 'all' ? stockStatus : undefined,
      includeZeroStock: includeZeroStock || stockStatus === 'without_stock' ? true : undefined,
      sortBy,
      sortOrder,
    }),
    [
      page,
      debouncedSearchQuery,
      selectedWarehouseId,
      selectedAreaId,
      stockStatus,
      includeZeroStock,
      sortBy,
      sortOrder,
    ]
  );

  const {
    data: stockResponse,
    isLoading,
    isRefetching,
    refetch,
  } = useProductsStock(queryParams);

  const products = stockResponse?.data || [];
  const meta = stockResponse?.meta || {
    page: 1,
    limit,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  const pageStats = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        acc.totalStock += Number(product.totalStock || 0);
        acc.reservedStock += Number(product.reservedStock || 0);
        acc.availableStock += Number(product.availableStock || 0);
        if (product.minStockAlert && product.minStockAlert > 0 && product.availableStock <= product.minStockAlert) {
          acc.lowStock += 1;
        }
        return acc;
      },
      { totalStock: 0, reservedStock: 0, availableStock: 0, lowStock: 0 }
    );
  }, [products]);

  useFocusEffect(
    useCallback(() => {
      logger.debug('StockScreen focused - refetching consolidated inventory');
      void refetchWarehouses();
      void refetch();
    }, [refetch, refetchWarehouses])
  );

  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);
  const selectedArea = areas.find((area: WarehouseArea) => area.id === selectedAreaId);
  const selectedStatus = STOCK_STATUS_OPTIONS.find((option) => option.value === stockStatus);
  const selectedSort = SORT_OPTIONS.find((option) => option.value === sortBy);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const renderPickerModal = () => {
    const close = () => setActivePicker(null);

    return (
      <Modal visible={!!activePicker} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={close}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleMedium" color="primary">
                {activePicker === 'warehouse'
                  ? 'Seleccionar almacén'
                  : activePicker === 'area'
                    ? 'Seleccionar área'
                    : activePicker === 'stockStatus'
                      ? 'Estado de stock'
                      : 'Ordenar por'}
              </Text>
              <TouchableOpacity onPress={close}>
                <Ionicons name="close" size={24} color={colors.icon.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {activePicker === 'warehouse' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalItem, selectedWarehouseId === 'all' && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedWarehouseId('all');
                      close();
                    }}
                  >
                    <Text variant="bodyMedium" color="primary">Todos los almacenes</Text>
                    {selectedWarehouseId === 'all' && <Ionicons name="checkmark" size={20} color={colors.accent[600]} />}
                  </TouchableOpacity>
                  {warehouses.map((warehouse) => (
                    <TouchableOpacity
                      key={warehouse.id}
                      style={[styles.modalItem, selectedWarehouseId === warehouse.id && styles.modalItemSelected]}
                      onPress={() => {
                        setSelectedWarehouseId(warehouse.id);
                        close();
                      }}
                    >
                      <View style={styles.modalItemContent}>
                        <Text variant="bodyMedium" color="primary">{warehouse.name}</Text>
                        <Caption color="tertiary">Código: {warehouse.code}</Caption>
                      </View>
                      {selectedWarehouseId === warehouse.id && <Ionicons name="checkmark" size={20} color={colors.accent[600]} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {activePicker === 'area' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalItem, selectedAreaId === 'all' && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedAreaId('all');
                      close();
                    }}
                  >
                    <Text variant="bodyMedium" color="primary">Todas las áreas</Text>
                    {selectedAreaId === 'all' && <Ionicons name="checkmark" size={20} color={colors.accent[600]} />}
                  </TouchableOpacity>
                  {areas.length === 0 ? (
                    <View style={styles.modalItem}>
                      <Caption color="tertiary">No hay áreas disponibles para este almacén.</Caption>
                    </View>
                  ) : (
                    areas.map((area: WarehouseArea) => (
                      <TouchableOpacity
                        key={area.id}
                        style={[styles.modalItem, selectedAreaId === area.id && styles.modalItemSelected]}
                        onPress={() => {
                          setSelectedAreaId(area.id);
                          close();
                        }}
                      >
                        <View style={styles.modalItemContent}>
                          <Text variant="bodyMedium" color="primary">
                            {area.name || area.code || `Área ${area.id.substring(0, 8)}`}
                          </Text>
                          {!!area.code && <Caption color="tertiary">Código: {area.code}</Caption>}
                        </View>
                        {selectedAreaId === area.id && <Ionicons name="checkmark" size={20} color={colors.accent[600]} />}
                      </TouchableOpacity>
                    ))
                  )}
                </>
              )}

              {activePicker === 'stockStatus' &&
                STOCK_STATUS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.modalItem, stockStatus === option.value && styles.modalItemSelected]}
                    onPress={() => {
                      setStockStatus(option.value);
                      close();
                    }}
                  >
                    <View style={styles.modalItemContent}>
                      <Text variant="bodyMedium" color="primary">{option.label}</Text>
                      <Caption color="tertiary">{option.helper}</Caption>
                    </View>
                    {stockStatus === option.value && <Ionicons name="checkmark" size={20} color={colors.accent[600]} />}
                  </TouchableOpacity>
                ))}

              {activePicker === 'sortBy' &&
                SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.modalItem, sortBy === option.value && styles.modalItemSelected]}
                    onPress={() => {
                      setSortBy(option.value);
                      close();
                    }}
                  >
                    <Text variant="bodyMedium" color="primary">{option.label}</Text>
                    {sortBy === option.value && <Ionicons name="checkmark" size={20} color={colors.accent[600]} />}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderProductCard = (product: ProductStockSummaryItem) => {
    const stockState = getProductStockState(product);
    const warehousesCount = product.warehouses?.length || 0;
    const areasCount = product.warehouses?.reduce((sum, warehouse) => sum + (warehouse.areas?.length || 0), 0) || 0;

    return (
      <Card key={product.productId} variant="outlined" padding="none" style={styles.productCard}>
        <TouchableOpacity activeOpacity={0.88} onPress={() => setSelectedDetailProduct(product)}>
          <View style={styles.productCardContent}>
            <View style={styles.productHeader}>
              <View style={styles.productInfo}>
                <Text variant="titleSmall" color="primary" numberOfLines={2}>{product.name}</Text>
                <Caption color="tertiary" numberOfLines={1}>
                  SKU: {product.sku || 'Sin SKU'}
                  {product.correlativeNumber ? ` • #${product.correlativeNumber}` : ''}
                </Caption>
                {!!product.categoryName && <Caption color="tertiary">{product.categoryName}</Caption>}
              </View>
              <View style={[styles.stockLevelBadge, { backgroundColor: stockState.color }]}>
                <Ionicons name={stockState.icon} size={13} color={colors.text.inverse} />
                <Text variant="labelSmall" color={colors.text.inverse}>{stockState.label}</Text>
              </View>
            </View>

            <Divider spacing="none" style={styles.productDivider} />

            <View style={styles.stockMetricsRow}>
              <View style={styles.stockMetricBox}>
                <Caption color="tertiary">Total</Caption>
                <Text variant="numericMedium" color="primary">{formatQuantity(product.totalStock)}</Text>
              </View>
              <View style={styles.stockMetricBox}>
                <Caption color="tertiary">Reservado</Caption>
                <Text variant="numericMedium" color={colors.warning[700]}>{formatQuantity(product.reservedStock)}</Text>
              </View>
              <View style={styles.stockMetricBox}>
                <Caption color="tertiary">Disponible</Caption>
                <Text variant="numericMedium" color={colors.success[700]}>{formatQuantity(product.availableStock)}</Text>
              </View>
            </View>

            <View style={styles.productDetails}>
              <View style={styles.productDetailRow}>
                <Caption color="tertiary">Ubicaciones</Caption>
                <Text variant="labelMedium" color="primary">
                  {warehousesCount} almacén(es) / {areasCount} área(s)
                </Text>
              </View>
              {!!product.minStockAlert && (
                <View style={styles.productDetailRow}>
                  <Caption color="tertiary">Stock mínimo</Caption>
                  <Text variant="labelMedium" color="primary">{formatQuantity(product.minStockAlert)}</Text>
                </View>
              )}
            </View>

            {product.warehouses?.length > 0 && (
              <View style={styles.warehousePreviewList}>
                {product.warehouses.slice(0, 2).map((warehouse) => (
                  <View key={warehouse.warehouseId} style={styles.warehousePreviewItem}>
                    <View style={styles.flexOne}>
                      <Text variant="labelSmall" color="primary" numberOfLines={1}>
                        {warehouse.warehouseName}
                      </Text>
                      <Caption color="tertiary" numberOfLines={1}>
                        {warehouse.warehouseCode || 'Sin código'}
                        {warehouse.siteCode ? ` • ${warehouse.siteCode}` : ''}
                      </Caption>
                    </View>
                    <Text variant="numericSmall" color={colors.accent[700]}>
                      {formatQuantity(warehouse.availableStock)}
                    </Text>
                  </View>
                ))}
                {product.warehouses.length > 2 && (
                  <Caption color="tertiary">+{product.warehouses.length - 2} almacén(es) más</Caption>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.detailButton]}
            onPress={() => setSelectedDetailProduct(product)}
          >
            <Text variant="labelMedium" color={colors.text.inverse}>Ver detalle</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  if (isLoading && !stockResponse) {
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
                    <Ionicons name="cube" size={22} color={colors.neutral[0]} />
                  </View>
                  <Text style={styles.title}>Inventario</Text>
                </View>
                <Text style={styles.subtitle}>Stock consolidado por producto</Text>
              </View>
            </View>
          </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[900]} />
            <Text variant="bodyMedium" color="secondary" style={styles.loadingText}>Cargando inventario...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

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
                  <Ionicons name="cube" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={styles.title}>Inventario</Text>
              </View>
              <Text style={styles.subtitle}>Stock consolidado por producto</Text>
            </View>

            <View style={styles.statsHeaderContainer}>
              <View style={styles.statHeaderItem}>
                <Text style={styles.statHeaderValue}>{meta.totalItems}</Text>
                <Text style={styles.statHeaderLabel}>Productos</Text>
              </View>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por nombre, SKU, código o correlativo..."
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
          <View style={styles.filtersWrapper}>
            <TouchableOpacity style={styles.filterButton} onPress={() => setActivePicker('stockStatus')}>
              <View style={styles.flexOne}>
                <Caption color="tertiary">Estado</Caption>
                <Text variant="labelMedium" color="primary">{selectedStatus?.label || 'Todos'}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.icon.tertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterButton} onPress={() => setActivePicker('warehouse')}>
              <View style={styles.flexOne}>
                <Caption color="tertiary">Almacén</Caption>
                <Text variant="labelMedium" color="primary" numberOfLines={1}>
                  {loadingWarehouses ? 'Cargando...' : selectedWarehouse?.name || 'Todos'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.icon.tertiary} />
            </TouchableOpacity>

            {selectedWarehouseId !== 'all' && (
              <TouchableOpacity style={styles.filterButton} onPress={() => setActivePicker('area')}>
                <View style={styles.flexOne}>
                  <Caption color="tertiary">Área</Caption>
                  <Text variant="labelMedium" color="primary" numberOfLines={1}>
                    {loadingAreas ? 'Cargando...' : selectedArea?.name || selectedArea?.code || 'Todas'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.icon.tertiary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.filterButton} onPress={() => setActivePicker('sortBy')}>
              <View style={styles.flexOne}>
                <Caption color="tertiary">Ordenar</Caption>
                <Text variant="labelMedium" color="primary">{selectedSort?.label || 'Disponible'}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.icon.tertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterButton, styles.compactFilterButton]}
              onPress={() => setSortOrder((value) => (value === 'ASC' ? 'DESC' : 'ASC'))}
            >
              <Ionicons
                name={sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down'}
                size={18}
                color={colors.accent[700]}
              />
              <Text variant="labelMedium" color={colors.accent[700]}>{sortOrder}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterButton, includeZeroStock && styles.filterButtonActive]}
              onPress={() => setIncludeZeroStock((value) => !value)}
            >
              <Ionicons
                name={includeZeroStock ? 'checkbox' : 'square-outline'}
                size={18}
                color={includeZeroStock ? colors.text.inverse : colors.icon.secondary}
              />
              <Text variant="labelMedium" color={includeZeroStock ? colors.text.inverse : 'primary'}>
                Incluir ceros
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: colors.accent[50] }]}> 
              <Text variant="numericMedium" color="primary">{products.length}</Text>
              <Caption color="tertiary">En página</Caption>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.success[50] }]}> 
              <Text variant="numericMedium" color="primary">{formatQuantity(pageStats.availableStock)}</Text>
              <Caption color="tertiary">Disponible</Caption>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.warning[50] }]}> 
              <Text variant="numericMedium" color="primary">{formatQuantity(pageStats.reservedStock)}</Text>
              <Caption color="tertiary">Reservado</Caption>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.danger[50] }]}> 
              <Text variant="numericMedium" color="primary">{pageStats.lowStock}</Text>
              <Caption color="tertiary">Stock bajo</Caption>
            </View>
          </View>

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
            {!isLoading && products.length === 0 ? (
              <EmptyState
                emoji=""
                title="No hay productos con stock"
                description={
                  debouncedSearchQuery
                    ? 'No se encontraron productos con ese criterio de búsqueda.'
                    : 'Ajusta los filtros o incluye productos con stock cero.'
                }
                actionLabel={!includeZeroStock ? 'Incluir stock cero' : undefined}
                onAction={!includeZeroStock ? () => setIncludeZeroStock(true) : undefined}
              />
            ) : (
              <View style={styles.stockList}>{products.map(renderProductCard)}</View>
            )}
          </ScrollView>

          {meta.totalItems > 0 && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.totalItems}
              itemsPerPage={meta.limit}
              onPageChange={setPage}
              loading={isLoading}
            />
          )}
        </View>

        {renderPickerModal()}

        <StockFAB
          onDownloadTemplate={() => setIsProductBulkUploadV2ModalVisible(true)}
          onUploadFile={() => setIsBulkUploadModalVisible(true)}
          onExportStock={() => setIsExportModalVisible(true)}
        />

        <StockProductDetailModal
          visible={!!selectedDetailProduct}
          onClose={() => setSelectedDetailProduct(null)}
          product={selectedDetailProduct}
          warehouseId={selectedWarehouseId !== 'all' ? selectedWarehouseId : undefined}
          areaId={selectedAreaId !== 'all' ? selectedAreaId : undefined}
        />

        <BulkUploadModal
          visible={isBulkUploadModalVisible}
          onClose={() => setIsBulkUploadModalVisible(false)}
          onSuccess={refetch}
        />

        {effectiveSite && (
          <StockExportModal
            visible={isExportModalVisible}
            onClose={() => setIsExportModalVisible(false)}
            siteId={effectiveSite.id}
            siteName={effectiveSite.name}
          />
        )}

        <ProductBulkUploadV2Modal
          visible={isProductBulkUploadV2ModalVisible}
          onClose={() => setIsProductBulkUploadV2ModalVisible(false)}
          onSuccess={refetch}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
  },
  filtersWrapper: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterButton: {
    minWidth: 145,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterButtonActive: {
    backgroundColor: colors.accent[600],
    borderColor: colors.accent[600],
  },
  compactFilterButton: {
    minWidth: 92,
    flexGrow: 0,
    justifyContent: 'center',
  },
  flexOne: {
    flex: 1,
  },
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
    maxWidth: 460,
    maxHeight: '75%',
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
    maxHeight: 480,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.secondary,
    gap: spacing[3],
  },
  modalItemSelected: {
    backgroundColor: colors.accent[50],
  },
  modalItemContent: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  statCard: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  productDivider: {
    marginVertical: spacing[3],
  },
  stockMetricsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  stockMetricBox: {
    flex: 1,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  productDetails: {
    gap: spacing[2],
  },
  productDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[3],
  },
  warehousePreviewList: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  warehousePreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
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
  detailButton: {
    backgroundColor: colors.accent[600],
  },
});

export default StockScreen;
