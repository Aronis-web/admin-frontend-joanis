import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { productsApi, Product } from '@/services/api/products';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { useDebounce } from '@/hooks/useDebounce';

interface ProductAutocompleteProps {
  onSelectProduct: (product: Product) => void;
  placeholder?: string;
  excludeProductIds?: string[];
}

export const ProductAutocomplete: React.FC<ProductAutocompleteProps> = ({
  onSelectProduct,
  placeholder = 'Buscar producto por nombre o código...',
  excludeProductIds = [],
}) => {
  const [searchText, setSearchText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const debouncedSearch = useDebounce(searchText, 300);

  // Buscar productos
  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setProducts([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const response = await productsApi.searchProductsV2({
        q: query,
        limit: 10,
      });

      // Filtrar productos excluidos
      const filteredProducts = response.results.filter(
        (product: Product) => !excludeProductIds.includes(product.id)
      );

      setProducts(filteredProducts);
      setShowDropdown(filteredProducts.length > 0);
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

  const handleSelectProduct = (product: Product) => {
    setSearchText('');
    setShowDropdown(false);
    setProducts([]);
    onSelectProduct(product);
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.dropdownItem}
      onPress={() => handleSelectProduct(item)}
    >
      <View style={styles.productInfo}>
        <View style={styles.productHeader}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.title}
          </Text>
          {item.sku && (
            <Text style={styles.productCode}>{item.sku}</Text>
          )}
        </View>

        <View style={styles.productDetails}>
          {item.barcode && (
            <Text style={styles.productBrand}>Código: {item.barcode}</Text>
          )}
          {item.category && (
            <Text style={styles.productCategory}>
              {item.category.name}
            </Text>
          )}
        </View>

        {item.presentations && item.presentations.length > 0 && (
          <View style={styles.presentationsContainer}>
            <Text style={styles.presentationsLabel}>Presentaciones:</Text>
            {item.presentations.slice(0, 2).map((pres: any, index: number) => (
              <Text key={index} style={styles.presentationItem}>
                • {pres.name} - S/ {pres.salePrice?.toFixed(2) || '0.00'}
              </Text>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={placeholder}
          placeholderTextColor="#999"
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color="#007bff"
            style={styles.loader}
          />
        )}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={products}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id}
            style={styles.dropdownList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No se encontraron productos
              </Text>
            }
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    fontSize: 16,
    backgroundColor: colors.surface.primary,
  },
  loader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    maxHeight: 300,
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  productInfo: {
    gap: spacing[1.5],
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[700],
    flex: 1,
  },
  productCode: {
    fontSize: 12,
    color: colors.neutral[500],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
    marginLeft: spacing[2],
  },
  productDetails: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  productBrand: {
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
    marginBottom: spacing[0.5],
  },
  presentationItem: {
    fontSize: 12,
    color: colors.neutral[500],
    marginLeft: spacing[2],
  },
  emptyText: {
    padding: spacing[4],
    textAlign: 'center',
    color: colors.neutral[400],
  },
});
