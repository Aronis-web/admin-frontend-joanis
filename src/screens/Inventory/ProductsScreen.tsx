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
  useWindowDimensions,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { ProductFormModal } from '@/components/Inventory/ProductFormModal';
import { ProductImagesModal } from '@/components/Inventory/ProductImagesModal';
import { ProductPriceProfilesModal } from '@/components/Inventory/ProductPriceProfilesModal';
import { productsApi, Product } from '@/services/api/products';
import { AddButton } from '@/components/Navigation/AddButton';
import { useProducts } from '@/hooks/api/useProducts';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';
import { BulkUpdateModal } from '@/components/Products/BulkUpdateModal';

interface ProductsScreenProps {
  navigation: any;
}

export const ProductsScreen: React.FC<ProductsScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
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

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // ✅ React Query: Reemplaza loadProducts() con caché automático
  const filters = useMemo(
    () => ({
      page,
      limit,
      ...(statusFilter !== 'all' && { status: statusFilter }),
    }),
    [page, statusFilter]
  );

  const {
    data: productsResponse,
    isLoading,
    isRefetching,
    refetch,
  } = useProducts(filters);

  // Extraer productos y paginación de la respuesta
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

  // ✅ Filtrado local con useMemo (optimizado)
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products) || products.length === 0) {
      return [];
    }

    let filtered = [...products];

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();

      filtered = filtered.filter((product) => {
        if (searchType === 'correlative') {
          return product.correlativeNumber && product.correlativeNumber.toString().includes(query);
        } else if (searchType === 'sku') {
          return product.sku && product.sku.toLowerCase().includes(query);
        } else {
          return (
            (product.title && product.title.toLowerCase().includes(query)) ||
            (product.sku && product.sku.toLowerCase().includes(query)) ||
            (product.correlativeNumber && product.correlativeNumber.toString().includes(query))
          );
        }
      });
    }

    return filtered;
  }, [products, searchQuery, searchType]);

  // Auto-reload products when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 ProductsScreen focused - refetching products...');
      refetch();
    }, [refetch])
  );

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ✅ Handlers simplificados
  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

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

  const handleLogout = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'draft':
        return '#F59E0B';
      case 'archived':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'draft':
        return 'Borrador';
      case 'archived':
        return 'Archivado';
      default:
        return status;
    }
  };

  // Detectar SKUs duplicados
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

  const hasDuplicateSKU = (sku: string) => {
    return getDuplicateSKUs().includes(sku);
  };

  const duplicateSKUs = getDuplicateSKUs();

  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setModalMode('create');
    setIsProductModalVisible(true);
  };

  const handleViewProduct = async (product: Product) => {
    // Load images for this product if not already loaded
    let productWithImages = product;
    if (!product.imageUrl && !product.imageUrls) {
      try {
        const imagesResponse = await productsApi.getProductImages(product.id);
        if (imagesResponse.success && imagesResponse.images.length > 0) {
          productWithImages = {
            ...product,
            imageUrl: imagesResponse.images[0].url,
            imageUrls: imagesResponse.images.map((img) => img.url),
          };
        }
      } catch (error) {
        console.log(`⚠️ No images found for product ${product.id}`);
      }
    }
    setViewProduct(productWithImages);
    setIsViewModalVisible(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setModalMode('edit');
    setIsProductModalVisible(true);
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
            console.error('Error deleting product:', error);
            Alert.alert('Error', error.message || 'No se pudo eliminar el producto');
          }
        },
      },
    ]);
  };

  const handleProductSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading && !productsResponse) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Productos</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Productos</Text>
        <View style={styles.backButton} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={
            searchType === 'correlative'
              ? 'Buscar por #correlativo...'
              : searchType === 'sku'
                ? 'Buscar por SKU...'
                : 'Buscar por nombre, SKU o #correlativo...'
          }
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
          keyboardType={searchType === 'correlative' ? 'numeric' : 'default'}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Type Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Buscar por:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, searchType === 'all' && styles.filterChipActive]}
            onPress={() => setSearchType('all')}
          >
            <Text
              style={[styles.filterChipText, searchType === 'all' && styles.filterChipTextActive]}
            >
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, searchType === 'sku' && styles.filterChipActive]}
            onPress={() => setSearchType('sku')}
          >
            <Text
              style={[styles.filterChipText, searchType === 'sku' && styles.filterChipTextActive]}
            >
              SKU
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, searchType === 'correlative' && styles.filterChipActive]}
            onPress={() => setSearchType('correlative')}
          >
            <Text
              style={[
                styles.filterChipText,
                searchType === 'correlative' && styles.filterChipTextActive,
              ]}
            >
              #Correlativo
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Duplicate SKUs Warning */}
      {duplicateSKUs.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>SKUs Duplicados Detectados</Text>
            <Text style={styles.warningText}>
              Hay {duplicateSKUs.length} SKU(s) con productos duplicados. Usa el número correlativo
              para identificarlos de forma única.
            </Text>
          </View>
        </View>
      )}

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Estado:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text
              style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}
            >
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'preliminary' && styles.filterChipActive]}
            onPress={() => setStatusFilter('preliminary')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'preliminary' && styles.filterChipTextActive,
              ]}
            >
              Preliminares
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'active' && styles.filterChipActive]}
            onPress={() => setStatusFilter('active')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'active' && styles.filterChipTextActive,
              ]}
            >
              Activos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'draft' && styles.filterChipActive]}
            onPress={() => setStatusFilter('draft')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'draft' && styles.filterChipTextActive,
              ]}
            >
              Borradores
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'archived' && styles.filterChipActive]}
            onPress={() => setStatusFilter('archived')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'archived' && styles.filterChipTextActive,
              ]}
            >
              Archivados
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
          <Text style={styles.statValue}>{filteredProducts.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
          <Text style={styles.statValue}>
            {filteredProducts.filter((p) => p.status === 'active').length}
          </Text>
          <Text style={styles.statLabel}>Activos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.statValue}>
            {filteredProducts.filter((p) => p.status === 'draft').length}
          </Text>
          <Text style={styles.statLabel}>Borradores</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.floatingButtonsContainer} pointerEvents="box-none">
        <ProtectedElement
          requiredPermissions={[PERMISSIONS.PRODUCTS.PRICES_DOWNLOAD, PERMISSIONS.PRODUCTS.PRICES_UPDATE]}
          requireAll={false}
          fallback={null}
        >
          <AddButton
            onPress={() => setIsBulkUpdateModalVisible(true)}
            icon="📊"
            label="Actualizar"
          />
        </ProtectedElement>
        <ProtectedElement
          requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
          requireAll={false}
          fallback={null}
        >
          <AddButton onPress={handleCreateProduct} icon="📦" />
        </ProtectedElement>
      </View>

      {/* Products List */}
      <ScrollView
        style={[styles.content, isLandscape && styles.contentLandscape]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      >
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No hay productos</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'No se encontraron productos con ese criterio de búsqueda'
                : 'Comienza creando tu primer producto'}
            </Text>
          </View>
        ) : (
          <View style={styles.productsList}>
            {filteredProducts.map((product, index) => (
              <View key={product.id || index} style={styles.productCard}>
                <TouchableOpacity
                  onPress={() => handleEditProduct(product)}
                  style={styles.productCardContent}
                >
                  <View style={styles.productHeader}>
                    {/* Product Image Thumbnail */}
                    {(() => {
                      const hasImage =
                        product.imageUrl || (product.imageUrls && product.imageUrls.length > 0);
                      const imageUri = product.imageUrl || product.imageUrls?.[0];
                      if (index === 0) {
                        console.log('🖼️ Product image check:', {
                          title: product.title,
                          hasImage,
                          imageUrl: product.imageUrl,
                          imageUrls: product.imageUrls,
                          imageUri,
                        });
                      }
                      return hasImage ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.productThumbnail}
                          resizeMode="cover"
                          onError={(e) =>
                            console.log('❌ Image load error:', imageUri, e.nativeEvent.error)
                          }
                          onLoad={() => index === 0 && console.log('✅ Image loaded:', imageUri)}
                        />
                      ) : (
                        <View style={styles.productThumbnailPlaceholder}>
                          <Text style={styles.productThumbnailPlaceholderText}>📦</Text>
                        </View>
                      );
                    })()}
                    <View style={styles.productInfo}>
                      <Text style={styles.productTitle}>{product.title}</Text>
                      <View style={styles.productMetaRow}>
                        {product.correlativeNumber && (
                          <Text style={styles.productCorrelative}>
                            #{product.correlativeNumber}
                          </Text>
                        )}
                        <Text style={styles.productSku}>SKU: {product.sku}</Text>
                        {hasDuplicateSKU(product.sku) && (
                          <View style={styles.duplicateBadge}>
                            <Text style={styles.duplicateBadgeText}>⚠️ Duplicado</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(product.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>{getStatusText(product.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.productDetails}>
                    <View style={styles.productDetailItem}>
                      <Text style={styles.productDetailLabel}>Costo:</Text>
                      <Text style={styles.productDetailValue}>
                        S/ {((product.costCents || product.priceCents || 0) / 100).toFixed(2)}
                      </Text>
                    </View>
                    {product.category?.name && (
                      <View style={styles.productDetailItem}>
                        <Text style={styles.productDetailLabel}>Categoría:</Text>
                        <Text style={styles.productDetailValue}>{product.category.name}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.productFooter}>
                    <View style={styles.productFooterInfo}>
                      <Text style={styles.productFooterText}>
                        📦 {product.presentations?.length || 0} presentaciones
                      </Text>
                      {product.salePrices && product.salePrices.length > 0 && (
                        <Text style={styles.productFooterText}>
                          💰 {product.salePrices.length} precios
                        </Text>
                      )}
                      {product.stockItems && product.stockItems.length > 0 && (
                        <Text style={styles.productFooterText}>
                          📊 Stock en {product.stockItems.length} almacén(es)
                        </Text>
                      )}
                    </View>
                    <Text style={styles.productArrow}>›</Text>
                  </View>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.productActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.viewButton]}
                    onPress={() => handleViewProduct(product)}
                  >
                    <Text style={[styles.actionButtonText, styles.viewButtonText]}>👁️ Ver</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.imagesButton]}
                    onPress={() => handleManageImages(product)}
                  >
                    <Text style={[styles.actionButtonText, styles.imagesButtonText]}>📸 Fotos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.pricesButton]}
                    onPress={() => handleManagePrices(product)}
                  >
                    <Text style={[styles.actionButtonText, styles.pricesButtonText]}>
                      💰 Precios
                    </Text>
                  </TouchableOpacity>

                  <ProtectedTouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditProduct(product)}
                    requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
                    hideIfNoPermission={true}
                  >
                    <Text style={styles.actionButtonText}>✏️ Editar</Text>
                  </ProtectedTouchableOpacity>

                  <ProtectedTouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteProduct(product)}
                    requiredPermissions={[PERMISSIONS.PRODUCTS.DELETE]}
                    hideIfNoPermission={true}
                  >
                    <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                      🗑️ Eliminar
                    </Text>
                  </ProtectedTouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Pagination Controls */}
      {!isLoading && pagination.total > 0 && !searchQuery && (
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
              {filteredProducts.length} de {pagination.total}
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

      {/* Product Form Modal */}
      <ProductFormModal
        visible={isProductModalVisible}
        onClose={() => setIsProductModalVisible(false)}
        onSuccess={handleProductSuccess}
        product={selectedProduct}
        mode={modalMode}
      />

      {/* Product Images Modal */}
      {selectedProductForImages && (
        <ProductImagesModal
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
              <TouchableOpacity
                onPress={() => setIsViewModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Detalles del Producto</Text>
              <View style={styles.modalCloseButton} />
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Product Images */}
              {(() => {
                const hasImages =
                  viewProduct.imageUrl ||
                  (viewProduct.imageUrls && viewProduct.imageUrls.length > 0);
                console.log('🖼️ View Product images:', {
                  title: viewProduct.title,
                  hasImages,
                  imageUrl: viewProduct.imageUrl,
                  imageUrls: viewProduct.imageUrls,
                });
                return (
                  hasImages && (
                    <View style={styles.viewSection}>
                      <Text style={styles.viewSectionTitle}>🖼️ Imágenes del Producto</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.imageGallery}>
                          {viewProduct.imageUrl && (
                            <Image
                              source={{ uri: viewProduct.imageUrl }}
                              style={styles.productImage}
                              resizeMode="cover"
                              onError={(e) =>
                                console.log(
                                  '❌ View image load error:',
                                  viewProduct.imageUrl,
                                  e.nativeEvent.error
                                )
                              }
                              onLoad={() =>
                                console.log('✅ View image loaded:', viewProduct.imageUrl)
                              }
                            />
                          )}
                          {viewProduct.imageUrls &&
                            viewProduct.imageUrls.map((url, idx) => (
                              <Image
                                key={idx}
                                source={{ uri: url }}
                                style={styles.productImage}
                                resizeMode="cover"
                                onError={(e) =>
                                  console.log('❌ View image load error:', url, e.nativeEvent.error)
                                }
                                onLoad={() => console.log('✅ View image loaded:', url)}
                              />
                            ))}
                        </View>
                      </ScrollView>
                    </View>
                  )
                );
              })()}

              {/* Información Básica */}
              <View style={styles.viewSection}>
                <Text style={styles.viewSectionTitle}>📋 Información Básica</Text>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Título:</Text>
                  <Text style={styles.viewValue}>{viewProduct.title}</Text>
                </View>
                {viewProduct.correlativeNumber && (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>#Correlativo:</Text>
                    <Text style={[styles.viewValue, styles.correlativeHighlight]}>
                      {viewProduct.correlativeNumber}
                    </Text>
                  </View>
                )}
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>SKU:</Text>
                  <View style={styles.viewValueRow}>
                    <Text style={styles.viewValue}>{viewProduct.sku}</Text>
                    {hasDuplicateSKU(viewProduct.sku) && (
                      <View style={styles.duplicateBadgeSmall}>
                        <Text style={styles.duplicateBadgeTextSmall}>⚠️ SKU Duplicado</Text>
                      </View>
                    )}
                  </View>
                </View>
                {viewProduct.barcode && (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>Código de Barras:</Text>
                    <Text style={styles.viewValue}>{viewProduct.barcode}</Text>
                  </View>
                )}
                {viewProduct.description && (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>Descripción:</Text>
                    <Text style={styles.viewValue}>{viewProduct.description}</Text>
                  </View>
                )}
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Estado:</Text>
                  <View
                    style={[
                      styles.viewStatusBadge,
                      { backgroundColor: getStatusColor(viewProduct.status) },
                    ]}
                  >
                    <Text style={styles.viewStatusText}>{getStatusText(viewProduct.status)}</Text>
                  </View>
                </View>
                {viewProduct.category?.name && (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>Categoría:</Text>
                    <Text style={styles.viewValue}>{viewProduct.category.name}</Text>
                  </View>
                )}
              </View>

              {/* Información Financiera */}
              <View style={styles.viewSection}>
                <Text style={styles.viewSectionTitle}>💰 Información Financiera</Text>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Costo:</Text>
                  <Text style={styles.viewValue}>
                    S/ {((viewProduct.costCents || viewProduct.priceCents || 0) / 100).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Moneda:</Text>
                  <Text style={styles.viewValue}>{viewProduct.currency || 'PEN'}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Tipo de Impuesto:</Text>
                  <Text style={styles.viewValue}>{viewProduct.taxType || 'GRAVADO'}</Text>
                </View>
              </View>

              {/* Presentaciones */}
              {viewProduct.presentations && viewProduct.presentations.length > 0 && (
                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>
                    📦 Presentaciones ({viewProduct.presentations.length})
                  </Text>
                  {viewProduct.presentations.map((pres, index) => (
                    <View key={index} style={styles.presentationViewCard}>
                      <View style={styles.presentationViewHeader}>
                        <Text style={styles.presentationViewName}>
                          {pres.presentation?.name || pres.presentation?.code || 'Presentación'}
                        </Text>
                        {pres.isBase && (
                          <View style={styles.baseBadge}>
                            <Text style={styles.baseBadgeText}>BASE</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Código:</Text>
                        <Text style={styles.viewValue}>{pres.presentation?.code}</Text>
                      </View>
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Factor a Base:</Text>
                        <Text style={styles.viewValue}>{pres.factorToBase}</Text>
                      </View>
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Cantidad Mínima:</Text>
                        <Text style={styles.viewValue}>{pres.minOrderQty}</Text>
                      </View>
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Incremento:</Text>
                        <Text style={styles.viewValue}>{pres.orderStep}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Precios de Venta */}
              {viewProduct.salePrices && viewProduct.salePrices.length > 0 && (
                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>
                    💵 Precios de Venta ({viewProduct.salePrices.length})
                  </Text>
                  {viewProduct.salePrices.map((price, index) => (
                    <View key={index} style={styles.priceViewCard}>
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Perfil:</Text>
                        <Text style={styles.viewValue}>{price.profile?.name || 'N/A'}</Text>
                      </View>
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Presentación:</Text>
                        <Text style={styles.viewValue}>
                          {price.presentation?.name || price.presentation?.code || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Precio:</Text>
                        <Text style={[styles.viewValue, styles.priceHighlight]}>
                          S/ {(price.priceCents / 100).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Stock */}
              {viewProduct.stockItems && viewProduct.stockItems.length > 0 && (
                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>
                    📊 Stock ({viewProduct.stockItems.length} ubicaciones)
                  </Text>
                  {viewProduct.stockItems.map((stock, index) => (
                    <View key={index} style={styles.stockViewCard}>
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Almacén:</Text>
                        <Text style={styles.viewValue}>{stock.warehouse?.name || 'N/A'}</Text>
                      </View>
                      {stock.area && (
                        <View style={styles.viewRow}>
                          <Text style={styles.viewLabel}>Área:</Text>
                          <Text style={styles.viewValue}>{stock.area.name || 'N/A'}</Text>
                        </View>
                      )}
                      <View style={styles.viewRow}>
                        <Text style={styles.viewLabel}>Cantidad:</Text>
                        <Text style={[styles.viewValue, styles.stockQuantityHighlight]}>
                          {stock.availableQuantityBase ?? stock.quantityBase} unidades disponibles
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Información Adicional */}
              <View style={styles.viewSection}>
                <Text style={styles.viewSectionTitle}>ℹ️ Información Adicional</Text>
                {viewProduct.minStockAlert && (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>Alerta de Stock Mínimo:</Text>
                    <Text style={styles.viewValue}>{viewProduct.minStockAlert} unidades</Text>
                  </View>
                )}
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>ID:</Text>
                  <Text style={[styles.viewValue, styles.idText]}>{viewProduct.id}</Text>
                </View>
                {viewProduct.createdAt && (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>Creado:</Text>
                    <Text style={styles.viewValue}>
                      {new Date(viewProduct.createdAt).toLocaleString('es-PE')}
                    </Text>
                  </View>
                )}
                {viewProduct.updatedAt && (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>Actualizado:</Text>
                    <Text style={styles.viewValue}>
                      {new Date(viewProduct.updatedAt).toLocaleString('es-PE')}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseButtonBottom}
                onPress={() => setIsViewModalVisible(false)}
              >
                <Text style={styles.modalCloseButtonBottomText}>Cerrar</Text>
              </TouchableOpacity>
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
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 12,
  },
  filterScroll: {
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingBottom: 100,
  },
  contentLandscape: {
    paddingBottom: 70,
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
  productsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  productThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F1F5F9',
  },
  productThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productThumbnailPlaceholderText: {
    fontSize: 28,
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
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  productCorrelative: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
    fontFamily: 'monospace',
  },
  productSku: {
    fontSize: 13,
    color: '#64748B',
  },
  duplicateBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  duplicateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 16,
  },
  productDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginBottom: 12,
  },
  productDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
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
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  productFooterInfo: {
    flex: 1,
    gap: 4,
  },
  productFooterText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  productArrow: {
    fontSize: 20,
    color: '#94A3B8',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#DC2626',
  },
  viewButton: {
    backgroundColor: '#EEF2FF',
  },
  viewButtonText: {
    color: '#667eea',
  },
  imagesButton: {
    backgroundColor: '#FEF3C7',
  },
  imagesButtonText: {
    color: '#D97706',
  },
  pricesButton: {
    backgroundColor: '#DCFCE7',
  },
  pricesButtonText: {
    color: '#16A34A',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 20,
    color: '#1E293B',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  viewSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  viewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
  },
  viewLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  viewValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  viewValueRow: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  correlativeHighlight: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  duplicateBadgeSmall: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  duplicateBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
  },
  viewStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  presentationViewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presentationViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  presentationViewName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  baseBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  baseBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceViewCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  priceHighlight: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
  },
  stockViewCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  stockQuantityHighlight: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '700',
  },
  idText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  modalFooter: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalCloseButtonBottom: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonBottomText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageGallery: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  productImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
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
    marginBottom: 60,
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
  floatingButtonsContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    zIndex: 9998,
    pointerEvents: 'box-none',
  },
});

export default ProductsScreen;
