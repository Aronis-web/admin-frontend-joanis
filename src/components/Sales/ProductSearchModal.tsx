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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  searchContainer: {
    padding: 16,
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
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
    paddingHorizontal: 16,
  },
  productItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    position: 'relative',
  },
  productContent: {
    flexDirection: 'row',
    gap: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  skuBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skuText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  productBarcode: {
    fontSize: 13,
    color: '#666',
  },
  productCategory: {
    fontSize: 13,
    color: '#999',
  },
  presentationsContainer: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  presentationsLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 2,
  },
  presentationItem: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
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
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
