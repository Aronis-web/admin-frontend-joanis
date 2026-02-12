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
    marginBottom: 16,
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    maxHeight: 300,
    shadowColor: '#000',
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productInfo: {
    gap: 6,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  productCode: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  productDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  productBrand: {
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
  emptyText: {
    padding: 16,
    textAlign: 'center',
    color: '#999',
  },
});
