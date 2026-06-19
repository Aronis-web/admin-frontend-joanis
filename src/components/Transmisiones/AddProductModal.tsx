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
  Image,
} from 'react-native';
import { useThemedStyles, useTheme } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const placeholderColor = theme.color.text.placeholder;
  const accentColor = theme.color.brand.primary;
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
    }, 800); // Wait 800ms after user stops typing (aumentado para permitir escribir)

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

      // ✅ Usar endpoint v2 optimizado con caché y Full-Text Search
      console.log('🔍 Searching products with v2 endpoint:', searchQuery.trim());
      const response = await productsApi.searchProductsV2({
        q: searchQuery.trim(),
        limit: 50, // Límite optimizado
        status: 'active,preliminary', // Incluir activos y preliminares
        includePhotos: true, // ✅ Incluir fotos para mostrar miniaturas
      });

      console.log('📦 Products found:', response.results?.length || 0, 'products');
      console.log('⚡ Search time:', response.searchTime, 'ms');
      console.log('💾 Cached:', response.cached);

      if (response.results && response.results.length > 0) {
        console.log(
          '📊 Product statuses:',
          response.results.map((p) => ({
            sku: p.sku,
            title: p.title,
            status: p.status,
          }))
        );

        setSearchResults(response.results);
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

      // ✅ Usar endpoint v2 optimizado
      const response = await productsApi.searchProductsV2({
        q: searchQuery.trim(),
        limit: 50,
        status: 'active,preliminary',
        includePhotos: true, // ✅ Incluir fotos para mostrar miniaturas
      });

      if (response.results.length === 0) {
        Alert.alert(
          'Sin resultados',
          'No se encontraron productos activos o preliminares con ese criterio'
        );
      } else {
        setSearchResults(response.results);
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

      Alert.alert(
        'Éxito',
        `${product.title} agregado a la transmisión. Ahora puedes editar los precios en la tabla.`
      );
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
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleCancel} />

        <View style={[styles.modal, isTablet && styles.modalTablet]}>
          <View style={styles.header}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Agregar Producto</Text>
            <TouchableOpacity onPress={handleCancel} disabled={adding || searching}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.searchSection}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Buscar Producto</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Escribe al menos 2 caracteres..."
                  placeholderTextColor={placeholderColor}
                  editable={!adding}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searching && (
                  <View style={styles.searchingIndicator}>
                    <ActivityIndicator color={accentColor} size="small" />
                  </View>
                )}
              </View>
              {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                <Text style={styles.searchHint}>Escribe al menos 2 caracteres para buscar</Text>
              )}
            </View>

            {searchResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>Resultados ({searchResults.length})</Text>
                {searchResults.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.resultItem}
                    onPress={() => handleSelectProduct(product)}
                    disabled={adding}
                  >
                    {/* ✅ Foto en miniatura */}
                    {product.photos && product.photos.length > 0 && (
                      <Image
                        source={{ uri: product.photos[0] }}
                        style={styles.resultImage}
                        resizeMode="cover"
                      />
                    )}
                    {!product.photos && product.imageUrl && (
                      <Image
                        source={{ uri: product.imageUrl }}
                        style={styles.resultImage}
                        resizeMode="cover"
                      />
                    )}
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
                      <ActivityIndicator color={accentColor} size="small" />
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
                  Factor:{' '}
                  {typeof priceProfile.factorToCost === 'string'
                    ? priceProfile.factorToCost
                    : priceProfile.factorToCost.toFixed(2)}
                  x
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
      backgroundColor: theme.color.overlay.medium,
    },
    modal: {
      backgroundColor: theme.color.surface.base,
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
      color: theme.color.text.heading,
    },
    titleTablet: {
      fontSize: 24,
    },
    closeButton: {
      fontSize: 24,
      color: theme.color.text.muted,
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
      color: theme.color.text.body,
      marginBottom: theme.space[2],
    },
    labelTablet: {
      fontSize: 16,
    },
    required: {
      color: theme.color.text.danger,
    },
    searchContainer: {
      position: 'relative',
    },
    searchInput: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      paddingRight: 40,
      fontSize: 16,
      color: theme.color.text.heading,
    },
    searchInputTablet: {
      padding: theme.space[4],
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
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
      fontStyle: 'italic',
    },
    resultsContainer: {
      marginBottom: 20,
    },
    resultsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[3],
    },
    resultItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    resultImage: {
      width: 50,
      height: 50,
      borderRadius: theme.radii.md,
      marginRight: theme.space[3],
      backgroundColor: theme.color.surface.muted,
    },
    resultInfo: {
      flex: 1,
    },
    resultTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    resultSku: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    resultCost: {
      fontSize: 13,
      color: theme.color.text.success,
      fontWeight: '600',
      marginBottom: 4,
    },
    resultBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: theme.radii.md,
    },
    resultBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    resultArrow: {
      fontSize: 20,
      color: theme.color.text.placeholder,
      marginLeft: theme.space[3],
    },
    selectedProductContainer: {
      backgroundColor: theme.color.brand.primarySoft,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
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
      color: theme.color.text.body,
    },
    changeButton: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    selectedProductInfo: {},
    selectedProductTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    selectedProductSku: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    inputGroup: {
      marginBottom: theme.space[4],
    },
    input: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      fontSize: 16,
      color: theme.color.text.heading,
    },
    inputTablet: {
      padding: theme.space[4],
      fontSize: 18,
    },
    textArea: {
      minHeight: 80,
      paddingTop: 12,
    },
    priceProfileInfo: {
      backgroundColor: theme.color.state.success.background,
      borderWidth: 1,
      borderColor: theme.color.state.success.border,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      marginBottom: 20,
    },
    priceProfileLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.state.success.text,
      marginBottom: theme.space[1],
    },
    priceProfileName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.state.success.text,
      marginBottom: 2,
    },
    priceProfileFactor: {
      fontSize: 14,
      color: theme.color.text.success,
      marginBottom: 6,
    },
    priceProfileHint: {
      fontSize: 12,
      color: theme.color.state.success.text,
      fontStyle: 'italic',
    },
    optional: {
      fontSize: 12,
      color: theme.color.text.subtle,
      fontStyle: 'italic',
    },
    fieldHint: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
      fontStyle: 'italic',
    },
    inputReadonly: {
      backgroundColor: theme.color.surface.disabled,
      color: theme.color.text.muted,
    },
    calculatedPriceHint: {
      fontSize: 12,
      color: theme.color.text.success,
      marginTop: theme.space[1],
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[5],
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    addButton: {
      backgroundColor: theme.color.action.success.background,
    },
    addButtonDisabled: {
      backgroundColor: theme.color.action.success.backgroundDisabled,
    },
    addButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.action.success.text,
    },
  });
