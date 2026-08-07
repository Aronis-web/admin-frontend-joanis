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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { CampaignProduct, ProductStatus, StockDetailByWarehouse } from '@/types/campaigns';
import { inventoryApi } from '@/services/api/inventory';
import { purchasesService } from '@/services/api/purchases';
import { priceProfilesApi } from '@/services/api/price-profiles';
import { campaignsService } from '@/services/api';
import { productsApi } from '@/services/api/products';
import { photoCampaignsApi } from '@/services/api/photo-campaigns';
import { ProductSalePrice, PriceProfile } from '@/types/price-profiles';
import { DistributionFormModalV2 as DistributionFormModal } from './DistributionFormModalV2';
import logger from '@/utils/logger';
import { useTenantStore } from '@/store/tenant';
import { useCampaignProductFull } from '@/hooks/api/useCampaigns';

interface CampaignProductBannerModalProps {
  visible: boolean;
  campaignProduct: CampaignProduct | null;
  productDetails?: any; // Full product details with costCents, priceCents, etc.
  onClose: () => void;
  onRefresh?: (updatedProduct?: CampaignProduct) => void; // Callback to refresh campaign data after distribution or update specific product
  hideStockAndDistribution?: boolean; // Hide stock and distribution sections (for search banner)
  onOpenDistribution?: () => void; // Optional callback to open distribution modal from parent
  /** Cantidad ya repartida (del endpoint compacto products/detail). */
  distributedQuantityBase?: number;
  /** Proveedor/compra del endpoint compacto. */
  supplier?: { id?: string; name: string; purchaseCode?: string } | null;
  /** Callback al pulsar "Ver cantidades repartidas por sede". */
  onViewDistributionsBySite?: () => void;
  /**
   * Callback al pulsar "Gestionar fotos" (junto a la foto del producto).
   * Abre el gestor de fotos del producto, igual que en la lista de productos.
   * Si no se define, el botón no se muestra.
   */
  onManagePhotos?: () => void;
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
  distributedQuantityBase,
  supplier,
  onViewDistributionsBySite,
  onManagePhotos,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const selectedSite = useTenantStore((state) => state.selectedSite);
  const currentSiteId = selectedSite?.id;
  const [, setLoadingStock] = useState(false);
  const [stockData, setStockData] = useState<{
    stock?: number;
    preliminaryStock?: number;
  }>({});
  // Breakdown por bodega/sede para el banner de recomendaciones cuando
  // el endpoint /full devuelve 404 y no podemos usar `fullData.stockBySite`.
  const [stockByWarehouseFallback, setStockByWarehouseFallback] = useState<
    Array<{
      warehouseId?: string;
      warehouseName: string;
      siteName?: string;
      quantityBase: number;
      reservedQuantityBase?: number;
      availableQuantityBase?: number;
    }>
  >([]);
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
  // Fotos completas del producto (tipadas) para el banner de recomendaciones,
  // cuando el endpoint /full no devuelve el arreglo photos.
  const [photoCampaignAssets, setPhotoCampaignAssets] = useState<
    Array<{ type?: string; url: string }>
  >([]);
  // Foto seleccionada para vista ampliada (null = modal cerrado).
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  // Datos completos del producto (endpoint rico `/full`). Se consulta siempre
  // que haya campañaId y productId, incluido el banner del buscador global, para
  // que las sugerencias muestren los mismos datos (foto, costo, stock, lotes).
  const campaignId = campaignProduct?.campaignId;
  const productId = campaignProduct?.productId;
  // En el banner de "recomendaciones" el producto todavía NO está en la
  // campaña, así que /full siempre respondería 404. Evitamos disparar la
  // query en ese caso para no ensuciar la consola con errores y para que
  // los fallbacks locales (stockByWarehouseFallback, photoCampaignAssets,
  // supplierFromDetails) se muestren de inmediato.
  const { data: fullData, isLoading: loadingFull } = useCampaignProductFull(
    campaignId || '',
    productId || '',
    visible && !hideStockAndDistribution && !!campaignId && !!productId
  );

