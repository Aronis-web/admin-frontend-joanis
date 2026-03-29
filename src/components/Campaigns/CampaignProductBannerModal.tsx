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
  SafeAreaView,
  Image,
} from 'react-native';
import Alert from '@/utils/alert';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { CampaignProduct, ProductStatus, StockDetailByWarehouse } from '@/types/campaigns';
import { inventoryApi } from '@/services/api/inventory';
import { purchasesService } from '@/services/api/purchases';
import { priceProfilesApi } from '@/services/api/price-profiles';
import { campaignsService } from '@/services/api';
import { productsApi } from '@/services/api/products';
import { ProductSalePrice, PriceProfile } from '@/types/price-profiles';
import { DistributionFormModal } from './DistributionFormModal';
import logger from '@/utils/logger';

interface CampaignProductBannerModalProps {
  visible: boolean;
  campaignProduct: CampaignProduct | null;
  productDetails?: any; // Full product details with costCents, priceCents, etc.
  onClose: () => void;
  onRefresh?: (updatedProduct?: CampaignProduct) => void; // Callback to refresh campaign data after distribution or update specific product
  hideStockAndDistribution?: boolean; // Hide stock and distribution sections (for search banner)
  onOpenDistribution?: () => void; // Optional callback to open distribution modal from parent
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
  onRefresh,
  hideStockAndDistribution = false,
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
  const [localCostCents, setLocalCostCents] = useState<number | null>(null); // Local state for updated cost
  const [editingCost, setEditingCost] = useState(false);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [quantityValue, setQuantityValue] = useState<string>('');
  const [savingQuantity, setSavingQuantity] = useState(false);
  const [updatedPrices, setUpdatedPrices] = useState<Set<string>>(new Set());
  const [updatedCost, setUpdatedCost] = useState(false);
  const [calculatedFranquicia, setCalculatedFranquicia] = useState(false);

  // Distribution modal states
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [localStockData, setLocalStockData] = useState<StockDetailByWarehouse[] | undefined>(
    undefined
  );

  // Product image states
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  // Fetch stock data and price profiles when modal opens
  useEffect(() => {
    if (visible && campaignProduct?.productId) {
      // Only fetch stock if not hiding stock and distribution
      if (!hideStockAndDistribution) {
        fetchStockData();
      }
      fetchPriceProfiles();
      fetchProductImage(); // Cargar imagen en segundo plano

      // Initialize cost value - handle both costCents and costCentsBase (API inconsistency)
      let costCentsValue = null;
      if (productDetails?.costCents !== undefined && productDetails.costCents !== null) {
        costCentsValue = typeof productDetails.costCents === 'string'
          ? parseFloat(productDetails.costCents)
          : productDetails.costCents;
      } else if (productDetails?.costCentsBase !== undefined && productDetails.costCentsBase !== null) {
        costCentsValue = typeof productDetails.costCentsBase === 'string'
          ? parseFloat(productDetails.costCentsBase)
          : productDetails.costCentsBase;
      }

      if (costCentsValue !== null && !isNaN(costCentsValue)) {
        setLocalCostCents(costCentsValue);
        setCostValue((costCentsValue / 100).toFixed(2));
      } else {
        setLocalCostCents(null);
        setCostValue('0.00');
      }

      // Initialize quantity value
      if (campaignProduct?.totalQuantityBase !== undefined) {
        setQuantityValue(campaignProduct.totalQuantityBase.toString());
      }
    }
  }, [visible, campaignProduct?.productId, hideStockAndDistribution, productDetails?.costCents, productDetails?.costCentsBase]); // Added both cost fields

  // Update form values when productDetails or campaignProduct changes (without fetching)
  useEffect(() => {
    if (productDetails?.costCents !== undefined && !editingCost) {
      setCostValue((productDetails.costCents / 100).toFixed(2));
    }
  }, [productDetails?.costCents, editingCost]);

  useEffect(() => {
    if (campaignProduct?.totalQuantityBase !== undefined && !editingQuantity) {
      setQuantityValue(campaignProduct.totalQuantityBase.toString());
    }
  }, [campaignProduct?.totalQuantityBase, editingQuantity]);

