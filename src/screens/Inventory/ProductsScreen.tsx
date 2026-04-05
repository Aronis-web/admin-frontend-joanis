/**
 * ProductsScreen - Rediseñado con Design System
 *
 * Pantalla de listado de productos profesional y moderna.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  useWindowDimensions,
  Modal,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProductFormModal } from '@/components/Inventory/ProductFormModal';
import { ProductPhotosModal } from '@/components/Photos';
import { ProductPriceProfilesModal } from '@/components/Inventory/ProductPriceProfilesModal';
import { productsApi, Product } from '@/services/api/products';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { useProducts } from '@/hooks/api/useProducts';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';
import { BulkUpdateModal } from '@/components/Products/BulkUpdateModal';
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
  Title,
  Body,
  Caption,
  Label,
  Button,
  Card,
  Badge,
  StatusBadge,
  IconButton,
  Chip,
  ChipGroup,
  EmptyState,
  Pagination,
  Divider,
} from '@/design-system/components';

interface ProductsScreenProps {
  navigation: any;
}

// Status configuration
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: colors.success[500], label: 'Activo' },
  preliminary: { color: colors.warning[500], label: '⚠️ Preliminar' },
  draft: { color: colors.warning[500], label: 'Borrador' },
  archived: { color: colors.neutral[500], label: 'Archivado' },
};

export const ProductsScreen: React.FC<ProductsScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'sku' | 'correlative'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [isImagesModalVisible, setIsImagesModalVisible] = useState(false);
  const [selectedProductForImages, setSelectedProductForImages] = useState<Product | null>(null);
  const [isPriceProfilesModalVisible, setIsPriceProfilesModalVisible] = useState(false);
  const [selectedProductForPrices, setSelectedProductForPrices] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [isBulkUpdateModalVisible, setIsBulkUpdateModalVisible] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = width >= 768 || height >= 768;

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery !== debouncedSearchQuery) {
        setPage(1);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // React Query filters
  const filters = useMemo(
    () => ({
      page,
      limit,
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(debouncedSearchQuery.trim() && {
        q: debouncedSearchQuery.trim(),
        ...(searchType !== 'all' && { searchField: searchType }),
      }),
      include: 'images',
      sortBy: 'correlativeNumber',
      sortOrder: 'desc' as const,
    }),
    [page, statusFilter, debouncedSearchQuery, searchType]
  );

  const {
    data: productsResponse,
    isLoading,
    isRefetching,
    refetch,
  } = useProducts(filters);

  const products = useMemo(() => productsResponse?.products || [], [productsResponse]);
  const pagination = useMemo(
    () => ({
      page: productsResponse?.page || 1,
      limit: productsResponse?.limit || limit,
      total: productsResponse?.total || 0,
      totalPages: productsResponse?.totalPages || 0,
    }),
    [productsResponse]
  );

  const filteredProducts = useMemo(() => products, [products]);

  useFocusEffect(
    useCallback(() => {
      logger.debug('📱 ProductsScreen focused - refetching products...');
      refetch();
    }, [refetch])
  );

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // Handlers
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.page > 1) setPage(pagination.page - 1);
  }, [pagination.page]);

  const handleNextPage = useCallback(() => {
    if (pagination.page < pagination.totalPages) setPage(pagination.page + 1);
  }, [pagination.page, pagination.totalPages]);

  // Detect duplicate SKUs
  const getDuplicateSKUs = () => {
    const skuCount = new Map<string, number>();
    products.forEach((p) => {
      if (p.sku) {
        skuCount.set(p.sku, (skuCount.get(p.sku) || 0) + 1);
      }
    });
    return Array.from(skuCount.entries())
      .filter(([_, count]) => count > 1)
      .map(([sku]) => sku);
  };

  const hasDuplicateSKU = (sku: string) => getDuplicateSKUs().includes(sku);
  const duplicateSKUs = getDuplicateSKUs();

  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setModalMode('create');
    setIsProductModalVisible(true);
  };

  const handleViewProduct = async (product: Product) => {
    try {
      // Obtener datos completos del producto (incluye weightKg y otros campos)
      const fullProduct = await productsApi.getProductById(product.id);

      // Obtener imágenes si no están incluidas
      let productWithImages = fullProduct;
      if (!fullProduct.imageUrl && !fullProduct.imageUrls) {
        try {
          const imagesResponse = await productsApi.getProductImages(product.id);
          if (imagesResponse.success && imagesResponse.images.length > 0) {
            productWithImages = {
              ...fullProduct,
              imageUrl: imagesResponse.images[0].url,
              imageUrls: imagesResponse.images.map((img) => img.url),
            };
          }
        } catch (error) {
          logger.debug(`⚠️ No images found for product ${product.id}`);
        }
      }
      setViewProduct(productWithImages);
      setIsViewModalVisible(true);
    } catch (error: any) {
      logger.error('❌ Error loading product details:', error);
      Alert.alert('Error', 'No se pudo cargar los detalles del producto');
    }
  };

  const handleEditProduct = async (product: Product) => {
    try {
      logger.debug('📦 Fetching full product details for edit:', product.id);
      const fullProduct = await productsApi.getProductById(product.id);
      setSelectedProduct(fullProduct);
      setModalMode('edit');
      setIsProductModalVisible(true);
    } catch (error: any) {
      logger.error('❌ Error loading product details:', error);
      Alert.alert('Error', 'No se pudo cargar los detalles del producto');
    }
  };

  const handleManageImages = (product: Product) => {
    setSelectedProductForImages(product);
    setIsImagesModalVisible(true);
  };

  const handleManagePrices = (product: Product) => {
    setSelectedProductForPrices(product);
    setIsPriceProfilesModalVisible(true);
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert('Eliminar Producto', `¿Estás seguro de que deseas eliminar "${product.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await productsApi.deleteProduct(product.id);
            Alert.alert('Éxito', 'Producto eliminado correctamente');
            refetch();
          } catch (error: any) {
            logger.error('Error deleting product:', error);
            Alert.alert('Error', error.message || 'No se pudo eliminar el producto');
          }
        },
      },
    ]);
  };

  const handleProductSuccess = useCallback(() => refetch(), [refetch]);

  // Search type options
  const searchTypeOptions = useMemo(() => [
    { label: 'Todos', value: 'all' },
    { label: 'SKU', value: 'sku' },
    { label: '#Correlativo', value: 'correlative' },
  ], []);

  // Status filter options
  const statusOptions = useMemo(() => [
    { label: 'Todos', value: 'all' },
    { label: 'Preliminares', value: 'preliminary' },
    { label: 'Activos', value: 'active' },
    { label: 'Borradores', value: 'draft' },
    { label: 'Archivados', value: 'archived' },
  ], []);

  // Render product card
  const renderProductCard = useCallback(({ item: product, index }: { item: Product; index: number }) => {
    const hasImage = (product.photos && product.photos.length > 0) || product.imageUrl || (product.imageUrls && product.imageUrls.length > 0);
    const imageUri = product.photos?.[0] || product.imageUrl || product.imageUrls?.[0];
    const statusConfig = STATUS_CONFIG[product.status] || STATUS_CONFIG.draft;

    return (
      <Card variant="outlined" padding="none" style={styles.productCard}>
        <TouchableOpacity
          onPress={() => handleEditProduct(product)}
          style={styles.productCardContent}
          activeOpacity={0.7}
        >
          {/* Product Header */}
          <View style={styles.productHeader}>
            {hasImage ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.productThumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productThumbnailPlaceholder}>
                <Text style={styles.productThumbnailPlaceholderText}>📦</Text>
              </View>
            )}

            <View style={styles.productInfo}>
              <Text variant="titleSmall" color="primary" numberOfLines={2}>
                {product.title}
              </Text>
              <View style={styles.productMetaRow}>
                {product.correlativeNumber && (
                  <Text variant="labelMedium" color={colors.accent[600]} style={styles.productCorrelative}>
                    #{product.correlativeNumber}
                  </Text>
                )}
                <Caption color="tertiary">SKU: {product.sku}</Caption>
                {hasDuplicateSKU(product.sku) && (
                  <View style={styles.duplicateBadge}>
                    <Text variant="labelSmall" color={colors.warning[700]}>⚠️ Duplicado</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.badgesContainer}>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
                <Text variant="labelSmall" color={colors.text.inverse}>{statusConfig.label}</Text>
              </View>
              {!hasImage && (
                <View style={styles.noPhotoBadge}>
                  <Text variant="labelSmall" color={colors.danger[600]}>📷 Sin foto</Text>
                </View>
              )}
            </View>
          </View>

          {/* Product Details */}
          <View style={styles.productDetails}>
            <View style={styles.productDetailItem}>
              <Caption color="tertiary">Costo:</Caption>
              <Text variant="labelMedium" color="primary">
                S/ {((product.costCents || product.priceCents || 0) / 100).toFixed(2)}
              </Text>
            </View>
            {product.category?.name && (
              <View style={styles.productDetailItem}>
                <Caption color="tertiary">Categoría:</Caption>
                <Text variant="labelMedium" color="primary">{product.category.name}</Text>
              </View>
            )}
          </View>

          <Divider spacing="none" style={styles.productDivider} />

          {/* Product Footer Info */}
          <View style={styles.productFooter}>
            <View style={styles.productFooterInfo}>
              <Caption color="tertiary">📦 {product.presentations?.length || 0} presentaciones</Caption>
              {product.salePrices && product.salePrices.length > 0 && (
                <Caption color="tertiary">💰 {product.salePrices.length} precios</Caption>
              )}
              {product.status !== 'preliminary' && product.stockItems && product.stockItems.length > 0 && (
                <Caption color="tertiary">📊 Stock en {product.stockItems.length} almacén(es)</Caption>
              )}
              {product.status === 'preliminary' && product.stock && (
                <Caption color="tertiary">📦 Stock preliminar: {product.stock.available || 0} unidades</Caption>
              )}
            </View>
            <Text variant="titleLarge" color={colors.neutral[300]}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => handleViewProduct(product)}
          >
            <Text variant="labelMedium" color={colors.accent[600]}>👁️ Ver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.imagesButton]}
            onPress={() => handleManageImages(product)}
          >
            <Text variant="labelMedium" color={colors.warning[600]}>📸 Fotos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.pricesButton]}
            onPress={() => handleManagePrices(product)}
          >
            <Text variant="labelMedium" color={colors.success[600]}>💰 Precios</Text>
          </TouchableOpacity>

          <ProtectedTouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditProduct(product)}
            requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
            hideIfNoPermission={true}
          >
            <Text variant="labelMedium" color={colors.text.secondary}>✏️ Editar</Text>
          </ProtectedTouchableOpacity>

          <ProtectedTouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteProduct(product)}
            requiredPermissions={[PERMISSIONS.PRODUCTS.DELETE]}
            hideIfNoPermission={true}
          >
            <Text variant="labelMedium" color={colors.danger[600]}>🗑️ Eliminar</Text>
          </ProtectedTouchableOpacity>
        </View>
      </Card>
    );
  }, [hasDuplicateSKU, handleEditProduct, handleViewProduct, handleManageImages, handleManagePrices, handleDeleteProduct]);

  // Loading state
  if (isLoading && !productsResponse) {
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
                  <Text style={[styles.title, isTablet && styles.titleTablet]}>Productos</Text>
                </View>
                <Text style={styles.subtitle}>Catálogo de productos</Text>
              </View>
            </View>
          </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[900]} />
            <Text variant="bodyMedium" color="secondary" style={styles.loadingText}>
              Cargando productos...
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
                <Ionicons name="cube" size={22} color={colors.neutral[0]} />
              </View>
              <Text style={[styles.title, isTablet && styles.titleTablet]}>Productos</Text>
            </View>
            <Text style={styles.subtitle}>Catálogo de productos</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsHeaderContainer}>
            <View style={styles.statHeaderItem}>
              <Text style={styles.statHeaderValue}>{pagination.total}</Text>
              <Text style={styles.statHeaderLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, isTablet && styles.searchInputTablet]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                searchType === 'correlative'
                  ? 'Buscar por #correlativo...'
                  : searchType === 'sku'
                    ? 'Buscar por SKU...'
                    : 'Buscar por nombre, SKU o #correlativo...'
              }
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

      {/* Quick Filters - Search Type */}
      <View style={styles.quickFiltersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFiltersContent}
        >
          {searchTypeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                searchType === option.value && styles.filterChipActive,
              ]}
              onPress={() => setSearchType(option.value as any)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                searchType === option.value && styles.filterChipTextActive,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.filterDivider} />
          {statusOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                statusFilter === option.value && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                statusFilter === option.value && styles.filterChipTextActive,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Duplicate SKUs Warning */}
      {duplicateSKUs.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text variant="titleSmall" color={colors.warning[800]}>SKUs Duplicados Detectados</Text>
            <Caption color={colors.warning[700]}>
              Hay {duplicateSKUs.length} SKU(s) con productos duplicados.
            </Caption>
          </View>
        </View>
      )}

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProductCard}
        keyExtractor={(item, index) => item.id || index.toString()}
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary[900]}
            colors={[colors.primary[900]]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="No hay productos"
            description={
              debouncedSearchQuery
                ? 'No se encontraron productos con ese criterio de búsqueda'
                : 'Comienza creando tu primer producto'
            }
            actionLabel={!debouncedSearchQuery ? 'Crear Producto' : undefined}
            onAction={!debouncedSearchQuery ? handleCreateProduct : undefined}
          />
        }
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        initialNumToRender={10}
      />

      {/* Pagination */}
      {!isLoading && pagination.total > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={setPage}
          loading={isLoading}
        />
      )}

      {/* Floating Action Buttons */}
      <ProtectedElement
        requiredPermissions={[PERMISSIONS.PRODUCTS.PRICES_DOWNLOAD, PERMISSIONS.PRODUCTS.PRICES_UPDATE]}
        requireAll={false}
        fallback={null}
      >
        <TouchableOpacity
          style={styles.pricesFloatingButton}
          onPress={() => setIsBulkUpdateModalVisible(true)}
          activeOpacity={0.9}
        >
          <Text style={styles.floatingButtonText}>💵</Text>
        </TouchableOpacity>
      </ProtectedElement>

      <ProtectedFAB
        icon="+"
        onPress={handleCreateProduct}
        requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
        hideIfNoPermission={true}
      />

      {/* Product Form Modal */}
      <ProductFormModal
        visible={isProductModalVisible}
        onClose={() => setIsProductModalVisible(false)}
        onSuccess={handleProductSuccess}
        product={selectedProduct}
        mode={modalMode}
      />

      {/* Product Photos Modal */}
      {selectedProductForImages && (
        <ProductPhotosModal
          visible={isImagesModalVisible}
          onClose={() => setIsImagesModalVisible(false)}
          onSuccess={handleProductSuccess}
          product={selectedProductForImages}
        />
      )}

      {/* Product Price Profiles Modal */}
      <ProductPriceProfilesModal
        visible={isPriceProfilesModalVisible}
        onClose={() => setIsPriceProfilesModalVisible(false)}
        onSuccess={handleProductSuccess}
        product={selectedProductForPrices}
      />

      {/* Product View Modal */}
      {viewProduct && (
        <Modal visible={isViewModalVisible} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <IconButton
                icon="close"
                onPress={() => setIsViewModalVisible(false)}
                variant="ghost"
                size="medium"
              />
              <Title size="medium">Detalles del Producto</Title>
              <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Product Images */}
              {(viewProduct.imageUrl || (viewProduct.imageUrls && viewProduct.imageUrls.length > 0)) && (
                <Card variant="outlined" style={styles.viewSection}>
                  <Text variant="titleSmall" color="primary" style={styles.viewSectionTitle}>
                    🖼️ Imágenes del Producto
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.imageGallery}>
                      {viewProduct.imageUrl && (
                        <Image source={{ uri: viewProduct.imageUrl }} style={styles.productImage} resizeMode="cover" />
                      )}
                      {viewProduct.imageUrls?.map((url, idx) => (
                        <Image key={idx} source={{ uri: url }} style={styles.productImage} resizeMode="cover" />
                      ))}
                    </View>
                  </ScrollView>
                </Card>
              )}

              {/* Información Básica */}
              <Card variant="outlined" style={styles.viewSection}>
                <Text variant="titleSmall" color="primary" style={styles.viewSectionTitle}>
                  📋 Información Básica
                </Text>
                <View style={styles.viewRow}>
                  <Caption color="tertiary">Título:</Caption>
                  <Text variant="bodyMedium" color="primary">{viewProduct.title}</Text>
                </View>
                {viewProduct.correlativeNumber && (
                  <View style={styles.viewRow}>
                    <Caption color="tertiary">#Correlativo:</Caption>
                    <Text variant="numericMedium" color={colors.accent[600]}>{viewProduct.correlativeNumber}</Text>
                  </View>
                )}
                <View style={styles.viewRow}>
                  <Caption color="tertiary">SKU:</Caption>
                  <Text variant="bodyMedium" color="primary">{viewProduct.sku}</Text>
                </View>
                {viewProduct.barcode && (
                  <View style={styles.viewRow}>
                    <Caption color="tertiary">Código de Barras:</Caption>
                    <Text variant="bodyMedium" color="primary">{viewProduct.barcode}</Text>
                  </View>
                )}
                <View style={styles.viewRow}>
                  <Caption color="tertiary">Estado:</Caption>
                  <View style={[styles.viewStatusBadge, { backgroundColor: STATUS_CONFIG[viewProduct.status]?.color || colors.neutral[500] }]}>
                    <Text variant="labelSmall" color={colors.text.inverse}>{STATUS_CONFIG[viewProduct.status]?.label}</Text>
                  </View>
                </View>
              </Card>

              {/* Información Financiera */}
              <Card variant="outlined" style={styles.viewSection}>
                <Text variant="titleSmall" color="primary" style={styles.viewSectionTitle}>
                  💰 Información Financiera
                </Text>
                <View style={styles.viewRow}>
                  <Caption color="tertiary">Costo:</Caption>
                  <Text variant="numericMedium" color={colors.success[600]}>
                    S/ {((viewProduct.costCents || viewProduct.priceCents || 0) / 100).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Caption color="tertiary">Moneda:</Caption>
                  <Text variant="bodyMedium" color="primary">{viewProduct.currency || 'PEN'}</Text>
                </View>
                {viewProduct.weightKg !== undefined && viewProduct.weightKg !== null && typeof viewProduct.weightKg === 'number' && !isNaN(viewProduct.weightKg) && (
                  <View style={styles.viewRow}>
                    <Caption color="tertiary">Peso:</Caption>
                    <Text variant="bodyMedium" color="primary">
                      {(viewProduct.weightKg * 1000).toFixed(0)} g ({viewProduct.weightKg.toFixed(3)} kg)
                    </Text>
                  </View>
                )}
              </Card>

              {/* Presentaciones */}
              {viewProduct.presentations && viewProduct.presentations.length > 0 && (
                <Card variant="outlined" style={styles.viewSection}>
                  <Text variant="titleSmall" color="primary" style={styles.viewSectionTitle}>
                    📦 Presentaciones ({viewProduct.presentations.length})
                  </Text>
                  {viewProduct.presentations.map((pres, index) => (
                    <View key={index} style={styles.presentationCard}>
                      <View style={styles.presentationHeader}>
                        <Text variant="labelLarge" color="primary">
                          {pres.presentation?.name || pres.presentation?.code || 'Presentación'}
                        </Text>
                        {pres.isBase && (
                          <View style={styles.baseBadge}>
                            <Text variant="labelSmall" color={colors.text.inverse}>BASE</Text>
                          </View>
                        )}
                      </View>
                      <Caption color="tertiary">Factor: {pres.factorToBase} | Min: {pres.minOrderQty}</Caption>
                    </View>
                  ))}
                </Card>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cerrar"
                onPress={() => setIsViewModalVisible(false)}
                variant="primary"
                fullWidth
              />
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        visible={isBulkUpdateModalVisible}
        onClose={() => setIsBulkUpdateModalVisible(false)}
        onSuccess={handleProductSuccess}
        mode="products"
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
  titleTablet: {
    fontSize: 28,
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
  searchInputTablet: {
    fontSize: 16,
    paddingVertical: spacing[3.5],
  },
  clearButton: {
    padding: spacing[1],
  },
  quickFiltersContainer: {
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  quickFiltersContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  filterChipActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[600],
  },
  filterChipTextActive: {
    color: colors.neutral[0],
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing[2],
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: spacing[4],
  },

  // Warning Banner
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: colors.warning[50],
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning[300],
  },

  warningIcon: {
    fontSize: 20,
    marginRight: spacing[2],
  },

  warningContent: {
    flex: 1,
  },

  // List
  listContainer: {
    flex: 1,
  },

  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[24],
  },

  // Product Card
  productCard: {
    marginBottom: spacing[3],
  },

  productCardContent: {
    padding: spacing[4],
  },

  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },

  productThumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    marginRight: spacing[3],
    backgroundColor: colors.surface.secondary,
  },

  productThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    marginRight: spacing[3],
    backgroundColor: colors.surface.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  productThumbnailPlaceholderText: {
    fontSize: 28,
  },

  productInfo: {
    flex: 1,
    marginRight: spacing[2],
  },

  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[1],
  },

  productCorrelative: {
    fontFamily: 'monospace',
  },

  duplicateBadge: {
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.warning[300],
  },

  badgesContainer: {
    flexDirection: 'column',
    gap: spacing[1.5],
    alignItems: 'flex-end',
  },

  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },

  noPhotoBadge: {
    backgroundColor: colors.danger[50],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.danger[200],
  },

  productDetails: {
    marginBottom: spacing[3],
  },

  productDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[1.5],
  },

  productDivider: {
    marginVertical: spacing[3],
  },

  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  productFooterInfo: {
    flex: 1,
    gap: spacing[1],
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
    backgroundColor: colors.surface.secondary,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },

  viewButton: {
    backgroundColor: colors.accent[50],
  },

  imagesButton: {
    backgroundColor: colors.warning[50],
  },

  pricesButton: {
    backgroundColor: colors.success[50],
  },

  deleteButton: {
    backgroundColor: colors.danger[50],
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  modalContent: {
    flex: 1,
    padding: spacing[4],
  },

  viewSection: {
    marginBottom: spacing[4],
    padding: spacing[4],
  },

  viewSectionTitle: {
    marginBottom: spacing[3],
  },

  viewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },

  viewStatusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },

  imageGallery: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },

  productImage: {
    width: 180,
    height: 180,
    borderRadius: borderRadius.lg,
  },

  presentationCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
  },

  presentationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },

  baseBadge: {
    backgroundColor: colors.success[500],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.xs,
  },

  modalFooter: {
    padding: spacing[4],
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  // Floating Button
  pricesFloatingButton: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[900],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows['2xl'],
    borderWidth: 3,
    borderColor: colors.surface.primary,
    zIndex: 9997,
  },

  floatingButtonText: {
    fontSize: 24,
  },
});

export default ProductsScreen;