  // Fetch stock data and price profiles when modal opens
  useEffect(() => {
    if (visible && campaignProduct?.productId) {
      // Siempre traemos stock: la vista de "recomendaciones" (búsqueda global)
      // también lo necesita para mostrarlo como el banner normal, aunque el
      // producto todavía no esté en la campaña.
      fetchStockData();
      fetchPriceProfiles();
      fetchProductImage(); // Cargar imagen en segundo plano

      // Initialize cost value - handle both costCents and costCentsBase (API inconsistency)
      let costCentsValue = null;
      if (productDetails?.costCents !== undefined && productDetails.costCents !== null) {
        costCentsValue =
          typeof productDetails.costCents === 'string'
            ? parseFloat(productDetails.costCents)
            : productDetails.costCents;
      } else if (
        productDetails?.costCentsBase !== undefined &&
        productDetails.costCentsBase !== null
      ) {
        costCentsValue =
          typeof productDetails.costCentsBase === 'string'
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
  }, [
    visible,
    campaignProduct?.productId,
    hideStockAndDistribution,
    productDetails?.costCents,
    productDetails?.costCentsBase,
  ]); // Added both cost fields

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
        // For active products, use inventory API. El backend a veces devuelve
        // un array de items en vez del objeto StockByProductResponse; soportamos
        // ambos formatos y guardamos el desglose para el banner de recomendaciones.
        const raw: any = await inventoryApi.getStockByProduct(campaignProduct.productId);
        console.log('📦 Fetched inventory stock data:', raw);

        const toNum = (v: any): number => {
          if (typeof v === 'number') return v;
          if (typeof v === 'string') {
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
          }
          return 0;
        };

        let totalStock = 0;
        const breakdown: Array<{
          warehouseId?: string;
          warehouseName: string;
          siteName?: string;
          quantityBase: number;
          reservedQuantityBase?: number;
          availableQuantityBase?: number;
        }> = [];

        if (Array.isArray(raw)) {
          for (const item of raw) {
            const qty = toNum(item?.availableQuantityBase ?? item?.quantityBase ?? item?.stock);
            totalStock += qty;
            breakdown.push({
              warehouseId: item?.warehouseId,
              warehouseName:
                item?.warehouseName || item?.siteName || item?.warehouse?.name || 'Almacén',
              siteName: item?.siteName || item?.site?.name,
              quantityBase: toNum(item?.quantityBase ?? item?.availableQuantityBase),
              reservedQuantityBase:
                item?.reservedQuantityBase !== undefined
                  ? toNum(item.reservedQuantityBase)
                  : undefined,
              availableQuantityBase:
                item?.availableQuantityBase !== undefined
                  ? toNum(item.availableQuantityBase)
                  : undefined,
            });
          }
        } else if (raw && typeof raw === 'object') {
          totalStock = toNum(raw.totalQuantityBase);
          if (Array.isArray(raw.stockByWarehouse)) {
            for (const wh of raw.stockByWarehouse) {
              breakdown.push({
                warehouseId: wh?.warehouseId,
                warehouseName: wh?.warehouseName || 'Almacén',
                quantityBase: toNum(wh?.quantityBase),
              });
            }
          }
        }

        setStockData({
          stock: totalStock,
          preliminaryStock: totalStock,
        });
        setStockByWarehouseFallback(breakdown);
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

      // Si el getProduct no trajo costCents (p. ej. banner de recomendaciones
      // con producto que aún no está en la campaña), usamos el costo que sí
      // devuelve el endpoint de precios de venta para poblar el estado local.
      const salePricesCostRaw = (salePricesResponse as any).costCents;
      if (
        localCostCents === null &&
        (productDetails?.costCents === undefined || productDetails?.costCents === null) &&
        salePricesCostRaw !== undefined &&
        salePricesCostRaw !== null
      ) {
        const parsed =
          typeof salePricesCostRaw === 'string' ? parseFloat(salePricesCostRaw) : salePricesCostRaw;
        if (!isNaN(parsed)) {
          setLocalCostCents(parsed);
          setCostValue((parsed / 100).toFixed(2));
        }
      }

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

    setLoadingImage(true);
    logger.debug('📸 Cargando imagen del producto en segundo plano...');

    // Corremos las dos fuentes en paralelo y de forma independiente para
    // que una falla en /files/products/:id/images no deje sin foto al
    // banner de recomendaciones (donde /files puede dar 404 pero
    // /admin/photo-campaigns/products/:id/photos sí tiene fotos).
    const [imagesResult, photosResult] = await Promise.allSettled([
      productsApi.getProductImages(campaignProduct.productId),
      photoCampaignsApi.getProductPhotos(campaignProduct.productId),
    ]);

    let firstFallbackUrl: string | null = null;

    if (imagesResult.status === 'fulfilled') {
      const resp = imagesResult.value;
      if (resp && resp.images && resp.images.length > 0) {
        firstFallbackUrl = resp.images[0].url;
        logger.debug('✅ Imagen del producto cargada (files):', firstFallbackUrl);
      } else {
        logger.debug('⚠️ /files no devolvió imágenes para el producto');
      }
    } else {
      logger.warn('⚠️ Error /files/products/:id/images:', imagesResult.reason);
    }

    if (photosResult.status === 'fulfilled') {
      const assets = photosResult.value;
      if (Array.isArray(assets) && assets.length > 0) {
        const mapped = assets
          .map((a) => ({
            type: typeof a.photoType === 'string' ? a.photoType.toLowerCase() : undefined,
            url: a.fileUrl,
          }))
          .filter((x) => !!x.url);
        setPhotoCampaignAssets(mapped);
        if (!firstFallbackUrl && mapped[0]) {
          firstFallbackUrl = mapped[0].url;
        }
        logger.debug('✅ Fotos tipadas cargadas (photo-campaigns):', mapped.length);
      } else {
        setPhotoCampaignAssets([]);
        logger.debug('⚠️ photo-campaigns no devolvió fotos');
      }
    } else {
      setPhotoCampaignAssets([]);
      logger.warn('⚠️ Error /admin/photo-campaigns/.../photos:', photosResult.reason);
    }

    setProductImageUrl(firstFallbackUrl);
    setLoadingImage(false);
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

    // Usamos el estado del CampaignProduct (mismo source que la lista). El
    // `status` del Product maestro puede quedar stale como 'preliminary'.
    const isProductPreliminary = campaignProduct.productStatus === ProductStatus.PRELIMINARY;

    if (isProductPreliminary) {
      Alert.alert(
        'Producto Preliminar',
        'No se puede generar reparto para productos preliminares. El producto debe estar validado primero.'
      );
      return;
    }

    // Also check campaign product status (should be ACTIVE)
    if (campaignProduct.productStatus !== 'ACTIVE') {
      Alert.alert(
        'Error',
        'Solo se pueden generar repartos de productos en estado ACTIVO en la campaña'
      );
      return;
    }

    // Cargar stock directamente desde el API de inventario
    logger.debug('📦 [STOCK] Consultando stock directamente del API de inventario...');
    try {
      const stockResponse: any = await inventoryApi.getAllStock({
        productId: campaignProduct.productId,
        // Filtrar por la sede actual cuando esté disponible para que el modal
        // solo muestre stock relevante a la sede del usuario.
        ...(currentSiteId ? { siteId: currentSiteId } : {}),
      });
      logger.debug('✅ [STOCK] Stock obtenido del API:', {
        stockResponse: stockResponse,
      });

      // El API devuelve una estructura paginada: { data: [...], total, page, limit }
      // Pero también puede devolver un array directamente (para compatibilidad)
      const stockData = Array.isArray(stockResponse) ? stockResponse : stockResponse?.data || [];

      // Guardar en estado local
      if (stockData && stockData.length > 0) {
        const stockDetails: StockDetailByWarehouse[] = stockData.map((item: any) => ({
          warehouse: item.warehouse?.name || 'Almacén desconocido',
          warehouseId: item.warehouseId || item.warehouse?.id,
          // El backend puede devolver siteId en distintos paths; si no viene,
          // asumimos el siteId actual porque ya filtramos en el request.
          siteId:
            item.warehouse?.siteId ?? item.warehouse?.site?.id ?? item.siteId ?? currentSiteId,
          area: item.area?.name ?? null,
          areaId: item.areaId ?? item.area?.id ?? null,
          // ⚠️ Usar ?? (no ||) para que un disponible legítimo de 0 (todo
          // reservado) no degrade al total. Antes mostrábamos el total como
          // "disponible" cuando availableQuantityBase venía 0.
          total: Number(item.quantityBase ?? 0),
          reserved: Number(item.reservedQuantityBase ?? 0),
          available: Number(
            item.availableQuantityBase ??
              Math.max(
                (Number(item.quantityBase) || 0) - (Number(item.reservedQuantityBase) || 0),
                0
              )
          ),
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
              logger.debug(
                '✅ [STOCK] Stock preliminar encontrado en compra:',
                purchaseProduct.preliminaryStock
              );

              // Crear stockDetails con el stock preliminar
              const stockDetails: StockDetailByWarehouse[] = [
                {
                  warehouse: purchaseProduct.warehouse?.name || 'Almacén de compra',
                  warehouseId:
                    (purchaseProduct as any).warehouseId || (purchaseProduct as any).warehouse?.id,
                  // Fallback explícito a la sede actual: el modal V2 descarta
                  // todo stock sin siteId para no mezclar sedes.
                  siteId:
                    (purchaseProduct as any).warehouse?.siteId ??
                    (purchaseProduct as any).warehouse?.site?.id ??
                    (purchaseProduct as any).siteId ??
                    currentSiteId,
                  area: (purchaseProduct as any).area?.name ?? null,
                  areaId: (purchaseProduct as any).areaId ?? null,
                  total: purchaseProduct.preliminaryStock,
                  reserved: 0,
                  available: purchaseProduct.preliminaryStock,
                },
              ];

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

  // Use product from campaignProduct if available, otherwise use productDetails.
  // ⚠️ Para productos PRELIMINARES el backend puede no incluir la relación
  // `campaignProduct.product` y el store `products` tampoco los indexa, así que
  // NO abortamos el render — usamos fallbacks de `fullData`/`campaignProduct`
  // para SKU/título/barcode. De lo contrario el banner quedaba en blanco y el
  // botón "Gestionar fotos" nunca aparecía para productos preliminares.
  const product: any =
    campaignProduct.product || productDetails || (campaignProduct as any).productSnapshot || {};

  // Estado preliminar: usamos el `productStatus` del CampaignProduct (mismo
  // source de verdad que la lista de productos de la campaña). NO usar
  // `product.status` del Product maestro porque puede quedar stale como
  // 'preliminary' aunque el campaign product ya esté validado, bloqueando
  // incorrectamente el botón "Generar Reparto".
  const isPreliminary = campaignProduct.productStatus === ProductStatus.PRELIMINARY;

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

  // Costo a mostrar en el banner:
  // - Producto ACTIVO: costo unitario del último ingreso registrado (lote más
  //   reciente por `receivedAt`).
  // - Producto PRELIMINAR: costo preliminar del producto (viene en `full`).
  // - Si el usuario editó el costo manualmente, respetamos ese valor.
  // Cae al costo maestro cuando no hay datos del endpoint `full`.
  const lastEntry =
    fullData?.entries && fullData.entries.length > 0
      ? [...fullData.entries].sort(
          (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
        )[0]
      : null;
  const displayCostCents = updatedCost
    ? costCents
    : isPreliminary
      ? (fullData?.costCents ?? costCents)
      : lastEntry
        ? lastEntry.unitCostCents
        : (fullData?.costCents ?? costCents);
  const costSourceLabel = updatedCost
    ? null
    : isPreliminary
      ? 'Costo preliminar'
      : lastEntry
        ? `Último ingreso${lastEntry.entryNumber ? ` · #${lastEntry.entryNumber}` : ''}`
        : null;

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  // Proveedor efectivo: prioriza el prop, luego el endpoint `full` y por
  // último los campos que a veces vienen dentro de `productDetails`
  // (ej. banner de recomendaciones, donde el prop `supplier` no se pasa).
  const supplierFromDetails: { id?: string; name: string; purchaseCode?: string } | null = (() => {
    const pd: any = productDetails;
    if (!pd) return null;
    // 1) Objeto supplier explícito.
    if (pd.supplier && typeof pd.supplier === 'object' && pd.supplier.name) {
      return {
        id: pd.supplier.id,
        name: pd.supplier.name,
        purchaseCode: pd.supplier.purchaseCode ?? pd.purchase?.code ?? undefined,
      };
    }
    // 2) `purchase` embebido (buscador v2, listado de campaña).
    if (pd.purchase && typeof pd.purchase === 'object') {
      const name: string =
        pd.purchase.supplier?.name || pd.purchase.supplierName || pd.purchase.name || '';
      const code: string | undefined = pd.purchase.code || pd.purchase.purchaseCode;
      if (name || code) {
        return {
          id: pd.purchase.supplier?.id,
          name: name || '',
          purchaseCode: code,
        };
      }
    }
    // 3) Nombre plano (poco común).
    if (typeof pd.supplierName === 'string' && pd.supplierName) {
      return { name: pd.supplierName, purchaseCode: pd.purchaseCode };
    }
    return null;
  })();

  const effectiveSupplier = supplier?.name
    ? supplier
    : fullData?.supplier
      ? {
          id: fullData.supplier.id,
          name: fullData.supplier.name,
          purchaseCode: fullData.supplier.purchaseCode ?? undefined,
        }
      : supplierFromDetails
        ? supplierFromDetails
        : supplier;

  // Precio Socia (destacado) vs. el resto de perfiles de venta.
  const isSociaProfile = (p: PriceFormData) =>
    p.profileCode === 'SOCIA' || p.profileName.toLowerCase().includes('socia');
  const sociaPrice = priceFormData.find(isSociaProfile);
  const otherPrices = priceFormData.filter((p) => !isSociaProfile(p));

  // Foto a mostrar: una sola, con prioridad price > design > reference >
  // catalog (miniatura del catálogo, igual que la lista). Si el endpoint
  // `full` no trae fotos, cae a la imagen cargada por separado.
  const bannerPhoto: { type?: string; url: string } | null = (() => {
    const pickUrl = (p: any): string | undefined => {
      if (!p) return undefined;
      if (typeof p === 'string') return p;
      if (typeof p === 'object' && typeof p.url === 'string') return p.url;
      return undefined;
    };
    const normalize = (arr: any): { type?: string; url: string }[] => {
      if (!Array.isArray(arr)) return [];
      const out: { type?: string; url: string }[] = [];
      for (const p of arr) {
        const url = pickUrl(p);
        if (!url) continue;
        const type =
          p && typeof p === 'object' && typeof (p as any).type === 'string'
            ? (p as { type: string }).type
            : undefined;
        out.push({ type, url });
      }
      return out;
    };
    // Prioridad: fullData.photos > photoCampaigns (getProductPhotos) >
    // productDetails.photos/photoUrls/imageUrls > imagen cargada aparte >
    // productDetails.imageUrl.
    const candidates = [
      ...normalize(fullData?.photos),
      ...photoCampaignAssets,
      ...normalize((productDetails as any)?.photos),
      ...normalize((productDetails as any)?.photoUrls),
      ...normalize((productDetails as any)?.imageUrls),
    ];
    const byType = (t: string) => candidates.find((p) => (p.type || '').toLowerCase() === t);
    const picked =
      byType('price') ||
      byType('design') ||
      byType('reference') ||
      byType('catalog') ||
      candidates[0];
    if (picked) return picked;
    if (productImageUrl) return { url: productImageUrl };
    const fallbackImageUrl =
      typeof (productDetails as any)?.imageUrl === 'string'
        ? (productDetails as any).imageUrl
        : undefined;
    return fallbackImageUrl ? { url: fallbackImageUrl } : null;
  })();

  // Tarjeta reutilizable de precio de venta (display + edición inline).
  const renderPriceCard = (priceData: PriceFormData) => {
    const isEditing = editingPriceId === priceData.profileId;
    const isSocia = isSociaProfile(priceData);

    return (
      <View
        key={priceData.profileId}
        style={[styles.bannerSection, isSocia && styles.bannerSectionSocia]}
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
            {isSocia && (
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
                style={[styles.savePriceButton, saving && styles.savePriceButtonDisabled]}
                onPress={() => handleSavePrice(priceData.profileId)}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.color.text.onAction} />
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
              {/* SKU + Producto (misma tarjeta) */}
              <View style={styles.bannerSection}>
                <Text style={styles.bannerLabel}>SKU</Text>
                <Text style={[styles.bannerValue, isTablet && styles.bannerValueTablet]}>
                  {product?.sku || fullData?.sku || (campaignProduct as any).sku || 'N/A'}
                </Text>
                <View style={styles.skuNameDivider} />
                <Text style={styles.bannerLabel}>PRODUCTO</Text>
                <Text
                  style={[
                    styles.bannerValue,
                    styles.bannerValueName,
                    isTablet && styles.bannerValueTablet,
                  ]}
                >
                  {product?.title ||
                    fullData?.title ||
                    (campaignProduct as any).title ||
                    'Sin nombre'}
                </Text>
                {(fullData?.barcode || product?.barcode) && (
                  <Text style={styles.barcodeText}>🏷️ {fullData?.barcode || product?.barcode}</Text>
                )}
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
                            <ActivityIndicator size="small" color={theme.color.text.onAction} />
                          ) : (
                            <Text style={styles.saveQuantityButtonText}>✓ Guardar</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.quantityDisplayContainer}>
                      {/* Cantidad campaña + repartida en la misma cartilla */}
                      <View style={styles.quantityComparisonRow}>
                        <View style={styles.quantityComparisonBlock}>
                          <Text style={styles.quantityComparisonLabel}>Campaña</Text>
                          <Text
                            style={[
                              styles.bannerValue,
                              styles.quantityValue,
                              styles.quantityComparisonValue,
                              isTablet && styles.bannerValueTablet,
                            ]}
                          >
                            {campaignProduct.totalQuantityBase}
                          </Text>
                        </View>
                        <View style={styles.quantityComparisonDivider} />
                        <View style={styles.quantityComparisonBlock}>
                          <Text style={styles.quantityComparisonLabel}>Repartido</Text>
                          <Text
                            style={[
                              styles.bannerValue,
                              styles.quantityComparisonValue,
                              styles.quantityRepartidoValue,
                              isTablet && styles.bannerValueTablet,
                            ]}
                          >
                            {distributedQuantityBase !== undefined
                              ? Math.floor(distributedQuantityBase)
                              : campaignProduct.distributionGenerated
                                ? campaignProduct.totalQuantityBase
                                : 0}
                          </Text>
                        </View>
                      </View>
                      {onViewDistributionsBySite && !campaignProduct.distributionGenerated && (
                        <TouchableOpacity
                          style={styles.viewBySiteButton}
                          onPress={onViewDistributionsBySite}
                        >
                          <Text style={styles.viewBySiteButtonText}>
                            🏢 Ver cantidades por sede
                          </Text>
                        </TouchableOpacity>
                      )}
                      {!campaignProduct.distributionGenerated ? (
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
                      ) : (
                        onViewDistributionsBySite && (
                          <View style={styles.quantityActionsContainer}>
                            <TouchableOpacity
                              style={styles.quickDistributionButton}
                              onPress={onViewDistributionsBySite}
                            >
                              <Text style={styles.quickDistributionButtonText}>📋 Ver Reparto</Text>
                            </TouchableOpacity>
                          </View>
                        )
                      )}
                      {isPreliminary && !campaignProduct.distributionGenerated && (
                        <Text style={styles.preliminaryWarningNote}>
                          ⚠️ Producto preliminar - Debe validarse antes de generar reparto
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Precio Socia (destacado) */}
              {loadingPrices ? (
                <View style={styles.loadingPricesContainer}>
                  <ActivityIndicator size="large" color={theme.color.text.success} />
                  <Text style={styles.loadingPricesText}>Cargando perfiles de precio...</Text>
                </View>
              ) : (
                sociaPrice && renderPriceCard(sociaPrice)
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
                          <ActivityIndicator size="small" color={theme.color.text.onAction} />
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
                        {formatCurrency(displayCostCents)}
                      </Text>
                      {costSourceLabel && (
                        <Text style={styles.costSourceLabel}>{costSourceLabel}</Text>
                      )}
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

              {/* Total Cost Banner - Solo cuando el producto está en la campaña
                  (en el banner de recomendaciones no hay cantidad definida). */}
              {!hideStockAndDistribution && (
                <View style={[styles.bannerSection, styles.bannerSectionTotal]}>
                  <Text style={styles.bannerLabel}>TOTAL COSTO</Text>
                  <Text style={styles.bannerLabelSubtitle}>(Costo × Cantidad Campaña)</Text>
                  <Text
                    style={[
                      styles.bannerValue,
                      styles.totalCostValue,
                      isTablet && styles.bannerValueTablet,
                    ]}
                  >
                    {formatCurrency(displayCostCents * (campaignProduct.totalQuantityBase || 0))}
                  </Text>
                  <Text style={styles.totalCostBreakdown}>
                    {formatCurrency(displayCostCents)} × {campaignProduct.totalQuantityBase || 0}{' '}
                    unidades
                  </Text>
                </View>
              )}

              {/* Stock por Sede - fallback para el banner de recomendaciones
                  cuando /full no devuelve stockBySite. Renderizamos el
                  desglose por bodega que devuelve /admin/inventory/stock/product/:id. */}
              {hideStockAndDistribution &&
                !(fullData && fullData.stockBySite.length > 0) &&
                stockByWarehouseFallback.length > 0 && (
                  <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
                    <Text style={styles.bannerLabel}>STOCK POR SEDE</Text>
                    {stockByWarehouseFallback.map((wh, idx) => (
                      <View key={`${wh.warehouseId || 'wh'}-${idx}`} style={styles.detailRow}>
                        <Text style={styles.detailRowTitle}>
                          {wh.siteName ? `${wh.siteName} · ` : ''}
                          {wh.warehouseName}
                        </Text>
                        <View style={styles.detailStockChips}>
                          <View style={styles.stockChip}>
                            <Text style={styles.stockChipLabel}>Total</Text>
                            <Text style={styles.stockChipValue}>{wh.quantityBase}</Text>
                          </View>
                          {wh.reservedQuantityBase !== undefined && (
                            <View style={styles.stockChip}>
                              <Text style={styles.stockChipLabel}>Reservado</Text>
                              <Text style={styles.stockChipValue}>{wh.reservedQuantityBase}</Text>
                            </View>
                          )}
                          {wh.availableQuantityBase !== undefined && (
                            <View style={styles.stockChip}>
                              <Text style={styles.stockChipLabel}>Disponible</Text>
                              <Text style={[styles.stockChipValue, styles.stockChipValueAvailable]}>
                                {wh.availableQuantityBase}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

              {/* Stock resumido - último fallback (buscador v2) cuando ni
                  /full ni el desglose por bodega devolvieron nada. */}
              {hideStockAndDistribution &&
                !(fullData && fullData.stockBySite.length > 0) &&
                stockByWarehouseFallback.length === 0 &&
                (() => {
                  const searchStock: any = (productDetails as any)?.stock;
                  const searchAvailable =
                    searchStock && typeof searchStock === 'object'
                      ? (searchStock.available ?? searchStock.total)
                      : typeof searchStock === 'number'
                        ? searchStock
                        : undefined;
                  const value = searchAvailable !== undefined ? searchAvailable : stockData.stock;
                  if (value === undefined) return null;
                  return (
                    <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
                      <Text style={styles.bannerLabel}>STOCK DISPONIBLE</Text>
                      <Text style={[styles.bannerValue, isTablet && styles.bannerValueTablet]}>
                        {value}
                      </Text>
                    </View>
                  );
                })()}

              {/* Foto del producto */}
              <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
                <View style={styles.photoHeaderRow}>
                  <Text style={styles.bannerLabel}>FOTO DEL PRODUCTO</Text>
                  {onManagePhotos && (
                    <TouchableOpacity
                      style={styles.managePhotosButton}
                      onPress={onManagePhotos}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.managePhotosButtonText}>🖼️ Gestionar fotos</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {loadingImage || loadingFull ? (
                  <View style={styles.loadingImageContainer}>
                    <ActivityIndicator size="large" color={theme.color.brand.accent} />
                    <Text style={styles.loadingImageText}>Cargando imagen...</Text>
                  </View>
                ) : bannerPhoto ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setPreviewPhotoUrl(bannerPhoto.url)}
                    style={styles.photoWrapper}
                  >
                    {bannerPhoto.type && (
                      <Text style={styles.photoTypeLabel}>{bannerPhoto.type}</Text>
                    )}
                    <Image
                      source={{ uri: bannerPhoto.url }}
                      style={styles.productImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.photoZoomHint}>🔍 Toca para ampliar</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noImageContainer}>
                    <Text style={styles.noImageIcon}>📷</Text>
                    <Text style={styles.noImageText}>Sin imagen disponible</Text>
                  </View>
                )}
              </View>

              {/* Stock por Sede */}
              {fullData && fullData.stockBySite.length > 0 && (
                <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
                  <Text style={styles.bannerLabel}>STOCK POR SEDE</Text>
                  {fullData.stockBySite.map((site) => (
                    <View key={site.siteId} style={styles.detailRow}>
                      <Text style={styles.detailRowTitle}>{site.siteName}</Text>
                      <View style={styles.detailStockChips}>
                        <View style={styles.stockChip}>
                          <Text style={styles.stockChipLabel}>Total</Text>
                          <Text style={styles.stockChipValue}>{site.quantityBase}</Text>
                        </View>
                        <View style={styles.stockChip}>
                          <Text style={styles.stockChipLabel}>Reservado</Text>
                          <Text style={styles.stockChipValue}>{site.reservedQuantityBase}</Text>
                        </View>
                        <View style={styles.stockChip}>
                          <Text style={styles.stockChipLabel}>Disponible</Text>
                          <Text style={[styles.stockChipValue, styles.stockChipValueAvailable]}>
                            {site.availableQuantityBase}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Ingresos / Lotes */}
              {fullData && fullData.entries.length > 0 && (
                <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
                  <Text style={styles.bannerLabel}>INGRESOS / LOTES</Text>
                  {fullData.entries.map((entry, idx) => (
                    <View key={`${entry.entryNumber}-${idx}`} style={styles.detailRow}>
                      <Text style={styles.detailRowTitle}>{entry.entryNumber}</Text>
                      <Text style={styles.detailRowSubtitle}>
                        {entry.sourceType}
                        {entry.purchaseCode ? ` • ${entry.purchaseCode}` : ''} •{' '}
                        {new Date(entry.receivedAt).toLocaleDateString()}
                      </Text>
                      <Text style={styles.detailRowMeta}>
                        Inicial: {entry.initialQuantity} • Restante: {entry.remainingQuantity} •
                        Costo unit.: {formatCurrency(entry.unitCostCents)}
                      </Text>
                      {entry.performedByName && (
                        <Text style={styles.detailRowMeta}>Por: {entry.performedByName}</Text>
                      )}
                      {entry.notes && <Text style={styles.detailRowMeta}>Nota: {entry.notes}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Proveedor / Compra (al final) */}
              <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
                <Text style={styles.bannerLabel}>PROVEEDOR</Text>
                {effectiveSupplier?.name ? (
                  <>
                    <Text
                      style={[
                        styles.bannerValue,
                        styles.supplierName,
                        isTablet && styles.bannerValueTablet,
                      ]}
                    >
                      🏢 {effectiveSupplier.name}
                    </Text>
                    {effectiveSupplier.purchaseCode && (
                      <Text style={styles.supplierPurchase}>
                        Compra: {effectiveSupplier.purchaseCode}
                      </Text>
                    )}
                  </>
                ) : campaignProduct.purchase?.code ? (
                  <Text
                    style={[
                      styles.bannerValue,
                      styles.supplierName,
                      isTablet && styles.bannerValueTablet,
                    ]}
                  >
                    Compra: {campaignProduct.purchase.code}
                  </Text>
                ) : (
                  <Text style={styles.supplierEmpty}>Sin información de proveedor</Text>
                )}
              </View>

              {/* Demás precios de venta */}
              {loadingPrices ? (
                <View style={styles.loadingPricesContainer}>
                  <ActivityIndicator size="large" color={theme.color.text.success} />
                  <Text style={styles.loadingPricesText}>Cargando perfiles de precio...</Text>
                </View>
              ) : otherPrices.length > 0 ? (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderText}>OTROS PRECIOS DE VENTA</Text>
                  </View>
                  {otherPrices.map((priceData) => renderPriceCard(priceData))}
                </>
              ) : null}
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

        {/* Vista ampliada de la foto del producto */}
        <Modal
          visible={!!previewPhotoUrl}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewPhotoUrl(null)}
        >
          <TouchableOpacity
            style={styles.photoPreviewOverlay}
            activeOpacity={1}
            onPress={() => setPreviewPhotoUrl(null)}
          >
            {previewPhotoUrl && (
              <Image
                source={{ uri: previewPhotoUrl }}
                style={styles.photoPreviewImage}
                resizeMode="contain"
              />
            )}
            <View style={styles.photoPreviewCloseButton}>
              <Text style={styles.photoPreviewCloseText}>✕</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    containerTablet: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    closeButton: {
      position: 'absolute',
      top: theme.space[4],
      right: theme.space[4],
      zIndex: 10,
      backgroundColor: theme.color.surface.base,
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    closeButtonText: {
      fontSize: 24,
      color: theme.color.text.subtle,
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: 60,
      paddingBottom: theme.space[5],
      paddingHorizontal: theme.space[4],
    },
    bannerSection: {
      backgroundColor: theme.color.surface.base,
      paddingVertical: theme.space[6],
      paddingHorizontal: theme.space[6],
      marginBottom: theme.space[4],
      borderRadius: theme.radii['2xl'],
      alignItems: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    bannerSectionAlt: {
      backgroundColor: theme.color.background.subtle,
      borderColor: theme.color.border.default,
    },
    bannerSectionFirst: {
      borderColor: theme.color.text.success,
      borderWidth: 3,
      backgroundColor: theme.color.state.success.background,
      shadowColor: theme.color.text.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    bannerSectionSocia: {
      borderColor: theme.color.text.success,
      borderWidth: 4,
      backgroundColor: theme.color.state.success.background,
      shadowColor: theme.color.text.success,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 6,
      transform: [{ scale: 1.02 }],
    },
    bannerLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.subtle,
      letterSpacing: 1.2,
      marginBottom: theme.space[2],
      textTransform: 'uppercase',
    },
    bannerLabelSocia: {
      fontSize: 14,
      color: theme.color.text.success,
      letterSpacing: 1.5,
    },
    bannerValue: {
      fontSize: 40,
      fontWeight: '800',
      color: theme.color.text.heading,
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
      color: theme.color.text.warning,
    },
    stockValue: {
      color: theme.color.text.link,
    },
    costValue: {
      color: theme.color.text.warning,
    },
    priceValue: {
      color: theme.color.text.success,
      fontSize: 48,
      fontWeight: '900',
    },
    preliminaryNote: {
      fontSize: 13,
      color: theme.color.text.warning,
      marginTop: theme.space[3],
      fontWeight: '600',
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.lg,
    },
    loadingStockContainer: {
      paddingVertical: theme.space[5],
      alignItems: 'center',
    },
    loadingStockText: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginTop: theme.space[3],
    },
    loadingPricesContainer: {
      paddingVertical: theme.space[10],
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      marginVertical: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    loadingPricesText: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginTop: theme.space[3],
    },
    emptyPricesContainer: {
      paddingVertical: theme.space[10],
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      marginVertical: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    emptyPricesText: {
      fontSize: 14,
      color: theme.color.text.subtle,
      textAlign: 'center',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    currencySymbol: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.subtle,
      marginRight: theme.space[2],
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
      backgroundColor: theme.color.state.warning.background,
      borderWidth: 2,
      borderColor: theme.color.text.warning,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      fontSize: 28,
      fontWeight: '800',
      color: theme.color.text.warning,
      textAlign: 'center',
    },
    costActionButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[4],
      width: '100%',
    },
    cancelCostButton: {
      flex: 1,
      backgroundColor: theme.color.border.default,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
    },
    cancelCostButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.muted,
    },
    saveCostButton: {
      flex: 1,
      backgroundColor: theme.color.text.warning,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      shadowColor: theme.color.text.warning,
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
      color: theme.color.text.onAction,
    },
    editCostButton: {
      marginTop: theme.space[3],
      backgroundColor: theme.color.surface.muted,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    editCostButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
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
      backgroundColor: theme.color.state.success.background,
      borderWidth: 3,
      borderColor: theme.color.text.success,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      fontSize: 32,
      fontWeight: '900',
      color: theme.color.text.success,
      textAlign: 'center',
    },
    priceActionButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[4],
      width: '100%',
    },
    cancelPriceButton: {
      flex: 1,
      backgroundColor: theme.color.border.default,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
    },
    cancelPriceButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.muted,
    },
    savePriceButton: {
      flex: 1,
      backgroundColor: theme.color.text.success,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      shadowColor: theme.color.text.success,
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
      color: theme.color.text.onAction,
    },
    editPriceButton: {
      marginTop: theme.space[3],
      backgroundColor: theme.color.surface.muted,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    editPriceButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    profileHeaderBanner: {
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    profileCodeBanner: {
      fontSize: 11,
      color: theme.color.text.disabled,
      marginTop: theme.space[1],
      fontWeight: '600',
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
    },
    priceInfoBanner: {
      marginTop: theme.space[3],
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.lg,
    },
    priceInfoText: {
      fontSize: 11,
      color: theme.color.text.subtle,
      textAlign: 'center',
      fontWeight: '500',
    },
    overriddenTextBanner: {
      fontSize: 11,
      color: theme.color.text.warning,
      fontWeight: '700',
      marginTop: theme.space[1],
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[2],
      paddingVertical: 3,
      borderRadius: theme.radii.md,
    },
    calculateSociaButton: {
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.xl,
      marginTop: theme.space[3],
      marginBottom: theme.space[2],
      width: '100%',
      alignItems: 'center',
      shadowColor: theme.color.brand.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    calculateSociaButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.onAction,
    },
    quantityEditContainer: {
      width: '100%',
      alignItems: 'center',
    },
    quantityDisplayContainer: {
      alignItems: 'center',
    },
    quantityComparisonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingVertical: theme.space[2],
    },
    quantityComparisonBlock: {
      flex: 1,
      alignItems: 'center',
    },
    quantityComparisonDivider: {
      width: 1,
      height: 56,
      backgroundColor: theme.color.border.default,
      marginHorizontal: theme.space[3],
    },
    quantityComparisonLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.subtle,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    quantityComparisonValue: {
      fontSize: 32,
      lineHeight: 38,
    },
    quantityRepartidoValue: {
      color: theme.color.text.success,
    },
    viewBySiteButton: {
      marginTop: theme.space[3],
      backgroundColor: theme.color.action.primary.background,
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.lg,
      alignSelf: 'center',
      shadowColor: theme.color.action.primary.background,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    viewBySiteButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.onAction,
    },
    supplierName: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    supplierPurchase: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginTop: theme.space[2],
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
    },
    supplierEmpty: {
      fontSize: 14,
      color: theme.color.text.disabled,
      fontStyle: 'italic',
      marginTop: theme.space[1],
    },
    quantityInput: {
      width: '100%',
      backgroundColor: theme.color.state.warning.background,
      borderWidth: 2,
      borderColor: theme.color.text.warning,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      fontSize: 28,
      fontWeight: '800',
      color: theme.color.text.warning,
      textAlign: 'center',
      marginBottom: theme.space[2],
    },
    stockAvailableText: {
      fontSize: 13,
      color: theme.color.text.link,
      marginBottom: theme.space[3],
      fontWeight: '600',
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.lg,
    },
    quantityActionButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[1],
      width: '100%',
    },
    cancelQuantityButton: {
      flex: 1,
      backgroundColor: theme.color.border.default,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
    },
    cancelQuantityButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.muted,
    },
    saveQuantityButton: {
      flex: 1,
      backgroundColor: theme.color.text.warning,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      shadowColor: theme.color.text.warning,
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
      color: theme.color.text.onAction,
    },
    quantityActionsContainer: {
      flexDirection: 'row',
      gap: theme.space[2],
      marginTop: theme.space[3],
      flexWrap: 'wrap',
    },
    editQuantityButton: {
      flex: 1,
      minWidth: 100,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      alignItems: 'center',
    },
    editQuantityButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    quickDistributionButton: {
      flex: 1,
      minWidth: 140,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.action.primary.background,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.action.primary.background,
      alignItems: 'center',
      shadowColor: theme.color.action.primary.background,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 2,
    },
    quickDistributionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    quickDistributionButtonDisabled: {
      backgroundColor: theme.color.surface.disabled,
      borderColor: theme.color.border.subtle,
      opacity: 0.6,
    },
    quickDistributionButtonTextDisabled: {
      color: theme.color.text.disabled,
    },
    preliminaryWarningNote: {
      fontSize: 12,
      color: theme.color.text.warning,
      marginTop: theme.space[2],
      fontWeight: '600',
      textAlign: 'center',
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.lg,
    },
    distributionGeneratedNote: {
      fontSize: 12,
      color: theme.color.text.warning,
      marginTop: theme.space[2],
      fontWeight: '600',
      textAlign: 'center',
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.lg,
    },
    sociaBadge: {
      marginTop: theme.space[2],
      backgroundColor: theme.color.text.success,
      paddingHorizontal: theme.space[3.5],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.full,
      shadowColor: theme.color.text.success,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    sociaBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.color.text.onAction,
      letterSpacing: 0.8,
    },
    generateDistributionButton: {
      marginTop: theme.space[4],
      backgroundColor: theme.color.action.primary.background,
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      shadowColor: theme.color.action.primary.background,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    generateDistributionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.onAction,
      textAlign: 'center',
    },
    priceValueContainer: {
      alignItems: 'center',
      gap: theme.space[2],
    },
    costValueContainer: {
      alignItems: 'center',
      gap: theme.space[2],
    },
    updatedBadge: {
      backgroundColor: theme.color.text.success,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.xl,
      marginTop: theme.space[1],
    },
    updatedBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    calculatedBadge: {
      backgroundColor: theme.color.text.success,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.xl,
      marginTop: theme.space[2],
      alignItems: 'center',
    },
    calculatedBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    distributionButton: {
      backgroundColor: theme.color.text.success,
      borderRadius: theme.radii.xl,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[5],
      marginTop: theme.space[4],
      alignItems: 'center',
      shadowColor: theme.color.text.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    distributionButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.onAction,
    },
    // Total Cost styles
    bannerSectionTotal: {
      backgroundColor: theme.color.state.warning.background,
      borderColor: theme.color.text.warning,
      borderWidth: 3,
      shadowColor: theme.color.text.warning,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 4,
    },
    bannerLabelSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.disabled,
      letterSpacing: 0.5,
      marginTop: theme.space[1],
      marginBottom: theme.space[2],
    },
    totalCostValue: {
      color: theme.color.text.warning,
      fontSize: 44,
      fontWeight: '900',
    },
    totalCostBreakdown: {
      fontSize: 13,
      color: theme.color.state.warning.text,
      marginTop: theme.space[2],
      fontWeight: '600',
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.lg,
    },
    // Product Image styles
    loadingImageContainer: {
      paddingVertical: theme.space[10],
      alignItems: 'center',
    },
    loadingImageText: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginTop: theme.space[3],
    },
    productImage: {
      width: '100%',
      height: 300,
      borderRadius: theme.radii.xl,
      marginTop: theme.space[3],
      backgroundColor: theme.color.surface.muted,
    },
    noImageContainer: {
      paddingVertical: theme.space[10],
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      marginTop: theme.space[3],
      borderWidth: 2,
      borderColor: theme.color.border.default,
      borderStyle: 'dashed',
    },
    noImageIcon: {
      fontSize: 48,
      marginBottom: theme.space[2],
    },
    noImageText: {
      fontSize: 14,
      color: theme.color.text.disabled,
      fontWeight: '600',
    },
    // Barcode
    barcodeText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginTop: theme.space[2],
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
    },
    // Detail rows (stock by site, entries, participants)
    detailRow: {
      width: '100%',
      paddingVertical: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    detailRowTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    detailRowSubtitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
    },
    detailRowMeta: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
    },
    detailStockChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
    stockChip: {
      flex: 1,
      minWidth: 80,
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.lg,
    },
    stockChipLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.color.text.subtle,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    stockChipValue: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.color.text.heading,
      marginTop: theme.space[1],
    },
    stockChipValueAvailable: {
      color: theme.color.text.success,
    },
    participantHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    participantTotalBadge: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.color.text.onAction,
      backgroundColor: theme.color.action.primary.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.full,
      overflow: 'hidden',
    },
    repartoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.space[2],
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
    },
    repartoName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    repartoMeta: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginLeft: theme.space[2],
    },
    // SKU + Nombre en la misma tarjeta
    skuNameDivider: {
      width: '60%',
      height: 1,
      backgroundColor: theme.color.border.default,
      marginVertical: theme.space[3],
    },
    // Fotos del producto
    photoHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      gap: theme.space[3],
    },
    managePhotosButton: {
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.lg,
      shadowColor: theme.color.brand.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    managePhotosButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.onAction,
    },
    photoWrapper: {
      width: '100%',
      marginTop: theme.space[3],
    },
    photoTypeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.subtle,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: theme.space[1],
    },
    photoZoomHint: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.subtle,
      textAlign: 'center',
      marginTop: theme.space[2],
    },
    costSourceLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
    },
    photoPreviewOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[4],
    },
    photoPreviewImage: {
      width: '100%',
      height: '80%',
    },
    photoPreviewCloseButton: {
      position: 'absolute',
      top: theme.space[10],
      right: theme.space[5],
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoPreviewCloseText: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    // Encabezado de sección (otros precios de venta)
    sectionHeaderRow: {
      width: '100%',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    sectionHeaderText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.color.text.subtle,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  });
