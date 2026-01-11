import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { campaignsService, productsApi, purchasesService } from '@/services/api';
import { inventoryApi, StockItem } from '@/services/api/inventory';
import {
  ProductSourceType,
  ProductStatus,
  DistributionType,
  AddProductRequest,
  AddProductsFromPurchaseRequest,
  DistributionTypeLabels,
  DistributionTypeDescriptions,
} from '@/types/campaigns';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

interface AddProductScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
    };
  };
}

export const AddProductScreen: React.FC<AddProductScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId } = route.params;
  const [sourceType, setSourceType] = useState<ProductSourceType>(
    ProductSourceType.INVENTORY
  );
  const [products, setProducts] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [showProductSuggestions, setShowProductSuggestions] = useState<boolean>(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [purchaseProducts, setPurchaseProducts] = useState<any[]>([]);
  const [selectedPurchaseProducts, setSelectedPurchaseProducts] = useState<
    Array<{ productId: string; quantity: number; productStatus: ProductStatus; distributionType: DistributionType }>
  >([]);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [productStatus, setProductStatus] = useState<ProductStatus>(ProductStatus.PENDING);
  const [distributionType, setDistributionType] = useState<DistributionType>(
    DistributionType.ALL
  );
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadData();
  }, [sourceType]);

  useEffect(() => {
    if (selectedPurchaseId) {
      loadPurchaseProducts();
    }
  }, [selectedPurchaseId]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      if (sourceType === ProductSourceType.INVENTORY) {
        console.log('📦 Loading products and stock...');

        // Load products
        const productsResponse = await productsApi.getProducts({
          limit: 100,
          status: 'active,preliminary', // Include both active and preliminary products
        });
        console.log('📦 Products loaded:', {
          count: productsResponse.products?.length,
        });
        setProducts(productsResponse.products || []);

        // Load stock items separately
        try {
          const stockResponse = await inventoryApi.getAllStock({});
          console.log('📦 Stock items loaded:', {
            count: stockResponse.length,
            sample: stockResponse.slice(0, 3).map(item => ({
              productId: item.productId,
              productSku: item.product?.sku,
              quantityBase: item.quantityBase,
            }))
          });
          // Convert StockItemResponse to StockItem format
          const stockItemsData: StockItem[] = stockResponse.map(item => ({
            id: `${item.productId}-${item.warehouseId}-${item.areaId || 'no-area'}`,
            productId: item.productId,
            warehouseId: item.warehouseId,
            areaId: item.areaId || undefined,
            quantityBase: item.quantityBase,
            updatedAt: item.updatedAt,
            productTitle: item.product?.title,
            productSku: item.product?.sku,
            warehouseName: item.warehouse?.name,
            areaName: item.area?.name,
          }));
          setStockItems(stockItemsData);
        } catch (stockError) {
          console.error('Error loading stock:', stockError);
          // Don't fail the whole operation if stock fails
          setStockItems([]);
        }
      } else {
        const response = await purchasesService.getPurchases({
          limit: 100,
        });
        // Filter validated purchases on the client side
        setPurchases(response.data.filter(p => p.status === 'VALIDATED') || []);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoadingData(false);
    }
  };

  const loadPurchaseProducts = async () => {
    try {
      const products = await purchasesService.getPurchaseProducts(selectedPurchaseId);
      setPurchaseProducts(products.filter((p) => p.status === 'VALIDATED'));
    } catch (error: any) {
      console.error('Error loading purchase products:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos de la compra');
    }
  };

  const handleAddManualProduct = async () => {
    // Validations
    if (!selectedProductId) {
      Alert.alert('Error', 'Debes seleccionar un producto');
      return;
    }

    if (!totalQuantity || parseFloat(totalQuantity) <= 0) {
      Alert.alert('Error', 'La cantidad debe ser mayor a 0');
      return;
    }

    setLoading(true);

    try {
      const data: AddProductRequest = {
        productId: selectedProductId,
        sourceType: ProductSourceType.INVENTORY,
        totalQuantity: parseFloat(totalQuantity),
        productStatus,
        distributionType,
      };

      await campaignsService.addProduct(campaignId, data);

      Alert.alert('Éxito', 'Producto agregado exitosamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo agregar el producto'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromPurchase = async () => {
    // Validations
    if (!selectedPurchaseId) {
      Alert.alert('Error', 'Debes seleccionar una compra');
      return;
    }

    if (selectedPurchaseProducts.length === 0) {
      Alert.alert('Error', 'Debes seleccionar al menos un producto');
      return;
    }

    setLoading(true);

    try {
      const data: AddProductsFromPurchaseRequest = {
        purchaseId: selectedPurchaseId,
        products: selectedPurchaseProducts,
      };

      await campaignsService.addProductsFromPurchase(campaignId, data);

      Alert.alert('Éxito', 'Productos agregados exitosamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Error adding products:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudieron agregar los productos'
      );
    } finally {
      setLoading(false);
    }
  };

  const togglePurchaseProduct = (product: any) => {
    const exists = selectedPurchaseProducts.find((p) => p.productId === product.productId);

    if (exists) {
      setSelectedPurchaseProducts(
        selectedPurchaseProducts.filter((p) => p.productId !== product.productId)
      );
    } else {
      setSelectedPurchaseProducts([
        ...selectedPurchaseProducts,
        {
          productId: product.productId,
          quantity: product.validatedStock || 0,
          productStatus: ProductStatus.ACTIVE,
          distributionType: DistributionType.ALL,
        },
      ]);
    }
  };

  const updatePurchaseProductConfig = (
    productId: string,
    field: 'quantity' | 'productStatus' | 'distributionType',
    value: any
  ) => {
    setSelectedPurchaseProducts(
      selectedPurchaseProducts.map((p) =>
        p.productId === productId ? { ...p, [field]: value } : p
      )
    );
  };

  const getProductStock = (productId: string): number => {
    // Filter stock items for this product
    const productStockItems = stockItems.filter(item => item.productId === productId);

    console.log('🔍 Getting stock for product:', {
      productId,
      stockItemsCount: productStockItems.length,
      stockItems: productStockItems.map(item => ({
        warehouseId: item.warehouseId,
        areaId: item.areaId,
        quantityBase: item.quantityBase,
      }))
    });

    if (productStockItems.length === 0) {
      console.log('❌ No stock items found for product');
      return 0;
    }

    const totalStock = productStockItems.reduce((total: number, item: StockItem) => {
      const quantity = typeof item.quantityBase === 'string'
        ? parseFloat(item.quantityBase)
        : (item.quantityBase || 0);
      return total + quantity;
    }, 0);

    console.log('✅ Total stock calculated:', totalStock);
    return totalStock;
  };

  const getFilteredProducts = () => {
    if (!productSearchQuery.trim()) {
      return products;
    }
    const query = productSearchQuery.toLowerCase();
    return products.filter(product =>
      product.sku?.toLowerCase().includes(query) ||
      product.title?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProductId(product.id);
    setProductSearchQuery(`${product.sku} - ${product.title}`);
    setShowProductSuggestions(false);
  };

  const handleProductSearchChange = (text: string) => {
    setProductSearchQuery(text);
    setShowProductSuggestions(text.length > 0);
    if (!text.trim()) {
      setSelectedProductId('');
    }
  };

  const renderManualForm = () => {
    const selectedProduct = products.find(p => p.id === selectedProductId);
    const availableStock = selectedProduct ? getProductStock(selectedProductId) : 0;
    const filteredProducts = getFilteredProducts();

    return (
      <>
        {/* Product Search */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Producto *
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={productSearchQuery}
            onChangeText={handleProductSearchChange}
            onFocus={() => setShowProductSuggestions(productSearchQuery.length > 0)}
            placeholder="Buscar por SKU, nombre o descripción..."
            placeholderTextColor="#94A3B8"
          />

          {/* Product Suggestions */}
          {showProductSuggestions && filteredProducts.length > 0 && (
            <View style={[styles.suggestionsContainer, isTablet && styles.suggestionsContainerTablet]}>
              <ScrollView
                style={styles.suggestionsList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {filteredProducts.slice(0, 10).map((product) => {
                  const stock = getProductStock(product.id);
                  return (
                    <TouchableOpacity
                      key={product.id}
                      style={[styles.suggestionItem, isTablet && styles.suggestionItemTablet]}
                      onPress={() => handleSelectProduct(product)}
                    >
                      <View style={styles.suggestionContent}>
                        <Text style={[styles.suggestionTitle, isTablet && styles.suggestionTitleTablet]}>
                          {product.sku} - {product.title}
                        </Text>
                        <View style={styles.suggestionMeta}>
                          <Text style={[styles.suggestionStock, isTablet && styles.suggestionStockTablet, stock > 0 ? styles.stockAvailable : styles.stockUnavailable]}>
                            Stock: {stock}
                          </Text>
                          <Text style={[styles.suggestionStatus, isTablet && styles.suggestionStatusTablet]}>
                            {product.status === 'active' ? '✓ Activo' : '⚠ Preliminar'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {selectedProduct && (
            <View style={[styles.stockInfo, isTablet && styles.stockInfoTablet]}>
              <Text style={[styles.stockLabel, isTablet && styles.stockLabelTablet]}>
                Stock Disponible:
              </Text>
              <Text style={[
                styles.stockValue,
                isTablet && styles.stockValueTablet,
                availableStock > 0 ? styles.stockAvailable : styles.stockUnavailable
              ]}>
                {availableStock} unidades
              </Text>
            </View>
          )}
        </View>

      {/* Total Quantity */}
      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>
          Cantidad Total *
        </Text>
        <TextInput
          style={[styles.input, isTablet && styles.inputTablet]}
          value={totalQuantity}
          onChangeText={setTotalQuantity}
          placeholder="Ej: 1000"
          placeholderTextColor="#94A3B8"
          keyboardType="decimal-pad"
        />
      </View>

      {/* Product Status - Info only */}
      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>
          Estado en Campaña
        </Text>
        <View style={[styles.statusDisplay, isTablet && styles.statusDisplayTablet]}>
          <Text style={[styles.statusText, isTablet && styles.statusTextTablet]}>
            ⏳ Pendiente
          </Text>
        </View>
        <Text style={[styles.hint, isTablet && styles.hintTablet]}>
          El producto se agregará con estado PENDIENTE. Deberás generar la distribución para asignar cantidades a los participantes.
        </Text>
      </View>

      {/* Distribution Type */}
      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>
          Tipo de Distribución *
        </Text>
        <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
          <Picker
            selectedValue={distributionType}
            onValueChange={setDistributionType}
            style={styles.picker}
          >
            {Object.values(DistributionType).map((type) => (
              <Picker.Item
                key={type}
                label={DistributionTypeLabels[type]}
                value={type}
              />
            ))}
          </Picker>
        </View>
        <Text style={[styles.hint, isTablet && styles.hintTablet]}>
          {DistributionTypeDescriptions[distributionType]}
        </Text>
      </View>
      </>
    );
  };

  const renderFromPurchaseForm = () => (
    <>
      {/* Purchase Selection */}
      <View style={styles.formGroup}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>
          Compra *
        </Text>
        <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
          <Picker
            selectedValue={selectedPurchaseId}
            onValueChange={setSelectedPurchaseId}
            style={styles.picker}
          >
            <Picker.Item label="Seleccionar compra..." value="" />
            {purchases.map((purchase) => (
              <Picker.Item
                key={purchase.id}
                label={`${purchase.code} - ${purchase.supplier?.commercialName}`}
                value={purchase.id}
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Purchase Products */}
      {selectedPurchaseId && purchaseProducts.length > 0 && (
        <View style={styles.formGroup}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Productos de la Compra
          </Text>
          {purchaseProducts.map((product) => {
            const isSelected = selectedPurchaseProducts.find(
              (p) => p.productId === product.productId
            );
            const config = selectedPurchaseProducts.find(
              (p) => p.productId === product.productId
            );

            return (
              <View key={product.id} style={styles.productItem}>
                <TouchableOpacity
                  style={styles.productCheckbox}
                  onPress={() => togglePurchaseProduct(product)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxChecked,
                    ]}
                  >
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>
                      {product.product?.title || product.name}
                    </Text>
                    <Text style={styles.productDetails}>
                      SKU: {product.sku} | Stock: {product.validatedStock}
                    </Text>
                  </View>
                </TouchableOpacity>

                {isSelected && config && (
                  <View style={styles.productConfig}>
                    <TextInput
                      style={[styles.smallInput, isTablet && styles.smallInputTablet]}
                      value={config.quantity.toString()}
                      onChangeText={(value) =>
                        updatePurchaseProductConfig(
                          product.productId,
                          'quantity',
                          parseFloat(value) || 0
                        )
                      }
                      placeholder="Cantidad"
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </>
  );

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>
            Agregar Producto
          </Text>
        </View>

        {/* Form */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.scrollContentTablet,
          ]}
        >
          <View style={[styles.formCard, isTablet && styles.formCardTablet]}>
            {/* Source Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Origen del Producto *
              </Text>
              <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
                <Picker
                  selectedValue={sourceType}
                  onValueChange={(value) => {
                    setSourceType(value);
                    setSelectedProductId('');
                    setSelectedPurchaseId('');
                    setSelectedPurchaseProducts([]);
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Desde Inventario" value={ProductSourceType.INVENTORY} />
                  <Picker.Item
                    label="Desde Compra"
                    value={ProductSourceType.PURCHASE}
                  />
                </Picker>
              </View>
            </View>

            {loadingData ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.loadingText}>Cargando...</Text>
              </View>
            ) : (
              <>
                {sourceType === ProductSourceType.INVENTORY
                  ? renderManualForm()
                  : renderFromPurchaseForm()}
              </>
            )}
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footer, isTablet && styles.footerTablet]}>
          <TouchableOpacity
            style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
              Cancelar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.addButton,
              isTablet && styles.addButtonTablet,
              loading && styles.addButtonDisabled,
            ]}
            onPress={
              sourceType === ProductSourceType.INVENTORY
                ? handleAddManualProduct
                : handleAddFromPurchase
            }
            disabled={loading || loadingData}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                Agregar Producto{sourceType === ProductSourceType.PURCHASE && 's'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  backButtonTextTablet: {
    fontSize: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    padding: 32,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formCardTablet: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  pickerContainerTablet: {
    borderRadius: 10,
  },
  picker: {
    height: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  inputTablet: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
  },
  smallInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  smallInputTablet: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  hintTablet: {
    fontSize: 14,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    gap: 8,
  },
  stockInfoTablet: {
    padding: 12,
  },
  stockLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  stockLabelTablet: {
    fontSize: 16,
  },
  stockValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stockValueTablet: {
    fontSize: 16,
  },
  stockAvailable: {
    color: '#10B981',
  },
  stockUnavailable: {
    color: '#EF4444',
  },
  statusDisplay: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDisplayTablet: {
    padding: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  statusTextTablet: {
    fontSize: 18,
  },
  suggestionsContainer: {
    maxHeight: 300,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsContainerTablet: {
    maxHeight: 400,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionItemTablet: {
    padding: 16,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  suggestionTitleTablet: {
    fontSize: 16,
  },
  suggestionMeta: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  suggestionStock: {
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionStockTablet: {
    fontSize: 14,
  },
  suggestionStatus: {
    fontSize: 12,
    color: '#64748B',
  },
  suggestionStatusTablet: {
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  productItem: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  productCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  productDetails: {
    fontSize: 12,
    color: '#64748B',
  },
  productConfig: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerTablet: {
    padding: 24,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonTablet: {
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  cancelButtonTextTablet: {
    fontSize: 18,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonTablet: {
    paddingVertical: 16,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextTablet: {
    fontSize: 18,
  },
});
