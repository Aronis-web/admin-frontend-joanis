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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
          placeholderTextColor={theme.color.text.placeholder}
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={theme.color.brand.accent}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.space[4],
      zIndex: 1000,
    },
    inputContainer: {
      position: 'relative',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      fontSize: 16,
      backgroundColor: theme.color.surface.base,
      color: theme.color.text.body,
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
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      maxHeight: 300,
      shadowColor: theme.color.shadow,
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
      padding: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
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
      color: theme.color.text.body,
      flex: 1,
    },
    productCode: {
      fontSize: 12,
      color: theme.color.text.muted,
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: theme.radii.sm,
      marginLeft: theme.space[2],
    },
    productDetails: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    productBrand: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    productCategory: {
      fontSize: 13,
      color: theme.color.text.placeholder,
    },
    presentationsContainer: {
      marginTop: theme.space[1],
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: theme.color.surface.muted,
    },
    presentationsLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '600',
      marginBottom: 2,
    },
    presentationItem: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginLeft: theme.space[2],
    },
    emptyText: {
      padding: theme.space[4],
      textAlign: 'center',
      color: theme.color.text.placeholder,
    },
  });
