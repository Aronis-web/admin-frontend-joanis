import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { transmisionesApi } from '@/services/api';
import { productsApi } from '@/services/api';
import { PriceProfile } from '@/types/price-profiles';

interface AddProductModalProps {
  visible: boolean;
  transmisionId: string;
  priceProfile?: PriceProfile | null; // Perfil de precios de la transmisión
  onClose: () => void;
  onProductAdded: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  visible,
  transmisionId,
  priceProfile,
  onClose,
  onProductAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-search when user types (with debounce)
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if query is too short
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      handleAutoSearch();
    }, 500); // Wait 500ms after user stops typing

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleAutoSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      return;
    }

    try {
      setSearching(true);

      // Search products by query - include both active and preliminary products
      // Try without status filter first to see all products
      const params: any = {
        q: searchQuery.trim(),
        limit: 100, // Increase limit to get more results
      };

      console.log('🔍 Searching products with params:', params);
      const response = await productsApi.getAllProducts(params);
      console.log('📦 Products found:', response.products?.length || 0, 'products');

      if (response.products && response.products.length > 0) {
        console.log('📊 Product statuses:', response.products.map(p => ({
          sku: p.sku,
          name: p.name,
          status: p.status
        })));

        // Filter on frontend to include both active and preliminary
        const filteredProducts = response.products.filter(
          (p: any) => p.status === 'active' || p.status === 'preliminary'
        );
        console.log('✅ Filtered products (active + preliminary):', filteredProducts.length);
        setSearchResults(filteredProducts);
      } else {
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Ingresa un SKU, código de barras o nombre para buscar');
      return;
    }

    try {
      setSearching(true);
      setSearchResults([]);

      // Search products by query
      const response = await productsApi.getAllProducts({
        q: searchQuery.trim(),
        limit: 100,
      });

      // Filter on frontend to include both active and preliminary
      const filteredProducts = response.products.filter(
        (p: any) => p.status === 'active' || p.status === 'preliminary'
      );

      if (filteredProducts.length === 0) {
        Alert.alert('Sin resultados', 'No se encontraron productos activos o preliminares con ese criterio');
      } else {
        setSearchResults(filteredProducts);
      }
    } catch (error: any) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'No se pudo realizar la búsqueda');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = async (product: any) => {
    try {
      setAdding(true);

      // Agregar producto directamente sin pedir precios
      // Los precios se editarán después en la tabla
      await transmisionesApi.addProductToTransmision(transmisionId, {
        productId: product.id,
        // No enviamos precios - se configurarán después en la tabla
      });

      Alert.alert('Éxito', `${product.title} agregado a la transmisión. Ahora puedes editar los precios en la tabla.`);
      handleReset();
      onProductAdded();
    } catch (error: any) {
      console.error('Error adding product:', error);
      const errorMessage = error.response?.data?.message || 'No se pudo agregar el producto';
      Alert.alert('Error', errorMessage);
    } finally {
      setAdding(false);
    }
  };

  const handleReset = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleCancel = () => {
    if (!adding && !searching) {
      handleReset();
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        />

        <View style={[styles.modal, isTablet && styles.modalTablet]}>
          <View style={styles.header}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              Agregar Producto
            </Text>
            <TouchableOpacity onPress={handleCancel} disabled={adding || searching}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.searchSection}>
                  <Text style={[styles.label, isTablet && styles.labelTablet]}>
                    Buscar Producto
                  </Text>
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Escribe al menos 2 caracteres..."
                      placeholderTextColor="#9CA3AF"
                      editable={!adding}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {searching && (
                      <View style={styles.searchingIndicator}>
                        <ActivityIndicator color="#0EA5E9" size="small" />
                      </View>
                    )}
                  </View>
                  {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                    <Text style={styles.searchHint}>
                      Escribe al menos 2 caracteres para buscar
                    </Text>
                  )}
                </View>

                {searchResults.length > 0 && (
                  <View style={styles.resultsContainer}>
                    <Text style={styles.resultsTitle}>
                      Resultados ({searchResults.length})
                    </Text>
                    {searchResults.map((product) => (
                      <TouchableOpacity
                        key={product.id}
                        style={styles.resultItem}
                        onPress={() => handleSelectProduct(product)}
                        disabled={adding}
                      >
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultTitle}>{product.title}</Text>
                          <Text style={styles.resultSku}>SKU: {product.sku}</Text>
                          {product.costCents && (
                            <Text style={styles.resultCost}>
                              Costo: S/ {(product.costCents / 100).toFixed(2)}
                            </Text>
                          )}
                          <View style={styles.resultBadge}>
                            <Text style={styles.resultBadgeText}>{product.status}</Text>
                          </View>
                        </View>
                        {adding ? (
                          <ActivityIndicator color="#0EA5E9" size="small" />
                        ) : (
                          <Text style={styles.resultArrow}>+ Agregar</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

            {priceProfile && (
              <View style={styles.priceProfileInfo}>
                <Text style={styles.priceProfileLabel}>📊 Perfil de Precio Activo</Text>
                <Text style={styles.priceProfileName}>{priceProfile.name}</Text>
                <Text style={styles.priceProfileFactor}>
                  Factor: {typeof priceProfile.factorToCost === 'string' ? priceProfile.factorToCost : priceProfile.factorToCost.toFixed(2)}x
                </Text>
                <Text style={styles.priceProfileHint}>
                  💡 Los precios se editarán después en la tabla
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={adding || searching}
            >
              <Text style={styles.cancelButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 24,
  },
  modalTablet: {
    maxHeight: '80%',
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  titleTablet: {
    fontSize: 24,
  },
  closeButton: {
    fontSize: 24,
    color: '#6B7280',
    padding: 4,
  },
  content: {
    maxHeight: 500,
  },
  searchSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  required: {
    color: '#EF4444',
  },
  searchContainer: {
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    paddingRight: 40,
    fontSize: 16,
    color: '#111827',
  },
  searchInputTablet: {
    padding: 16,
    paddingRight: 48,
    fontSize: 18,
  },
  searchingIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  searchHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  resultsContainer: {
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  resultSku: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  resultCost: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 4,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  resultArrow: {
    fontSize: 20,
    color: '#9CA3AF',
    marginLeft: 12,
  },
  selectedProductContainer: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  selectedProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedProductLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  changeButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  selectedProductInfo: {},
  selectedProductTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  selectedProductSku: {
    fontSize: 14,
    color: '#6B7280',
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputTablet: {
    padding: 16,
    fontSize: 18,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  priceProfileInfo: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  priceProfileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
    marginBottom: 4,
  },
  priceProfileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  priceProfileFactor: {
    fontSize: 14,
    color: '#16A34A',
    marginBottom: 6,
  },
  priceProfileHint: {
    fontSize: 12,
    color: '#15803D',
    fontStyle: 'italic',
  },
  optional: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  fieldHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputReadonly: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  calculatedPriceHint: {
    fontSize: 12,
    color: '#16A34A',
    marginTop: 4,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  addButton: {
    backgroundColor: '#10B981',
  },
  addButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
