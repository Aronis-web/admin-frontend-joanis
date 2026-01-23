import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { CampaignProduct, ProductStatus } from '@/types/campaigns';
import { inventoryApi } from '@/services/api/inventory';
import { purchasesService } from '@/services/api/purchases';
import { priceProfilesApi } from '@/services/api/price-profiles';
import { campaignsApi } from '@/services/api/campaigns';
import { ProductSalePrice, PriceProfile } from '@/types/price-profiles';

interface CampaignProductBannerModalProps {
  visible: boolean;
  campaignProduct: CampaignProduct | null;
  productDetails?: any; // Full product details with costCents, priceCents, etc.
  onClose: () => void;
}

interface PriceFormData {
  profileId: string;
  profileCode: string;
  profileName: string;
  presentationId: string | null;
  priceCents: number;
  isOverridden: boolean;
  calculatedPriceCents: number;
  factorToCost: number;
  displayValue: string; // Valor que se muestra en el input
}

export const CampaignProductBannerModal: React.FC<CampaignProductBannerModalProps> = ({
  visible,
  campaignProduct,
  productDetails,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockData, setStockData] = useState<{
    stock?: number;
    preliminaryStock?: number;
  }>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  const [profiles, setProfiles] = useState<PriceProfile[]>([]);
  const [salePrices, setSalePrices] = useState<ProductSalePrice[]>([]);
  const [priceFormData, setPriceFormData] = useState<PriceFormData[]>([]);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [costValue, setCostValue] = useState<string>('');
  const [editingCost, setEditingCost] = useState(false);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [quantityValue, setQuantityValue] = useState<string>('');
  const [savingQuantity, setSavingQuantity] = useState(false);

  // Fetch stock data and price profiles when modal opens
  useEffect(() => {
    if (visible && campaignProduct?.productId) {
      fetchStockData();
      fetchPriceProfiles();
      // Initialize cost value
      if (productDetails?.costCents !== undefined) {
        setCostValue((productDetails.costCents / 100).toFixed(2));
      }
      // Initialize quantity value
      if (campaignProduct?.totalQuantityBase !== undefined) {
        setQuantityValue(campaignProduct.totalQuantityBase.toString());
      }
    }
  }, [visible, campaignProduct?.productId, productDetails?.costCents, campaignProduct?.totalQuantityBase]);

  const fetchStockData = async () => {
    if (!campaignProduct?.productId) return;

    const isPrelim = campaignProduct.productStatus === ProductStatus.PRELIMINARY;

    try {
      setLoadingStock(true);

      if (isPrelim) {
        // For preliminary products, search in all purchases to find the preliminary stock
        console.log('🔍 Searching preliminary stock in purchases for product:', campaignProduct.productId);

        // Get recent purchases (not closed or cancelled)
        const purchasesResponse = await purchasesService.getPurchases({
          page: 1,
          limit: 50,
        });

        let prelimStock = 0;

        // Search through all purchases for this product
        if (purchasesResponse.data && purchasesResponse.data.length > 0) {
          for (const purchase of purchasesResponse.data) {
            // Skip closed and cancelled purchases
            if (purchase.status === 'CLOSED' || purchase.status === 'CANCELLED') {
              continue;
            }

            try {
              const products = await purchasesService.getPurchaseProducts(purchase.id, {
                includeProductStatus: 'preliminary',
              });

              // Find the product in this purchase
              const foundProduct = products.find(p => p.productId === campaignProduct.productId);
              if (foundProduct && foundProduct.preliminaryStock) {
                prelimStock = foundProduct.preliminaryStock;
                console.log('✅ Found preliminary stock:', prelimStock, 'in purchase:', purchase.id);
                break; // Found it, stop searching
              }
            } catch (err) {
              // Continue searching in other purchases
              console.log('⚠️ Could not get products from purchase:', purchase.id);
            }
          }
        }

        setStockData({
          stock: prelimStock,
          preliminaryStock: prelimStock,
        });
      } else {
        // For active products, use inventory API
        const stockData = await inventoryApi.getStockByProduct(campaignProduct.productId);
        console.log('📦 Fetched inventory stock data:', stockData);

        const totalStock = stockData.totalQuantityBase || 0;

        setStockData({
          stock: totalStock,
          preliminaryStock: totalStock,
        });
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
      // If error, set stock to 0 instead of undefined
      setStockData({
        stock: 0,
        preliminaryStock: 0,
      });
    } finally {
      setLoadingStock(false);
    }
  };

  const fetchPriceProfiles = async () => {
    if (!campaignProduct?.productId || !productDetails) return;

    try {
      setLoadingPrices(true);

      // Load price profiles and product sale prices in parallel
      const [profilesResponse, salePricesResponse] = await Promise.all([
        priceProfilesApi.getActivePriceProfiles(),
        priceProfilesApi.getProductSalePrices(campaignProduct.productId),
      ]);

      console.log('🔍 Sale prices response:', salePricesResponse);

      setProfiles(profilesResponse);

      // La API devuelve {productId, productSku, costCents, salePrices: [...]}
      const salePricesArray = salePricesResponse.salePrices || salePricesResponse.data || [];
      setSalePrices(salePricesArray);

      // Initialize form data
      const formData: PriceFormData[] = profilesResponse.map((profile) => {
        const existingPrice = salePricesArray.find(
          (sp: any) => sp.profileId === profile.id && sp.presentationId === null
        );

        const factorToCost = typeof profile.factorToCost === 'string'
          ? parseFloat(profile.factorToCost)
          : profile.factorToCost;

        const calculatedPriceCents = priceProfilesApi.calculatePrice(
          productDetails.costCents || 0,
          factorToCost
        );

        const priceCents = existingPrice?.priceCents || calculatedPriceCents;

        return {
          profileId: profile.id,
          profileCode: profile.code,
          profileName: profile.name,
          presentationId: null,
          priceCents,
          isOverridden: existingPrice?.isOverridden || false,
          calculatedPriceCents,
          factorToCost,
          displayValue: (priceCents / 100).toFixed(2),
        };
      });

      setPriceFormData(formData);
    } catch (error: any) {
      console.error('Error loading price profiles:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar los perfiles de precio');
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleStartEditPrice = (priceData: PriceFormData) => {
    setEditingPriceId(priceData.profileId);
    setEditingPriceValue((priceData.priceCents / 100).toFixed(2));
  };

  const handlePriceChange = (value: string) => {
    // Permitir solo números y un punto decimal
    const sanitizedValue = value.replace(/[^0-9.]/g, '');

    // Evitar múltiples puntos decimales
    const parts = sanitizedValue.split('.');
    const finalValue = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : sanitizedValue;

    setEditingPriceValue(finalValue);
  };

  const handleCalculateFranquiciaFromSocia = () => {
    console.log('🧮 Calculate Franquicia from Socia clicked');
    console.log('📊 editingPriceValue:', editingPriceValue);
    console.log('📊 priceFormData:', priceFormData);

    if (!editingPriceValue) {
      console.log('❌ No editingPriceValue');
      return;
    }

    // Calculate Precio Franquicia by dividing Precio Socia by 1.15
    const sociaPrice = parseFloat(editingPriceValue);
    const franquiciaPrice = sociaPrice / 1.15;

    console.log('💰 Socia price:', sociaPrice);
    console.log('💰 Calculated Franquicia price:', franquiciaPrice);

    // Find the Precio Franquicia profile
    const franquiciaProfile = priceFormData.find(p => p.profileCode === 'FRANQ' || p.profileName.toLowerCase().includes('franquicia'));

    console.log('🔍 Found Franquicia profile:', franquiciaProfile);

    if (franquiciaProfile) {
      // Update the Precio Franquicia price
      handleSaveCalculatedFranquiciaPrice(franquiciaProfile.profileId, franquiciaPrice);
    } else {
      console.log('❌ Franquicia profile not found in priceFormData');
      Alert.alert('Error', 'No se encontró el perfil "Precio Franquicia"');
    }
  };

  const handleSaveCalculatedFranquiciaPrice = async (franquiciaProfileId: string, franquiciaPrice: number) => {
    if (!campaignProduct?.productId) return;

    try {
      setSaving(true);
      const priceCents = Math.round(franquiciaPrice * 100);

      const requestBody = {
        productId: campaignProduct.productId,
        presentationId: null,
        profileId: franquiciaProfileId,
        priceCents: priceCents,
      };

      console.log('💾 Saving calculated Franquicia price:', {
        productId: campaignProduct.productId,
        profileId: franquiciaProfileId,
        priceCents,
        franquiciaPrice,
      });
      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

      const result = await priceProfilesApi.updateSalePrice(campaignProduct.productId, requestBody);

      console.log('✅ Franquicia price saved successfully:', result);

      Alert.alert('Éxito', `Precio Franquicia calculado y actualizado: S/ ${franquiciaPrice.toFixed(2)}`);

      // Reload data to get updated prices
      await fetchPriceProfiles();
    } catch (error: any) {
      console.error('❌ Error saving calculated Franquicia price:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert('Error', error.message || 'No se pudo actualizar el Precio Franquicia');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrice = async (profileId: string) => {
    if (!campaignProduct?.productId || !editingPriceValue) return;

    try {
      setSaving(true);
      const priceCents = Math.round(parseFloat(editingPriceValue) * 100);

      // Find the base price (presentationId === null) for this profile in salePrices
      const basePriceEntry = salePrices.find(
        (sp: any) => sp.profileId === profileId && sp.presentationId === null
      );

      console.log('🔍 Found base price entry:', basePriceEntry);

      const requestBody = {
        productId: campaignProduct.productId,
        presentationId: null,
        profileId: profileId,
        priceCents: priceCents,
      };

      console.log('💾 Saving price:', {
        productId: campaignProduct.productId,
        profileId,
        priceCents,
        priceValue: editingPriceValue,
        basePriceId: basePriceEntry?.id,
      });
      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

      const result = await priceProfilesApi.updateSalePrice(campaignProduct.productId, requestBody);

      console.log('✅ Price saved successfully:', result);
      console.log('⚠️ Server returned presentationId:', result.presentationId, '(should be null)');

      Alert.alert('Éxito', 'Precio actualizado correctamente');
      setEditingPriceId(null);
      setEditingPriceValue('');

      // Reload data to get updated prices
      await fetchPriceProfiles();
    } catch (error: any) {
      console.error('❌ Error saving price:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert('Error', error.message || 'No se pudo actualizar el precio');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPriceEdit = () => {
    setEditingPriceId(null);
    setEditingPriceValue('');
  };

  const calculateMargin = (costCents: number, priceCents: number): string => {
    if (costCents === 0) return '0%';
    const margin = ((priceCents - costCents) / costCents) * 100;
    return `${margin.toFixed(1)}%`;
  };

  const handleCostChange = (value: string) => {
    // Permitir solo números y un punto decimal
    const sanitizedValue = value.replace(/[^0-9.]/g, '');

    // Evitar múltiples puntos decimales
    const parts = sanitizedValue.split('.');
    const finalValue = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : sanitizedValue;

    setCostValue(finalValue);
  };

  const handleSaveCost = async () => {
    if (!campaignProduct?.productId || !costValue) return;

    try {
      setSavingCost(true);
      const costCents = Math.round(parseFloat(costValue) * 100);

      // Import productsApi
      const { productsApi } = await import('@/services/api/products');

      await productsApi.updateProduct(campaignProduct.productId, {
        costCents,
      });

      Alert.alert('Éxito', 'Costo actualizado correctamente');
      setEditingCost(false);

      // Reload price profiles to recalculate prices
      await fetchPriceProfiles();
    } catch (error: any) {
      console.error('Error saving cost:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el costo');
    } finally {
      setSavingCost(false);
    }
  };

  const handleCancelCostEdit = () => {
    setEditingCost(false);
    if (productDetails?.costCents !== undefined) {
      setCostValue((productDetails.costCents / 100).toFixed(2));
    }
  };

  const handleQuantityChange = (value: string) => {
    // Permitir solo números enteros
    const sanitizedValue = value.replace(/[^0-9]/g, '');
    setQuantityValue(sanitizedValue);
  };

  const handleSaveQuantity = async () => {
    if (!campaignProduct?.productId || !quantityValue || !campaignProduct?.campaignId) return;

    try {
      setSavingQuantity(true);
      const newQuantity = parseInt(quantityValue, 10);

      // Validate quantity
      if (isNaN(newQuantity) || newQuantity <= 0) {
        Alert.alert('Error', 'La cantidad debe ser un número mayor a 0');
        return;
      }

      // Check available stock
      const availableStock = stockData.stock || 0;
      if (newQuantity > availableStock) {
        Alert.alert('Error', `La cantidad no puede ser mayor al stock disponible (${availableStock})`);
        return;
      }

      await campaignsApi.updateProduct(campaignProduct.campaignId, campaignProduct.productId, {
        totalQuantity: newQuantity,
      });

      Alert.alert('Éxito', 'Cantidad de campaña actualizada correctamente');
      setEditingQuantity(false);

      // Reload modal data if there's a callback
      // The parent component should refresh the campaign products list
    } catch (error: any) {
      console.error('Error saving quantity:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar la cantidad');
    } finally {
      setSavingQuantity(false);
    }
  };

  const handleCancelQuantityEdit = () => {
    setEditingQuantity(false);
    if (campaignProduct?.totalQuantityBase !== undefined) {
      setQuantityValue(campaignProduct.totalQuantityBase.toString());
    }
  };

  if (!campaignProduct) return null;

  // Use product from campaignProduct if available, otherwise use productDetails
  const product = campaignProduct.product || productDetails;

  if (!product) return null;
  const isPreliminary = campaignProduct.productStatus === ProductStatus.PRELIMINARY;

  // Use productDetails if available (has costCents), otherwise fallback to 0
  const costCents = productDetails?.costCents || 0;

  // Determine which stock to show
  const stockValue = isPreliminary
    ? stockData.preliminaryStock
    : stockData.stock;
  const stockLabel = isPreliminary ? 'Stock Preliminar' : 'Stock';

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* SKU Banner */}
            <View style={styles.bannerSection}>
              <Text style={styles.bannerLabel}>SKU</Text>
              <Text style={[styles.bannerValue, isTablet && styles.bannerValueTablet]}>
                {product.sku || 'N/A'}
              </Text>
            </View>

            {/* Product Name Banner */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>PRODUCTO</Text>
              <Text style={[styles.bannerValue, styles.bannerValueName, isTablet && styles.bannerValueTablet]}>
                {product.title || 'Sin nombre'}
              </Text>
            </View>

            {/* Quantity in Campaign Banner - Editable */}
            <View style={styles.bannerSection}>
              <Text style={styles.bannerLabel}>CANTIDAD EN CAMPAÑA</Text>
              {editingQuantity ? (
                <View style={styles.quantityEditContainer}>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantityValue}
                    onChangeText={handleQuantityChange}
                    keyboardType="number-pad"
                    editable={!savingQuantity}
                    selectTextOnFocus={true}
                    autoFocus={true}
                  />
                  <Text style={styles.stockAvailableText}>
                    Stock disponible: {stockData.stock !== undefined ? stockData.stock : 'Cargando...'}
                  </Text>
                  <View style={styles.quantityActionButtons}>
                    <TouchableOpacity
                      style={styles.cancelQuantityButton}
                      onPress={handleCancelQuantityEdit}
                      disabled={savingQuantity}
                    >
                      <Text style={styles.cancelQuantityButtonText}>✕ Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveQuantityButton, savingQuantity && styles.saveQuantityButtonDisabled]}
                      onPress={handleSaveQuantity}
                      disabled={savingQuantity}
                    >
                      {savingQuantity ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveQuantityButtonText}>✓ Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.quantityDisplayContainer}>
                  <Text style={[styles.bannerValue, styles.quantityValue, isTablet && styles.bannerValueTablet]}>
                    {campaignProduct.totalQuantityBase}
                  </Text>
                  {!campaignProduct.distributionGenerated && (
                    <TouchableOpacity
                      style={styles.editQuantityButton}
                      onPress={() => setEditingQuantity(true)}
                    >
                      <Text style={styles.editQuantityButtonText}>✏️ Editar</Text>
                    </TouchableOpacity>
                  )}
                  {campaignProduct.distributionGenerated && (
                    <Text style={styles.distributionGeneratedNote}>
                      ⚠️ No se puede editar - Reparto generado
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Cost Banner - Editable */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>COSTO</Text>
              {editingCost ? (
                <View style={styles.costEditContainer}>
                  <View style={styles.inputRow}>
                    <Text style={styles.currencySymbol}>S/</Text>
                    <TextInput
                      style={styles.costInput}
                      value={costValue}
                      onChangeText={handleCostChange}
                      keyboardType="decimal-pad"
                      editable={!savingCost}
                      selectTextOnFocus={true}
                      autoFocus={true}
                    />
                  </View>
                  <View style={styles.costActionButtons}>
                    <TouchableOpacity
                      style={styles.cancelCostButton}
                      onPress={handleCancelCostEdit}
                      disabled={savingCost}
                    >
                      <Text style={styles.cancelCostButtonText}>✕ Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveCostButton, savingCost && styles.saveCostButtonDisabled]}
                      onPress={handleSaveCost}
                      disabled={savingCost}
                    >
                      {savingCost ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveCostButtonText}>✓ Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.costDisplayContainer}>
                  <Text style={[styles.bannerValue, styles.costValue, isTablet && styles.bannerValueTablet]}>
                    {formatCurrency(costCents)}
                  </Text>
                  <TouchableOpacity
                    style={styles.editCostButton}
                    onPress={() => setEditingCost(true)}
                  >
                    <Text style={styles.editCostButtonText}>✏️ Editar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Price Profiles Section */}
            {loadingPrices ? (
              <View style={styles.loadingPricesContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingPricesText}>Cargando perfiles de precio...</Text>
              </View>
            ) : priceFormData.length === 0 ? (
              <View style={styles.emptyPricesContainer}>
                <Text style={styles.emptyPricesText}>
                  No hay perfiles de precio activos
                </Text>
              </View>
            ) : (
              priceFormData.map((priceData, index) => {
                const isEditing = editingPriceId === priceData.profileId;

                return (
                <View
                  key={priceData.profileId}
                  style={[
                    styles.bannerSection,
                    index === 0 && styles.bannerSectionFirst,
                  ]}
                >
                  {/* Profile Header */}
                  <View style={styles.profileHeaderBanner}>
                    <Text style={styles.bannerLabel}>{priceData.profileName}</Text>
                    <Text style={styles.profileCodeBanner}>{priceData.profileCode} • {priceData.factorToCost.toFixed(2)}x</Text>
                  </View>

                  {/* Price Display/Edit */}
                  {isEditing ? (
                    <View style={styles.priceEditContainer}>
                      <View style={styles.inputRow}>
                        <Text style={styles.currencySymbol}>S/</Text>
                        <TextInput
                          style={styles.priceInputLarge}
                          value={editingPriceValue}
                          onChangeText={handlePriceChange}
                          keyboardType="decimal-pad"
                          editable={!saving}
                          selectTextOnFocus={true}
                          autoFocus={true}
                        />
                      </View>

                      {/* Show calculate button only for Precio Socia */}
                      {(priceData.profileCode === 'SOCIA' || priceData.profileName.toLowerCase().includes('socia')) && (
                        <TouchableOpacity
                          style={styles.calculateSociaButton}
                          onPress={handleCalculateFranquiciaFromSocia}
                          disabled={saving || !editingPriceValue}
                        >
                          <Text style={styles.calculateSociaButtonText}>
                            🧮 Calcular Precio Franquicia (/1.15)
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.priceActionButtons}>
                        <TouchableOpacity
                          style={styles.cancelPriceButton}
                          onPress={handleCancelPriceEdit}
                          disabled={saving}
                        >
                          <Text style={styles.cancelPriceButtonText}>✕ Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.savePriceButton, saving && styles.savePriceButtonDisabled]}
                          onPress={() => handleSavePrice(priceData.profileId)}
                          disabled={saving}
                        >
                          {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.savePriceButtonText}>✓ Guardar</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.priceDisplayContainer}>
                      <Text style={[styles.bannerValue, styles.priceValue, isTablet && styles.bannerValueTablet]}>
                        {formatCurrency(priceData.priceCents)}
                      </Text>
                      <TouchableOpacity
                        style={styles.editPriceButton}
                        onPress={() => handleStartEditPrice(priceData)}
                      >
                        <Text style={styles.editPriceButtonText}>✏️ Editar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Price Info */}
                  {!isEditing && (
                    <View style={styles.priceInfoBanner}>
                      <Text style={styles.priceInfoText}>
                        Calculado: {formatCurrency(priceData.calculatedPriceCents)} • Margen: {calculateMargin(costCents, priceData.priceCents)}
                      </Text>
                      {priceData.isOverridden && (
                        <Text style={styles.overriddenTextBanner}>✏️ Modificado</Text>
                      )}
                    </View>
                  )}
                </View>
              );
              })
            )}

            {/* Stock Banner - Moved to the end */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>{stockLabel.toUpperCase()}</Text>
              {loadingStock ? (
                <View style={styles.loadingStockContainer}>
                  <ActivityIndicator size="large" color="#60A5FA" />
                  <Text style={styles.loadingStockText}>Cargando stock...</Text>
                </View>
              ) : (
                <Text style={[styles.bannerValue, styles.stockValue, isTablet && styles.bannerValueTablet]}>
                  {stockValue !== undefined && stockValue !== null ? stockValue : 'N/A'}
                </Text>
              )}
              {isPreliminary && (
                <Text style={styles.preliminaryNote}>
                  ⚠️ Producto Preliminar
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
    position: 'relative',
  },
  containerTablet: {
    width: '90%',
    height: '90%',
    borderRadius: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  closeButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingTop: 80,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  bannerSection: {
    backgroundColor: '#374151',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4B5563',
  },
  bannerSectionAlt: {
    backgroundColor: '#2D3748',
    borderColor: '#3F4A5C',
  },
  bannerSectionFirst: {
    borderColor: '#10B981',
    borderWidth: 3,
    backgroundColor: '#0F2A3F',
  },
  bannerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  bannerValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 42,
  },
  bannerValueTablet: {
    fontSize: 48,
    lineHeight: 56,
  },
  bannerValueName: {
    fontSize: 28,
    lineHeight: 34,
  },
  quantityValue: {
    color: '#F59E0B',
  },
  stockValue: {
    color: '#60A5FA',
  },
  costValue: {
    color: '#FBBF24',
  },
  priceValue: {
    color: '#10B981',
  },
  preliminaryNote: {
    fontSize: 14,
    color: '#F59E0B',
    marginTop: 12,
    fontWeight: '600',
  },
  loadingStockContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingStockText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  loadingPricesContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    marginVertical: 12,
  },
  loadingPricesText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  emptyPricesContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    marginVertical: 12,
  },
  emptyPricesText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 10,
  },
  costEditContainer: {
    width: '100%',
    alignItems: 'center',
  },
  costDisplayContainer: {
    alignItems: 'center',
  },
  costInput: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#FBBF24',
    borderRadius: 8,
    padding: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#FBBF24',
    textAlign: 'center',
  },
  costActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  cancelCostButton: {
    flex: 1,
    backgroundColor: '#4B5563',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelCostButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveCostButton: {
    flex: 1,
    backgroundColor: '#FBBF24',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveCostButtonDisabled: {
    backgroundColor: '#FCD34D',
  },
  saveCostButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  editCostButton: {
    marginTop: 12,
    backgroundColor: '#4B5563',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  editCostButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priceDisplayContainer: {
    alignItems: 'center',
  },
  priceEditContainer: {
    width: '100%',
    alignItems: 'center',
  },
  priceInputLarge: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  priceActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  cancelPriceButton: {
    flex: 1,
    backgroundColor: '#4B5563',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelPriceButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  savePriceButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  savePriceButtonDisabled: {
    backgroundColor: '#6EE7B7',
  },
  savePriceButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editPriceButton: {
    marginTop: 12,
    backgroundColor: '#4B5563',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  editPriceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileHeaderBanner: {
    alignItems: 'center',
    marginBottom: 12,
  },
  profileCodeBanner: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  priceInfoBanner: {
    marginTop: 12,
    alignItems: 'center',
  },
  priceInfoText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  overriddenTextBanner: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 4,
  },
  calculateSociaButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
    width: '100%',
    alignItems: 'center',
  },
  calculateSociaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quantityEditContainer: {
    width: '100%',
    alignItems: 'center',
  },
  quantityDisplayContainer: {
    alignItems: 'center',
  },
  quantityInput: {
    width: '100%',
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: 8,
  },
  stockAvailableText: {
    fontSize: 14,
    color: '#60A5FA',
    marginBottom: 12,
    fontWeight: '600',
  },
  quantityActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    width: '100%',
  },
  cancelQuantityButton: {
    flex: 1,
    backgroundColor: '#4B5563',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelQuantityButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveQuantityButton: {
    flex: 1,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveQuantityButtonDisabled: {
    opacity: 0.5,
  },
  saveQuantityButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editQuantityButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#374151',
    borderRadius: 6,
  },
  editQuantityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  distributionGeneratedNote: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
});
