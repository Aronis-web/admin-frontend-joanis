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
  Image,
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
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';

interface AddProductScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
    };
  };
}

export const AddProductScreen: React.FC<AddProductScreenProps> = ({ navigation, route }) => {
  const { campaignId } = route.params;
  const [sourceType, setSourceType] = useState<ProductSourceType>(ProductSourceType.INVENTORY);
  const [products, setProducts] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [showProductSuggestions, setShowProductSuggestions] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [purchaseProducts, setPurchaseProducts] = useState<any[]>([]);
  const [selectedPurchaseProducts, setSelectedPurchaseProducts] = useState<
    Array<{
      productId: string;
      quantity: number;
      productStatus: ProductStatus;
      distributionType: DistributionType;
    }>
  >([]);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [productStatus, setProductStatus] = useState<ProductStatus>(ProductStatus.PRELIMINARY);
  const [distributionType, setDistributionType] = useState<DistributionType>(DistributionType.ALL);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [campaignProducts, setCampaignProducts] = useState<string[]>([]);
  const [campaignPurchases, setCampaignPurchases] = useState<string[]>([]);
  const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadCampaignProducts();
    loadData();
  }, [sourceType]);

  useEffect(() => {
    if (selectedPurchaseId) {
      loadPurchaseProducts();
    }
  }, [selectedPurchaseId]);

  const loadCampaignProducts = async () => {
    try {
      const campaign = await campaignsService.getCampaign(campaignId);
      const productIds = campaign.products?.map((p) => p.productId) || [];
      setCampaignProducts(productIds);

      // Extract unique purchase IDs from campaign products
      const purchaseIds =
        campaign.products
          ?.filter((p) => p.sourceType === ProductSourceType.PURCHASE && p.purchaseId)
          .map((p) => p.purchaseId!)
          .filter((id, index, self) => self.indexOf(id) === index) || [];
      setCampaignPurchases(purchaseIds);
    } catch (error) {
      console.error('Error loading campaign products:', error);
    }
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      if (sourceType === ProductSourceType.INVENTORY) {
        console.log('📦 Loading products and stock...');

        // Load products using admin endpoint to include preliminary products
        console.log('📦 Loading products with params:', {
          limit: 100,
          status: 'active,preliminary',
        });

        // Don't load all products on mount - we'll search on demand
        console.log('📦 Products will be loaded on search');

        // Load stock items separately
        try {
          const stockResponse = await inventoryApi.getAllStock({});
          console.log('📦 Stock items loaded:', {
            count: stockResponse.length,
            sample: stockResponse.slice(0, 3).map((item) => ({
              productId: item.productId,
              productSku: item.product?.sku,
              quantityBase: item.quantityBase,
            })),
          });
          // Convert StockItemResponse to StockItem format
          const stockItemsData: StockItem[] = stockResponse.map((item) => ({
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
        // Filter purchases that have products available (IN_CAPTURE, IN_VALIDATION, VALIDATED, or CLOSED)
        setPurchases(
          response.data.filter(
            (p) =>
              p.status === 'IN_CAPTURE' ||
              p.status === 'IN_VALIDATION' ||
              p.status === 'VALIDATED' ||
              p.status === 'CLOSED'
          ) || []
        );
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
      console.log('🛒 Loading purchase products with params:', {
        purchaseId: selectedPurchaseId,
        includeProductStatus: 'active,preliminary',
      });

      const products = await purchasesService.getPurchaseProducts(selectedPurchaseId, {
        includeProductStatus: 'active,preliminary', // Include products with active or preliminary status
      });

      console.log('🛒 Purchase products received from backend:', {
        total: products.length,
        products: products.map((p) => ({
          id: p.id,
          productId: p.productId,
          sku: p.sku,
          purchaseProductStatus: p.status,
          productStatus: p.product?.status,
          productTitle: p.product?.title,
          hasProductRelation: !!p.product,
        })),
      });

      // Include both VALIDATED and PRELIMINARY purchase products
      const availableProducts = products.filter(
        (p) => p.status === 'VALIDATED' || p.status === 'PRELIMINARY'
      );
      console.log('🛒 Available products (VALIDATED + PRELIMINARY):', availableProducts.length);

      setPurchaseProducts(availableProducts);
    } catch (error: any) {
      console.error('Error loading purchase products:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos de la compra');
    }
  };

  const togglePurchaseExpansion = (purchaseId: string) => {
    setExpandedPurchases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(purchaseId)) {
        newSet.delete(purchaseId);
      } else {
        newSet.add(purchaseId);
      }
      return newSet;
    });
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
      // Get the selected product to determine its status
      const selectedProduct = products.find((p) => p.id === selectedProductId);

      // Use the actual product status from the inventory, similar to purchase flow
      const actualProductStatus =
        selectedProduct?.status === 'preliminary'
          ? ProductStatus.PRELIMINARY
          : ProductStatus.ACTIVE;

      const data: AddProductRequest = {
        productId: selectedProductId,
        sourceType: ProductSourceType.INVENTORY,
        totalQuantity: parseFloat(totalQuantity),
        productStatus: actualProductStatus,
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
      Alert.alert('Error', error.response?.data?.message || 'No se pudo agregar el producto');
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
      Alert.alert('Error', error.response?.data?.message || 'No se pudieron agregar los productos');
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
      // Use the actual product status from the inventory, not hardcoded ACTIVE
      const productStatus =
        product.product?.status === 'preliminary'
          ? ProductStatus.PRELIMINARY
          : ProductStatus.ACTIVE;

      // Use available stock from inventory instead of purchase stock
      const availableStock = getProductStock(product.productId);

      setSelectedPurchaseProducts([
        ...selectedPurchaseProducts,
        {
          productId: product.productId,
          quantity: availableStock,
          productStatus: productStatus,
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
    const productStockItems = stockItems.filter((item) => item.productId === productId);

    console.log('🔍 Getting stock for product:', {
      productId,
      stockItemsCount: productStockItems.length,
      stockItems: productStockItems.map((item) => ({
        warehouseId: item.warehouseId,
        areaId: item.areaId,
        quantityBase: item.quantityBase,
      })),
    });

    if (productStockItems.length === 0) {
      console.log('❌ No stock items found for product');
      return 0;
    }

    const totalStock = productStockItems.reduce((total: number, item: StockItem) => {
      // Use availableQuantityBase (stock disponible) instead of quantityBase (stock total)
      const quantity =
        typeof item.availableQuantityBase === 'number'
          ? item.availableQuantityBase
          : typeof item.quantityBase === 'string'
            ? parseFloat(item.quantityBase)
            : item.quantityBase || 0;
      return total + quantity;
    }, 0);

    console.log('✅ Total stock calculated:', totalStock);
    return totalStock;
  };

  const searchProducts = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setProducts([]);
      setShowProductSuggestions(false);
      return;
    }

    try {
      setIsSearching(true);
      console.log('🔍 Searching products with v2 endpoint:', query);

      // ✅ Usar endpoint v2 optimizado con caché y Full-Text Search
      const response = await productsApi.searchProductsV2({
        q: query.trim(),
        limit: 20,
        status: 'active,preliminary',
        includePhotos: true, // ✅ Incluir fotos para mostrar miniaturas
      });

      console.log('🔍 Search results:', response.results.length, 'products found');
      console.log('⚡ Search time:', response.searchTime, 'ms');
      console.log('💾 Cached:', response.cached);

      setProducts(response.results);
      setShowProductSuggestions(response.results.length > 0);
    } catch (error) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'No se pudieron buscar los productos');
    } finally {
      setIsSearching(false);
    }
  };

  const getFilteredProducts = () => {
    return products;
  };

  const handleSelectProduct = (product: any) => {
    console.log('🔍 Selecting product:', product.sku, product.title);
    setSelectedProductId(product.id);
    const correlativePrefix = product.correlativeNumber ? `#${product.correlativeNumber} | ` : '';
    setProductSearchQuery(`${correlativePrefix}${product.sku} - ${product.title}`);
    setShowProductSuggestions(false);
    console.log('✅ Product selected, suggestions hidden');
  };

  const handleProductSearchChange = (text: string) => {
    setProductSearchQuery(text);

    if (!text.trim()) {
      setSelectedProductId('');
      setProducts([]);
      setShowProductSuggestions(false);
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      return;
    }

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      searchProducts(text);
    }, 800); // Wait 800ms after user stops typing (aumentado para permitir escribir)

    setSearchTimeout(timeout);
  };

  const renderManualForm = () => {
    if (loadingData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      );
    }

    const selectedProduct = products.find((p) => p.id === selectedProductId);
    const availableStock = selectedProduct ? getProductStock(selectedProductId) : 0;
    const filteredProducts = getFilteredProducts();

    return (
      <>
        {/* Product Search */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Producto *</Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={productSearchQuery}
            onChangeText={handleProductSearchChange}
            onFocus={() => setShowProductSuggestions(productSearchQuery.length > 0)}
            placeholder="Buscar por #correlativo, SKU, nombre o descripción..."
            placeholderTextColor="#94A3B8"
          />

          {/* Product Suggestions */}
          {showProductSuggestions && filteredProducts.length > 0 && (
            <View
              style={[styles.suggestionsContainer, isTablet && styles.suggestionsContainerTablet]}
            >
              <ScrollView
                style={styles.suggestionsList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {filteredProducts.slice(0, 10).map((product) => {
                  const stock = getProductStock(product.id);
                  const isAlreadyAdded = campaignProducts.includes(product.id);
                  const isPreliminary = (product.status as any) === 'preliminary';

                  return (
                    <TouchableOpacity
                      key={product.id}
                      style={[
                        styles.suggestionItem,
                        isTablet && styles.suggestionItemTablet,
                        isPreliminary && styles.suggestionItemPreliminary,
                        isAlreadyAdded && styles.suggestionItemDisabled,
                      ]}
                      onPress={() => {
                        console.log(
                          '🖱️ Suggestion clicked:',
                          product.sku,
                          'Already added:',
                          isAlreadyAdded
                        );
                        if (!isAlreadyAdded) {
                          handleSelectProduct(product);
                        } else {
                          console.log('⚠️ Product already added, ignoring click');
                        }
                      }}
                      activeOpacity={isAlreadyAdded ? 1 : 0.7}
                    >
                      {/* ✅ Product Image - Priorizar photos sobre imageUrl */}
                      {product.photos && product.photos.length > 0 ? (
                        <Image
                          source={{ uri: product.photos[0] }}
                          style={styles.suggestionImage}
                          resizeMode="cover"
                        />
                      ) : product.imageUrl ? (
                        <Image
                          source={{ uri: product.imageUrl }}
                          style={styles.suggestionImage}
                          resizeMode="cover"
                        />
                      ) : null}
                      <View style={styles.suggestionContent}>
                        <Text
                          style={[
                            styles.suggestionTitle,
                            isTablet && styles.suggestionTitleTablet,
                            isAlreadyAdded && styles.suggestionTitleDisabled,
                          ]}
                        >
                          {product.correlativeNumber && `#${product.correlativeNumber} | `}
                          {product.sku} - {product.title}
                          {isAlreadyAdded && ' (Ya agregado)'}
                        </Text>
                        {isPreliminary && (
                          <Text style={[styles.warningText, isTablet && styles.warningTextTablet]}>
                            ⚠️ Producto por validar Ingreso
                          </Text>
                        )}
                        <View style={styles.suggestionMeta}>
                          <Text
                            style={[
                              styles.suggestionStock,
                              isTablet && styles.suggestionStockTablet,
                              stock > 0 ? styles.stockAvailable : styles.stockUnavailable,
                            ]}
                          >
                            Stock: {stock}
                          </Text>
                          <Text
                            style={[
                              styles.suggestionStatus,
                              isTablet && styles.suggestionStatusTablet,
                            ]}
                          >
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

          {/* No products message */}
          {showProductSuggestions && filteredProducts.length === 0 && products.length > 0 && (
            <View
              style={[styles.suggestionsContainer, isTablet && styles.suggestionsContainerTablet]}
            >
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No se encontraron productos con ese criterio de búsqueda
                </Text>
              </View>
            </View>
          )}

          {/* No products available at all */}
          {products.length === 0 && (
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>⚠️ No hay productos disponibles en el inventario</Text>
            </View>
          )}

          {selectedProduct && (
            <View style={[styles.stockInfo, isTablet && styles.stockInfoTablet]}>
              <Text style={[styles.stockLabel, isTablet && styles.stockLabelTablet]}>
                Stock Disponible:
              </Text>
              <Text
                style={[
                  styles.stockValue,
                  isTablet && styles.stockValueTablet,
                  availableStock > 0 ? styles.stockAvailable : styles.stockUnavailable,
                ]}
              >
                {availableStock} unidades
              </Text>
            </View>
          )}
        </View>

        {/* Total Quantity */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Cantidad Total *</Text>
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
        {selectedProduct && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>Estado del Producto</Text>
            <View
              style={[
                styles.statusDisplay,
                isTablet && styles.statusDisplayTablet,
                selectedProduct.status === 'preliminary' && styles.statusDisplayPreliminary,
              ]}
            >
              <Text style={[styles.statusText, isTablet && styles.statusTextTablet]}>
                {selectedProduct.status === 'preliminary'
                  ? '⚠️ Preliminar (Por validar)'
                  : '✓ Activo'}
              </Text>
            </View>
            <Text style={[styles.hint, isTablet && styles.hintTablet]}>
              {selectedProduct.status === 'preliminary'
                ? 'Este producto está en estado preliminar. Se agregará a la campaña como PRELIMINAR hasta que se valide el ingreso.'
                : 'El producto se agregará con estado PENDIENTE. Deberás generar la distribución para asignar cantidades a los participantes.'}
            </Text>
          </View>
        )}

        {/* Distribution Type */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Tipo de Distribución *</Text>
          <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
            <Picker
              selectedValue={distributionType}
              onValueChange={setDistributionType}
              style={styles.picker}
            >
              {Object.values(DistributionType).map((type) => (
                <Picker.Item key={type} label={DistributionTypeLabels[type]} value={type} />
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

  const renderFromPurchaseForm = () => {
    // Separate purchases into already added and not added
    const addedPurchases = purchases.filter((p) => campaignPurchases.includes(p.id));
    const notAddedPurchases = purchases.filter((p) => !campaignPurchases.includes(p.id));

    return (
      <>
        {/* Already Added Purchases */}
        {addedPurchases.length > 0 && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>
              Compras Ya Agregadas ({addedPurchases.length})
            </Text>
            <Text style={[styles.hint, isTablet && styles.hintTablet]}>
              Estas compras ya tienen productos en la campaña. Puedes expandirlas para agregar más
              productos.
            </Text>
            {addedPurchases.map((purchase) => {
              const isExpanded = expandedPurchases.has(purchase.id);
              const isSelected = selectedPurchaseId === purchase.id;

              return (
                <View key={purchase.id} style={styles.purchaseCard}>
                  <TouchableOpacity
                    style={[styles.purchaseHeader, isSelected && styles.purchaseHeaderSelected]}
                    onPress={() => {
                      if (isExpanded) {
                        togglePurchaseExpansion(purchase.id);
                        if (selectedPurchaseId === purchase.id) {
                          setSelectedPurchaseId('');
                        }
                      } else {
                        togglePurchaseExpansion(purchase.id);
                        setSelectedPurchaseId(purchase.id);
                      }
                    }}
                  >
                    <View style={styles.purchaseHeaderContent}>
                      <Text style={styles.purchaseHeaderIcon}>{isExpanded ? '▼' : '▶'}</Text>
                      <View style={styles.purchaseHeaderInfo}>
                        <Text style={styles.purchaseHeaderTitle}>
                          {purchase.code} - {purchase.guideNumber} - {purchase.supplier?.commercialName}
                        </Text>
                        <Text style={styles.purchaseHeaderBadge}>✓ Ya agregada</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {isExpanded && isSelected && purchaseProducts.length > 0 && (
                    <View style={styles.purchaseProductsContainer}>{renderPurchaseProducts()}</View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Purchase Selection - Not Added */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            {addedPurchases.length > 0 ? 'Otras Compras Disponibles' : 'Compra *'}
          </Text>
          <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
            <Picker
              selectedValue={selectedPurchaseId}
              onValueChange={(value) => {
                setSelectedPurchaseId(value);
                // Collapse all expanded purchases when selecting a new one
                setExpandedPurchases(new Set());
              }}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar compra..." value="" />
              {notAddedPurchases.map((purchase) => (
                <Picker.Item
                  key={purchase.id}
                  label={`${purchase.code} - ${purchase.guideNumber} - ${purchase.supplier?.commercialName}`}
                  value={purchase.id}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Purchase Products - Only show for non-expanded purchases */}
        {selectedPurchaseId &&
          !expandedPurchases.has(selectedPurchaseId) &&
          purchaseProducts.length > 0 && (
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Productos de la Compra
              </Text>
              {renderPurchaseProducts()}
            </View>
          )}
      </>
    );
  };

  const renderPurchaseProducts = () => {
    return purchaseProducts.map((product) => {
      const isSelected = selectedPurchaseProducts.find((p) => p.productId === product.productId);
      const config = selectedPurchaseProducts.find((p) => p.productId === product.productId);
      const isAlreadyAdded = campaignProducts.includes(product.productId);
      const isPreliminary = (product.product?.status as any) === 'preliminary';

      return (
        <View
          key={product.id}
          style={[
            styles.productItem,
            isPreliminary && styles.productItemPreliminary,
            isAlreadyAdded && styles.productItemDisabled,
          ]}
        >
          <TouchableOpacity
            style={styles.productCheckbox}
            onPress={() => {
              if (!isAlreadyAdded) {
                togglePurchaseProduct(product);
              }
            }}
            activeOpacity={isAlreadyAdded ? 1 : 0.7}
          >
            <View
              style={[
                styles.checkbox,
                isSelected && styles.checkboxChecked,
                isAlreadyAdded && styles.checkboxDisabled,
              ]}
            >
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.productInfo}>
              <Text style={[styles.productName, isAlreadyAdded && styles.productNameDisabled]}>
                {product.product?.title || product.name}
                {isAlreadyAdded && ' (Ya agregado)'}
              </Text>
              {isPreliminary && (
                <Text style={[styles.warningText, isTablet && styles.warningTextTablet]}>
                  ⚠️ Producto por validar Ingreso
                </Text>
              )}
              <Text style={styles.productDetails}>
                {product.correlativeNumber && `#${product.correlativeNumber} | `}SKU: {product.sku}{' '}
                | Stock Disponible: {getProductStock(product.productId)}
                {product.product?.status === 'preliminary' && ' ⚠ Preliminar'}
              </Text>
            </View>
          </TouchableOpacity>

          {isSelected && config && (
            <View style={styles.productConfig}>
              <TextInput
                style={[styles.smallInput, isTablet && styles.smallInputTablet]}
                value={config.quantity.toString()}
                onChangeText={(value) =>
                  updatePurchaseProductConfig(product.productId, 'quantity', parseFloat(value) || 0)
                }
                placeholder="Cantidad"
                keyboardType="decimal-pad"
              />
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Agregar Producto</Text>
        </View>

        {/* Form */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
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
                  <Picker.Item label="Desde Compra" value={ProductSourceType.PURCHASE} />
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
  statusDisplayPreliminary: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
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
    flexDirection: 'row', // ✅ Para alinear imagen y contenido
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  suggestionItemTablet: {
    padding: 16,
  },
  suggestionItemPreliminary: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  suggestionItemDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F1F5F9',
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
  suggestionTitleDisabled: {
    color: '#94A3B8',
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  infoContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  infoText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
  productItem: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  productItemPreliminary: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  productItemDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
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
  checkboxDisabled: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
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
  productNameDisabled: {
    color: '#94A3B8',
  },
  productDetails: {
    fontSize: 12,
    color: '#64748B',
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  warningTextTablet: {
    fontSize: 14,
  },
  productConfig: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  purchaseCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  purchaseHeader: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  purchaseHeaderSelected: {
    backgroundColor: '#EEF2FF',
    borderBottomColor: '#6366F1',
  },
  purchaseHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  purchaseHeaderIcon: {
    fontSize: 14,
    color: '#64748B',
    width: 20,
  },
  purchaseHeaderInfo: {
    flex: 1,
  },
  purchaseHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  purchaseHeaderBadge: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  purchaseProductsContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
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
