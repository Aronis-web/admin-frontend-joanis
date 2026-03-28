import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { productsApi, Product } from '@/services/api/products';
import { inventoryApi, StockItemResponse } from '@/services/api/inventory';
import { useDebounce } from '@/hooks/useDebounce';

interface ProductSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product, stock: StockItemResponse[]) => void;
  warehouseId?: string;
  excludeProductIds?: string[];
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  visible,
  onClose,
  onSelectProduct,
  warehouseId,
  excludeProductIds = [],
}) => {
  const [searchText, setSearchText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStock, setLoadingStock] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchText, 300);

  // Buscar productos
  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setProducts([]);
      return;
    }

    setLoading(true);
    try {
      const response = await productsApi.searchProductsV2({
        q: query,
        limit: 20,
        status: 'active',
      });

      // Filtrar productos excluidos
      const filteredProducts = response.results.filter(
        (product: Product) => !excludeProductIds.includes(product.id)
      );

      setProducts(filteredProducts);
    } catch (error) {
      console.error('Error buscando productos:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [excludeProductIds]);

  // Efecto para buscar cuando cambia el texto con debounce
  React.useEffect(() => {
    searchProducts(debouncedSearch);
  }, [debouncedSearch, searchProducts]);

  const handleSelectProduct = async (product: Product) => {
    if (!warehouseId) {
      onSelectProduct(product, []);
      setSearchText('');
      setProducts([]);
      onClose();
      return;
    }

    // Obtener stock del producto
    setLoadingStock(product.id);
    try {
      const stockData = await inventoryApi.getStockByProduct(product.id);

      // Filtrar stock del almacén seleccionado
      const warehouseStock = stockData.stockByWarehouse.filter(
        (stock) => stock.warehouseId === warehouseId
      );

      // Convertir a formato StockItemResponse
      const stockItems: StockItemResponse[] = warehouseStock.map((stock) => ({
        id: `${product.id}-${stock.warehouseId}`,
        productId: product.id,
        warehouseId: stock.warehouseId,
        areaId: stock.areaId || null,
        quantityBase: stock.quantityBase,
        reservedQuantityBase: 0,
        availableQuantityBase: stock.quantityBase,
        updatedAt: new Date().toISOString(),
        product: {
          id: product.id,
          title: product.title,
          sku: product.sku,
        },
        warehouse: {
          id: stock.warehouseId,
          name: stock.warehouseName,
          code: '',
          siteId: '',
        },
        area: stock.areaId ? {
          id: stock.areaId,
          name: stock.areaName || '',
          code: '',
        } : null,
      }));

      onSelectProduct(product, stockItems);
      setSearchText('');
      setProducts([]);
      onClose();
    } catch (error) {
      console.error('Error obteniendo stock:', error);
      onSelectProduct(product, []);
      setSearchText('');
      setProducts([]);
      onClose();
    } finally {
      setLoadingStock(null);
    }
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const isLoadingStock = loadingStock === item.id;

    return (
      <TouchableOpacity
        style={styles.productItem}
        onPress={() => handleSelectProduct(item)}
        disabled={isLoadingStock}
      >
        <View style={styles.productContent}>
          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.productImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.title}
              </Text>
              {item.sku && (
                <View style={styles.skuBadge}>
                  <Text style={styles.skuText}>{item.sku}</Text>
                </View>
              )}
            </View>

            {item.barcode && (
              <Text style={styles.productBarcode}>Código: {item.barcode}</Text>
            )}

            {item.category && (
              <Text style={styles.productCategory}>{item.category.name}</Text>
            )}

            {item.presentations && item.presentations.length > 0 && (
              <View style={styles.presentationsContainer}>
                <Text style={styles.presentationsLabel}>Presentaciones:</Text>
                {item.presentations.slice(0, 2).map((pres: any, index: number) => (
                  <Text key={index} style={styles.presentationItem}>
                    • {pres.presentation?.name || 'N/A'}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {isLoadingStock && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#007bff" />
            <Text style={styles.loadingText}>Verificando stock...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Buscar Producto</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Buscar por nombre, SKU o código de barras..."
              placeholderTextColor="#999"
              autoFocus
            />
            {loading && (
              <ActivityIndicator
                size="small"
                color="#007bff"
                style={styles.loader}
              />
            )}
          </View>

          <FlatList
            data={products}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              searchText.length >= 2 && !loading ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No se encontraron productos
                  </Text>
                </View>
              ) : searchText.length < 2 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Escribe al menos 2 caracteres para buscar
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
    paddingBottom: spacing[5],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.neutral[800],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
  },
  searchContainer: {
    padding: spacing[4],
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    fontSize: 16,
    backgroundColor: colors.surface.primary,
  },
  loader: {
    position: 'absolute',
    right: 28,
    top: 28,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing[4],
  },
  productItem: {
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    backgroundColor: colors.surface.primary,
    position: 'relative',
  },
  productContent: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
  },
  productInfo: {
    flex: 1,
    gap: spacing[1],
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    flex: 1,
  },
  skuBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  skuText: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  productBarcode: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  productCategory: {
    fontSize: 13,
    color: colors.neutral[400],
  },
  presentationsContainer: {
    marginTop: spacing[1],
    paddingTop: spacing[1.5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  presentationsLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    fontWeight: '600',
    marginBottom: 2,
  },
  presentationItem: {
    fontSize: 12,
    color: colors.neutral[500],
    marginLeft: spacing[2],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  loadingText: {
    fontSize: 14,
    color: colors.info[500],
    fontWeight: '600',
  },
  emptyContainer: {
    padding: spacing[10],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
