import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Product, productsApi } from '@/services/api/products';

interface ProductAutocompleteProps {
  products: Product[]; // ⚠️ DEPRECATED - Ya no se usa, búsqueda en tiempo real con V2
  selectedProductId: string;
  warehouseId?: string;
  onSelectProduct: (product: Product) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ProductAutocomplete: React.FC<ProductAutocompleteProps> = ({
  products, // Mantenido para compatibilidad pero no se usa
  selectedProductId,
  warehouseId,
  onSelectProduct,
  placeholder = 'Buscar producto...',
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Cargar producto seleccionado si existe
  useEffect(() => {
    if (selectedProductId && products.length > 0) {
      const product = products.find((p) => p.id === selectedProductId);
      if (product) {
        setSelectedProduct(product);
      }
    }
  }, [selectedProductId, products]);

  // Búsqueda de productos con stock incluido
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.trim() === '') {
        setFilteredProducts([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // Usar endpoint v1 con include para obtener stock
        const response = await productsApi.getAllProducts({
          q: searchQuery,
          limit: 10,
          status: 'active,preliminary',
          include: 'stockItems.warehouse,stockItems.area', // ✅ Incluir stock con relaciones
        });

        setFilteredProducts(response.products || []);
      } catch (error) {
        console.error('Error searching products:', error);
        setFilteredProducts([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce de 300ms para búsqueda en tiempo real
    const timer = setTimeout(searchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    onSelectProduct(product);
    setSearchQuery('');
    setShowDropdown(false);
    setFilteredProducts([]);
  };

  const getProductStock = (product: Product): number => {
    if (!warehouseId || !product.stockItems) {
      return 0;
    }

    const stockItem = product.stockItems.find((item) => item.warehouseId === warehouseId);
    return stockItem?.quantityBase || 0;
  };

  return (
    <View style={styles.container}>
      {selectedProduct ? (
        <View style={styles.selectedContainer}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedTitle} numberOfLines={1}>
              {selectedProduct.title}
            </Text>
            <View style={styles.selectedMetaRow}>
              {selectedProduct.correlativeNumber && (
                <Text style={styles.selectedCorrelative}>#{selectedProduct.correlativeNumber}</Text>
              )}
              <Text style={styles.selectedSku}>SKU: {selectedProduct.sku}</Text>
            </View>
            {warehouseId && (
              <Text style={styles.selectedStock}>
                Stock disponible: {getProductStock(selectedProduct).toFixed(2)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedProduct(null);
              onSelectProduct({ id: '' } as Product);
            }}
            style={styles.clearButton}
            disabled={disabled}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, disabled && styles.inputDisabled]}
              placeholder={placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setShowDropdown(true)}
              editable={!disabled}
              placeholderTextColor="#94A3B8"
            />
            {isSearching && (
              <ActivityIndicator
                size="small"
                color="#6366F1"
                style={styles.searchingIndicator}
              />
            )}
          </View>

          {showDropdown && filteredProducts.length > 0 && (
            <View style={styles.dropdown}>
              <ScrollView
                style={styles.dropdownList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {filteredProducts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.dropdownItem}
                    onPress={() => handleSelectProduct(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.productInfo}>
                      <Text style={styles.productTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.productMetaRow}>
                        {item.correlativeNumber && (
                          <Text style={styles.productCorrelative}>#{item.correlativeNumber}</Text>
                        )}
                        <Text style={styles.productSku}>SKU: {item.sku}</Text>
                      </View>
                    </View>
                    <View style={styles.stockInfo}>
                      <Text
                        style={[
                          styles.stockText,
                          getProductStock(item) === 0 && styles.stockTextZero,
                        ]}
                      >
                        Stock: {getProductStock(item).toFixed(2)}
                      </Text>
                      {getProductStock(item) === 0 && (
                        <Text style={styles.noStockBadge}>Sin stock</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showDropdown && searchQuery.trim() !== '' && filteredProducts.length === 0 && (
            <View style={styles.dropdown}>
              <Text style={styles.noResultsText}>No se encontraron productos</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    paddingRight: 40, // Espacio para el indicador de carga
    fontSize: 14,
    color: '#1E293B',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  searchingIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  selectedContainer: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedInfo: {
    flex: 1,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 2,
  },
  selectedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  selectedCorrelative: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    fontFamily: 'monospace',
  },
  selectedSku: {
    fontSize: 12,
    color: '#0369A1',
    marginBottom: 2,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productCorrelative: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
    fontFamily: 'monospace',
  },
  selectedStock: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '500',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#0369A1',
    fontWeight: 'bold',
  },
  dropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  dropdownList: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productInfo: {
    flex: 1,
    marginRight: 8,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 2,
  },
  productSku: {
    fontSize: 12,
    color: '#64748B',
  },
  stockInfo: {
    alignItems: 'flex-end',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  stockTextZero: {
    color: '#EF4444',
  },
  noStockBadge: {
    fontSize: 10,
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  noResultsText: {
    padding: 16,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
  },
});
