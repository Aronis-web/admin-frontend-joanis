import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { ProductPhotosModal } from '@/components/Photos';
import { productsApi, Product } from '@/services/api/products';
import { AddButton } from '@/components/Navigation/AddButton';
import { useProducts } from '@/hooks/api/useProducts';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';

interface PhotosScreenProps {
  navigation: any;
}

export const PhotosScreen: React.FC<PhotosScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isPhotosModalVisible, setIsPhotosModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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
    }, 800);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // React Query: Load products with images
  const filters = useMemo(
    () => ({
      page,
      limit,
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(debouncedSearchQuery.trim() && { q: debouncedSearchQuery.trim() }),
      include: 'images',
      sortBy: 'correlativeNumber',
      sortOrder: 'desc' as const,
    }),
    [page, statusFilter, debouncedSearchQuery]
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

  const filteredProducts = useMemo(() => {
    return products;
  }, [products]);

  // Auto-reload products when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📸 PhotosScreen focused - refetching products...');
      refetch();
    }, [refetch])
  );

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'preliminary':
        return '#F59E0B';
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
      case 'preliminary':
        return '⚠️ Preliminar';
      case 'draft':
        return 'Borrador';
      case 'archived':
        return 'Archivado';
      default:
        return status;
    }
  };

  const handleManagePhotos = (product: Product) => {
    setSelectedProduct(product);
    setIsPhotosModalVisible(true);
  };

  const handlePhotosSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading && !productsResponse) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fotos de Productos</Text>
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
        <Text style={styles.headerTitle}>📸 Fotos de Productos</Text>
        <View style={styles.backButton} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, SKU o #correlativo..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
        {searchQuery !== debouncedSearchQuery && (
          <ActivityIndicator size="small" color="#3B82F6" style={styles.searchLoader} />
        )}
      </View>

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
            {filteredProducts.filter((p) => (p.photos && p.photos.length > 0) || p.imageUrl).length}
          </Text>
          <Text style={styles.statLabel}>Con Fotos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.statValue}>
            {filteredProducts.filter((p) => !p.photos && !p.imageUrl).length}
          </Text>
          <Text style={styles.statLabel}>Sin Fotos</Text>
        </View>
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
              {debouncedSearchQuery
                ? 'No se encontraron productos con ese criterio de búsqueda'
                : 'No hay productos disponibles'}
            </Text>
          </View>
        ) : (
          <View style={styles.productsList}>
            {filteredProducts.map((product, index) => {
              const hasPhotos = (product.photos && product.photos.length > 0) || product.imageUrl || (product.imageUrls && product.imageUrls.length > 0);
              const photoCount = product.photos?.length || product.imageUrls?.length || (product.imageUrl ? 1 : 0);
              const imageUri = product.photos?.[0] || product.imageUrl || product.imageUrls?.[0];

              return (
                <View key={product.id || index} style={styles.productCard}>
                  <TouchableOpacity
                    onPress={() => handleManagePhotos(product)}
                    style={styles.productCardContent}
                  >
                    <View style={styles.productHeader}>
                      {/* Product Image Thumbnail */}
                      {hasPhotos ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.productThumbnail}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.productThumbnailPlaceholder}>
                          <Text style={styles.productThumbnailPlaceholderText}>📷</Text>
                        </View>
                      )}
                      <View style={styles.productInfo}>
                        <Text style={styles.productTitle}>{product.title}</Text>
                        <View style={styles.productMetaRow}>
                          {product.correlativeNumber && (
                            <Text style={styles.productCorrelative}>
                              #{product.correlativeNumber}
                            </Text>
                          )}
                          <Text style={styles.productSku}>SKU: {product.sku}</Text>
                        </View>
                        <View style={styles.photoCountBadge}>
                          <Text style={styles.photoCountText}>
                            📸 {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
                          </Text>
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

                    <View style={styles.productFooter}>
                      <View style={styles.productFooterInfo}>
                        {hasPhotos ? (
                          <Text style={styles.productFooterTextSuccess}>✓ Tiene fotos</Text>
                        ) : (
                          <Text style={styles.productFooterTextWarning}>⚠️ Sin fotos</Text>
                        )}
                      </View>
                      <Text style={styles.productArrow}>›</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Action Buttons */}
                  <View style={styles.productActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.photosButton]}
                      onPress={() => handleManagePhotos(product)}
                    >
                      <Text style={[styles.actionButtonText, styles.photosButtonText]}>
                        📸 Gestionar Fotos
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Pagination Controls */}
      {!isLoading && pagination.total > 0 && (
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
              {debouncedSearchQuery && ' (filtrados)'}
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

      {/* Product Photos Modal */}
      {selectedProduct && (
        <ProductPhotosModal
          visible={isPhotosModalVisible}
          onClose={() => setIsPhotosModalVisible(false)}
          onSuccess={handlePhotosSuccess}
          product={selectedProduct}
        />
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#1E293B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  clearIcon: {
    fontSize: 18,
    color: '#94A3B8',
    paddingHorizontal: 8,
  },
  searchLoader: {
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
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
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentLandscape: {
    paddingHorizontal: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  productsList: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  productCardContent: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  productThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productThumbnailPlaceholderText: {
    fontSize: 24,
  },
  productInfo: {
    flex: 1,
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
    marginBottom: 4,
  },
  productCorrelative: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
  },
  productSku: {
    fontSize: 12,
    color: '#64748B',
  },
  photoCountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  photoCountText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productFooterInfo: {
    flex: 1,
  },
  productFooterTextSuccess: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  productFooterTextWarning: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
  },
  productArrow: {
    fontSize: 24,
    color: '#CBD5E1',
  },
  productActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  actionButton: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  photosButton: {
    backgroundColor: '#EEF2FF',
  },
  photosButtonText: {
    color: '#3B82F6',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
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
  paginationInfo: {
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
