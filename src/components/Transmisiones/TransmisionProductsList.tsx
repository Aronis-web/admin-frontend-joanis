import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles, useTheme } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { transmisionesApi, productsApi } from '@/services/api';
import {
  TransmisionProduct,
  ProductStatus,
  getProductStatusLabel,
  getProductStatusColor,
  formatCentsToCurrency,
  calculateProfitMargin,
  isProductPreliminary,
  isProductActive,
} from '@/types/transmisiones';
import { QuickEditModal } from '@/components/Transmisiones/QuickEditModal';
import { ProductBannerModal } from '@/components/Transmisiones/ProductBannerModal';

interface TransmisionProductsListProps {
  transmisionId: string;
  products: TransmisionProduct[];
  onProductsChanged: () => void;
}

export const TransmisionProductsList: React.FC<TransmisionProductsListProps> = ({
  transmisionId,
  products,
  onProductsChanged,
}) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const placeholderColor = theme.color.text.placeholder;
  const inverseTextColor = theme.color.text.inverse;
  const [selectedProduct, setSelectedProduct] = useState<TransmisionProduct | null>(null);
  const [quickEditModalVisible, setQuickEditModalVisible] = useState(false);
  const [bannerModalVisible, setBannerModalVisible] = useState(false);
  const [bannerProduct, setBannerProduct] = useState<TransmisionProduct | null>(null);
  const [processingProductId, setProcessingProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const handleQuickEdit = (product: TransmisionProduct) => {
    setSelectedProduct(product);
    setQuickEditModalVisible(true);
  };

  const handleQuickEditSaved = () => {
    setQuickEditModalVisible(false);
    setSelectedProduct(null);
    onProductsChanged();
  };

  const handleShowBanner = (product: TransmisionProduct) => {
    setBannerProduct(product);
    setBannerModalVisible(true);
  };

  // Search all products with debounce
  useEffect(() => {
    const searchAllProducts = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      setIsSearching(true);
      setShowSearchResults(true);

      try {
        // ✅ Usar endpoint v2 optimizado
        const response = await productsApi.searchProductsV2({
          q: searchQuery.trim(),
          limit: 20,
          status: 'active,preliminary',
          includePhotos: true, // ✅ Incluir fotos para mostrar miniaturas
        });

        console.log('🔍 Search response:', response);
        console.log('⚡ Search time:', response.searchTime, 'ms');
        console.log('💾 Cached:', response.cached);

        setSearchResults(response.results || []);
      } catch (error) {
        console.error('Error searching products:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchAllProducts, 800); // Aumentado a 800ms para permitir escribir
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Filter products in transmission based on search query
  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim()) {
      return true;
    }

    const query = searchQuery.toLowerCase();
    const title = product.product?.title?.toLowerCase() || '';
    const sku = product.product?.sku?.toLowerCase() || '';

    return title.includes(query) || sku.includes(query);
  });

  // Handle adding product from search
  const handleAddProductFromSearch = async (product: any) => {
    Alert.alert('Agregar Producto', `¿Deseas agregar "${product.title}" a esta transmisión?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Agregar',
        onPress: async () => {
          try {
            await transmisionesApi.addProductToTransmision(transmisionId, {
              productId: product.id,
            });
            Alert.alert('Éxito', 'Producto agregado a la transmisión');
            setSearchQuery('');
            setShowSearchResults(false);
            onProductsChanged();
          } catch (error: any) {
            console.error('Error adding product:', error);
            Alert.alert('Error', error.message || 'No se pudo agregar el producto');
          }
        },
      },
    ]);
  };

  const handleCheckValidation = async (product: TransmisionProduct) => {
    try {
      setProcessingProductId(product.id);
      const result = await transmisionesApi.checkProductValidation(transmisionId, product.id);

      if (result.statusChanged) {
        Alert.alert(
          '✅ Producto Validado',
          `El producto "${product.product?.title}" ha sido validado y ahora está activo.`,
          [{ text: 'OK', onPress: onProductsChanged }]
        );
      } else {
        Alert.alert(
          'ℹ️ Sin Cambios',
          `El producto "${product.product?.title}" aún está en estado preliminar.`
        );
      }
    } catch (error: any) {
      console.error('Error checking validation:', error);
      Alert.alert('Error', 'No se pudo verificar la validación del producto');
    } finally {
      setProcessingProductId(null);
    }
  };

  const handleUpdateData = async (product: TransmisionProduct) => {
    try {
      setProcessingProductId(product.id);
      const result = await transmisionesApi.updateProductData(transmisionId, product.id);

      if (result.updated) {
        const changes = [];
        if (result.changes.costCents) {
          changes.push(
            `Costo: ${formatCentsToCurrency(result.changes.costCents.old)} → ${formatCentsToCurrency(result.changes.costCents.new)}`
          );
        }
        if (result.changes.salePriceCents) {
          changes.push(
            `Precio: ${formatCentsToCurrency(result.changes.salePriceCents.old)} → ${formatCentsToCurrency(result.changes.salePriceCents.new)}`
          );
        }

        Alert.alert(
          '✅ Datos Actualizados',
          changes.length > 0
            ? `Se actualizaron los siguientes datos:\n\n${changes.join('\n')}`
            : 'Los datos ya estaban actualizados.',
          [{ text: 'OK', onPress: onProductsChanged }]
        );
      } else {
        Alert.alert('ℹ️ Sin Cambios', 'Los datos del producto ya están actualizados.');
      }
    } catch (error: any) {
      console.error('Error updating product data:', error);
      Alert.alert('Error', 'No se pudieron actualizar los datos del producto');
    } finally {
      setProcessingProductId(null);
    }
  };

  const handleRemoveProduct = (product: TransmisionProduct) => {
    Alert.alert(
      'Eliminar Producto',
      `¿Estás seguro de que deseas eliminar "${product.product?.title}" de esta transmisión?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transmisionesApi.removeProductFromTransmision(transmisionId, product.productId);
              Alert.alert('Éxito', 'Producto eliminado de la transmisión');
              onProductsChanged();
            } catch (error: any) {
              console.error('Error removing product:', error);
              Alert.alert('Error', 'No se pudo eliminar el producto');
            }
          },
        },
      ]
    );
  };

  const renderProductCard = (product: TransmisionProduct) => {
    const isPreliminary = isProductPreliminary(product.productStatus);
    const isActive = isProductActive(product.productStatus);
    const profitMargin = calculateProfitMargin(product.costCents, product.salePriceCents);
    const isProcessing = processingProductId === product.id;

    return (
      <View key={product.id} style={[styles.card, isTablet && styles.cardTablet]}>
        <View style={styles.cardHeader}>
          <View style={styles.productInfo}>
            {product.product?.imageUrl && (
              <Image source={{ uri: product.product.imageUrl }} style={styles.productImage} />
            )}
            <View style={styles.productDetails}>
              <Text style={[styles.productTitle, isTablet && styles.productTitleTablet]}>
                {product.product?.title || 'Producto sin nombre'}
              </Text>
              <Text style={styles.productSku}>SKU: {product.product?.sku || 'N/A'}</Text>
              <View style={[styles.statusBadge, getStatusBadgeStyle(product.productStatus)]}>
                <Text style={[styles.statusText, getStatusTextStyle(product.productStatus)]}>
                  {getProductStatusLabel(product.productStatus)}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleRemoveProduct(product)}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.priceContainer}>
          <View style={styles.priceItem}>
            <Text style={styles.priceLabel}>Costo</Text>
            <Text style={styles.priceValue}>{formatCentsToCurrency(product.costCents)}</Text>
          </View>
          <View style={styles.priceItem}>
            <Text style={styles.priceLabel}>Precio Venta</Text>
            <Text style={styles.priceValue}>{formatCentsToCurrency(product.salePriceCents)}</Text>
          </View>
          <View style={styles.priceItem}>
            <Text style={styles.priceLabel}>Margen</Text>
            <Text
              style={[
                styles.priceValue,
                profitMargin > 0 ? styles.profitPositive : styles.profitNegative,
              ]}
            >
              {profitMargin.toFixed(1)}%
            </Text>
          </View>
        </View>

        {product.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notas:</Text>
            <Text style={styles.notesText}>{product.notes}</Text>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.bannerButton]}
            onPress={() => handleShowBanner(product)}
            disabled={isProcessing}
          >
            <Text style={styles.bannerButtonText}>📊 Ver Banner</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleQuickEdit(product)}
            disabled={isProcessing}
          >
            <Text style={styles.editButtonText}>✏️ Editar Precios</Text>
          </TouchableOpacity>

          {isPreliminary && (
            <TouchableOpacity
              style={[styles.actionButton, styles.validateButton]}
              onPress={() => handleCheckValidation(product)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={inverseTextColor} />
              ) : (
                <Text style={styles.validateButtonText}>🔍 Verificar Validación</Text>
              )}
            </TouchableOpacity>
          )}

          {isActive && (
            <TouchableOpacity
              style={[styles.actionButton, styles.updateButton]}
              onPress={() => handleUpdateData(product)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={inverseTextColor} />
              ) : (
                <Text style={styles.updateButtonText}>🔄 Actualizar Datos</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const getStatusBadgeStyle = (status: ProductStatus) => {
    return {
      backgroundColor: getProductStatusColor(status) + '20',
      borderColor: getProductStatusColor(status),
    };
  };

  const getStatusTextStyle = (status: ProductStatus) => {
    return {
      color: getProductStatusColor(status),
    };
  };

  if (products.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyTitle}>No hay productos</Text>
        <Text style={styles.emptySubtitle}>Agrega productos a esta transmisión para comenzar</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Productos ({products.length})</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={placeholderColor} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar en todos los productos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={placeholderColor}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setShowSearchResults(false);
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={placeholderColor} />
            </TouchableOpacity>
          )}
          {isSearching && (
            <ActivityIndicator size="small" color={'#8B5CF6'} style={styles.searchLoader} />
          )}
        </View>
      </View>

      {/* Search Results Dropdown */}
      {showSearchResults && searchQuery.trim() && (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.searchResultsTitle}>
            Resultados de búsqueda ({searchResults.length})
          </Text>
          {searchResults.length === 0 && !isSearching ? (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No se encontraron productos</Text>
            </View>
          ) : (
            searchResults.map((product) => {
              const isInTransmission = products.some((p) => p.productId === product.id);
              return (
                <View key={product.id} style={styles.searchResultItem}>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>
                      {product.title}
                    </Text>
                    <Text style={styles.searchResultSku}>SKU: {product.sku}</Text>
                    <Text style={styles.searchResultStatus}>
                      {product.status === 'preliminary' ? '⚠️ Preliminar' : '✅ Activo'}
                    </Text>
                  </View>
                  {isInTransmission ? (
                    <View style={styles.inTransmissionBadge}>
                      <Text style={styles.inTransmissionText}>✓ En transmisión</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addFromSearchButton}
                      onPress={() => handleAddProductFromSearch(product)}
                    >
                      <Ionicons name="add-circle" size={24} color={'#8B5CF6'} />
                      <Text style={styles.addFromSearchText}>Agregar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Products in Transmission */}
      {filteredProducts.length === 0 && searchQuery.trim() && !showSearchResults ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No se encontraron productos en la transmisión</Text>
          <Text style={styles.emptySubtitle}>
            Busca en todos los productos arriba para agregar nuevos
          </Text>
        </View>
      ) : !showSearchResults ? (
        filteredProducts.map(renderProductCard)
      ) : null}

      {selectedProduct && (
        <QuickEditModal
          visible={quickEditModalVisible}
          transmisionId={transmisionId}
          product={selectedProduct}
          onClose={() => {
            setQuickEditModalVisible(false);
            setSelectedProduct(null);
          }}
          onSaved={handleQuickEditSaved}
        />
      )}

      <ProductBannerModal
        visible={bannerModalVisible}
        product={bannerProduct}
        onClose={() => {
          setBannerModalVisible(false);
          setBannerProduct(null);
        }}
      />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    searchIcon: {
      marginRight: theme.space[2],
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.color.text.heading,
    },
    clearButton: {
      padding: 4,
    },
    searchLoader: {
      marginLeft: theme.space[2],
    },
    searchResultsContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      maxHeight: 400,
    },
    searchResultsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.muted,
      marginBottom: theme.space[3],
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    noResultsContainer: {
      padding: 20,
      alignItems: 'center',
    },
    noResultsText: {
      fontSize: 14,
      color: theme.color.text.placeholder,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[2],
    },
    searchResultInfo: {
      flex: 1,
      marginRight: theme.space[3],
    },
    searchResultTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    searchResultSku: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    searchResultStatus: {
      fontSize: 11,
      color: theme.color.text.placeholder,
    },
    inTransmissionBadge: {
      backgroundColor: theme.color.state.success.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.state.success.border,
    },
    inTransmissionText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.state.success.text,
    },
    addFromSearchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F3E8FF',
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: '#8B5CF6',
    },
    addFromSearchText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#8B5CF6',
      marginLeft: theme.space[1],
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    cardTablet: {
      padding: 20,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.space[3],
    },
    productInfo: {
      flex: 1,
      flexDirection: 'row',
      marginRight: theme.space[3],
    },
    productImage: {
      width: 60,
      height: 60,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      marginRight: theme.space[3],
    },
    productDetails: {
      flex: 1,
    },
    productTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    productTitleTablet: {
      fontSize: 18,
    },
    productSku: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: 6,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
    },
    deleteButton: {
      padding: 8,
    },
    deleteButtonText: {
      fontSize: 20,
    },
    priceContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.space[3],
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.color.border.subtle,
      marginBottom: theme.space[3],
    },
    priceItem: {
      flex: 1,
      alignItems: 'center',
    },
    priceLabel: {
      fontSize: 12,
      color: theme.color.text.placeholder,
      marginBottom: theme.space[1],
    },
    priceValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    profitPositive: {
      color: theme.color.text.success,
    },
    profitNegative: {
      color: theme.color.text.danger,
    },
    notesContainer: {
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[3],
    },
    notesLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    notesText: {
      fontSize: 14,
      color: theme.color.text.body,
      lineHeight: 20,
    },
    actionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    actionButton: {
      flex: 1,
      minWidth: '45%',
      paddingVertical: 10,
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editButton: {
      backgroundColor: theme.color.brand.primary,
    },
    editButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    validateButton: {
      backgroundColor: theme.color.icon.warning,
    },
    validateButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    updateButton: {
      backgroundColor: theme.color.action.success.background,
    },
    updateButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.action.success.text,
    },
    bannerButton: {
      backgroundColor: '#8B5CF6',
    },
    bannerButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    emptyContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[10],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: theme.space[4],
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
  });