  const fetchStockData = async () => {
    if (!campaignProduct?.productId) {
      return;
    }

    const isPrelim = campaignProduct.productStatus === ProductStatus.PRELIMINARY;

    try {
      setLoadingStock(true);

      if (isPrelim) {
        // For preliminary products, search in all purchases to find the preliminary stock
        console.log(
          '🔍 Searching preliminary stock in purchases for product:',
          campaignProduct.productId
        );

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
              const foundProduct = products.find((p) => p.productId === campaignProduct.productId);
              if (foundProduct && foundProduct.preliminaryStock) {
                prelimStock = foundProduct.preliminaryStock;
                console.log(
                  '✅ Found preliminary stock:',
                  prelimStock,
                  'in purchase:',
                  purchase.id
                );
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
    if (!campaignProduct?.productId || !productDetails) {
      return;
    }

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
      const salePricesArray =
        (salePricesResponse as any).salePrices || salePricesResponse.data || [];
      setSalePrices(salePricesArray);

      // Initialize form data
      const formData: PriceFormData[] = profilesResponse.map((profile) => {
        const existingPrice = salePricesArray.find(
          (sp: any) => sp.profileId === profile.id && sp.presentationId === null
        );

        const factorToCost =
          typeof profile.factorToCost === 'string'
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

  const fetchProductImage = async () => {
    if (!campaignProduct?.productId) {
      return;
    }

    try {
      setLoadingImage(true);
      logger.debug('📸 Cargando imagen del producto en segundo plano...');

      // Obtener las imágenes del producto
      const imagesResponse = await productsApi.getProductImages(campaignProduct.productId);

      if (imagesResponse && imagesResponse.images && imagesResponse.images.length > 0) {
        // Usar la primera imagen disponible
        setProductImageUrl(imagesResponse.images[0].url);
        logger.debug('✅ Imagen del producto cargada:', imagesResponse.images[0].url);
      } else {
        logger.debug('⚠️ No se encontraron imágenes para el producto');
        setProductImageUrl(null);
      }
    } catch (error) {
      logger.error('❌ Error cargando imagen del producto:', error);
      setProductImageUrl(null);
    } finally {
      setLoadingImage(false);
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
    const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitizedValue;

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
    const franquiciaProfile = priceFormData.find(
      (p) => p.profileCode === 'FRANQ' || p.profileName.toLowerCase().includes('franquicia')
    );

    console.log('🔍 Found Franquicia profile:', franquiciaProfile);

    if (franquiciaProfile) {
      // Update the Precio Franquicia price
      handleSaveCalculatedFranquiciaPrice(franquiciaProfile.profileId, franquiciaPrice);
    } else {
      console.log('❌ Franquicia profile not found in priceFormData');
      Alert.alert('Error', 'No se encontró el perfil "Precio Franquicia"');
    }
  };

  const handleSaveCalculatedFranquiciaPrice = async (
    franquiciaProfileId: string,
    franquiciaPrice: number
  ) => {
    if (!campaignProduct?.productId) {
      return;
    }

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

      // Show success badge for 3 seconds
      setCalculatedFranquicia(true);
      setTimeout(() => {
        setCalculatedFranquicia(false);
      }, 3000);

      // Update the local state instead of refetching
      setPriceFormData((prevData) =>
        prevData.map((p) =>
          p.profileId === franquiciaProfileId
            ? { ...p, priceCents, displayValue: franquiciaPrice.toFixed(2), isOverridden: true }
            : p
        )
      );
    } catch (error: any) {
      console.error('❌ Error saving calculated Franquicia price:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert('Error', error.message || 'No se pudo actualizar el Precio Franquicia');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrice = async (profileId: string) => {
    if (!campaignProduct?.productId || !editingPriceValue) {
      return;
    }

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

      // Show "updated" badge instead of alert
      setUpdatedPrices((prev) => new Set(prev).add(profileId));
      setTimeout(() => {
        setUpdatedPrices((prev) => {
          const newSet = new Set(prev);
          newSet.delete(profileId);
          return newSet;
        });
      }, 3000);

      setEditingPriceId(null);
      setEditingPriceValue('');

      // Update the local state instead of refetching
      setPriceFormData((prevData) =>
        prevData.map((p) =>
          p.profileId === profileId
            ? { ...p, priceCents, displayValue: editingPriceValue, isOverridden: true }
            : p
        )
      );

      // Get updated product and pass it to parent
      if (onRefresh && campaignProduct?.campaignId) {
        try {
          const updatedProduct = await campaignsService.getProduct(
            campaignProduct.campaignId,
            campaignProduct.productId
          );
          onRefresh(updatedProduct);
        } catch (error) {
          console.error('Error fetching updated product:', error);
          onRefresh(); // Fallback to full refresh
        }
      }
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
    if (costCents === 0) {
      return '0%';
    }
    const margin = ((priceCents - costCents) / costCents) * 100;
    return `${margin.toFixed(1)}%`;
  };

  const handleCostChange = (value: string) => {
    // Permitir solo números y un punto decimal
    const sanitizedValue = value.replace(/[^0-9.]/g, '');

    // Evitar múltiples puntos decimales
    const parts = sanitizedValue.split('.');
    const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitizedValue;

    setCostValue(finalValue);
  };

  const handleSaveCost = async () => {
    if (!campaignProduct?.productId || !costValue) {
      return;
    }

    try {
      setSavingCost(true);
      const costCents = Math.round(parseFloat(costValue) * 100);

      const updateData = {
        costCents,
      };

      console.log('💾 Saving cost:', {
        productId: campaignProduct.productId,
        costCents,
        costValue,
        updateData: JSON.stringify(updateData),
      });

      // Import productsApi
      const { productsApi } = await import('@/services/api/products');

      // Update ONLY the costCents field, nothing else
      const result = await productsApi.updateProduct(campaignProduct.productId, updateData);

      console.log('✅ Cost saved successfully:', result);

      // Show "updated" badge instead of alert
      setUpdatedCost(true);
      setTimeout(() => {
        setUpdatedCost(false);
      }, 3000);

      setEditingCost(false);

      // Update local state with new cost
      setLocalCostCents(costCents);
      setCostValue((costCents / 100).toFixed(2));

      // Only refresh if product is in campaign (not from search)
      if (onRefresh && campaignProduct?.campaignId && !hideStockAndDistribution) {
        try {
          const updatedProduct = await campaignsService.getProduct(
            campaignProduct.campaignId,
            campaignProduct.productId
          );
          onRefresh(updatedProduct);
        } catch (error) {
          console.error('Error fetching updated product:', error);
          // Don't call onRefresh() without params as it causes full reload
        }
      }
    } catch (error: any) {
      console.error('❌ Error saving cost:', error);
      console.error('Error details:', error.response?.data || error.message);

      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudo actualizar el costo';

      // Check if it's a presentation validation error
      if (errorMessage.includes('Presentation') && errorMessage.includes('not found')) {
        Alert.alert(
          'Error de Validación',
          'Este producto tiene presentaciones con datos inconsistentes en la base de datos. Por favor, contacta al administrador del sistema para corregir las presentaciones del producto antes de actualizar el costo.\n\n' +
            'Detalles técnicos: ' +
            errorMessage,
          [{ text: 'Entendido' }]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
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
    if (!campaignProduct?.productId || !quantityValue || !campaignProduct?.campaignId) {
      return;
    }

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
        Alert.alert(
          'Error',
          `La cantidad no puede ser mayor al stock disponible (${availableStock})`
        );
        return;
      }

      await campaignsService.updateProduct(campaignProduct.campaignId, campaignProduct.productId, {
        totalQuantity: newQuantity,
      });

      Alert.alert('Éxito', 'Cantidad de campaña actualizada correctamente');
      setEditingQuantity(false);

      // Get updated product and pass it to parent
      if (onRefresh) {
        try {
          const updatedProduct = await campaignsService.getProduct(
            campaignProduct.campaignId,
            campaignProduct.productId
          );
          onRefresh(updatedProduct);
        } catch (error) {
          console.error('Error fetching updated product:', error);
          onRefresh(); // Fallback to full refresh
        }
      }
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

  const handleOpenDistribution = async () => {
    if (!campaignProduct) {
      return;
    }

    // Check if the PRODUCT itself is preliminary (not the campaign product status)
    const product = campaignProduct.product || productDetails;
    const isProductPreliminary = (product?.status as any) === 'preliminary';

    if (isProductPreliminary) {
      Alert.alert(
        'Producto Preliminar',
        'No se puede generar reparto para productos preliminares. El producto debe estar validado primero.'
      );
      return;
    }

    // Also check campaign product status (should be ACTIVE)
    if (campaignProduct.productStatus !== 'ACTIVE') {
      Alert.alert('Error', 'Solo se pueden generar repartos de productos en estado ACTIVO en la campaña');
      return;
    }

    // Cargar stock directamente desde el API de inventario
    logger.debug('📦 [STOCK] Consultando stock directamente del API de inventario...');
    try {
      const stockResponse: any = await inventoryApi.getAllStock({ productId: campaignProduct.productId });
      logger.debug('✅ [STOCK] Stock obtenido del API:', {
        stockResponse: stockResponse,
      });

      // El API devuelve una estructura paginada: { data: [...], total, page, limit }
      // Pero también puede devolver un array directamente (para compatibilidad)
      const stockData = Array.isArray(stockResponse) ? stockResponse : (stockResponse?.data || []);

      // Guardar en estado local
      if (stockData && stockData.length > 0) {
        const stockDetails: StockDetailByWarehouse[] = stockData.map((item: any) => ({
          warehouse: item.warehouse?.name || 'Almacén desconocido',
          total: item.quantityBase || 0,
          reserved: item.reservedQuantityBase || 0,
          available: item.availableQuantityBase || item.quantityBase || 0,
        }));

        setLocalStockData(stockDetails);
        logger.debug('✅ [STOCK] Stock guardado en estado local:', stockDetails);
      } else {
        // Si no hay stock en inventario, intentar obtener stock preliminar de compras
        logger.debug('⚠️ [STOCK] No hay stock en inventario, buscando stock preliminar...');

        if (campaignProduct.sourceType === 'PURCHASE' && campaignProduct.purchaseId) {
          try {
            const purchaseProducts = await purchasesService.getPurchaseProducts(
              campaignProduct.purchaseId,
              { includeProductStatus: 'active,preliminary' }
            );

            const purchaseProduct = purchaseProducts.find(
              (p) => p.productId === campaignProduct.productId
            );

            if (purchaseProduct && purchaseProduct.preliminaryStock) {
              logger.debug('✅ [STOCK] Stock preliminar encontrado en compra:', purchaseProduct.preliminaryStock);

              // Crear stockDetails con el stock preliminar
              const stockDetails: StockDetailByWarehouse[] = [{
                warehouse: purchaseProduct.warehouse?.name || 'Almacén de compra',
                total: purchaseProduct.preliminaryStock,
                reserved: 0,
                available: purchaseProduct.preliminaryStock,
              }];

              setLocalStockData(stockDetails);
            }
          } catch (error) {
            logger.error('❌ [STOCK] Error obteniendo stock preliminar de compra:', error);
          }
        }
      }
    } catch (error: any) {
      logger.error('❌ [STOCK] Error obteniendo stock del API:', error);
      // Continuar sin stock si hay error
    }

    // Abrir el modal de distribución
    setShowDistributionModal(true);
  };

  const handleDistributionSuccess = () => {
    setShowDistributionModal(false);
    if (onRefresh) {
      onRefresh();
    }
  };

  if (!campaignProduct) {
    return null;
  }

  // Use product from campaignProduct if available, otherwise use productDetails
  const product = campaignProduct.product || productDetails;

  if (!product) {
    return null;
  }

  // Check if the PRODUCT itself is preliminary (not the campaign product status)
  const isPreliminary = (product?.status as any) === 'preliminary';

  // For backward compatibility, also check campaign product status for stock display
  const isCampaignProductPreliminary = campaignProduct.productStatus === ProductStatus.PRELIMINARY;

  // Use localCostCents (updated state) if available, otherwise fallback to productDetails or 0
  const getCostCents = () => {
    if (localCostCents !== null) {
      return localCostCents;
    }

    // Try costCents first
    if (productDetails?.costCents !== undefined && productDetails.costCents !== null) {
      return typeof productDetails.costCents === 'string'
        ? parseFloat(productDetails.costCents)
        : productDetails.costCents;
    }

    // Try costCentsBase
    if (productDetails?.costCentsBase !== undefined && productDetails.costCentsBase !== null) {
      return typeof productDetails.costCentsBase === 'string'
        ? parseFloat(productDetails.costCentsBase)
        : productDetails.costCentsBase;
    }

    return 0;
  };

  const costCents = getCostCents();

  // Determine which stock to show (based on campaign product status)
  const stockValue = isCampaignProductPreliminary ? stockData.preliminaryStock : stockData.stock;
  const stockLabel = isCampaignProductPreliminary ? 'Stock Preliminar' : 'Stock';

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {!showDistributionModal && (
          <>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <ScrollView
              style={styles.scrollView}
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
              <Text
                style={[
                  styles.bannerValue,
                  styles.bannerValueName,
                  isTablet && styles.bannerValueTablet,
                ]}
              >
                {product.title || 'Sin nombre'}
              </Text>
            </View>

            {/* Quantity in Campaign Banner - Editable - Only show if not hiding stock and distribution */}
            {!hideStockAndDistribution && (
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
                      Stock disponible:{' '}
                      {stockData.stock !== undefined ? stockData.stock : 'Cargando...'}
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
                        style={[
                          styles.saveQuantityButton,
                          savingQuantity && styles.saveQuantityButtonDisabled,
                        ]}
                        onPress={handleSaveQuantity}
                        disabled={savingQuantity}
                      >
                        {savingQuantity ? (
                          <ActivityIndicator size="small" color={colors.neutral[0]} />
                        ) : (
                          <Text style={styles.saveQuantityButtonText}>✓ Guardar</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.quantityDisplayContainer}>
                    <Text
                      style={[
                        styles.bannerValue,
                        styles.quantityValue,
                        isTablet && styles.bannerValueTablet,
                      ]}
                    >
                      {campaignProduct.totalQuantityBase}
                    </Text>
                    {!campaignProduct.distributionGenerated && (
                      <View style={styles.quantityActionsContainer}>
                        <TouchableOpacity
                          style={styles.editQuantityButton}
                          onPress={() => setEditingQuantity(true)}
                        >
                          <Text style={styles.editQuantityButtonText}>✏️ Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.quickDistributionButton,
                            isPreliminary && styles.quickDistributionButtonDisabled,
                          ]}
                          onPress={handleOpenDistribution}
                          disabled={isPreliminary}
                        >
                          <Text
                            style={[
                              styles.quickDistributionButtonText,
                              isPreliminary && styles.quickDistributionButtonTextDisabled,
                            ]}
                          >
                            ⚡ Generar Reparto
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {isPreliminary && !campaignProduct.distributionGenerated && (
                      <Text style={styles.preliminaryWarningNote}>
                        ⚠️ Producto preliminar - Debe validarse antes de generar reparto
                      </Text>
                    )}
                    {campaignProduct.distributionGenerated && (
                      <Text style={styles.distributionGeneratedNote}>
                        ⚠️ No se puede editar - Reparto generado
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

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
                        <ActivityIndicator size="small" color={colors.neutral[0]} />
                      ) : (
                        <Text style={styles.saveCostButtonText}>✓ Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.costDisplayContainer}>
                  <View style={styles.costValueContainer}>
                    <Text
                      style={[
                        styles.bannerValue,
                        styles.costValue,
                        isTablet && styles.bannerValueTablet,
                      ]}
                    >
                      {formatCurrency(costCents)}
                    </Text>
                    {updatedCost && (
                      <View style={styles.updatedBadge}>
                        <Text style={styles.updatedBadgeText}>✓ Actualizado</Text>
                      </View>
                    )}
                  </View>
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
                <ActivityIndicator size="large" color={colors.success[500]} />
                <Text style={styles.loadingPricesText}>Cargando perfiles de precio...</Text>
              </View>
            ) : priceFormData.length === 0 ? (
              <View style={styles.emptyPricesContainer}>
                <Text style={styles.emptyPricesText}>No hay perfiles de precio activos</Text>
              </View>
            ) : (
              priceFormData.map((priceData, index) => {
                const isEditing = editingPriceId === priceData.profileId;
                const isSocia =
                  priceData.profileCode === 'SOCIA' ||
                  priceData.profileName.toLowerCase().includes('socia');

                return (
                  <View
                    key={priceData.profileId}
                    style={[
                      styles.bannerSection,
                      isSocia && styles.bannerSectionSocia,
                      !isSocia && index === 0 && styles.bannerSectionFirst,
                    ]}
                  >
                    {/* Profile Header */}
                    <View style={styles.profileHeaderBanner}>
                      <Text style={[styles.bannerLabel, isSocia && styles.bannerLabelSocia]}>
                        {priceData.profileName}
                      </Text>
                      <Text style={styles.profileCodeBanner}>
                        {priceData.profileCode} • {priceData.factorToCost.toFixed(2)}x
                      </Text>
                      {isSocia && (
                        <View style={styles.sociaBadge}>
                          <Text style={styles.sociaBadgeText}>⭐ PRECIO DESTACADO</Text>
                        </View>
                      )}
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
                        {(priceData.profileCode === 'SOCIA' ||
                          priceData.profileName.toLowerCase().includes('socia')) && (
                          <View>
                            <TouchableOpacity
                              style={styles.calculateSociaButton}
                              onPress={handleCalculateFranquiciaFromSocia}
                              disabled={saving || !editingPriceValue}
                            >
                              <Text style={styles.calculateSociaButtonText}>
                                🧮 Calcular Precio Franquicia (/1.15)
                              </Text>
                            </TouchableOpacity>
                            {calculatedFranquicia && (
                              <View style={styles.calculatedBadge}>
                                <Text style={styles.calculatedBadgeText}>✓ Calculado</Text>
                              </View>
                            )}
                          </View>
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
                            style={[
                              styles.savePriceButton,
                              saving && styles.savePriceButtonDisabled,
                            ]}
                            onPress={() => handleSavePrice(priceData.profileId)}
                            disabled={saving}
                          >
                            {saving ? (
                              <ActivityIndicator size="small" color={colors.neutral[0]} />
                            ) : (
                              <Text style={styles.savePriceButtonText}>✓ Guardar</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.priceDisplayContainer}>
                        <View style={styles.priceValueContainer}>
                          <Text
                            style={[
                              styles.bannerValue,
                              styles.priceValue,
                              isTablet && styles.bannerValueTablet,
                            ]}
                          >
                            {formatCurrency(priceData.priceCents)}
                          </Text>
                          {updatedPrices.has(priceData.profileId) && (
                            <View style={styles.updatedBadge}>
                              <Text style={styles.updatedBadgeText}>✓ Actualizado</Text>
                            </View>
                          )}
                        </View>
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
                          Calculado: {formatCurrency(priceData.calculatedPriceCents)} • Margen:{' '}
                          {calculateMargin(costCents, priceData.priceCents)}
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

            {/* Total Cost Banner - NEW */}
            <View style={[styles.bannerSection, styles.bannerSectionTotal]}>
              <Text style={styles.bannerLabel}>TOTAL COSTO</Text>
              <Text style={styles.bannerLabelSubtitle}>
                (Costo × Cantidad Campaña)
              </Text>
              <Text
                style={[
                  styles.bannerValue,
                  styles.totalCostValue,
                  isTablet && styles.bannerValueTablet,
                ]}
              >
                {formatCurrency(costCents * (campaignProduct.totalQuantityBase || 0))}
              </Text>
              <Text style={styles.totalCostBreakdown}>
                {formatCurrency(costCents)} × {campaignProduct.totalQuantityBase || 0} unidades
              </Text>
            </View>

            {/* Product Image Banner - NEW */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>FOTO DEL PRODUCTO</Text>
              {loadingImage ? (
                <View style={styles.loadingImageContainer}>
                  <ActivityIndicator size="large" color={colors.accent[500]} />
                  <Text style={styles.loadingImageText}>Cargando imagen...</Text>
                </View>
              ) : productImageUrl ? (
                <Image
                  source={{ uri: productImageUrl }}
                  style={styles.productImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.noImageContainer}>
                  <Text style={styles.noImageIcon}>📷</Text>
                  <Text style={styles.noImageText}>Sin imagen disponible</Text>
                </View>
              )}
            </View>

            {/* Stock Banner - Moved to the end - Only show if not hiding stock and distribution */}
            {!hideStockAndDistribution && (
              <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
                <Text style={styles.bannerLabel}>{stockLabel.toUpperCase()}</Text>
                {loadingStock ? (
                  <View style={styles.loadingStockContainer}>
                    <ActivityIndicator size="large" color={colors.primary[400]} />
                    <Text style={styles.loadingStockText}>Cargando stock...</Text>
                  </View>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.bannerValue,
                        styles.stockValue,
                        isTablet && styles.bannerValueTablet,
                      ]}
                    >
                      {stockValue !== undefined && stockValue !== null ? stockValue : 'N/A'}
                    </Text>
                    {!campaignProduct.distributionGenerated && campaignProduct.productStatus === 'ACTIVE' && (
                      <TouchableOpacity
                        style={styles.distributionButton}
                        onPress={handleOpenDistribution}
                      >
                        <Text style={styles.distributionButtonText}>
                          📊 Generar Distribución
                        </Text>
                      </TouchableOpacity>
                    )}
                    {campaignProduct.distributionGenerated && (
                      <Text style={styles.distributionGeneratedNote}>
                        ✅ Distribución ya generada
                      </Text>
                    )}
                  </>
                )}
                {isPreliminary && <Text style={styles.preliminaryNote}>⚠️ Producto Preliminar</Text>}
              </View>
            )}
          </ScrollView>
          </>
        )}

        {/* Distribution Form - Rendered as content, not as nested modal */}
        {showDistributionModal && (
          <DistributionFormModal
            visible={showDistributionModal}
            campaignId={campaignProduct?.campaignId || ''}
            product={campaignProduct}
            localStockData={localStockData}
            onClose={() => setShowDistributionModal(false)}
            onSuccess={handleDistributionSuccess}
            asContent={true}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  containerTablet: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  closeButton: {
    position: 'absolute',
    top: spacing[4],
    right: spacing[4],
    zIndex: 10,
    backgroundColor: colors.surface.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[4],
  },
  bannerSection: {
    backgroundColor: colors.surface.primary,
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[6],
    marginBottom: spacing[4],
    borderRadius: borderRadius['2xl'],
    alignItems: 'center',
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  bannerSectionAlt: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.neutral[300],
  },
  bannerSectionFirst: {
    borderColor: colors.success[500],
    borderWidth: 3,
    backgroundColor: colors.success[50],
    shadowColor: colors.success[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  bannerSectionSocia: {
    borderColor: colors.success[500],
    borderWidth: 4,
    backgroundColor: colors.success[50],
    shadowColor: colors.success[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  bannerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[500],
    letterSpacing: 1.2,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
  },
  bannerLabelSocia: {
    fontSize: 14,
    color: colors.success[500],
    letterSpacing: 1.5,
  },
  bannerValue: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.neutral[800],
    textAlign: 'center',
    lineHeight: 48,
  },
  bannerValueTablet: {
    fontSize: 52,
    lineHeight: 60,
  },
  bannerValueName: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  quantityValue: {
    color: colors.warning[500],
  },
  stockValue: {
    color: colors.info[500],
  },
  costValue: {
    color: colors.warning[500],
  },
  priceValue: {
    color: colors.success[500],
    fontSize: 48,
    fontWeight: '900',
  },
  preliminaryNote: {
    fontSize: 13,
    color: colors.warning[500],
    marginTop: spacing[3],
    fontWeight: '600',
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.lg,
  },
  loadingStockContainer: {
    paddingVertical: spacing[5],
    alignItems: 'center',
  },
  loadingStockText: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[3],
  },
  loadingPricesContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    marginVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  loadingPricesText: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[3],
  },
  emptyPricesContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    marginVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emptyPricesText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[500],
    marginRight: spacing[2],
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
    backgroundColor: colors.warning[50],
    borderWidth: 2,
    borderColor: colors.warning[500],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    fontSize: 28,
    fontWeight: '800',
    color: colors.warning[500],
    textAlign: 'center',
  },
  costActionButtons: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
    width: '100%',
  },
  cancelCostButton: {
    flex: 1,
    backgroundColor: colors.border.default,
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  cancelCostButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  saveCostButton: {
    flex: 1,
    backgroundColor: colors.warning[500],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    shadowColor: colors.warning[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveCostButtonDisabled: {
    opacity: 0.6,
  },
  saveCostButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  editCostButton: {
    marginTop: spacing[3],
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  editCostButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
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
    backgroundColor: colors.success[50],
    borderWidth: 3,
    borderColor: colors.success[500],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    fontSize: 32,
    fontWeight: '900',
    color: colors.success[500],
    textAlign: 'center',
  },
  priceActionButtons: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
    width: '100%',
  },
  cancelPriceButton: {
    flex: 1,
    backgroundColor: colors.border.default,
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  cancelPriceButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  savePriceButton: {
    flex: 1,
    backgroundColor: colors.success[500],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    shadowColor: colors.success[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  savePriceButtonDisabled: {
    opacity: 0.6,
  },
  savePriceButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  editPriceButton: {
    marginTop: spacing[3],
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  editPriceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  profileHeaderBanner: {
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  profileCodeBanner: {
    fontSize: 11,
    color: colors.neutral[400],
    marginTop: spacing[1],
    fontWeight: '600',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  priceInfoBanner: {
    marginTop: spacing[3],
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
  },
  priceInfoText: {
    fontSize: 11,
    color: colors.neutral[500],
    textAlign: 'center',
    fontWeight: '500',
  },
  overriddenTextBanner: {
    fontSize: 11,
    color: colors.warning[500],
    fontWeight: '700',
    marginTop: spacing[1],
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: borderRadius.md,
  },
  calculateSociaButton: {
    backgroundColor: colors.accent[500],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    marginTop: spacing[3],
    marginBottom: spacing[2],
    width: '100%',
    alignItems: 'center',
    shadowColor: colors.accent[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  calculateSociaButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[0],
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
    backgroundColor: colors.warning[50],
    borderWidth: 2,
    borderColor: colors.warning[500],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    fontSize: 28,
    fontWeight: '800',
    color: colors.warning[500],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  stockAvailableText: {
    fontSize: 13,
    color: colors.info[500],
    marginBottom: spacing[3],
    fontWeight: '600',
    backgroundColor: colors.info[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.lg,
  },
  quantityActionButtons: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[1],
    width: '100%',
  },
  cancelQuantityButton: {
    flex: 1,
    backgroundColor: colors.border.default,
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  cancelQuantityButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  saveQuantityButton: {
    flex: 1,
    backgroundColor: colors.warning[500],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    shadowColor: colors.warning[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveQuantityButtonDisabled: {
    opacity: 0.6,
  },
  saveQuantityButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  quantityActionsContainer: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
    flexWrap: 'wrap',
  },
  editQuantityButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    alignItems: 'center',
  },
  editQuantityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  quickDistributionButton: {
    flex: 1,
    minWidth: 140,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[500],
    alignItems: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  quickDistributionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  quickDistributionButtonDisabled: {
    backgroundColor: colors.neutral[400],
    borderColor: colors.neutral[400],
    opacity: 0.6,
  },
  quickDistributionButtonTextDisabled: {
    color: colors.border.default,
  },
  preliminaryWarningNote: {
    fontSize: 12,
    color: colors.warning[500],
    marginTop: spacing[2],
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.lg,
  },
  distributionGeneratedNote: {
    fontSize: 12,
    color: colors.warning[500],
    marginTop: spacing[2],
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.lg,
  },
  sociaBadge: {
    marginTop: spacing[2],
    backgroundColor: colors.success[500],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    shadowColor: colors.success[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sociaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.neutral[0],
    letterSpacing: 0.8,
  },
  generateDistributionButton: {
    marginTop: spacing[4],
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  generateDistributionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
    textAlign: 'center',
  },
  priceValueContainer: {
    alignItems: 'center',
    gap: spacing[2],
  },
  costValueContainer: {
    alignItems: 'center',
    gap: spacing[2],
  },
  updatedBadge: {
    backgroundColor: colors.success[500],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.xl,
    marginTop: spacing[1],
  },
  updatedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  calculatedBadge: {
    backgroundColor: colors.success[500],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.xl,
    marginTop: spacing[2],
    alignItems: 'center',
  },
  calculatedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  distributionButton: {
    backgroundColor: colors.success[500],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
    alignItems: 'center',
    shadowColor: colors.success[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  distributionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  // Total Cost styles
  bannerSectionTotal: {
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[500],
    borderWidth: 3,
    shadowColor: colors.warning[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  bannerLabelSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[400],
    letterSpacing: 0.5,
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  totalCostValue: {
    color: colors.warning[600],
    fontSize: 44,
    fontWeight: '900',
  },
  totalCostBreakdown: {
    fontSize: 13,
    color: colors.warning[800],
    marginTop: spacing[2],
    fontWeight: '600',
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.lg,
  },
  // Product Image styles
  loadingImageContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  loadingImageText: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[3],
  },
  productImage: {
    width: '100%',
    height: 300,
    borderRadius: borderRadius.xl,
    marginTop: spacing[3],
    backgroundColor: colors.neutral[100],
  },
  noImageContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    marginTop: spacing[3],
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
  },
  noImageIcon: {
    fontSize: 48,
    marginBottom: spacing[2],
  },
  noImageText: {
    fontSize: 14,
    color: colors.neutral[400],
    fontWeight: '600',
  },
});
