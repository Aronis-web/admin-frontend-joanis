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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
const getStatusConfig = (theme: Theme): Record<string, { color: string; label: string }> => ({
  active: { color: theme.color.icon.success, label: 'Activo' },
  preliminary: { color: theme.color.icon.warning, label: '⚠️ Preliminar' },
  draft: { color: theme.color.icon.warning, label: 'Borrador' },
  archived: { color: theme.color.icon.subtle, label: 'Archivado' },
});

export const ProductsScreen: React.FC<ProductsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const STATUS_CONFIG = useMemo(() => getStatusConfig(theme), [theme]);
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
                  <Text variant="labelMedium" color={theme.color.brand.accent} style={styles.productCorrelative}>
                    #{product.correlativeNumber}
                  </Text>
                )}
                <Caption color="tertiary">SKU: {product.sku}</Caption>
                {hasDuplicateSKU(product.sku) && (
                  <View style={styles.duplicateBadge}>
                    <Text variant="labelSmall" color={theme.color.text.warning}>⚠️ Duplicado</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.badgesContainer}>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
                <Text variant="labelSmall" color={theme.color.text.inverse}>{statusConfig.label}</Text>
              </View>
              {!hasImage && (
                <View style={styles.noPhotoBadge}>
                  <Text variant="labelSmall" color={theme.color.text.danger}>📷 Sin foto</Text>
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
            <Text variant="titleLarge" color={theme.color.text.placeholder}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => handleViewProduct(product)}
          >
            <Text variant="labelMedium" color={theme.color.brand.accent}>👁️ Ver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.imagesButton]}
            onPress={() => handleManageImages(product)}
          >
            <Text variant="labelMedium" color={theme.color.text.warning}>📸 Fotos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.pricesButton]}
            onPress={() => handleManagePrices(product)}
          >
            <Text variant="labelMedium" color={theme.color.text.success}>💰 Precios</Text>
          </TouchableOpacity>

          <ProtectedTouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditProduct(product)}
            requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
            hideIfNoPermission={true}
          >
            <Text variant="labelMedium" color={theme.color.text.muted}>✏️ Editar</Text>
          </ProtectedTouchableOpacity>

          <ProtectedTouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteProduct(product)}
            requiredPermissions={[PERMISSIONS.PRODUCTS.DELETE]}
            hideIfNoPermission={true}
          >
            <Text variant="labelMedium" color={theme.color.text.danger}>🗑️ Eliminar</Text>
          </ProtectedTouchableOpacity>
        </View>
      </Card>
    );
  }, [theme, styles, STATUS_CONFIG, hasDuplicateSKU, handleEditProduct, handleViewProduct, handleManageImages, handleManagePrices, handleDeleteProduct]);

  // Loading state
  if (isLoading && !productsResponse) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <LinearGradient
            colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerTop}>
              <View style={styles.headerTitleContainer}>
                <View style={styles.headerIconRow}>
                  <View style={styles.headerIconContainer}>
                    <Ionicons name="cube" size={22} color={theme.color.brand.onHeader} />
                  </View>
                  <Text style={[styles.title, isTablet && styles.titleTablet]}>Productos</Text>
                </View>
                <Text style={styles.subtitle}>Catálogo de productos</Text>
              </View>
            </View>
          </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.primary} />
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
        colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="cube" size={22} color={theme.color.brand.onHeader} />
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
            <Ionicons name="search" size={20} color={theme.color.text.placeholder} style={styles.searchIcon} />
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
              placeholderTextColor={theme.color.text.placeholder}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={theme.color.text.placeholder} />
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
            <Text variant="titleSmall" color={theme.color.text.warning}>SKUs Duplicados Detectados</Text>
            <Caption color={theme.color.text.warning}>
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
            tintColor={theme.color.brand.primary}
            colors={[theme.color.brand.primary]}
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
        actions={[
          {
            icon: 'cube-outline',
            label: 'Crear Producto',
            onPress: handleCreateProduct,
            requiredPermissions: [PERMISSIONS.PRODUCTS.CREATE],
          },
        ]}
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
                    <Text variant="numericMedium" color={theme.color.brand.accent}>{viewProduct.correlativeNumber}</Text>
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
                  <View style={[styles.viewStatusBadge, { backgroundColor: STATUS_CONFIG[viewProduct.status]?.color || theme.color.icon.subtle }]}>
                    <Text variant="labelSmall" color={theme.color.text.inverse}>{STATUS_CONFIG[viewProduct.status]?.label}</Text>
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
                  <Text variant="numericMedium" color={theme.color.text.success}>
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
                            <Text variant="labelSmall" color={theme.color.text.inverse}>BASE</Text>
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },

  // Header con gradiente
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[4],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.space[4],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    letterSpacing: 0.3,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  statsHeaderContainer: {
    alignItems: 'flex-end',
  },
  statHeaderItem: {
    alignItems: 'center',
    backgroundColor: theme.color.brand.headerBadge,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.lg,
  },
  statHeaderValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  statHeaderLabel: {
    fontSize: 11,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.space[3],
  },
  searchIcon: {
    marginRight: theme.space[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.space[3],
    fontSize: 15,
    color: theme.color.text.body,
  },
  searchInputTablet: {
    fontSize: 16,
    paddingVertical: theme.space[3.5],
  },
  clearButton: {
    padding: theme.space[1],
  },
  quickFiltersContainer: {
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  quickFiltersContent: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    gap: theme.space[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.muted,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  filterChipActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  filterChipTextActive: {
    color: theme.color.text.inverse,
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.color.border.subtle,
    marginHorizontal: theme.space[2],
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: theme.space[4],
  },

  // Warning Banner
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: theme.color.state.warning.background,
    marginHorizontal: theme.space[4],
    marginVertical: theme.space[2],
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },

  warningIcon: {
    fontSize: 20,
    marginRight: theme.space[2],
  },

  warningContent: {
    flex: 1,
  },

  // List
  listContainer: {
    flex: 1,
  },

  listContent: {
    padding: theme.space[4],
    paddingBottom: theme.space[24],
  },

  // Product Card
  productCard: {
    marginBottom: theme.space[3],
  },

  productCardContent: {
    padding: theme.space[4],
  },

  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.space[3],
  },

  productThumbnail: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.md,
    marginRight: theme.space[3],
    backgroundColor: theme.color.surface.subtle,
  },

  productThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.md,
    marginRight: theme.space[3],
    backgroundColor: theme.color.surface.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },

  productThumbnailPlaceholderText: {
    fontSize: 28,
  },

  productInfo: {
    flex: 1,
    marginRight: theme.space[2],
  },

  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.space[2],
    marginTop: theme.space[1],
  },

  productCorrelative: {
    fontFamily: 'monospace',
  },

  duplicateBadge: {
    backgroundColor: theme.color.state.warning.background,
    paddingHorizontal: theme.space[1.5],
    paddingVertical: theme.space[0.5],
    borderRadius: theme.radii.xs,
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },

  badgesContainer: {
    flexDirection: 'column',
    gap: theme.space[1.5],
    alignItems: 'flex-end',
  },

  statusBadge: {
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },

  noPhotoBadge: {
    backgroundColor: theme.color.state.danger.background,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
  },

  productDetails: {
    marginBottom: theme.space[3],
  },

  productDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.space[1.5],
  },

  productDivider: {
    marginVertical: theme.space[3],
  },

  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  productFooterInfo: {
    flex: 1,
    gap: theme.space[1],
  },

  productActions: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },

  actionButton: {
    flex: 1,
    backgroundColor: theme.color.surface.subtle,
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[2],
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },

  viewButton: {
    backgroundColor: theme.color.brand.accentSoft,
  },

  imagesButton: {
    backgroundColor: theme.color.state.warning.background,
  },

  pricesButton: {
    backgroundColor: theme.color.state.success.background,
  },

  deleteButton: {
    backgroundColor: theme.color.state.danger.background,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },

  modalContent: {
    flex: 1,
    padding: theme.space[4],
  },

  viewSection: {
    marginBottom: theme.space[4],
    padding: theme.space[4],
  },

  viewSectionTitle: {
    marginBottom: theme.space[3],
  },

  viewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[2],
  },

  viewStatusBadge: {
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },

  imageGallery: {
    flexDirection: 'row',
    gap: theme.space[3],
    paddingVertical: theme.space[2],
  },

  productImage: {
    width: 180,
    height: 180,
    borderRadius: theme.radii.lg,
  },

  presentationCard: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: theme.radii.md,
    padding: theme.space[3],
    marginBottom: theme.space[2],
  },

  presentationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[1],
  },

  baseBadge: {
    backgroundColor: theme.color.icon.success,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[0.5],
    borderRadius: theme.radii.xs,
  },

  modalFooter: {
    padding: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },

  // Floating Button
  pricesFloatingButton: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.color.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow['2xl'],
    borderWidth: 3,
    borderColor: theme.color.surface.base,
    zIndex: 9997,
  },

  floatingButtonText: {
    fontSize: 24,
  },
});

export default ProductsScreen;
