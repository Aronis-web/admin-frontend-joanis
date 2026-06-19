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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Product, productsApi } from '@/services/api/products';
import { inventoryApi } from '@/services/api/inventory';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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

      console.log('🔍 Buscando productos con query:', searchQuery);
      setIsSearching(true);
      try {
        // Usar endpoint v2 para búsqueda (más rápido y con full-text search)
        const response = await productsApi.searchProductsV2({
          q: searchQuery,
          limit: 10,
          status: 'active,preliminary',
          includePhotos: true,
        });

        console.log('✅ Productos encontrados:', response.results?.length || 0);

        // Cargar el stock de cada producto encontrado usando inventoryApi
        if (response.results && response.results.length > 0) {
          const productsWithStock = await Promise.all(
            response.results.map(async (product) => {
              try {
                // Obtener el stock del producto usando el endpoint de inventario
                const stockResponse = await inventoryApi.getStockByProduct(product.id);
                const stockItems = stockResponse?.stockByWarehouse || [];
                console.log('📦 Producto:', product.title, 'Stock items:', stockItems.length);

                // Agregar stockItems al producto
                return {
                  ...product,
                  stockItems,
                };
              } catch (error) {
                console.error('Error loading stock for product:', product.id, error);
                return {
                  ...product,
                  stockItems: [],
                }; // Devolver el producto sin stock si falla
              }
            })
          );
          setFilteredProducts(productsWithStock as unknown as Product[]);
        } else {
          setFilteredProducts([]);
        }

        setShowDropdown(true); // Asegurar que el dropdown se muestre
      } catch (error) {
        console.error('❌ Error searching products:', error);
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
    if (!product.stockItems || product.stockItems.length === 0) {
      return 0;
    }

    // Si hay warehouseId específico, buscar solo ese almacén
    if (warehouseId) {
      const stockItem = product.stockItems.find((item) => item.warehouseId === warehouseId);
      // Usar availableQuantityBase (stock disponible = total - reservado)
      return stockItem?.availableQuantityBase || stockItem?.quantityBase || 0;
    }

    // Si no hay warehouseId, sumar todo el stock disponible
    return product.stockItems.reduce((total, item) => {
      // Usar availableQuantityBase si existe, sino quantityBase
      const available = item.availableQuantityBase ?? item.quantityBase ?? 0;
      return total + (typeof available === 'number' ? available : parseFloat(available) || 0);
    }, 0);
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
              placeholderTextColor={theme.color.text.placeholder}
            />
            {isSearching && (
              <ActivityIndicator
                size="small"
                color={theme.color.brand.accent}
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

          {showDropdown && searchQuery.trim() !== '' && filteredProducts.length === 0 && !isSearching && (
            <View style={styles.dropdown}>
              <Text style={styles.noResultsText}>No se encontraron productos</Text>
            </View>
          )}

          {showDropdown && searchQuery.trim() !== '' && isSearching && filteredProducts.length === 0 && (
            <View style={styles.dropdown}>
              <View style={styles.searchingContainer}>
                <ActivityIndicator size="small" color={theme.color.brand.accent} />
                <Text style={styles.searchingText}>Buscando productos...</Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      zIndex: 1,
    },
    inputContainer: {
      position: 'relative',
    },
    input: {
      backgroundColor: theme.color.background.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      paddingRight: 40, // Espacio para el indicador de carga
      fontSize: 14,
      color: theme.color.text.heading,
    },
    inputDisabled: {
      backgroundColor: theme.color.surface.muted,
      color: theme.color.text.placeholder,
    },
    searchingIndicator: {
      position: 'absolute',
      right: 12,
      top: 12,
    },
    selectedContainer: {
      backgroundColor: theme.color.brand.primarySoft,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
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
      color: theme.color.brand.primary,
      marginBottom: theme.space[0.5],
    },
    selectedMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginBottom: theme.space[0.5],
    },
    selectedCorrelative: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.accent,
      fontFamily: 'monospace',
    },
    selectedSku: {
      fontSize: 12,
      color: theme.color.text.body,
      marginBottom: theme.space[0.5],
    },
    productMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    productCorrelative: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.brand.accent,
      fontFamily: 'monospace',
    },
    selectedStock: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    clearButton: {
      width: 24,
      height: 24,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: theme.space[2],
    },
    clearButtonText: {
      fontSize: 16,
      color: theme.color.text.body,
      fontWeight: 'bold',
    },
    dropdown: {
      position: 'absolute',
      top: 48,
      left: 0,
      right: 0,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      maxHeight: 250,
      shadowColor: theme.color.shadow,
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
      padding: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    productInfo: {
      flex: 1,
      marginRight: theme.space[2],
    },
    productTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    productSku: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    stockInfo: {
      alignItems: 'flex-end',
    },
    stockText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.state.success.border,
    },
    stockTextZero: {
      color: theme.color.state.danger.border,
    },
    noStockBadge: {
      fontSize: 10,
      color: theme.color.state.danger.border,
      backgroundColor: theme.color.state.danger.background,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 2,
    },
    noResultsText: {
      padding: theme.space[4],
      textAlign: 'center',
      color: theme.color.text.muted,
      fontSize: 14,
    },
    searchingContainer: {
      padding: theme.space[4],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
    },
    searchingText: {
      color: theme.color.text.muted,
      fontSize: 14,
      marginLeft: theme.space[2],
    },
  });
