import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  TextInput,
  Platform,
  Modal,
  Image,
} from 'react-native';
import Alert from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { saveAndSharePdf } from '@/utils/fileDownload';
import { generateCampaignPhotosPdf } from '@/utils/campaignPhotosPdf';
import { campaignsService, repartosService } from '@/services/api';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { productsApi, priceProfilesApi, photoCampaignsApi } from '@/services/api';
import { inventoryApi, StockItem } from '@/services/api/inventory';
import logger from '@/utils/logger';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusLabels,
  CampaignStatusColors,
  CampaignProduct,
  CampaignProductDetailItem,
  ProductSourceType,
  ProductStatus,
  DistributionType,
  AddProductRequest,
} from '@/types/campaigns';
import { useCampaignProductsDetail } from '@/hooks/api/useCampaigns';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { Product } from '@/services/api/products';
import { PriceProfile, ProductSalePrice } from '@/types/price-profiles';
import { ParticipantTotalsResponse } from '@/types/participant-totals';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { CampaignProductBannerModal } from '@/components/Campaigns/CampaignProductBannerModal';
import { ProductPhotoManagerModal } from '@/components/Photos/ProductPhotoManagerModal';
import { LinkPhotoCampaignModal } from '@/components/Photos/LinkPhotoCampaignModal';
import { ProductDistributionsBySiteModal } from '@/components/Campaigns/ProductDistributionsBySiteModal';
import { usePhotoGenerationStore } from '@/store/photoGeneration';
import { BulkUpdateModal } from '@/components/Products/BulkUpdateModal';
import { BulkDistributionModal } from '@/components/Campaigns/BulkDistributionModal';
import { CopyParticipantsModal } from '@/components/Campaigns/CopyParticipantsModal';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface CampaignDetailScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
      shouldReload?: boolean;
      skipReloadOnce?: boolean;
      updatedProductId?: string;
      forceReload?: boolean;
      timestamp?: number;
    };
  };
}

type TabType = 'overview' | 'participants' | 'products';

/**
 * Miniatura para cada resultado del buscador global.
 * - Intenta primero las fuentes ya presentes en el producto (photos, imageUrl…).
 * - Si no hay ninguna, hace un lazy-fetch a photoCampaignsApi.getProductPhotos.
 * Mantiene una cache en memoria por productId para no repetir requests.
 */
const searchResultPhotoCache = new Map<string, string | null>();

const SearchResultThumb: React.FC<{
  product: any;
  style: any;
  placeholderStyle: any;
  placeholderTextStyle: any;
}> = ({ product, style, placeholderStyle, placeholderTextStyle }) => {
  const pickPhotoUrl = (p: any): string | undefined => {
    if (!p) return undefined;
    if (typeof p === 'string') return p;
    if (typeof p === 'object' && typeof p.url === 'string') return p.url;
    if (typeof p === 'object' && typeof p.fileUrl === 'string') return p.fileUrl;
    return undefined;
  };
  const pickPreferredPhotoUrl = (arr: any): string | undefined => {
    if (!Array.isArray(arr)) return undefined;
    const byType = (t: string) =>
      arr.find((p) => {
        if (!p || typeof p !== 'object') return false;
        const t1 = typeof p.type === 'string' ? p.type.toLowerCase() : '';
        const t2 = typeof p.photoType === 'string' ? p.photoType.toLowerCase() : '';
        return t1 === t || t2 === t;
      });
    for (const t of ['design', 'reference', 'price', 'catalog']) {
      const found = byType(t);
      if (found) {
        const url = pickPhotoUrl(found);
        if (url) return url;
      }
    }
    for (const p of arr) {
      const url = pickPhotoUrl(p);
      if (url) return url;
    }
    return undefined;
  };

  const initialUri =
    pickPreferredPhotoUrl(product?.photos) ||
    pickPreferredPhotoUrl(product?.photoUrls) ||
    (typeof product?.imageUrl === 'string' ? product.imageUrl : undefined) ||
    pickPreferredPhotoUrl(product?.imageUrls) ||
    (product?.id ? (searchResultPhotoCache.get(product.id) ?? undefined) : undefined);

  const [uri, setUri] = useState<string | undefined>(initialUri);

  useEffect(() => {
    if (uri || !product?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const assets = await photoCampaignsApi.getProductPhotos(product.id);
        if (cancelled) return;
        const picked = pickPreferredPhotoUrl(assets);
        searchResultPhotoCache.set(product.id, picked ?? null);
        if (picked) setUri(picked);
      } catch {
        if (!cancelled) searchResultPhotoCache.set(product.id, null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.id, uri]);

  if (!uri) {
    return (
      <View style={placeholderStyle}>
        <Text style={placeholderTextStyle}>📦</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={style} resizeMode="cover" />;
};

export const CampaignDetailScreen: React.FC<CampaignDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { campaignId } = route.params;
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [companies, setCompanies] = useState<Record<string, Company>>({});
  const [sites, setSites] = useState<Record<string, Site>>({});
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [selectedProduct, setSelectedProduct] = useState<CampaignProduct | null>(null);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [photoManagerProduct, setPhotoManagerProduct] = useState<{
    productId: string;
    title: string;
    sku: string;
    catalogPhotoUrl?: string;
    fallbackImageUrl?: string;
    /**
     * Fotos de referencia que ya existen para el producto según el endpoint
     * compacto (típicamente las fotos de validación de la compra). No son
     * assets de la campaña de fotos todavía; se ofrecen en el modal para
     * adoptarlas como referencia con un toque.
     */
    existingReferenceUrls?: string[];
  } | null>(null);
  // Visibilidad separada del producto activo: al cerrar solo ocultamos el modal,
  // pero lo mantenemos montado si aún hay una generación en curso para no
  // interrumpir la subida en segundo plano (Gemini / diseño con precio).
  const [photoManagerVisible, setPhotoManagerVisible] = useState(false);
  const [showLinkPhotoCampaignModal, setShowLinkPhotoCampaignModal] = useState(false);
  // Campaña de fotos anexada a esta campaña. Se envía en las subidas de fotos
  // para que el backend no caiga en su ruta de auto-resolución (que arma un
  // uuid duplicado cuando hay vínculos y devuelve 500).
  const [linkedPhotoCampaignId, setLinkedPhotoCampaignId] = useState<string | undefined>(undefined);
  const [priceProfiles, setPriceProfiles] = useState<PriceProfile[]>([]);
  const [productSalePrices, setProductSalePrices] = useState<Record<string, ProductSalePrice[]>>(
    {}
  );
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [editingPrice, setEditingPrice] = useState<{
    productId: string;
    profileId: string;
    value: string;
  } | null>(null);
  const [editingCost, setEditingCost] = useState<{ productId: string; value: string } | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);
  const [updatedPrices, setUpdatedPrices] = useState<Set<string>>(new Set());
  const [updatedCosts, setUpdatedCosts] = useState<Set<string>>(new Set());
  const [calculatedFranquicia, setCalculatedFranquicia] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [distributionFilter, setDistributionFilter] = useState<
    'all' | 'generated' | 'not-generated'
  >('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  // Filtro por estado del producto subyacente (PurchaseProduct):
  //  - 'preliminary' = compra aún no validada (ProductStatus.PRELIMINARY)
  //  - 'active'      = compra validada (ProductStatus.ACTIVE)
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'preliminary' | 'active'>(
    'all'
  );
  // Set de campaignProductIds que están actualmente cerrando validación
  // (para mostrar spinner en el botón "Activar").
  const [activatingProductIds, setActivatingProductIds] = useState<Set<string>>(new Set());
  const [participantTotals, setParticipantTotals] = useState<ParticipantTotalsResponse | null>(
    null
  );
  const [downloadingReport, setDownloadingReport] = useState(false);
  const { width, height } = useWindowDimensions();
  const hasLoadedRef = useRef(false);
  const [isBulkUpdateModalVisible, setIsBulkUpdateModalVisible] = useState(false);
  const [isBulkDistributionModalVisible, setIsBulkDistributionModalVisible] = useState(false);
  const [isCopyParticipantsModalVisible, setIsCopyParticipantsModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [distributionsBySiteProduct, setDistributionsBySiteProduct] =
    useState<CampaignProduct | null>(null);

  // Quick add product states
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [showGlobalSearchSuggestions, setShowGlobalSearchSuggestions] = useState(false);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [addingQuickProduct, setAddingQuickProduct] = useState(false);

  // Custom add product modal states
  const [showCustomAddModal, setShowCustomAddModal] = useState(false);
  const [selectedProductForCustomAdd, setSelectedProductForCustomAdd] = useState<any | null>(null);
  const [customQuantity, setCustomQuantity] = useState<string>('');

  // Banner modal states for global search
  const [showBannerModalFromSearch, setShowBannerModalFromSearch] = useState(false);
  const [selectedProductForBannerSearch, setSelectedProductForBannerSearch] = useState<any>(null);
  const [productDetailsForBannerSearch, setProductDetailsForBannerSearch] = useState<any>(null);

  // Descarga del PDF de fotos de productos activos
  const [downloadingPhotosPdf, setDownloadingPhotosPdf] = useState(false);

  // Pagination states
  const [displayedItemsCount, setDisplayedItemsCount] = useState(20);
  const ITEMS_PER_PAGE = 20;

  const isTablet = width >= 768 || height >= 768;

  // ✅ Nuevo endpoint compacto: trae todos los datos de productos de la
  // campaña (stock site, costo, precios, proveedor, fotos) en un único
  // request. Reemplaza el flujo de "getCampaign embed + batch products
  // + sale prices".
  const { data: productsDetailData, refetch: refetchProductsDetail } =
    useCampaignProductsDetail(campaignId);

  const productsDetailMap = useMemo<Record<string, CampaignProductDetailItem>>(() => {
    const map: Record<string, CampaignProductDetailItem> = {};
    productsDetailData?.items?.forEach((item) => {
      map[item.campaignProductId] = item;
    });
    return map;
  }, [productsDetailData]);

  // Genera un PDF con las fotos, nombre, SKU, stock disponible/repartido, costo
  // y precio socia de los productos activos de la campaña.
  const handleDownloadPhotosPdf = useCallback(async () => {
    const items = productsDetailData?.items ?? [];
    if (items.length === 0) {
      Alert.alert('Sin datos', 'Aún no se cargaron los productos de la campaña.');
      return;
    }
    setDownloadingPhotosPdf(true);
    try {
      const count = await generateCampaignPhotosPdf({
        campaignName: campaign?.name ?? 'Campaña',
        items,
      });
      logger.debug(`📄 PDF de fotos generado con ${count} productos activos`);
    } catch (error) {
      logger.error('Error generando PDF de fotos de campaña:', error);
      Alert.alert('Error', 'No se pudo generar el PDF de fotos.');
    } finally {
      setDownloadingPhotosPdf(false);
    }
  }, [productsDetailData, campaign?.name]);

  const loadLinkedPhotoCampaign = useCallback(async () => {
    if (!campaignId) {
      return;
    }
    try {
      const linked = await photoCampaignsApi.getPhotoCampaignsByCampaign(campaignId);
      // De-duplicamos y tomamos la primera; basta una para asociar las fotos.
      setLinkedPhotoCampaignId(linked[0]?.id);
    } catch (error) {
      logger.error('Error loading linked photo campaign:', error);
      setLinkedPhotoCampaignId(undefined);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadLinkedPhotoCampaign();
  }, [loadLinkedPhotoCampaign]);

  // ¿Hay una generación de fotos (diseño / precio) en curso para el producto
  // cuyo modal está (o estuvo) abierto? Nos suscribimos al store global para
  // no desmontar el modal mientras la subida en segundo plano no termine.
  const photoGeneratingForProduct = usePhotoGenerationStore((s) => {
    const id = photoManagerProduct?.productId;
    if (!id) return false;
    // Las flags se llavean por grupo (`${productId}::${parentAssetId}`); basta
    // con que cualquier grupo del producto esté generando.
    return Object.entries(s.generating).some(
      ([key, flags]) => key.startsWith(`${id}::`) && (flags.design || flags.price)
    );
  });

  const prevPhotoGeneratingRef = useRef(false);
  useEffect(() => {
    const wasGenerating = prevPhotoGeneratingRef.current;
    prevPhotoGeneratingRef.current = photoGeneratingForProduct;

    // Al terminar la generación, refrescamos las fotos del detalle para que la
    // nueva imagen se refleje aunque el modal se haya cerrado durante la espera.
    if (wasGenerating && !photoGeneratingForProduct) {
      void refetchProductsDetail?.();
    }

    // Solo desmontamos el modal cuando está oculto y ya no hay generación activa.
    if (!photoManagerVisible && !photoGeneratingForProduct && photoManagerProduct) {
      setPhotoManagerProduct(null);
    }
  }, [photoGeneratingForProduct, photoManagerVisible, photoManagerProduct, refetchProductsDetail]);

  const loadCampaign = useCallback(async () => {
    try {
      const data = await campaignsService.getCampaign(campaignId);
      setCampaign(data);

      // Load price profiles
      try {
        const profiles = await priceProfilesApi.getActivePriceProfiles();
        setPriceProfiles(profiles);
      } catch (error) {
        logger.error('Error loading price profiles:', error);
      }

      // Load companies and sites for participants
      if (data.participants && data.participants.length > 0) {
        const companyIds = data.participants
          .filter((p) => p.participantType === 'EXTERNAL_COMPANY' && p.companyId)
          .map((p) => p.companyId!);

        const siteIds = data.participants
          .filter((p) => p.participantType === 'INTERNAL_SITE' && p.siteId)
          .map((p) => p.siteId!);

        // Load companies
        if (companyIds.length > 0) {
          try {
            const companiesResponse = await companiesApi.getCompanies({ limit: 100 });
            const companiesMap: Record<string, Company> = {};
            companiesResponse.data.forEach((company) => {
              if (companyIds.includes(company.id)) {
                companiesMap[company.id] = company;
              }
            });
            setCompanies(companiesMap);
          } catch (error) {
            logger.error('Error loading companies:', error);
          }
        }

        // Load sites
        if (siteIds.length > 0) {
          try {
            const sitesResponse = await sitesApi.getSites({ limit: 100 });
            const sitesMap: Record<string, Site> = {};
            sitesResponse.data.forEach((site) => {
              if (siteIds.includes(site.id)) {
                sitesMap[site.id] = site;
              }
            });
            setSites(sitesMap);
          } catch (error) {
            logger.error('Error loading sites:', error);
          }
        }
      }

      // Load participant totals
      if (data.participants && data.participants.length > 0) {
        try {
          const totalsResponse = await campaignsService.getParticipantTotals(campaignId);
          setParticipantTotals(totalsResponse);
        } catch (error) {
          logger.error('Error loading participant totals:', error);
        }
      }

      // Load products for campaign products
      // ⚡ [PERF] Solo poblamos el map con datos embebidos. El endpoint
      // compacto `useCampaignProductsDetail` ya trae fotos, stock, precios
      // y proveedor en un único request, así que NO disparamos el batch
      // `getProductsByIds` ni las N llamadas paralelas a
      // `getProductSalePrices`. En campañas con muchos productos eso
      // saturaba memoria/red y crasheaba el build Electron en producción.
      if (data.products && data.products.length > 0) {
        const productsMap: Record<string, Product> = {};
        data.products.forEach((campaignProduct) => {
          if (campaignProduct.product) {
            productsMap[campaignProduct.productId] = campaignProduct.product as any;
          }
        });
        setProducts(productsMap);
        logger.info(
          `📦 Campaign products: ${data.products.length} (detalle compacto vía useCampaignProductsDetail)`
        );
      }
    } catch (error: any) {
      logger.error('Error loading campaign:', error);
      Alert.alert('Error', 'No se pudo cargar la campaña');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, navigation]);

  useFocusEffect(
    useCallback(() => {
      // Check if we should force reload (e.g., after editing a product)
      const params = route.params as {
        campaignId: string;
        shouldReload?: boolean;
        skipReloadOnce?: boolean;
        updatedProductId?: string;
        forceReload?: boolean;
        timestamp?: number;
      };
      const shouldReload = params?.shouldReload;
      const skipReloadOnce = params?.skipReloadOnce;
      const updatedProductId = params?.updatedProductId;
      const forceReload = params?.forceReload;

      logger.debug('≡ƒöä [CAMPAIGN] useFocusEffect triggered:', {
        shouldReload,
        skipReloadOnce,
        updatedProductId,
        forceReload,
        hasLoaded: hasLoadedRef.current,
      });

      if (updatedProductId) {
        // OPTIMIZATION: Solo actualizar el producto específico sin recargar toda la campaña
        logger.debug('⚡ [CAMPAIGN] Actualizando solo producto:', updatedProductId);
        navigation.setParams({ updatedProductId: undefined } as any);

        // Actualizar solo el producto específico en el estado
        campaignsService
          .getProduct(campaignId, updatedProductId)
          .then((updatedProduct) => {
            setCampaign((prevCampaign) => {
              if (!prevCampaign) return prevCampaign;

              return {
                ...prevCampaign,
                products: prevCampaign.products?.map((p) =>
                  p.id === updatedProductId ? updatedProduct : p
                ),
              };
            });
            logger.debug('✅ [CAMPAIGN] Producto actualizado en estado local');
          })
          .catch((error) => {
            logger.error('❌ [CAMPAIGN] Error actualizando producto:', error);
          });
      } else if (shouldReload || forceReload) {
        // Clear the param to avoid reloading again
        logger.debug('≡ƒöä [CAMPAIGN] Reloading due to shouldReload/forceReload param');
        navigation.setParams({
          shouldReload: undefined,
          forceReload: undefined,
          timestamp: undefined,
        } as any);
        hasLoadedRef.current = true;
        loadCampaign();
      } else if (skipReloadOnce) {
        // Skip reload this time (coming back from product detail)
        logger.debug('⭕ [CAMPAIGN] Skipping reload due to skipReloadOnce param');
        navigation.setParams({ skipReloadOnce: undefined } as any);
        // Don't reload, just mark as loaded
        hasLoadedRef.current = true;
      } else if (!hasLoadedRef.current) {
        // Only load on first mount, not on every focus
        logger.debug('≡ƒôÑ [CAMPAIGN] Loading campaign (first time)');
        hasLoadedRef.current = true;
        loadCampaign();
      } else {
        logger.debug('✅ [CAMPAIGN] Already loaded, skipping reload');
      }

      // OPTIMIZATION: Don't reset hasLoadedRef on cleanup
      // This was causing the campaign to reload every time you came back from a child screen
      // The cleanup runs when navigating to ANY screen (including child screens like ProductDetail)
      // We only want to reload when explicitly requested via shouldReload param
      // This prevents unnecessary reloads and improves performance significantly
    }, [
      loadCampaign,
      route.params?.shouldReload,
      route.params?.skipReloadOnce,
      route.params?.updatedProductId,
      navigation,
      campaignId,
    ])
  );

  // Track whether stock has been loaded (lazy: only when user starts searching)
  const stockLoadedRef = useRef(false);

  // Ref a handleOpenBannerFromSearch para poder usarlo desde handleSearchSubmit
  // sin generar TDZ (la función real se asigna más abajo en el render).
  const handleOpenBannerFromSearchRef = useRef<((product: any) => Promise<void>) | null>(null);

  // Load stock items for quick add functionality (lazy)
  const loadStockItems = useCallback(async () => {
    try {
      const stockResponse: any = await inventoryApi.getAllStock({});
      // El API puede devolver un array o un objeto paginado { data: [...], total, page, limit }
      const stockArray = Array.isArray(stockResponse) ? stockResponse : stockResponse?.data || [];
      const stockItemsData: StockItem[] = stockArray.map((item: any) => ({
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
    } catch (error) {
      console.error('Error loading stock:', error);
      setStockItems([]);
    }
  }, []);

  // Get product stock from search results (backend now returns stock structure)
  const getProductStock = useCallback(
    (product: any): { available: number; reserved: number; total: number } => {
      // If product has stock from backend (v2 search), use it
      if (product.stock) {
        // Backend returns stock structure for both preliminary and active products
        if (typeof product.stock === 'object') {
          return {
            available: product.stock.available || 0,
            reserved: product.stock.reserved || 0,
            total: product.stock.total || 0,
          };
        }
        // Fallback: if stock is a number (old format)
        return {
          available: product.stock,
          reserved: 0,
          total: product.stock,
        };
      }

      // Fallback: calculate from stockItems (old method, shouldn't be needed with v2 search)
      const productStockItems = stockItems.filter((item) => item.productId === product.id);
      if (productStockItems.length === 0) {
        return { available: 0, reserved: 0, total: 0 };
      }
      const totalStock = productStockItems.reduce((total: number, item: StockItem) => {
        const quantity =
          typeof item.availableQuantityBase === 'number'
            ? item.availableQuantityBase
            : typeof item.quantityBase === 'string'
              ? parseFloat(item.quantityBase)
              : item.quantityBase || 0;
        return total + quantity;
      }, 0);
      return { available: totalStock, reserved: 0, total: totalStock };
    },
    [stockItems]
  );

  // Global search for products not in campaign
  const searchGlobalProducts = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setGlobalSearchResults([]);
      setShowGlobalSearchSuggestions(false);
      return;
    }

    try {
      setIsGlobalSearching(true);
      console.log('≡ƒöì Global search:', query);

      try {
        const response = await productsApi.searchProductsV2({
          q: query.trim(),
          limit: 20,
          status: 'active,preliminary',
          includePhotos: true,
        });

        console.log('≡ƒöì Search results:', response.results.length, 'products found');
        console.log('⚡ Search time:', response.searchTime, 'ms');
        console.log('≡ƒÆ╛ Cached:', response.cached);

        // Log product statuses for debugging
        const statusCounts = response.results.reduce((acc: any, p: any) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {});
        console.log('≡ƒôè Products by status:', statusCounts);
        console.log(
          '📦 Sample products:',
          response.results.slice(0, 5).map((p: any) => ({
            id: p.id,
            sku: p.sku,
            title: p.title,
            status: p.status,
          }))
        );

        setGlobalSearchResults(response.results);
        setShowGlobalSearchSuggestions(response.results.length > 0);
      } catch (v2Error) {
        console.warn('⚠️ V2 endpoint failed, falling back to v1:', v2Error);
        const response = await productsApi.getProducts({
          q: query.trim(),
          limit: 20,
        });
        console.log('≡ƒöì Search results (v1):', response.products.length, 'products found');
        setGlobalSearchResults(response.products);
        setShowGlobalSearchSuggestions(response.products.length > 0);
      }
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsGlobalSearching(false);
    }
  }, []);

  /**
   * Cuando el usuario escanea con un lector de código de barras, el
   * dispositivo envía todo el código rápido seguido de Enter. Capturamos
   * `onSubmitEditing`:
   *  1. Si el texto coincide con el barcode de un producto YA en la campaña,
   *     abrimos su banner directamente.
   *  2. Si no, buscamos el producto en el catálogo global por barcode y
   *     abrimos su banner (modal "desde búsqueda") para poder agregarlo.
   */
  const handleSearchSubmit = useCallback(async () => {
    const raw = searchQuery.trim();
    if (!raw) return;
    const target = raw.toLowerCase();

    // 1) Buscar en productos de la campaña
    const match = campaign?.products?.find((product) => {
      const detail = productsDetailMap[product.id];
      const productDetails = product.product || products[product.productId];
      const barcode = (detail?.barcode || (productDetails as any)?.barcode || '')
        .toString()
        .toLowerCase();
      if (!barcode) return false;
      return barcode === target;
    });

    if (match) {
      setSelectedProduct(match);
      setShowBannerModal(true);
      setSearchQuery('');
      setGlobalSearchResults([]);
      setShowGlobalSearchSuggestions(false);
      return;
    }

    // 2) Buscar en el catálogo global por barcode (lector de barras)
    try {
      setIsGlobalSearching(true);
      let candidates: any[] = [];
      try {
        const response = await productsApi.searchProductsV2({
          q: raw,
          limit: 20,
          status: 'active,preliminary',
          includePhotos: true,
        });
        candidates = response.results || [];
      } catch (v2Error) {
        const response = await productsApi.getProducts({ q: raw, limit: 20 });
        candidates = response.products || [];
      }

      const apiMatch = candidates.find(
        (p: any) => (p?.barcode || '').toString().toLowerCase() === target
      );

      if (apiMatch) {
        setSearchQuery('');
        setGlobalSearchResults([]);
        setShowGlobalSearchSuggestions(false);
        await handleOpenBannerFromSearchRef.current?.(apiMatch);
      }
    } catch (error) {
      console.error('Error buscando producto por barcode:', error);
    } finally {
      setIsGlobalSearching(false);
    }
  }, [searchQuery, campaign?.products, productsDetailMap, products]);

  // Handle search query change with debounce
  const handleSearchQueryChange = useCallback(
    (text: string) => {
      setSearchQuery(text);

      // Lazy-load stock items the first time the user actually searches
      if (!stockLoadedRef.current && text.trim().length > 0) {
        stockLoadedRef.current = true;
        void loadStockItems();
      }

      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // If query is empty, hide suggestions
      if (!text.trim()) {
        setGlobalSearchResults([]);
        setShowGlobalSearchSuggestions(false);
        return;
      }

      // Set new timeout for debounced search
      const timeout = setTimeout(() => {
        searchGlobalProducts(text);
      }, 800);

      setSearchTimeout(timeout);
    },
    [searchTimeout, searchGlobalProducts, loadStockItems]
  );

  // Quick add product with available stock
  const handleQuickAddProduct = useCallback(
    async (product: any) => {
      if (!campaign) return;

      const stockInfo = getProductStock(product);

      if (stockInfo.available <= 0) {
        Alert.alert('Sin stock', 'Este producto no tiene stock disponible');
        return;
      }

      setAddingQuickProduct(true);
      try {
        const actualProductStatus =
          product.status === 'preliminary' ? ProductStatus.PRELIMINARY : ProductStatus.ACTIVE;

        const data: AddProductRequest = {
          productId: product.id,
          sourceType: ProductSourceType.INVENTORY,
          totalQuantity: stockInfo.available, // Use available stock (total - reserved)
          productStatus: actualProductStatus,
          distributionType: DistributionType.ALL,
        };

        await campaignsService.addProduct(campaignId, data);

        Alert.alert('Éxito', `Producto agregado con ${stockInfo.available} unidades disponibles`);

        // Don't clear search - keep it to allow adding multiple products
        // Just reload campaign to update the list
        loadCampaign();
      } catch (error: any) {
        console.error('Error adding product:', error);
        Alert.alert('Error', error.response?.data?.message || 'No se pudo agregar el producto');
      } finally {
        setAddingQuickProduct(false);
      }
    },
    [campaign, campaignId, getProductStock, loadCampaign]
  );

  // Open custom add modal
  const handleOpenCustomAddModal = useCallback(
    (product: any) => {
      const stockInfo = getProductStock(product);
      setSelectedProductForCustomAdd(product);
      setCustomQuantity(stockInfo.available.toString());
      setShowCustomAddModal(true);
    },
    [getProductStock]
  );

  // Open banner modal from global search
  const handleOpenBannerFromSearch = useCallback(
    async (product: any) => {
      try {
        console.log('🎯 Opening banner from search for product:', product.sku);

        // Fetch full product details to get costCents and other info
        const fullProductDetails = await productsApi.getProduct(product.id);
        console.log('📦 Full product details:', fullProductDetails);
        console.log('💰 Cost from API:', (fullProductDetails as any).costCents);

        // Fusionamos la data del resultado de búsqueda v2 (que ya trae photos,
        // stock y a veces costCents) con el detalle del producto. El endpoint
        // /admin/campaigns/:c/products/:p/full devuelve 404 cuando el producto
        // todavía no está en la campaña, así que sin este merge el banner de
        // recomendaciones se quedaría sin foto ni stock.
        const mergedDetails: any = {
          ...fullProductDetails,
          photos:
            (fullProductDetails as any).photos ||
            (product as any).photos ||
            (product as any).photoUrls,
          imageUrl: (fullProductDetails as any).imageUrl || (product as any).imageUrl,
          imageUrls: (fullProductDetails as any).imageUrls || (product as any).imageUrls,
          stock: (product as any).stock ?? (fullProductDetails as any).stock,
          costCents:
            (fullProductDetails as any).costCents ??
            (fullProductDetails as any).costCentsBase ??
            (product as any).costCents,
        };

        // Create a mock campaign product structure for the banner modal
        const mockCampaignProduct = {
          productId: product.id,
          campaignId: campaignId,
          totalQuantityBase: 0, // No quantity yet since it's not added to campaign
          productStatus:
            product.status === 'preliminary' ? ProductStatus.PRELIMINARY : ProductStatus.ACTIVE,
          distributionGenerated: false,
          product: mergedDetails,
        };

        setSelectedProductForBannerSearch(mockCampaignProduct);
        setProductDetailsForBannerSearch(mergedDetails);
        setShowBannerModalFromSearch(true);
      } catch (error) {
        console.error('Error loading product details for banner:', error);
        Alert.alert('Error', 'No se pudieron cargar los detalles del producto');
      }
    },
    [campaignId]
  );

  // Mantener el ref sincronizado para handleSearchSubmit (lector de barras)
  handleOpenBannerFromSearchRef.current = handleOpenBannerFromSearch;

  // Handle custom add product with specific quantity
  const handleCustomAddProduct = useCallback(async () => {
    if (!campaign || !selectedProductForCustomAdd) return;

    const quantity = parseFloat(customQuantity);
    const stockInfo = getProductStock(selectedProductForCustomAdd);

    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Por favor ingresa una cantidad válida');
      return;
    }

    if (quantity > stockInfo.available) {
      Alert.alert(
        'Error',
        `La cantidad no puede ser mayor al stock disponible (${stockInfo.available})`
      );
      return;
    }

    setAddingQuickProduct(true);
    try {
      const actualProductStatus =
        selectedProductForCustomAdd.status === 'preliminary'
          ? ProductStatus.PRELIMINARY
          : ProductStatus.ACTIVE;

      const data: AddProductRequest = {
        productId: selectedProductForCustomAdd.id,
        sourceType: ProductSourceType.INVENTORY,
        totalQuantity: quantity,
        productStatus: actualProductStatus,
        distributionType: DistributionType.ALL,
      };

      await campaignsService.addProduct(campaignId, data);

      Alert.alert('Éxito', `Producto agregado con ${quantity} unidades`);

      // Close modal and reset
      setShowCustomAddModal(false);
      setSelectedProductForCustomAdd(null);
      setCustomQuantity('');

      // Don't clear search - keep it to allow adding multiple products
      // Just reload campaign to update the list
      loadCampaign();
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo agregar el producto');
    } finally {
      setAddingQuickProduct(false);
    }
  }, [
    campaign,
    campaignId,
    selectedProductForCustomAdd,
    customQuantity,
    getProductStock,
    loadCampaign,
  ]);

  const handleRefresh = () => {
    setRefreshing(true);
    hasLoadedRef.current = true; // Mark as loaded to prevent duplicate loads
    loadCampaign();
    refetchProductsDetail();
  };

  const handleActivate = async () => {
    if (!campaign) {
      return;
    }

    Alert.alert(
      'Activar Campaña',
      '¿Estás seguro de activar esta campaña? Podrás seguir editando y eliminando participantes y productos hasta que cierres la campaña.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Activar',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await campaignsService.activateCampaign(campaignId);
              Alert.alert('Éxito', 'Campaña activada exitosamente');
              loadCampaign();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo activar la campaña'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = async () => {
    if (!campaign) {
      return;
    }

    Alert.alert(
      'Cerrar Campaña',
      '¿Estás seguro de cerrar esta campaña? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await campaignsService.closeCampaign(campaignId);
              Alert.alert('Éxito', 'Campaña cerrada exitosamente');
              loadCampaign();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'No se pudo cerrar la campaña');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = async () => {
    if (!campaign) {
      return;
    }

    Alert.alert('Cancelar Campaña', '¿Estás seguro de cancelar esta campaña?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, Cancelar',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await campaignsService.cancelCampaign(campaignId);
            Alert.alert('Éxito', 'Campaña cancelada exitosamente');
            loadCampaign();
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo cancelar la campaña');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  const getStatusBadgeStyle = useCallback((status: CampaignStatus) => {
    return {
      backgroundColor: CampaignStatusColors[status] + '20',
      borderColor: CampaignStatusColors[status],
    };
  }, []);

  const getStatusTextStyle = useCallback((status: CampaignStatus) => {
    return {
      color: CampaignStatusColors[status],
    };
  }, []);

  const tabs = useMemo<Array<{ key: TabType; label: string }>>(
    () => [
      { key: 'overview', label: 'Resumen' },
      { key: 'participants', label: 'Participantes' },
      { key: 'products', label: 'Productos' },
    ],
    []
  );

  const renderTabs = useMemo(
    () => (
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              isTablet && styles.tabTablet,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                isTablet && styles.tabTextTablet,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    [activeTab, isTablet, tabs]
  );

  const renderOverview = () => {
    if (!campaign) {
      return null;
    }

    const totalParticipants = campaign.participants?.length || 0;
    const totalProducts = campaign.products?.length || 0;
    const activeProducts =
      campaign.products?.filter((p) => p.productStatus === 'ACTIVE').length || 0;
    const generatedProducts = campaign.products?.filter((p) => p.distributionGenerated).length || 0;

    return (
      <View style={styles.overviewContainer}>
        {/* Campaign Info */}
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Información General
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Código:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {campaign.code}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Nombre:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {campaign.name}
            </Text>
          </View>

          {campaign.description && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Descripción:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {campaign.description}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Estado:</Text>
            <View
              style={[
                styles.statusBadge,
                isTablet && styles.statusBadgeTablet,
                getStatusBadgeStyle(campaign.status),
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isTablet && styles.statusTextTablet,
                  getStatusTextStyle(campaign.status),
                ]}
              >
                {CampaignStatusLabels[campaign.status]}
              </Text>
            </View>
          </View>

          {campaign.startDate && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Fecha Inicio:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(campaign.startDate)}
              </Text>
            </View>
          )}

          {campaign.endDate && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Fecha Fin:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(campaign.endDate)}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Creado:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {formatDate(campaign.createdAt)}
            </Text>
          </View>

          {campaign.closedAt && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Cerrado:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(campaign.closedAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Statistics */}
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Estadísticas
          </Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {totalParticipants}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Participantes
              </Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {totalProducts}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>Productos</Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {activeProducts}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>Activos</Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {generatedProducts}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>Generados</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {campaign.notes && (
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>Notas</Text>
            <Text style={[styles.notesText, isTablet && styles.notesTextTablet]}>
              {campaign.notes}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const handleDownloadGeneralReport = async () => {
    try {
      setDownloadingReport(true);

      logger.info('≡ƒöä Descargando reporte general de totales de participantes...');
      const startTime = new Date().getTime();

      // Call the campaigns API to get the participant totals PDF (uses VALIDATED quantities)
      const pdfBlob = await campaignsService.exportParticipantTotalsPdf(campaignId);

      const endTime = new Date().getTime();
      logger.info('✅ PDF descargado del servidor');
      logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
      logger.info('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

      const timestamp = new Date().getTime();
      const fileName = `reporte-totales-participantes-${campaign?.code || campaignId}-${timestamp}.pdf`;

      await saveAndSharePdf(pdfBlob, fileName, 'Reporte de Totales de Participantes');

      if (Platform.OS === 'web') {
        Alert.alert('Éxito', 'El reporte se está descargando');
      }
    } catch (error: any) {
      logger.error('Error downloading report:', error);
      Alert.alert('Error', error.message || 'No se pudo descargar el reporte');
    } finally {
      setDownloadingReport(false);
    }
  };

  const formatCurrency = useCallback((cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  }, []);

  const handleCopyParticipantsFromCampaign = useCallback(
    async (sourceCampaign: Campaign) => {
      try {
        if (!sourceCampaign || !sourceCampaign.participants) {
          Alert.alert('Error', 'No se encontraron participantes en la campaña seleccionada');
          setActionLoading(false);
          return;
        }

        // Copy each participant
        let successCount = 0;
        let errorCount = 0;

        for (const participant of sourceCampaign.participants) {
          try {
            const participantData: any = {
              participantType: participant.participantType,
              assignedAmount: participant.assignedAmountCents / 100,
              currency: participant.currency,
            };

            if (participant.participantType === 'EXTERNAL_COMPANY' && participant.companyId) {
              participantData.companyId = participant.companyId;
            } else if (participant.participantType === 'INTERNAL_SITE' && participant.siteId) {
              participantData.siteId = participant.siteId;
            }

            if (participant.priceProfileId) {
              participantData.priceProfileId = participant.priceProfileId;
            }

            await campaignsService.addParticipant(campaignId, participantData);
            successCount++;
          } catch (error) {
            errorCount++;
            logger.error('Error copying participant:', error);
          }
        }

        if (successCount > 0) {
          Alert.alert(
            'Éxito',
            `Se copiaron ${successCount} participante(s) correctamente${errorCount > 0 ? `. ${errorCount} fallaron.` : ''}`,
            [{ text: 'OK', onPress: () => loadCampaign() }]
          );
        } else {
          Alert.alert('Error', 'No se pudo copiar ningún participante');
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'No se pudieron copiar los participantes');
      } finally {
        setActionLoading(false);
      }
    },
    [campaignId, loadCampaign]
  );

  const handleOpenCopyParticipantsModal = useCallback(async () => {
    try {
      setActionLoading(true);

      // Load all campaigns except the current one, ordered by creation date (newest first)
      const response = await campaignsService.getCampaigns({
        limit: 100,
        orderBy: 'createdAt',
        orderDir: 'DESC',
      });

      // Filter campaigns that are not the current one
      const otherCampaigns = response.data.filter((c) => c.id !== campaignId);

      if (otherCampaigns.length === 0) {
        Alert.alert('Error', 'No hay otras campañas disponibles para copiar participantes');
        setActionLoading(false);
        return;
      }

      // Get the most recent campaign (first one after ordering by createdAt DESC)
      const latestCampaign = otherCampaigns[0];

      // Load the full campaign details with participants
      logger.info('≡ƒôÑ Cargando participantes de la campaña:', latestCampaign.code);
      const fullCampaign = await campaignsService.getCampaign(latestCampaign.id);

      if (!fullCampaign.participants || fullCampaign.participants.length === 0) {
        Alert.alert(
          'Error',
          `La campaña "${latestCampaign.code} - ${latestCampaign.name}" no tiene participantes para copiar`
        );
        setActionLoading(false);
        return;
      }

      // Show confirmation dialog
      Alert.alert(
        'Copiar Participantes',
        `¿Deseas copiar los ${fullCampaign.participants.length} participante(s) de la campaña "${latestCampaign.code} - ${latestCampaign.name}"?`,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => setActionLoading(false),
          },
          {
            text: 'Copiar',
            onPress: () => handleCopyParticipantsFromCampaign(fullCampaign),
          },
        ]
      );
    } catch (error: any) {
      logger.error('Error loading campaigns for copy:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar las campañas');
      setActionLoading(false);
    }
  }, [campaignId, handleCopyParticipantsFromCampaign]);

  const handleDeleteAllParticipants = useCallback(async () => {
    if (!campaign || !campaign.participants || campaign.participants.length === 0) {
      Alert.alert('Sin participantes', 'No hay participantes para eliminar');
      return;
    }

    Alert.alert(
      'Eliminar Todos los Participantes',
      `¿Estás seguro de eliminar los ${campaign.participants.length} participante(s)? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Todos',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              logger.info('🗑️ Eliminando todos los participantes...');

              let successCount = 0;
              let errorCount = 0;

              for (const participant of campaign.participants ?? []) {
                try {
                  await campaignsService.deleteParticipant(campaignId, participant.id);
                  successCount++;
                } catch (error) {
                  errorCount++;
                  logger.error('Error deleting participant:', error);
                }
              }

              if (successCount > 0) {
                Alert.alert(
                  'Éxito',
                  `Se eliminaron ${successCount} participante(s)${errorCount > 0 ? `. ${errorCount} fallaron.` : ''}`,
                  [{ text: 'OK', onPress: () => loadCampaign() }]
                );
              } else {
                Alert.alert('Error', 'No se pudo eliminar ningún participante');
              }
            } catch (error: any) {
              logger.error('Error deleting participants:', error);
              Alert.alert('Error', error.message || 'No se pudieron eliminar los participantes');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [campaign, campaignId, loadCampaign]);

  const renderParticipants = () => {
    if (!campaign) {
      return null;
    }

    // Calculate total expected amount from all participants
    const totalExpectedAmountCents =
      campaign.participants?.reduce(
        (sum, participant) => sum + (Number(participant.assignedAmountCents) || 0),
        0
      ) || 0;

    return (
      <View style={styles.tabContent}>
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Participantes ({campaign.participants?.length || 0})
            </Text>
            {(campaign.status === CampaignStatus.DRAFT ||
              campaign.status === CampaignStatus.ACTIVE) && (
              <View style={styles.headerButtons}>
                {campaign.participants && campaign.participants.length > 0 && (
                  <TouchableOpacity
                    style={[styles.deleteAllButton, isTablet && styles.deleteAllButtonTablet]}
                    onPress={handleDeleteAllParticipants}
                  >
                    <Text
                      style={[
                        styles.deleteAllButtonText,
                        isTablet && styles.deleteAllButtonTextTablet,
                      ]}
                    >
                      🗑️ Eliminar Todos
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.copyButton, isTablet && styles.copyButtonTablet]}
                  onPress={() => setIsCopyParticipantsModalVisible(true)}
                >
                  <Text style={[styles.copyButtonText, isTablet && styles.copyButtonTextTablet]}>
                    📋 Copiar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, isTablet && styles.addButtonTablet]}
                  onPress={() => navigation.navigate('AddCampaignParticipant', { campaignId })}
                >
                  <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                    + Agregar
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Summary Section */}
          {participantTotals && campaign.participants && campaign.participants.length > 0 && (
            <View style={[styles.summaryCard, isTablet && styles.summaryCardTablet]}>
              <Text style={[styles.summaryTitle, isTablet && styles.summaryTitleTablet]}>
                Resumen General
              </Text>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                    Total Compra
                  </Text>
                  <Text
                    style={[styles.summaryValuePurchase, isTablet && styles.summaryValueTablet]}
                  >
                    {formatCurrency(participantTotals.totalPurchaseCents)}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                    Total Venta
                  </Text>
                  <Text style={[styles.summaryValueSale, isTablet && styles.summaryValueTablet]}>
                    {formatCurrency(participantTotals.totalSaleCents)}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                    Total Margen
                  </Text>
                  <Text style={[styles.summaryValueMargin, isTablet && styles.summaryValueTablet]}>
                    {formatCurrency(participantTotals.totalMarginCents)}
                  </Text>
                  <Text
                    style={[styles.summaryPercentage, isTablet && styles.summaryPercentageTablet]}
                  >
                    ({participantTotals.totalMarginPercentage.toFixed(2)}%)
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                    Total Esperado
                  </Text>
                  <Text
                    style={[styles.summaryValueExpected, isTablet && styles.summaryValueTablet]}
                  >
                    {formatCurrency(totalExpectedAmountCents)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Download General Report Button - Participant Totals */}
          {campaign.participants &&
            campaign.participants.length > 0 &&
            !permissionsLoading &&
            hasPermission(PERMISSIONS.REPARTOS.REPORTS) && (
              <TouchableOpacity
                style={[
                  styles.downloadGeneralReportButton,
                  isTablet && styles.downloadGeneralReportButtonTablet,
                  downloadingReport && styles.downloadButtonDisabled,
                ]}
                onPress={handleDownloadGeneralReport}
                disabled={downloadingReport}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.downloadGeneralReportButtonText,
                    isTablet && styles.downloadGeneralReportButtonTextTablet,
                  ]}
                >
                  {downloadingReport
                    ? '📄 Generando...'
                    : '📄 Descargar Reporte General de Totales de Participantes'}
                </Text>
              </TouchableOpacity>
            )}

          {!campaign.participants || campaign.participants.length === 0 ? (
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay participantes agregados
            </Text>
          ) : (
            // Sort participants: INTERNAL_SITE first, then EXTERNAL_COMPANY, alphabetically within each group
            [...campaign.participants]
              .sort((a, b) => {
                // First, sort by participant type (INTERNAL_SITE before EXTERNAL_COMPANY)
                if (a.participantType !== b.participantType) {
                  return a.participantType === 'INTERNAL_SITE' ? -1 : 1;
                }

                // Within same type, sort alphabetically
                let nameA = '';
                let nameB = '';

                if (a.participantType === 'EXTERNAL_COMPANY') {
                  // For external companies, use alias if available, otherwise use name
                  nameA =
                    a.company?.alias ||
                    a.company?.name ||
                    companies[a.companyId!]?.alias ||
                    companies[a.companyId!]?.name ||
                    '';
                  nameB =
                    b.company?.alias ||
                    b.company?.name ||
                    companies[b.companyId!]?.alias ||
                    companies[b.companyId!]?.name ||
                    '';
                } else {
                  // For internal sites, use site name
                  nameA = a.site?.name || sites[a.siteId!]?.name || '';
                  nameB = b.site?.name || sites[b.siteId!]?.name || '';
                }

                return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
              })
              .map((participant) => {
                // Find totals for this participant
                const participantTotal = participantTotals?.participants.find(
                  (p) => p.participantId === participant.id
                );

                // Debug: Log participant data to identify the issue
                logger.debug(`🔍 Participant ${participant.id}:`, {
                  participantId: participant.id,
                  participantType: participant.participantType,
                  companyId: participant.companyId,
                  siteId: participant.siteId,
                  embeddedCompany: participant.company,
                  embeddedSite: participant.site,
                  foundTotal: !!participantTotal,
                  totalData: participantTotal
                    ? {
                        participantId: participantTotal.participantId,
                        totalPurchaseCents: participantTotal.totalPurchaseCents,
                        totalSaleCents: participantTotal.totalSaleCents,
                      }
                    : null,
                });

                // Debug: Log all available participant totals
                if (participantTotals?.participants) {
                  logger.debug(
                    `📊 Available participant totals (${participantTotals.participants.length}):`,
                    participantTotals.participants.map((pt) => ({
                      participantId: pt.participantId,
                      participantName: pt.participantName,
                      totalPurchaseCents: pt.totalPurchaseCents,
                    }))
                  );
                }

                return (
                  <View
                    key={participant.id}
                    style={[styles.participantCard, isTablet && styles.participantCardTablet]}
                  >
                    <TouchableOpacity
                      style={styles.participantCardMain}
                      onPress={() =>
                        navigation.navigate('ParticipantDetail', {
                          campaignId,
                          participantId: participant.id,
                        })
                      }
                    >
                      <View style={styles.listItemContent}>
                        <View style={styles.participantHeader}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.listItemTitle, isTablet && styles.listItemTitleTablet]}
                            >
                              {participant.participantType === 'EXTERNAL_COMPANY'
                                ? participant.company?.alias ||
                                  participant.company?.name ||
                                  companies[participant.companyId!]?.alias ||
                                  companies[participant.companyId!]?.name ||
                                  `Empresa ID: ${participant.companyId}`
                                : participant.site?.name ||
                                  sites[participant.siteId!]?.name ||
                                  `Sede ID: ${participant.siteId}`}
                            </Text>
                            <Text
                              style={[
                                styles.listItemSubtitle,
                                isTablet && styles.listItemSubtitleTablet,
                              ]}
                            >
                              {participant.participantType === 'EXTERNAL_COMPANY'
                                ? 'Empresa Externa'
                                : 'Sede Interna'}
                              {(participant.site?.code || sites[participant.siteId!]?.code) &&
                                ` - ${participant.site?.code || sites[participant.siteId!]?.code}`}
                            </Text>
                          </View>
                          {(campaign.status === CampaignStatus.DRAFT ||
                            campaign.status === CampaignStatus.ACTIVE) && (
                            <TouchableOpacity
                              style={[
                                styles.editParticipantButton,
                                isTablet && styles.editParticipantButtonTablet,
                              ]}
                              onPress={(e) => {
                                e.stopPropagation();
                                navigation.navigate('EditCampaignParticipant', {
                                  campaignId,
                                  participantId: participant.id,
                                  participant,
                                });
                              }}
                            >
                              <Text
                                style={[
                                  styles.editParticipantButtonText,
                                  isTablet && styles.editParticipantButtonTextTablet,
                                ]}
                              >
                                ✏️ Editar
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Totals Display */}
                        {participantTotal && (
                          <View style={styles.totalsContainer}>
                            <View style={styles.totalRow}>
                              <Text
                                style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}
                              >
                                Esperado:
                              </Text>
                              <Text
                                style={[
                                  styles.totalValueExpected,
                                  isTablet && styles.totalValueTablet,
                                ]}
                              >
                                {formatCurrency(participant.assignedAmountCents)}
                              </Text>
                            </View>
                            <View style={styles.totalRow}>
                              <Text
                                style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}
                              >
                                Compra:
                              </Text>
                              <Text
                                style={[
                                  styles.totalValuePurchase,
                                  isTablet && styles.totalValueTablet,
                                ]}
                              >
                                {formatCurrency(participantTotal.totalPurchaseCents)}
                              </Text>
                            </View>
                            <View style={styles.totalRow}>
                              <Text
                                style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}
                              >
                                Venta:
                              </Text>
                              <Text
                                style={[styles.totalValueSale, isTablet && styles.totalValueTablet]}
                              >
                                {formatCurrency(participantTotal.totalSaleCents)}
                              </Text>
                            </View>
                            <View style={styles.totalRow}>
                              <Text
                                style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}
                              >
                                Margen:
                              </Text>
                              <View style={styles.marginValueContainer}>
                                <Text
                                  style={[
                                    styles.totalValueMargin,
                                    isTablet && styles.totalValueTablet,
                                  ]}
                                >
                                  {formatCurrency(participantTotal.marginCents)}
                                </Text>
                                <Text
                                  style={[
                                    styles.marginPercentage,
                                    isTablet && styles.marginPercentageTablet,
                                  ]}
                                >
                                  ({participantTotal.marginPercentage.toFixed(2)}%)
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>
                        ΓÇ║
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
          )}
        </View>
      </View>
    );
  };

  const handleOpenImageModal = useCallback((imageUri: string) => {
    setSelectedImageUri(imageUri);
    setIsImageModalVisible(true);
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setIsImageModalVisible(false);
    setSelectedImageUri(null);
  }, []);

  const handleDeleteProduct = useCallback(
    async (product: CampaignProduct) => {
      Alert.alert(
        'Eliminar Producto',
        `¿Estás seguro de eliminar "${product.product?.title || 'este producto'}" de la campaña?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                setActionLoading(true);
                await campaignsService.deleteProduct(campaignId, product.id);

                // Update local state instead of reloading everything
                setCampaign((prevCampaign) => {
                  if (!prevCampaign || !prevCampaign.products) {
                    return prevCampaign;
                  }
                  return {
                    ...prevCampaign,
                    products: prevCampaign.products.filter((p) => p.id !== product.id),
                  };
                });

                // Remove from product sale prices
                setProductSalePrices((prevPrices) => {
                  const { [product.productId]: removed, ...rest } = prevPrices;
                  return rest;
                });

                Alert.alert('Éxito', 'Producto eliminado de la campaña');
              } catch (error: any) {
                logger.error('Error deleting product:', error);
                Alert.alert('Error', error.message || 'No se pudo eliminar el producto');
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]
      );
    },
    [campaignId]
  );

  const handleShowBanner = useCallback((product: CampaignProduct) => {
    setSelectedProduct(product);
    setShowBannerModal(true);
  }, []);

  const handleCloseBanner = useCallback(() => {
    setShowBannerModal(false);
    setSelectedProduct(null);
    // No need to reload campaign - the modal updates its own state locally
  }, []);

  // Abre el gestor de fotos para el producto mostrado en el banner. Reúne los
  // mismos datos (título, sku, foto de catálogo, referencias) que el botón de
  // "Fotos" de la lista, a partir del endpoint compacto `products-detail`.
  const handleOpenPhotoManagerFromBanner = useCallback(
    (product: CampaignProduct) => {
      const detail = productsDetailMap[product.id];
      const embedded = product.product || products[product.productId];

      const pickUrl = (p: any): string | undefined => {
        if (!p) return undefined;
        if (typeof p === 'string') return p;
        if (typeof p === 'object' && typeof p.url === 'string') return p.url;
        return undefined;
      };
      const photos: any[] = Array.isArray(detail?.photos) ? detail!.photos : [];
      const byType = (t: string) =>
        photos.find(
          (p) =>
            p && typeof p === 'object' && typeof p.type === 'string' && p.type.toLowerCase() === t
        );
      const catalogPhotoUrl = pickUrl(byType('catalog'));
      const referencePhotos = photos.filter((p) => {
        const t =
          p && typeof p === 'object' && typeof p.type === 'string' ? p.type.toLowerCase() : '';
        return t === 'reference';
      });
      const existingReferenceUrls = referencePhotos
        .map(pickUrl)
        .filter((u): u is string => typeof u === 'string' && u.length > 0);
      const fallbackImageUrl =
        pickUrl(byType('design')) ||
        pickUrl(byType('reference')) ||
        pickUrl(photos[0]) ||
        catalogPhotoUrl;

      setPhotoManagerProduct({
        productId: product.productId,
        title: detail?.title || embedded?.title || '',
        sku: detail?.sku || embedded?.sku || '',
        catalogPhotoUrl,
        fallbackImageUrl,
        existingReferenceUrls,
      });
      setPhotoManagerVisible(true);
    },
    [productsDetailMap, products]
  );

  const handleRefreshProductFromBanner = useCallback(
    async (updatedProductParam?: CampaignProduct) => {
      if (!selectedProduct) {
        return;
      }

      logger.debug('≡ƒöä [BANNER] Actualizando producto específico:', selectedProduct.id);

      try {
        // Use provided updated product or fetch it
        let updatedProduct: CampaignProduct;

        if (updatedProductParam) {
          logger.debug('✅ [BANNER] Usando producto actualizado proporcionado');
          updatedProduct = updatedProductParam;
        } else {
          logger.debug('≡ƒöä [BANNER] Obteniendo producto actualizado del servidor');
          // Fetch only the updated product
          updatedProduct = await campaignsService.getProduct(campaignId, selectedProduct.productId);
        }

        logger.debug('✅ [BANNER] Producto actualizado:', {
          productId: updatedProduct.id,
          distributionGenerated: updatedProduct.distributionGenerated,
          productStatus: updatedProduct.productStatus,
        });

        // Update the product in the campaign state
        setCampaign((prev) => {
          if (!prev || !prev.products) return prev;

          return {
            ...prev,
            products: prev.products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
          };
        });

        // Update selected product
        setSelectedProduct(updatedProduct);

        logger.debug('✅ [BANNER] Producto actualizado en la lista sin recargar toda la campaña');
      } catch (error: any) {
        logger.error('❌ [BANNER] Error actualizando producto:', error);
        // Fallback: reload entire campaign
        logger.debug('⚠️ [BANNER] Fallback: recargando toda la campaña');
        loadCampaign();
      }
    },
    [selectedProduct, campaignId, loadCampaign]
  );

  const toggleProductExpanded = useCallback(
    async (productId: string) => {
      setExpandedProducts((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(productId)) {
          newSet.delete(productId);
        } else {
          newSet.add(productId);

          // OPTIMIZATION: Cargar precios solo cuando se expande por primera vez
          // Solo si no están ya cargados y el producto existe en el catálogo
          if (!productSalePrices[productId]) {
            const productDetails = products[productId];
            const isPreliminary =
              productDetails && (productDetails as any).status === 'preliminary';

            if (productDetails && !isPreliminary) {
              logger.debug('⚡ [PERF] Cargando precios para producto expandido:', productId);

              // Cargar precios en background
              priceProfilesApi
                .getProductSalePrices(productId)
                .then((response) => {
                  const salePricesArray = (response as any).salePrices || response.data || [];

                  setProductSalePrices((prevPrices) => ({
                    ...prevPrices,
                    [productId]: salePricesArray,
                  }));

                  logger.debug('✅ [PERF] Precios cargados para producto:', productId);
                })
                .catch((error) => {
                  logger.debug(
                    '⚠️ [PERF] No se pudieron cargar precios para producto (puede ser preliminar o no existir)'
                  );
                });
            } else {
              logger.debug('⚠️ [PERF] Producto preliminar o no existe, no se cargan precios');
            }
          }
        }
        return newSet;
      });
    },
    [productSalePrices, products]
  );

  const handleStartEditCost = useCallback((productId: string, currentCost: number) => {
    setEditingCost({
      productId,
      value: (currentCost / 100).toFixed(2),
    });
  }, []);

  const handleStartEditPrice = useCallback(
    (productId: string, profileId: string, currentPrice: number) => {
      setEditingPrice({
        productId,
        profileId,
        value: (currentPrice / 100).toFixed(2),
      });
    },
    []
  );

  const handleSaveCost = useCallback(
    async (productId: string) => {
      if (!editingCost || editingCost.productId !== productId) {
        return;
      }

      try {
        setSavingPrice(true);
        const costCents = Math.round(parseFloat(editingCost.value) * 100);

        await productsApi.updateProduct(productId, { costCents });

        // ✅ Invalidar caché V2 para reflejar cambios inmediatamente en búsquedas
        try {
          await productsApi.invalidateProductsCacheV2();
          logger.info('✅ Caché V2 invalidado después de actualizar costo');
        } catch (cacheError) {
          logger.warn('⚠️ No se pudo invalidar caché V2:', cacheError);
          // No bloqueamos la operación si falla la invalidación
        }

        // Update local state instead of reloading everything
        setProducts((prevProducts) => {
          if (!prevProducts || !prevProducts[productId]) {
            return prevProducts;
          }
          return {
            ...prevProducts,
            [productId]: {
              ...prevProducts[productId],
              costCents,
            },
          };
        });

        setEditingCost(null);
        Alert.alert('Éxito', 'Costo actualizado correctamente');
      } catch (error: any) {
        logger.error('Error saving cost:', error);
        Alert.alert('Error', error.message || 'No se pudo actualizar el costo');
      } finally {
        setSavingPrice(false);
      }
    },
    [editingCost]
  );

  const handleSavePrice = useCallback(
    async (productId: string, profileId: string) => {
      if (
        !editingPrice ||
        editingPrice.productId !== productId ||
        editingPrice.profileId !== profileId
      ) {
        return;
      }

      try {
        setSavingPrice(true);
        const priceCents = Math.round(parseFloat(editingPrice.value) * 100);

        await priceProfilesApi.updateSalePrice(productId, {
          productId,
          presentationId: null,
          profileId,
          priceCents,
        });

        // Update local state instead of reloading everything
        setProductSalePrices((prevPrices) => {
          const currentPrices = prevPrices[productId] || [];
          const existingIndex = currentPrices.findIndex(
            (p) => p.profileId === profileId && p.presentationId === null
          );

          let updatedPrices: ProductSalePrice[];
          if (existingIndex >= 0) {
            // Update existing price
            updatedPrices = [...currentPrices];
            updatedPrices[existingIndex] = { ...updatedPrices[existingIndex], priceCents };
          } else {
            // Add new price - create a complete ProductSalePrice object
            const newPrice: ProductSalePrice = {
              id: `temp-${Date.now()}`, // Temporary ID
              productId,
              presentationId: null,
              profileId,
              priceCents,
              currency: 'PEN',
              isOverridden: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            updatedPrices = [...currentPrices, newPrice];
          }

          return {
            ...prevPrices,
            [productId]: updatedPrices,
          };
        });

        setEditingPrice(null);
        Alert.alert('Éxito', 'Precio actualizado correctamente');
      } catch (error: any) {
        logger.error('Error saving price:', error);
        Alert.alert('Error', error.message || 'No se pudo actualizar el precio');
      } finally {
        setSavingPrice(false);
      }
    },
    [editingPrice]
  );

  const getSalePriceForProfile = useCallback(
    (productId: string, profileId: string): number => {
      const prices = productSalePrices[productId] || [];
      const priceEntry = prices.find((p) => p.profileId === profileId && p.presentationId === null);
      return priceEntry?.priceCents || 0;
    },
    [productSalePrices]
  );

  const handleCalculateFranquiciaFromSocia = useCallback(
    async (productId: string) => {
      // Find Socia and Franquicia profiles
      const sociaProfile = priceProfiles.find(
        (p) => p.code === 'SOCIA' || p.name.toLowerCase().includes('socia')
      );
      const franquiciaProfile = priceProfiles.find(
        (p) => p.code === 'FRANQ' || p.name.toLowerCase().includes('franquicia')
      );

      if (!sociaProfile || !franquiciaProfile) {
        Alert.alert('Error', 'No se encontraron los perfiles de Precio Socia y Precio Franquicia');
        return;
      }

      const sociaPriceCents = getSalePriceForProfile(productId, sociaProfile.id);
      if (sociaPriceCents === 0) {
        Alert.alert('Error', 'El Precio Socia debe estar configurado primero');
        return;
      }

      const franquiciaPriceCents = Math.round(sociaPriceCents / 1.15);

      try {
        setSavingPrice(true);
        await priceProfilesApi.updateSalePrice(productId, {
          productId,
          presentationId: null,
          profileId: franquiciaProfile.id,
          priceCents: franquiciaPriceCents,
        });

        // Update local state instead of reloading everything
        setProductSalePrices((prevPrices) => {
          const currentPrices = prevPrices[productId] || [];
          const existingIndex = currentPrices.findIndex(
            (p) => p.profileId === franquiciaProfile.id && p.presentationId === null
          );

          let updatedPrices: ProductSalePrice[];
          if (existingIndex >= 0) {
            // Update existing price
            updatedPrices = [...currentPrices];
            updatedPrices[existingIndex] = {
              ...updatedPrices[existingIndex],
              priceCents: franquiciaPriceCents,
            };
          } else {
            // Add new price
            const newPrice: ProductSalePrice = {
              id: `temp-${Date.now()}`,
              productId,
              presentationId: null,
              profileId: franquiciaProfile.id,
              priceCents: franquiciaPriceCents,
              currency: 'PEN',
              isOverridden: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            updatedPrices = [...currentPrices, newPrice];
          }

          return {
            ...prevPrices,
            [productId]: updatedPrices,
          };
        });

        // Show success badge for 3 seconds
        setCalculatedFranquicia((prev) => new Set(prev).add(productId));
        setTimeout(() => {
          setCalculatedFranquicia((prev) => {
            const newSet = new Set(prev);
            newSet.delete(productId);
            return newSet;
          });
        }, 3000);
      } catch (error: any) {
        logger.error('Error calculating franquicia price:', error);
        Alert.alert('Error', error.message || 'No se pudo calcular el precio franquicia');
      } finally {
        setSavingPrice(false);
      }
    },
    [priceProfiles, getSalePriceForProfile]
  );

  const filteredProducts = useMemo(() => {
    if (!campaign?.products) {
      return [];
    }

    let filtered = campaign.products;

    // Apply distribution filter
    if (distributionFilter === 'generated') {
      filtered = filtered.filter((product) => product.distributionGenerated);
    } else if (distributionFilter === 'not-generated') {
      filtered = filtered.filter((product) => !product.distributionGenerated);
    }

    // Apply product status filter (preliminar / activo del producto subyacente).
    // Prioridad: `detail.productStatus` (endpoint fresco products-detail) >
    // `product.productStatus` (CampaignProduct). NO usar `productDetails.status`
    // porque ése es el status del Product maestro (típicamente 'active')
    // y enmascaraba campaign products realmente preliminares.
    if (productStatusFilter !== 'all') {
      filtered = filtered.filter((product) => {
        const detail = productsDetailMap[product.id];
        const raw = (detail?.productStatus || product.productStatus || '').toString().toLowerCase();
        const masterRaw =
          ((products[product.productId] || product.product) as any)?.status
            ?.toString()
            .toLowerCase() || '';
        // Un producto se considera preliminar si lo es en la campaña O si el
        // producto maestro aún está preliminar (compra no validada).
        const isPreliminary = raw === 'preliminary' || masterRaw === 'preliminary';
        return productStatusFilter === 'preliminary' ? isPreliminary : !isPreliminary;
      });
    }

    // Apply supplier filter
    if (supplierFilter !== 'all') {
      filtered = filtered.filter((product) => {
        const detail = productsDetailMap[product.id];
        const productDetails = product.product || products[product.productId];
        const key =
          detail?.supplier?.purchaseCode ||
          detail?.supplier?.name ||
          (productDetails as any)?.purchase?.code ||
          '__no_supplier__';
        return key === supplierFilter;
      });
    }

    // Apply search filter (usa primero los datos del endpoint compacto)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((product) => {
        const detail = productsDetailMap[product.id];
        const productDetails = product.product || products[product.productId];
        const title = (detail?.title || productDetails?.title || '').toLowerCase();
        const sku = (detail?.sku || productDetails?.sku || '').toLowerCase();
        const barcode = (detail?.barcode || (productDetails as any)?.barcode || '').toLowerCase();
        const supplierName = (detail?.supplier?.name || '').toLowerCase();
        const supplierCode = (detail?.supplier?.purchaseCode || '').toLowerCase();
        const quantity = product.totalQuantityBase.toString();

        return (
          title.includes(query) ||
          sku.includes(query) ||
          barcode.includes(query) ||
          supplierName.includes(query) ||
          supplierCode.includes(query) ||
          quantity.includes(query)
        );
      });
    }

    return filtered;
  }, [
    campaign?.products,
    products,
    productsDetailMap,
    searchQuery,
    distributionFilter,
    supplierFilter,
    productStatusFilter,
  ]);

  // Lista única de proveedores presentes entre los productos de la campaña.
  // Usa el endpoint compacto (preferido) con fallback al `purchase.code` del
  // producto cuando todavía no se hidrató.
  const availableSuppliers = useMemo(() => {
    if (!campaign?.products) return [] as Array<{ key: string; label: string }>;
    const map = new Map<string, string>();
    campaign.products.forEach((product) => {
      const detail = productsDetailMap[product.id];
      const productDetails = product.product || products[product.productId];
      const key =
        detail?.supplier?.purchaseCode ||
        detail?.supplier?.name ||
        (productDetails as any)?.purchase?.code ||
        null;
      if (!key) {
        map.set('__no_supplier__', 'Sin proveedor');
        return;
      }
      const label = detail?.supplier?.name
        ? detail.supplier.purchaseCode
          ? `${detail.supplier.name} · ${detail.supplier.purchaseCode}`
          : detail.supplier.name
        : key;
      if (!map.has(key)) {
        map.set(key, label);
      }
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [campaign?.products, productsDetailMap, products]);

  // Paginated products - only show a subset for better performance
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, displayedItemsCount);
  }, [filteredProducts, displayedItemsCount]);

  // Activar un producto preliminar dentro de la campaña: simplemente
  // cambia el `productStatus` del CampaignProduct de PRELIMINARY a ACTIVE.
  // No toca la compra ni dispara validaciones — sólo es un toggle de
  // estado en la campaña.
  const handleActivatePreliminary = useCallback(
    async (product: CampaignProduct) => {
      Alert.alert(
        'Activar producto',
        '¿Pasar este producto de preliminar a activo en la campaña?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Activar',
            style: 'default',
            onPress: async () => {
              setActivatingProductIds((prev) => new Set(prev).add(product.id));
              try {
                await campaignsService.updateProduct(campaignId, product.id, {
                  productStatus: ProductStatus.ACTIVE,
                });
                // Refrescamos campaign (para que `product.productStatus`
                // pase a 'ACTIVE') y el endpoint compacto (para que
                // `detail.productStatus` no quede stale en 'PRELIMINARY').
                await Promise.all([loadCampaign(), refetchProductsDetail()]);
                Alert.alert('Producto activado', 'El producto ahora está activo en la campaña.');
              } catch (e: any) {
                logger.error('Error activando producto en campaña', e);
                Alert.alert(
                  'Error',
                  e?.response?.data?.message ||
                    e?.message ||
                    'No se pudo activar el producto. Intenta de nuevo.'
                );
              } finally {
                setActivatingProductIds((prev) => {
                  const n = new Set(prev);
                  n.delete(product.id);
                  return n;
                });
              }
            },
          },
        ]
      );
    },
    [campaignId, loadCampaign, refetchProductsDetail]
  );

  // Reset pagination when filters change (side effect, must be useEffect)
  React.useEffect(() => {
    setDisplayedItemsCount(ITEMS_PER_PAGE);
  }, [searchQuery, distributionFilter]);

  // Load more items
  const handleLoadMore = useCallback(() => {
    if (displayedItemsCount < filteredProducts.length) {
      setDisplayedItemsCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredProducts.length));
    }
  }, [displayedItemsCount, filteredProducts.length, ITEMS_PER_PAGE]);

  // Memoized render function for product items
  const renderProductItem = useCallback(
    ({ item: product }: { item: CampaignProduct }) => {
      // ✅ Priorizar datos del nuevo endpoint compacto `products-detail`.
      // Hace fallback a los datos embebidos / batch endpoint si todavía
      // no se cargó el detalle (primer render).
      const detail = productsDetailMap[product.id];
      const productDetails = products[product.productId] || product.product;
      const costCents = detail?.costCents ?? productDetails?.costCents ?? 0;
      const isExpanded = expandedProducts.has(product.id);
      // Fuentes válidas para saber si el campaign product es preliminar:
      //   1) `detail.productStatus` — endpoint products-detail (fresco)
      //   2) `product.productStatus` — campo del CampaignProduct
      //   3) `productDetails.status` — status del Product maestro: marca
      //      como preliminar también a los productos cuyo origen en compras
      //      aún no fue validado (aunque en la campaña ya estén "ACTIVE").
      const productStatusRaw = (detail?.productStatus || product.productStatus || '').toString();
      const masterStatusRaw = (productDetails as any)?.status?.toString() || '';
      const isPreliminary =
        productStatusRaw.toLowerCase() === 'preliminary' ||
        masterStatusRaw.toLowerCase() === 'preliminary';
      const title = detail?.title || productDetails?.title || `Producto ID: ${product.productId}`;
      const sku = detail?.sku || productDetails?.sku || 'N/A';
      const barcode = detail?.barcode || (productDetails as any)?.barcode || null;
      const totalQty = detail
        ? parseFloat(detail.campaignQuantityBase || '0')
        : product.totalQuantityBase;
      // Sum from customDistributions (sólo disponible para distribuciones
      // CUSTOM). Para distribuciones generadas (ALL / INTERNAL_* /
      // EXTERNAL_*) el desglose vive en `repartos` y no se trae en este
      // request, así que asumimos que se repartió el total cuando el
      // backend marca `distributionGenerated=true`.
      const customDistributedQty =
        product.customDistributions?.[0]?.items?.reduce(
          (sum: number, item: any) => sum + parseFloat(item.assignedQuantityBase || '0'),
          0
        ) || 0;
      const hasDistributedInfo =
        !!detail || customDistributedQty > 0 || product.distributionGenerated;
      const distributedQty = detail
        ? parseFloat(detail.distributedQuantityBase || '0')
        : customDistributedQty > 0
          ? customDistributedQty
          : product.distributionGenerated
            ? totalQty
            : 0;
      const pendingQty = Math.max(totalQty - distributedQty, 0);
      const stock = detail?.tenantSiteStock;
      const availableStock = stock ? parseFloat(stock.availableQuantityBase || '0') : null;
      const reservedStock = stock ? parseFloat(stock.reservedQuantityBase || '0') : 0;
      const totalStock = stock ? parseFloat(stock.quantityBase || '0') : 0;
      // ⚠️ Las fotos del endpoint compacto pueden venir como string o como
      // { type, url }. Las del producto embebido pueden ser string o el
      // mismo objeto. Normalizamos a string para no romper <Image>.
      // Preferencia: design > reference > primera disponible.
      const pickPhotoUrl = (p: any): string | undefined => {
        if (!p) return undefined;
        if (typeof p === 'string') return p;
        if (typeof p === 'object' && typeof p.url === 'string') return p.url;
        return undefined;
      };
      const pickPreferredPhotoUrl = (arr: any): string | undefined => {
        if (!Array.isArray(arr)) return undefined;
        const byType = (t: string) =>
          arr.find(
            (p) =>
              p && typeof p === 'object' && typeof p.type === 'string' && p.type.toLowerCase() === t
          );
        const design = byType('design');
        if (design) {
          const url = pickPhotoUrl(design);
          if (url) return url;
        }
        const reference = byType('reference');
        if (reference) {
          const url = pickPhotoUrl(reference);
          if (url) return url;
        }
        for (const p of arr) {
          const url = pickPhotoUrl(p);
          if (url) return url;
        }
        return undefined;
      };
      const imageUri =
        pickPreferredPhotoUrl(detail?.photos) ||
        pickPreferredPhotoUrl((productDetails as any)?.photoUrls) ||
        pickPreferredPhotoUrl((productDetails as any)?.photos) ||
        (typeof (productDetails as any)?.imageUrl === 'string'
          ? (productDetails as any).imageUrl
          : undefined) ||
        pickPreferredPhotoUrl((productDetails as any)?.imageUrls);
      // Foto de catálogo del producto. El backend garantiza que `photos`
      // incluye un item `type: 'catalog'` cuando el producto no tiene fotos
      // de design/reference. Pasamos estrictamente esa url (no un diseño).
      const catalogPhotoUrl = Array.isArray(detail?.photos)
        ? pickPhotoUrl(
            detail.photos.find(
              (p: any) =>
                p &&
                typeof p === 'object' &&
                typeof p.type === 'string' &&
                p.type.toLowerCase() === 'catalog'
            )
          )
        : undefined;
      // Estado de fotos del producto por grupo (referencia / diseño / precio) para
      // el badge del botón "Fotos". Cada referencia define un grupo de 3 fotos
      // (referencia + diseño + precio), por lo que con N referencias el total es N*3.
      const relevantPhotos = Array.isArray(detail?.photos)
        ? detail.photos.filter((p) => {
            const t =
              p && typeof p === 'object' && typeof p.type === 'string' ? p.type.toLowerCase() : '';
            return t === 'reference' || t === 'design' || t === 'price';
          })
        : [];
      const referencePhotos = relevantPhotos.filter((p) => {
        const t =
          typeof (p as { type?: unknown }).type === 'string'
            ? (p as { type: string }).type.toLowerCase()
            : '';
        return t === 'reference';
      });
      const referenceCount = referencePhotos.length;
      // URLs de referencia existentes (p. ej. fotos de validación de la compra)
      // que aún no son assets de la campaña de fotos. Se ofrecen en el modal
      // para adoptarlas como referencia.
      const existingReferenceUrls = referencePhotos
        .map((p) => pickPhotoUrl(p))
        .filter((u): u is string => typeof u === 'string' && u.length > 0);
      // Con 0 referencias mantenemos el total en 3 para mostrar "0/3".
      const photoGroupCount = Math.max(referenceCount, 1);
      const photoCompletion = relevantPhotos.length;
      const photoTotal = photoGroupCount * 3;
      const currencyCode = detail?.currency || 'PEN';
      const currencyPrefix = currencyCode === 'PEN' ? 'S/' : currencyCode;
      const fmt = (cents: number) => `${currencyPrefix} ${(cents / 100).toFixed(2)}`;

      // Precios: priorizar los del endpoint compacto. Mostramos sólo
      // precios base (sin presentación) — los precios por presentación
      // se ven al entrar al detalle del producto.
      type DisplayPrice = { profileId: string; profileName: string; priceCents: number };
      const detailPrices: DisplayPrice[] =
        detail?.salePrices
          ?.filter((p) => !p.presentationId)
          .map((p) => ({
            profileId: p.profileId,
            profileName: p.profileName,
            priceCents: p.priceCents,
          })) || [];
      const fallbackPrices: DisplayPrice[] = priceProfiles.slice(0, 2).map((profile) => ({
        profileId: profile.id,
        profileName: profile.name,
        priceCents: getSalePriceForProfile(product.productId, profile.id),
      }));
      // El usuario pidió invertir el orden de los perfiles en la lista
      // (lo que el backend devuelve primero, mostrarlo al final).
      const orderedDetailPrices = [...detailPrices].reverse();
      const orderedFallbackPrices = [...fallbackPrices].reverse();
      const allPrices =
        orderedDetailPrices.length > 0 ? orderedDetailPrices : orderedFallbackPrices;
      // En las tarjetas sólo mostramos el precio Socia junto al costo.
      const displayPrices = allPrices.filter((p) => p.profileName.toLowerCase().includes('socia'));

      return (
        <View
          style={[
            styles.productCardCompact,
            isTablet && styles.productCardTablet,
            isPreliminary && styles.productCardPreliminary,
          ]}
        >
          <TouchableOpacity
            style={styles.productCardCompactMain}
            onPress={() => toggleProductExpanded(product.id)}
            activeOpacity={0.7}
          >
            {imageUri ? (
              <TouchableOpacity onPress={() => handleOpenImageModal(imageUri)} activeOpacity={0.7}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.productImageCompact}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.productImageCompactPlaceholder}>
                <Text style={styles.productImagePlaceholderText}>📦</Text>
              </View>
            )}

            <View style={styles.productCompactContent}>
              {/* Línea 1: SKU + título + badges */}
              <View style={styles.productCompactHeader}>
                <Text style={styles.productCompactSku}>{sku}</Text>
                {barcode ? (
                  <Text style={styles.productCompactBarcode} numberOfLines={1}>
                    🔖 {barcode}
                  </Text>
                ) : null}
                <Text
                  style={[styles.productCompactTitle, isTablet && styles.productCompactTitleTablet]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                <View style={styles.productCompactBadges}>
                  {/* Badge Activo/Preliminar: usamos `isPreliminary` (que
                      prioriza `detail.productStatus` del endpoint compacto
                      products-detail) en vez de `product.productStatus`,
                      porque éste último puede quedar stale cuando la compra
                      asociada se valida fuera del flujo de la campaña. */}
                  <View
                    style={[
                      styles.badgeSmall,
                      isPreliminary ? styles.badgePreliminary : styles.badgeActive,
                    ]}
                  >
                    <Text style={styles.badgeSmallText}>
                      {isPreliminary ? 'Preliminar' : 'Activo'}
                    </Text>
                  </View>
                  {product.distributionGenerated && (
                    <View style={[styles.badgeSmall, styles.badgeGenerated]}>
                      <Text style={styles.badgeSmallText}>✓ Gen</Text>
                    </View>
                  )}
                  {isPreliminary && (
                    <TouchableOpacity
                      style={[styles.badgeSmall, styles.badgeActivate]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleActivatePreliminary(product);
                      }}
                      disabled={activatingProductIds.has(product.id)}
                    >
                      {activatingProductIds.has(product.id) ? (
                        <ActivityIndicator size="small" color={theme.color.surface.base} />
                      ) : (
                        <Text style={styles.badgeSmallText}>✅ Activar</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Línea 2: cantidades */}
              <View style={styles.productCompactMetricsRow}>
                <View style={styles.productCompactMetric}>
                  <Text style={styles.productCompactMetricLabel}>Camp.</Text>
                  <Text style={styles.productCompactMetricValue}>{Math.floor(totalQty)}</Text>
                </View>
                <View style={styles.productCompactMetric}>
                  <Text style={styles.productCompactMetricLabel}>Repart.</Text>
                  <Text
                    style={[
                      styles.productCompactMetricValue,
                      distributedQty > 0 && styles.productCompactMetricValueOk,
                    ]}
                  >
                    {hasDistributedInfo ? Math.floor(distributedQty) : '—'}
                  </Text>
                </View>
                <View style={styles.productCompactMetric}>
                  <Text style={styles.productCompactMetricLabel}>Pend.</Text>
                  <Text
                    style={[
                      styles.productCompactMetricValue,
                      pendingQty > 0 && styles.productCompactMetricValueWarn,
                    ]}
                  >
                    {hasDistributedInfo ? Math.floor(pendingQty) : '—'}
                  </Text>
                </View>
                <View style={styles.productCompactDivider} />
                <View style={styles.productCompactMetric}>
                  <Text style={styles.productCompactMetricLabel}>Stock disp.</Text>
                  <Text
                    style={[
                      styles.productCompactMetricValue,
                      (availableStock ?? 0) > 0
                        ? styles.productCompactMetricValueOk
                        : styles.productCompactMetricValueWarn,
                    ]}
                  >
                    {availableStock !== null ? Math.floor(availableStock) : '—'}
                  </Text>
                </View>
                {reservedStock > 0 && (
                  <View style={styles.productCompactMetric}>
                    <Text style={styles.productCompactMetricLabel}>Reserv.</Text>
                    <Text style={styles.productCompactMetricValueMuted}>
                      {Math.floor(reservedStock)}
                    </Text>
                  </View>
                )}
                {totalStock > 0 && (
                  <View style={styles.productCompactMetric}>
                    <Text style={styles.productCompactMetricLabel}>Total</Text>
                    <Text style={styles.productCompactMetricValueMuted}>
                      {Math.floor(totalStock)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Línea 3: precios */}
              <View style={styles.productCompactPricesRow}>
                <View style={styles.productCompactPriceChip}>
                  <Text style={styles.productCompactPriceLabel}>Costo</Text>
                  <Text style={styles.productCompactPriceValue}>{fmt(costCents)}</Text>
                </View>
                {displayPrices.map((p) => {
                  const lower = p.priceCents < costCents && costCents > 0;
                  return (
                    <View
                      key={p.profileId}
                      style={[
                        styles.productCompactPriceChip,
                        lower && styles.productCompactPriceChipWarn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.productCompactPriceLabel,
                          lower && styles.productCompactPriceLabelWarn,
                        ]}
                        numberOfLines={1}
                      >
                        {p.profileName}
                      </Text>
                      <Text
                        style={[
                          styles.productCompactPriceValue,
                          lower && styles.productCompactPriceValueWarn,
                        ]}
                      >
                        {fmt(p.priceCents)}
                        {lower ? ' ⚠️' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Línea 4: proveedor / compra (siempre visible) */}
              <View style={styles.productCompactSupplierRow}>
                <Text style={styles.productCompactSupplierIcon}>🏢</Text>
                <Text
                  style={[
                    styles.productCompactSupplierText,
                    !detail?.supplier &&
                      !product.purchase &&
                      styles.productCompactSupplierTextEmpty,
                  ]}
                  numberOfLines={1}
                >
                  {detail?.supplier
                    ? `${detail.supplier.name}${
                        detail.supplier.purchaseCode ? ` · ${detail.supplier.purchaseCode}` : ''
                      }`
                    : product.purchase?.code
                      ? `Compra: ${product.purchase.code}`
                      : 'Sin proveedor'}
                </Text>
              </View>
            </View>

            <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>
              {isExpanded ? '▾' : '▸'}
            </Text>
          </TouchableOpacity>

          {/* Action buttons */}
          <View style={styles.productCardActions}>
            <TouchableOpacity
              style={[styles.productActionButton, styles.productBannerButton]}
              onPress={() => handleShowBanner(product)}
            >
              <Text style={styles.productActionButtonText}>📸 Banner</Text>
            </TouchableOpacity>

            {hasPermission(PERMISSIONS.PHOTO_CAMPAIGNS.PRODUCTS.READ) && (
              <TouchableOpacity
                style={[styles.productActionButton, styles.productPhotosButton]}
                onPress={() => {
                  setPhotoManagerProduct({
                    productId: product.productId,
                    title,
                    sku,
                    catalogPhotoUrl,
                    fallbackImageUrl: imageUri,
                    existingReferenceUrls,
                  });
                  setPhotoManagerVisible(true);
                }}
              >
                <Text style={styles.productActionButtonText}>
                  🖼️ Fotos {photoCompletion}/{photoTotal}
                </Text>
              </TouchableOpacity>
            )}

            {(campaign!.status === CampaignStatus.DRAFT ||
              campaign!.status === CampaignStatus.ACTIVE) && (
              <TouchableOpacity
                style={[styles.productActionButton, styles.productDeleteButton]}
                onPress={() => handleDeleteProduct(product)}
              >
                <Text style={styles.productDeleteButtonText}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Expanded price details */}
          {isExpanded && (
            <View style={styles.priceDetailsContainer}>
              {/* Cost row */}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Costo:</Text>
                {editingCost?.productId === product.productId ? (
                  <View style={styles.priceEditRow}>
                    <Text style={styles.currencySymbol}>S/</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={editingCost.value}
                      onChangeText={(text) => setEditingCost({ ...editingCost, value: text })}
                      keyboardType="decimal-pad"
                      autoFocus
                      onSubmitEditing={() => handleSaveCost(product.productId)}
                    />
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleSaveCost(product.productId)}
                      disabled={savingPrice}
                    >
                      {savingPrice ? (
                        <ActivityIndicator size="small" color={theme.color.surface.base} />
                      ) : (
                        <Text style={styles.saveButtonText}>✔</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelEditButton}
                      onPress={() => setEditingCost(null)}
                    >
                      <Text style={styles.cancelEditButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.priceDisplayRow}>
                    <Text style={styles.priceValue}>S/ {(costCents / 100).toFixed(2)}</Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleStartEditCost(product.productId, costCents)}
                    >
                      <Text style={styles.editButtonText}>✏️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Sale prices for first 2 profiles */}
              {priceProfiles.slice(0, 2).map((profile) => {
                const salePriceCents = getSalePriceForProfile(product.productId, profile.id);
                const isEditingThisPrice =
                  editingPrice?.productId === product.productId &&
                  editingPrice?.profileId === profile.id;

                return (
                  <View key={profile.id} style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{profile.name}:</Text>
                    {isEditingThisPrice ? (
                      <View style={styles.priceEditRow}>
                        <Text style={styles.currencySymbol}>S/</Text>
                        <TextInput
                          style={styles.priceInput}
                          value={editingPrice.value}
                          onChangeText={(value) => setEditingPrice({ ...editingPrice, value })}
                          keyboardType="decimal-pad"
                          autoFocus
                        />
                        <TouchableOpacity
                          style={styles.savePriceIconButton}
                          onPress={() => handleSavePrice(product.productId, profile.id)}
                          disabled={savingPrice}
                        >
                          <Text style={styles.savePriceIcon}>{savingPrice ? '⏳' : '✔'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelPriceIconButton}
                          onPress={() => setEditingPrice(null)}
                        >
                          <Text style={styles.cancelPriceIcon}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.priceDisplayRow}>
                        <Text style={styles.priceValue}>{formatCurrency(salePriceCents)}</Text>
                        <TouchableOpacity
                          style={styles.editPriceIconButton}
                          onPress={() =>
                            handleStartEditPrice(product.productId, profile.id, salePriceCents)
                          }
                        >
                          <Text style={styles.editPriceIcon}>✏️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Calculate Franquicia button (only for Socia profile) */}
              {priceProfiles.some(
                (p) => p.code === 'SOCIA' || p.name.toLowerCase().includes('socia')
              ) && (
                <View style={styles.calculateFranquiciaContainer}>
                  <TouchableOpacity
                    style={styles.calculateFranquiciaButton}
                    onPress={() => handleCalculateFranquiciaFromSocia(product.productId)}
                    disabled={savingPrice}
                  >
                    <Text style={styles.calculateFranquiciaButtonText}>
                      🧮 Calcular Precio Franquicia (/1.15)
                    </Text>
                  </TouchableOpacity>
                  {calculatedFranquicia.has(product.productId) && (
                    <View style={styles.calculatedBadge}>
                      <Text style={styles.calculatedBadgeText}>✔ Calculado</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      );
    },
    [
      products,
      productsDetailMap,
      expandedProducts,
      isTablet,
      navigation,
      campaignId,
      handleOpenImageModal,
      priceProfiles,
      getSalePriceForProfile,
      toggleProductExpanded,
      handleShowBanner,
      campaign,
      handleDeleteProduct,
      editingCost,
      savingPrice,
      handleSaveCost,
      handleStartEditCost,
      editingPrice,
      handleSavePrice,
      handleStartEditPrice,
      formatCurrency,
      handleCalculateFranquiciaFromSocia,
      calculatedFranquicia,
      hasPermission,
    ]
  );

  const keyExtractor = useCallback((item: CampaignProduct) => item.id, []);

  // Calculate total estimated purchase based on filtered products
  const estimatedTotalPurchase = useMemo(() => {
    if (!filteredProducts || filteredProducts.length === 0) {
      return 0;
    }

    return filteredProducts.reduce((total, product) => {
      const detail = productsDetailMap[product.id];
      const productDetails = products[product.productId] || product.product;
      const costCents = detail?.costCents ?? productDetails?.costCents ?? 0;
      const quantity = detail
        ? parseFloat(detail.campaignQuantityBase || '0') || product.totalQuantityBase || 0
        : product.totalQuantityBase || 0;

      return total + costCents * quantity;
    }, 0);
  }, [filteredProducts, products, productsDetailMap]);

  // Encabezado de la lista de productos (título, buscador y filtros).
  // Se usa como `ListHeaderComponent` del FlatList virtualizado para que
  // el scroll en Android no se trabe montando todas las tarjetas a la vez.
  const renderProductsHeader = () => {
    if (!campaign) {
      return null;
    }

    return (
      <View style={styles.tabContent}>
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                Productos ({campaign.products?.length || 0})
              </Text>
              {/* Estimated Total Purchase in Header */}
              {campaign.products && campaign.products.length > 0 && (
                <View style={styles.estimatedTotalHeaderCard}>
                  <Text style={styles.estimatedTotalHeaderLabel}>≡ƒÆ░ Compra Total:</Text>
                  <Text style={styles.estimatedTotalHeaderValue}>
                    {formatCurrency(estimatedTotalPurchase)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerButtonsContainer}>
              {hasPermission(PERMISSIONS.PHOTO_CAMPAIGNS.READ) && (
                <TouchableOpacity
                  style={[styles.bulkButton, isTablet && styles.bulkButtonTablet]}
                  onPress={() => setShowLinkPhotoCampaignModal(true)}
                >
                  <Text style={[styles.bulkButtonText, isTablet && styles.bulkButtonTextTablet]}>
                    🖼️ Campaña de fotos
                  </Text>
                </TouchableOpacity>
              )}
              {(campaign.status === CampaignStatus.DRAFT ||
                campaign.status === CampaignStatus.ACTIVE) && (
                <>
                  <TouchableOpacity
                    style={[styles.bulkButton, isTablet && styles.bulkButtonTablet]}
                    onPress={() => setIsBulkDistributionModalVisible(true)}
                  >
                    <Text style={[styles.bulkButtonText, isTablet && styles.bulkButtonTextTablet]}>
                      📦 Masivo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addButton, isTablet && styles.addButtonTablet]}
                    onPress={() => navigation.navigate('AddCampaignProduct', { campaignId })}
                  >
                    <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                      + Agregar
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Search bar + supplier picker */}
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                placeholder="Buscar por nombre, SKU, cantidad o escanear código..."
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                blurOnSubmit={false}
                placeholderTextColor={theme.color.text.subtle}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => {
                    setSearchQuery('');
                    setGlobalSearchResults([]);
                    setShowGlobalSearchSuggestions(false);
                  }}
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {availableSuppliers.length > 0 && (
              <View
                style={[styles.supplierPickerWrap, isTablet && styles.supplierPickerWrapTablet]}
              >
                <Picker
                  selectedValue={supplierFilter}
                  onValueChange={(v) => setSupplierFilter(String(v))}
                  style={styles.supplierPicker}
                  mode="dropdown"
                  dropdownIconColor={theme.color.text.muted}
                >
                  <Picker.Item
                    label={`Todos los proveedores (${availableSuppliers.length})`}
                    value="all"
                  />
                  {availableSuppliers.map((s) => (
                    <Picker.Item key={s.key} label={s.label} value={s.key} />
                  ))}
                </Picker>
              </View>
            )}
          </View>

          {/* Distribution filter - Only show when there are products */}
          {campaign.products && campaign.products.length > 0 && (
            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Reparto:</Text>
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    distributionFilter === 'all' && styles.filterButtonActive,
                  ]}
                  onPress={() => setDistributionFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      distributionFilter === 'all' && styles.filterButtonTextActive,
                    ]}
                  >
                    Todos ({campaign.products.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    distributionFilter === 'generated' && styles.filterButtonActive,
                  ]}
                  onPress={() => setDistributionFilter('generated')}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      distributionFilter === 'generated' && styles.filterButtonTextActive,
                    ]}
                  >
                    ✔ Generado ({campaign.products.filter((p) => p.distributionGenerated).length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    distributionFilter === 'not-generated' && styles.filterButtonActive,
                  ]}
                  onPress={() => setDistributionFilter('not-generated')}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      distributionFilter === 'not-generated' && styles.filterButtonTextActive,
                    ]}
                  >
                    ✕ Sin generar (
                    {campaign.products.filter((p) => !p.distributionGenerated).length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Product status filter (preliminar / activo del producto subyacente) */}
          {campaign.products && campaign.products.length > 0 && (
            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Estado:</Text>
              <View style={styles.filterButtons}>
                {(
                  [
                    { key: 'all', label: 'Todos' },
                    { key: 'active', label: '✅ Activos' },
                    { key: 'preliminary', label: '⚠️ Preliminares' },
                  ] as const
                ).map((opt) => {
                  const count =
                    opt.key === 'all'
                      ? campaign.products!.length
                      : campaign.products!.filter((p) => {
                          const d = productsDetailMap[p.id];
                          const pd = p.product || products[p.productId];
                          const raw = (
                            d?.productStatus ||
                            (pd?.status as any) ||
                            p.productStatus ||
                            ''
                          )
                            .toString()
                            .toLowerCase();
                          const isPrel = raw === 'preliminary';
                          return opt.key === 'preliminary' ? isPrel : !isPrel;
                        }).length;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.filterButton,
                        productStatusFilter === opt.key && styles.filterButtonActive,
                      ]}
                      onPress={() => setProductStatusFilter(opt.key)}
                    >
                      <Text
                        style={[
                          styles.filterButtonText,
                          productStatusFilter === opt.key && styles.filterButtonTextActive,
                        ]}
                      >
                        {opt.label} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Mensaje vacío: solo cuando NO hay productos en campaña Y el usuario no está buscando.
              Si está buscando, dejamos que el buscador global muestre sugerencias debajo. */}
          {(!campaign.products || campaign.products.length === 0) && !searchQuery.trim() && (
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay productos agregados
            </Text>
          )}

          {/* Sin coincidencias al filtrar dentro de la campaña */}
          {filteredProducts.length === 0 &&
            searchQuery.trim() &&
            campaign.products &&
            campaign.products.length > 0 && (
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No se encontraron productos en la campaña que coincidan con "{searchQuery}"
              </Text>
            )}
        </View>
      </View>
    );
  };

  // Pie de la lista de productos: botón "cargar más", indicador de fin y
  // el buscador global con sugerencias. Se usa como `ListFooterComponent`.
  const renderProductsFooter = () => {
    if (!campaign) {
      return null;
    }

    return (
      <View style={styles.tabContent}>
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          {displayedItemsCount < filteredProducts.length && (
            <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
              <Text style={styles.loadMoreButtonText}>
                Cargar más productos ({displayedItemsCount} de {filteredProducts.length})
              </Text>
            </TouchableOpacity>
          )}
          {displayedItemsCount >= filteredProducts.length &&
            filteredProducts.length > ITEMS_PER_PAGE && (
              <View style={styles.endOfListContainer}>
                <Text style={styles.endOfListText}>
                  ✓ Mostrando todos los productos ({filteredProducts.length})
                </Text>
              </View>
            )}

          {/* Loading indicator for global search */}
          {searchQuery.trim() && isGlobalSearching && (
            <View style={styles.globalSearchLoading}>
              <ActivityIndicator size="small" color={theme.color.brand.primary} />
              <Text style={styles.globalSearchLoadingText}>Buscando en todos los productos...</Text>
            </View>
          )}

          {/* Global search suggestions - Always show when searching */}
          {searchQuery.trim() &&
            !isGlobalSearching &&
            showGlobalSearchSuggestions &&
            globalSearchResults.length > 0 && (
              <View style={styles.globalSearchContainer}>
                <Text style={styles.globalSearchTitle}>
                  ≡ƒÆí Productos disponibles para agregar ({globalSearchResults.length})
                </Text>
                <Text style={styles.globalSearchHint}>
                  Usa "Agregar Todo" para agregar con todo el stock o "Personalizado" para elegir la
                  cantidad
                </Text>
                <ScrollView style={styles.globalSearchList} nestedScrollEnabled>
                  {globalSearchResults.slice(0, 10).map((product) => {
                    const isPreliminary = (product.status as any) === 'preliminary';
                    const stockInfo = getProductStock(product);
                    const isAlreadyAdded = campaign.products?.some(
                      (p) => p.productId === product.id
                    );

                    return (
                      <View
                        key={product.id}
                        style={[
                          styles.globalSearchItem,
                          isPreliminary && styles.globalSearchItemPreliminary,
                          isAlreadyAdded && styles.globalSearchItemDisabled,
                        ]}
                      >
                        {/* Banner button - Left side */}
                        <TouchableOpacity
                          style={styles.globalSearchBannerButtonLeft}
                          onPress={() => handleOpenBannerFromSearch(product)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.globalSearchBannerButtonLeftText}>📋</Text>
                        </TouchableOpacity>

                        <SearchResultThumb
                          product={product}
                          style={styles.globalSearchImage}
                          placeholderStyle={styles.globalSearchImagePlaceholder}
                          placeholderTextStyle={styles.productImagePlaceholderText}
                        />

                        <View style={styles.globalSearchContent}>
                          <Text
                            style={[
                              styles.globalSearchItemTitle,
                              isAlreadyAdded && styles.globalSearchItemTitleDisabled,
                            ]}
                          >
                            {product.correlativeNumber && `#${product.correlativeNumber} | `}
                            {product.sku} - {product.title}
                            {isAlreadyAdded && ' (Ya agregado)'}
                          </Text>
                          {isPreliminary && (
                            <Text style={styles.globalSearchWarning}>
                              ⚠️ Producto por validar Ingreso
                            </Text>
                          )}
                          <View style={styles.globalSearchMeta}>
                            <View style={styles.stockInfoContainer}>
                              <Text
                                style={[
                                  styles.globalSearchStock,
                                  stockInfo.available > 0
                                    ? styles.stockAvailable
                                    : styles.stockUnavailable,
                                ]}
                              >
                                {isPreliminary ? '📦 Stock preliminar: ' : '✅ Disponible: '}
                                {stockInfo.available}
                              </Text>
                              {!isPreliminary && stockInfo.reserved > 0 && (
                                <Text style={styles.stockReserved}>
                                  ≡ƒöÆ Reservado: {stockInfo.reserved}
                                </Text>
                              )}
                              {!isPreliminary && stockInfo.total !== stockInfo.available && (
                                <Text style={styles.stockTotal}>≡ƒôè Total: {stockInfo.total}</Text>
                              )}
                            </View>
                            <Text style={styles.globalSearchStatus}>
                              {product.status === 'active' ? '✔ Activo' : 'ΓÜá Preliminar'}
                            </Text>
                          </View>
                        </View>
                        {!isAlreadyAdded && stockInfo.available > 0 && (
                          <View style={styles.globalSearchActions}>
                            <TouchableOpacity
                              style={styles.globalSearchActionButton}
                              onPress={() => handleQuickAddProduct(product)}
                              disabled={addingQuickProduct}
                            >
                              <Text style={styles.globalSearchActionButtonText}>+ Todo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.globalSearchActionButtonSecondary}
                              onPress={() => handleOpenCustomAddModal(product)}
                              disabled={addingQuickProduct}
                            >
                              <Text style={styles.globalSearchActionButtonSecondaryText}>
                                ⚙️ Personalizado
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.primary} />
          <Text style={styles.loadingText}>Cargando campaña...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return null;
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ΓåÉ Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>{campaign.code}</Text>
        </View>

        {/* Tabs */}
        {renderTabs}

        {/* Content */}
        {activeTab === 'products' ? (
          // Lista virtualizada: FlatList recicla las tarjetas fuera de
          // pantalla, evitando el lag de scroll en Android cuando hay
          // muchos productos (el ScrollView montaba todas a la vez).
          <FlatList
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
            data={paginatedProducts}
            keyExtractor={keyExtractor}
            renderItem={renderProductItem}
            // Pasamos ELEMENTOS (no referencias de función) para que el
            // encabezado se reconcilie en lugar de remontarse en cada render.
            // Si se pasa la función, su identidad cambia por render y FlatList
            // desmonta el TextInput de búsqueda, rompiendo el lector de barras
            // (pierde foco/valor y nunca dispara onSubmitEditing).
            ListHeaderComponent={renderProductsHeader()}
            ListFooterComponent={renderProductsFooter()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            removeClippedSubviews={Platform.OS !== 'web'}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={11}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'participants' && renderParticipants()}
          </ScrollView>
        )}

        {/* Action Buttons */}
        {campaign.status === CampaignStatus.DRAFT && (
          <View style={[styles.footer, isTablet && styles.footerTablet]}>
            <TouchableOpacity
              style={[styles.cancelCampaignButton, isTablet && styles.cancelCampaignButtonTablet]}
              onPress={handleCancel}
              disabled={actionLoading}
            >
              <Text
                style={[
                  styles.cancelCampaignButtonText,
                  isTablet && styles.cancelCampaignButtonTextTablet,
                ]}
              >
                Cancelar Campaña
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.activateButton, isTablet && styles.activateButtonTablet]}
              onPress={handleActivate}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={theme.color.surface.base} />
              ) : (
                <Text
                  style={[styles.activateButtonText, isTablet && styles.activateButtonTextTablet]}
                >
                  Activar Campaña
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {campaign.status === CampaignStatus.ACTIVE && (
          <View style={[styles.footer, isTablet && styles.footerTablet]}>
            <TouchableOpacity
              style={[styles.closeButton, isTablet && styles.closeButtonTablet]}
              onPress={handleClose}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={theme.color.surface.base} />
              ) : (
                <Text style={[styles.closeButtonText, isTablet && styles.closeButtonTextTablet]}>
                  Cerrar Campaña
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Banner Modal */}
        <CampaignProductBannerModal
          visible={showBannerModal}
          campaignProduct={selectedProduct}
          productDetails={
            selectedProduct ? selectedProduct.product || products[selectedProduct.productId] : null
          }
          onClose={handleCloseBanner}
          onRefresh={handleRefreshProductFromBanner}
          distributedQuantityBase={
            selectedProduct
              ? productsDetailMap[selectedProduct.id]?.distributedQuantityBase
                ? parseFloat(productsDetailMap[selectedProduct.id].distributedQuantityBase)
                : selectedProduct.distributionGenerated
                  ? selectedProduct.totalQuantityBase
                  : undefined
              : undefined
          }
          supplier={
            selectedProduct
              ? productsDetailMap[selectedProduct.id]?.supplier ||
                (selectedProduct.purchase
                  ? { name: '', purchaseCode: selectedProduct.purchase.code }
                  : null)
              : null
          }
          onViewDistributionsBySite={
            selectedProduct
              ? () => {
                  setDistributionsBySiteProduct(selectedProduct);
                }
              : undefined
          }
          onManagePhotos={
            selectedProduct ? () => handleOpenPhotoManagerFromBanner(selectedProduct) : undefined
          }
        />

        {/* Gestión de fotos del producto (referencia / diseño / precio) */}
        {photoManagerProduct && (
          <ProductPhotoManagerModal
            visible={photoManagerVisible}
            productId={photoManagerProduct.productId}
            productTitle={photoManagerProduct.title}
            productSku={photoManagerProduct.sku}
            catalogPhotoUrl={photoManagerProduct.catalogPhotoUrl}
            fallbackImageUrl={photoManagerProduct.fallbackImageUrl}
            existingReferenceUrls={photoManagerProduct.existingReferenceUrls}
            photoCampaignId={linkedPhotoCampaignId}
            onPhotosChanged={() => void refetchProductsDetail?.()}
            onClose={() => setPhotoManagerVisible(false)}
          />
        )}

        {/* Anexar campaña a una campaña de fotos */}
        <LinkPhotoCampaignModal
          visible={showLinkPhotoCampaignModal}
          campaignId={campaignId}
          campaignName={campaign?.name}
          onChanged={loadLinkedPhotoCampaign}
          onClose={() => setShowLinkPhotoCampaignModal(false)}
        />

        {/* Repartos por sede (modal con scroll) */}
        {distributionsBySiteProduct && (
          <ProductDistributionsBySiteModal
            visible={!!distributionsBySiteProduct}
            campaignId={campaignId}
            productId={distributionsBySiteProduct.productId}
            productTitle={
              productsDetailMap[distributionsBySiteProduct.id]?.title ||
              distributionsBySiteProduct.product?.title ||
              products[distributionsBySiteProduct.productId]?.title
            }
            productSku={
              productsDetailMap[distributionsBySiteProduct.id]?.sku ||
              distributionsBySiteProduct.product?.sku ||
              products[distributionsBySiteProduct.productId]?.sku
            }
            campaignQuantityBase={(() => {
              const d = productsDetailMap[distributionsBySiteProduct.id];
              return d
                ? parseFloat(d.campaignQuantityBase || '0') ||
                    distributionsBySiteProduct.totalQuantityBase
                : distributionsBySiteProduct.totalQuantityBase;
            })()}
            distributedQuantityBase={(() => {
              const d = productsDetailMap[distributionsBySiteProduct.id];
              if (d) {
                return parseFloat(d.distributedQuantityBase || '0');
              }
              return distributionsBySiteProduct.distributionGenerated
                ? distributionsBySiteProduct.totalQuantityBase
                : undefined;
            })()}
            onClose={() => setDistributionsBySiteProduct(null)}
          />
        )}

        {/* Bulk Update Modal */}
        <BulkUpdateModal
          visible={isBulkUpdateModalVisible}
          onClose={() => setIsBulkUpdateModalVisible(false)}
          onSuccess={loadCampaign}
          mode="campaign"
          campaignProducts={campaign?.products}
          productsMap={products}
        />

        {/* Bulk Distribution Modal */}
        <BulkDistributionModal
          visible={isBulkDistributionModalVisible}
          campaignId={campaignId}
          campaignCode={campaign?.code || ''}
          onClose={() => setIsBulkDistributionModalVisible(false)}
          onSuccess={() => {
            loadCampaign();
            setIsBulkDistributionModalVisible(false);
          }}
        />

        {/* Copy Participants Modal */}
        <CopyParticipantsModal
          visible={isCopyParticipantsModalVisible}
          currentCampaignId={campaignId}
          onClose={() => setIsCopyParticipantsModalVisible(false)}
          onSuccess={() => {
            loadCampaign();
            setIsCopyParticipantsModalVisible(false);
          }}
        />

        {/* Banner Modal from Global Search */}
        {showBannerModalFromSearch && selectedProductForBannerSearch && (
          <CampaignProductBannerModal
            visible={showBannerModalFromSearch}
            campaignProduct={selectedProductForBannerSearch}
            productDetails={productDetailsForBannerSearch}
            hideStockAndDistribution={true}
            onClose={() => {
              setShowBannerModalFromSearch(false);
              setSelectedProductForBannerSearch(null);
              setProductDetailsForBannerSearch(null);
            }}
            onRefresh={() => {
              // No need to refresh anything since product is not in campaign yet
              console.log('Banner modal closed from search, no refresh needed');
            }}
          />
        )}

        {/* Image Preview Modal */}
        <Modal
          visible={isImageModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseImageModal}
        >
          <View style={styles.imageModalContainer}>
            <TouchableOpacity
              style={styles.imageModalBackdrop}
              activeOpacity={1}
              onPress={handleCloseImageModal}
            >
              <View style={styles.imageModalContent}>
                {selectedImageUri && (
                  <Image
                    source={{ uri: selectedImageUri }}
                    style={styles.imageModalImage}
                    resizeMode="contain"
                  />
                )}
                <TouchableOpacity
                  style={styles.imageModalCloseButton}
                  onPress={handleCloseImageModal}
                >
                  <Text style={styles.imageModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Custom Add Product Modal */}
        <Modal
          visible={showCustomAddModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowCustomAddModal(false);
            setSelectedProductForCustomAdd(null);
            setCustomQuantity('');
          }}
        >
          <View style={styles.customAddModalContainer}>
            <TouchableOpacity
              style={styles.customAddModalBackdrop}
              activeOpacity={1}
              onPress={() => {
                setShowCustomAddModal(false);
                setSelectedProductForCustomAdd(null);
                setCustomQuantity('');
              }}
            />
            <View style={styles.customAddModalContent}>
              <View style={styles.customAddModalHeader}>
                <Text style={styles.customAddModalTitle}>Agregar Producto Personalizado</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCustomAddModal(false);
                    setSelectedProductForCustomAdd(null);
                    setCustomQuantity('');
                  }}
                >
                  <Text style={styles.customAddModalCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedProductForCustomAdd && (
                <>
                  <View style={styles.customAddModalProductInfo}>
                    <Text style={styles.customAddModalProductTitle}>
                      {selectedProductForCustomAdd.correlativeNumber &&
                        `#${selectedProductForCustomAdd.correlativeNumber} | `}
                      {selectedProductForCustomAdd.sku} - {selectedProductForCustomAdd.title}
                    </Text>
                    {selectedProductForCustomAdd.status === 'preliminary' && (
                      <Text style={styles.customAddModalWarning}>
                        ⚠️ Producto por validar Ingreso
                      </Text>
                    )}
                  </View>

                  <View style={styles.customAddModalStockInfo}>
                    <Text style={styles.customAddModalStockTitle}>Información de Stock:</Text>
                    {(() => {
                      const stockInfo = getProductStock(selectedProductForCustomAdd);
                      const isPreliminary = selectedProductForCustomAdd.status === 'preliminary';
                      return (
                        <>
                          <View style={styles.customAddModalStockRow}>
                            <Text style={styles.customAddModalStockLabel}>
                              {isPreliminary ? '📦 Stock preliminar:' : '✅ Disponible:'}
                            </Text>
                            <Text style={styles.customAddModalStockValue}>
                              {stockInfo.available}
                            </Text>
                          </View>
                          {!isPreliminary && stockInfo.reserved > 0 && (
                            <View style={styles.customAddModalStockRow}>
                              <Text style={styles.customAddModalStockLabel}>≡ƒöÆ Reservado:</Text>
                              <Text style={styles.customAddModalStockValue}>
                                {stockInfo.reserved}
                              </Text>
                            </View>
                          )}
                          {!isPreliminary && (
                            <View style={styles.customAddModalStockRow}>
                              <Text style={styles.customAddModalStockLabel}>≡ƒôè Total:</Text>
                              <Text style={styles.customAddModalStockValue}>{stockInfo.total}</Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>

                  <View style={styles.customAddModalQuantitySection}>
                    <Text style={styles.customAddModalQuantityLabel}>Cantidad a agregar:</Text>
                    <TextInput
                      style={styles.customAddModalQuantityInput}
                      value={customQuantity}
                      onChangeText={setCustomQuantity}
                      keyboardType="decimal-pad"
                      placeholder="Ingresa la cantidad"
                      autoFocus
                    />
                  </View>

                  <View style={styles.customAddModalActions}>
                    <TouchableOpacity
                      style={styles.customAddModalCancelButton}
                      onPress={() => {
                        setShowCustomAddModal(false);
                        setSelectedProductForCustomAdd(null);
                        setCustomQuantity('');
                      }}
                      disabled={addingQuickProduct}
                    >
                      <Text style={styles.customAddModalCancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.customAddModalConfirmButton}
                      onPress={handleCustomAddProduct}
                      disabled={addingQuickProduct}
                    >
                      {addingQuickProduct ? (
                        <ActivityIndicator color={theme.color.surface.base} />
                      ) : (
                        <Text style={styles.customAddModalConfirmButtonText}>Agregar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Floating Action Button (pestaña de productos) */}
        {activeTab === 'products' && campaign?.products && campaign.products.length > 0 && (
          <ProtectedFAB
            actions={[
              {
                icon: 'cash-outline',
                label: 'Precios',
                onPress: () => setIsBulkUpdateModalVisible(true),
                requiredPermissions: [
                  PERMISSIONS.PRODUCTS.PRICES_DOWNLOAD,
                  PERMISSIONS.PRODUCTS.PRICES_UPDATE,
                ],
                requireAll: false,
              },
              {
                icon: downloadingPhotosPdf ? 'hourglass-outline' : 'images-outline',
                label: 'Fotos PDF',
                onPress: () => {
                  if (downloadingPhotosPdf) return;
                  void handleDownloadPhotosPdf();
                },
                requiredPermissions: [PERMISSIONS.PRODUCTS.PRICES_DOWNLOAD],
              },
            ]}
          />
        )}
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.color.text.muted,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
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
      color: theme.color.brand.primary,
      fontWeight: '600',
    },
    backButtonTextTablet: {
      fontSize: 18,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    titleTablet: {
      fontSize: 32,
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabTablet: {
      paddingVertical: 16,
    },
    tabActive: {
      borderBottomColor: theme.color.brand.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.muted,
    },
    tabTextTablet: {
      fontSize: 16,
    },
    tabTextActive: {
      color: theme.color.brand.primary,
      fontWeight: '600',
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
    overviewContainer: {
      gap: 16,
    },
    tabContent: {
      gap: 16,
    },
    section: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 16,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTablet: {
      padding: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      flexWrap: 'wrap',
      gap: 12,
    },
    sectionHeaderLeft: {
      flex: 1,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 16,
    },
    sectionTitleTablet: {
      fontSize: 22,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.muted,
      minWidth: 120,
    },
    infoLabelTablet: {
      fontSize: 16,
      minWidth: 150,
    },
    infoValue: {
      fontSize: 14,
      color: theme.color.text.heading,
      flex: 1,
    },
    infoValueTablet: {
      fontSize: 16,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    statusBadgeTablet: {
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    statusTextTablet: {
      fontSize: 14,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.color.background.subtle,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    statCardTablet: {
      padding: 20,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.brand.primary,
      marginBottom: 4,
    },
    statValueTablet: {
      fontSize: 28,
    },
    statLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    statLabelTablet: {
      fontSize: 14,
    },
    notesText: {
      fontSize: 14,
      color: theme.color.text.muted,
      lineHeight: 20,
    },
    notesTextTablet: {
      fontSize: 16,
      lineHeight: 24,
    },
    headerButtonsContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    bulkButton: {
      backgroundColor: theme.color.icon.success,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    bulkButtonTablet: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    bulkButtonText: {
      color: theme.color.surface.base,
      fontSize: 12,
      fontWeight: '600',
    },
    bulkButtonTextTablet: {
      fontSize: 14,
    },
    addButton: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    addButtonTablet: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    addButtonText: {
      color: theme.color.surface.base,
      fontSize: 12,
      fontWeight: '600',
    },
    addButtonTextTablet: {
      fontSize: 14,
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.subtle,
      textAlign: 'center',
      paddingVertical: 20,
    },
    emptyTextTablet: {
      fontSize: 16,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    listItemTablet: {
      paddingVertical: 16,
    },
    listItemContent: {
      flex: 1,
    },
    listItemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    listItemTitleTablet: {
      fontSize: 18,
    },
    listItemSubtitle: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: 4,
    },
    listItemSubtitleTablet: {
      fontSize: 15,
    },
    listItemAmount: {
      fontSize: 14,
      color: theme.color.icon.success,
      fontWeight: '500',
    },
    listItemAmountTablet: {
      fontSize: 16,
    },
    participantCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      overflow: 'hidden',
    },
    participantCardTablet: {
      borderRadius: 12,
    },
    participantCardMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
    },
    participantHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
    },
    editParticipantButton: {
      backgroundColor: theme.color.icon.warning,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    editParticipantButtonTablet: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    editParticipantButtonText: {
      color: theme.color.surface.base,
      fontSize: 11,
      fontWeight: '600',
    },
    editParticipantButtonTextTablet: {
      fontSize: 13,
    },
    totalsContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: 6,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 13,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    totalLabelTablet: {
      fontSize: 15,
    },
    totalValuePurchase: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.icon.warning,
    },
    totalValueSale: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.icon.success,
    },
    totalValueMargin: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    totalValueExpected: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    totalValueTablet: {
      fontSize: 16,
    },
    marginValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    marginPercentage: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.brand.primary,
      opacity: 0.8,
    },
    marginPercentageTablet: {
      fontSize: 14,
    },
    summaryCard: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: theme.color.brand.primary,
    },
    summaryCardTablet: {
      padding: 24,
      marginBottom: 20,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 16,
      textAlign: 'center',
    },
    summaryTitleTablet: {
      fontSize: 22,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    summaryItem: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.color.surface.base,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '500',
      marginBottom: 6,
      textAlign: 'center',
    },
    summaryLabelTablet: {
      fontSize: 14,
    },
    summaryValuePurchase: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.icon.warning,
      textAlign: 'center',
    },
    summaryValueSale: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.icon.success,
      textAlign: 'center',
    },
    summaryValueMargin: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.brand.primary,
      textAlign: 'center',
    },
    summaryValueExpected: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.brand.accent,
      textAlign: 'center',
    },
    summaryValueTablet: {
      fontSize: 22,
    },
    summaryPercentage: {
      fontSize: 12,
      color: theme.color.brand.primary,
      fontWeight: '600',
      marginTop: 2,
    },
    summaryPercentageTablet: {
      fontSize: 14,
    },
    downloadGeneralReportButton: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    downloadGeneralReportButtonTablet: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      marginBottom: 20,
    },
    downloadGeneralReportButtonText: {
      color: theme.color.surface.base,
      fontSize: 14,
      fontWeight: '600',
    },
    downloadGeneralReportButtonTextTablet: {
      fontSize: 16,
    },
    downloadButtonDisabled: {
      opacity: 0.5,
    },
    quickPriceValue: {
      fontWeight: '700',
      color: theme.color.icon.success,
    },
    productBadges: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    badgeActive: {
      backgroundColor: theme.color.state.success.background,
    },
    badgePreliminary: {
      backgroundColor: theme.color.state.warning.background,
      borderWidth: 1,
      borderColor: theme.color.icon.warning,
    },
    badgeActivate: {
      backgroundColor: theme.color.icon.success,
      borderWidth: 1,
      borderColor: theme.color.text.success,
      minHeight: 22,
      justifyContent: 'center',
    },
    badgeGenerated: {
      backgroundColor: theme.color.brand.primarySoft,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    productTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    preliminaryIndicator: {
      backgroundColor: theme.color.state.warning.background,
      borderWidth: 1,
      borderColor: theme.color.icon.warning,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    preliminaryIndicatorText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.color.text.warning,
      letterSpacing: 0.5,
    },
    arrowIcon: {
      fontSize: 24,
      color: theme.color.border.default,
      fontWeight: 'bold',
    },
    arrowIconTablet: {
      fontSize: 32,
    },
    productCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      overflow: 'hidden',
    },
    // ============================================
    // Compact product card (new endpoint design)
    // ============================================
    productCardCompact: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      overflow: 'hidden',
    },
    productCardCompactMain: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 10,
      gap: 10,
    },
    productImageCompact: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: theme.color.surface.muted,
    },
    productImageCompactPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    productCompactContent: {
      flex: 1,
      gap: 6,
    },
    productCompactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    productCompactSku: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.muted,
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      letterSpacing: 0.3,
    },
    productCompactBarcode: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.color.text.success,
      backgroundColor: theme.color.state.success.background,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      letterSpacing: 0.3,
      maxWidth: 160,
    },
    productCompactTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      minWidth: 120,
    },
    productCompactTitleTablet: {
      fontSize: 15,
    },
    productCompactBadges: {
      flexDirection: 'row',
      gap: 4,
      flexShrink: 0,
    },
    badgeSmall: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeSmallText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.color.text.heading,
      letterSpacing: 0.2,
    },
    productCompactMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    productCompactMetric: {
      flexDirection: 'column',
    },
    productCompactDivider: {
      width: 1,
      height: 18,
      backgroundColor: theme.color.border.subtle,
    },
    productCompactMetricLabel: {
      fontSize: 9,
      fontWeight: '600',
      color: theme.color.text.subtle,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    productCompactMetricValue: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
      lineHeight: 16,
    },
    productCompactMetricValueOk: {
      color: theme.color.text.success,
    },
    productCompactMetricValueWarn: {
      color: theme.color.text.warning,
    },
    productCompactMetricValueMuted: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
      lineHeight: 16,
    },
    productCompactPricesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    productCompactPriceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.color.state.info.background,
      borderWidth: 1,
      borderColor: theme.color.state.info.background,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    productCompactPriceChipMuted: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    productCompactPriceChipWarn: {
      backgroundColor: theme.color.state.danger.background,
      borderColor: theme.color.state.danger.border,
    },
    productCompactPriceLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    productCompactPriceLabelWarn: {
      color: theme.color.state.danger.text,
    },
    productCompactPriceValue: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.state.info.text,
    },
    productCompactPriceValueWarn: {
      color: theme.color.state.danger.text,
    },
    productCompactSupplierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    productCompactSupplierIcon: {
      fontSize: 12,
    },
    productCompactSupplierText: {
      flex: 1,
      fontSize: 11,
      fontWeight: '500',
      color: theme.color.text.muted,
    },
    productCompactSupplierTextEmpty: {
      color: theme.color.border.default,
      fontStyle: 'italic',
    },
    productCardPreliminary: {
      backgroundColor: theme.color.state.warning.background,
      borderWidth: 2,
      borderColor: theme.color.icon.warning,
      borderLeftWidth: 4,
    },
    productCardTablet: {
      borderRadius: 12,
    },
    productCardMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    productImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: theme.color.surface.muted,
    },
    productImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    productImagePlaceholderText: {
      fontSize: 28,
    },
    productCardActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      backgroundColor: theme.color.background.subtle,
    },
    productActionButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    productBannerButton: {
      borderRightWidth: 1,
      borderRightColor: theme.color.border.subtle,
    },
    productPhotosButton: {
      borderRightWidth: 1,
      borderRightColor: theme.color.border.subtle,
    },
    productActionButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    productDeleteButton: {
      backgroundColor: theme.color.state.danger.background,
    },
    productDeleteButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.icon.danger,
    },
    productExpandButton: {
      borderRightWidth: 1,
      borderRightColor: theme.color.border.subtle,
    },
    priceDetailsContainer: {
      backgroundColor: theme.color.background.subtle,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    priceLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
      flex: 1,
    },
    priceDisplayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    priceValue: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    priceLowerThanCost: {
      color: theme.color.text.danger,
      backgroundColor: theme.color.state.danger.background,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    priceEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    currencySymbol: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    priceInput: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.brand.primary,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      minWidth: 80,
    },
    editButton: {
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    editButtonText: {
      fontSize: 14,
      color: theme.color.text.link,
    },
    saveButton: {
      backgroundColor: theme.color.icon.success,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      minWidth: 32,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.surface.base,
    },
    cancelEditButton: {
      backgroundColor: theme.color.icon.danger,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      minWidth: 32,
      alignItems: 'center',
    },
    cancelEditButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.surface.base,
    },
    calculateButton: {
      backgroundColor: theme.color.icon.warning,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginLeft: 4,
    },
    calculateButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    searchContainer: {
      marginBottom: 16,
      position: 'relative',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    searchInputWrap: {
      flex: 1,
      minWidth: 220,
      position: 'relative',
    },
    supplierPickerWrap: {
      minWidth: 220,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: 8,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    supplierPickerWrapTablet: {
      minWidth: 280,
    },
    supplierPicker: {
      height: 44,
      color: theme.color.text.heading,
    },
    searchInput: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.color.text.heading,
    },
    searchInputTablet: {
      fontSize: 16,
      paddingVertical: 12,
    },
    clearSearchButton: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: [{ translateY: -12 }],
      backgroundColor: theme.color.text.subtle,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearSearchText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.surface.base,
    },
    filterContainer: {
      marginBottom: 16,
    },
    filterLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: 8,
    },
    filterButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    filterButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      alignItems: 'center',
    },
    filterButtonActive: {
      backgroundColor: theme.color.icon.success,
      borderColor: theme.color.icon.success,
    },
    filterButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    filterButtonTextActive: {
      color: theme.color.surface.base,
    },
    estimatedTotalHeaderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.color.text.link,
    },
    estimatedTotalHeaderLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.state.info.text,
    },
    estimatedTotalHeaderValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.color.state.info.text,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    footerTablet: {
      padding: 24,
      gap: 16,
    },
    cancelCampaignButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.color.icon.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelCampaignButtonTablet: {
      paddingVertical: 16,
    },
    cancelCampaignButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.icon.danger,
    },
    cancelCampaignButtonTextTablet: {
      fontSize: 18,
    },
    activateButton: {
      flex: 1,
      backgroundColor: theme.color.icon.success,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activateButtonTablet: {
      paddingVertical: 16,
    },
    activateButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    activateButtonTextTablet: {
      fontSize: 18,
    },
    closeButton: {
      flex: 1,
      backgroundColor: theme.color.brand.primary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonTablet: {
      paddingVertical: 16,
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    closeButtonTextTablet: {
      fontSize: 18,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    copyButton: {
      backgroundColor: theme.color.icon.success,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    copyButtonTablet: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    copyButtonText: {
      color: theme.color.surface.base,
      fontSize: 12,
      fontWeight: '600',
    },
    copyButtonTextTablet: {
      fontSize: 14,
    },
    deleteAllButton: {
      backgroundColor: theme.color.icon.danger,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    deleteAllButtonTablet: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    deleteAllButtonText: {
      color: theme.color.surface.base,
      fontSize: 12,
      fontWeight: '600',
    },
    deleteAllButtonTextTablet: {
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 24,
      width: '100%',
      maxWidth: 500,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalContentTablet: {
      padding: 32,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 12,
    },
    modalTitleTablet: {
      fontSize: 24,
    },
    modalDescription: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: 20,
    },
    modalDescriptionTablet: {
      fontSize: 16,
    },
    pickerContainer: {
      backgroundColor: theme.color.background.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 24,
    },
    pickerContainerTablet: {
      borderRadius: 10,
    },
    picker: {
      height: 50,
      color: theme.color.text.heading,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      backgroundColor: theme.color.border.subtle,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalConfirmButton: {
      flex: 1,
      backgroundColor: theme.color.brand.primary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalButtonTablet: {
      paddingVertical: 16,
    },
    modalButtonDisabled: {
      opacity: 0.5,
    },
    modalCancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    modalConfirmButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    modalButtonTextTablet: {
      fontSize: 16,
    },

    imageModalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalBackdrop: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalContent: {
      width: '90%',
      height: '80%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalImage: {
      width: '100%',
      height: '100%',
    },
    imageModalCloseButton: {
      position: 'absolute',
      top: 20,
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    imageModalCloseText: {
      fontSize: 24,
      color: theme.color.surface.base,
      fontWeight: 'bold',
    },
    // Global search styles
    globalSearchLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      gap: 12,
    },
    globalSearchLoadingText: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    globalSearchContainer: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    globalSearchTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 8,
    },
    globalSearchHint: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: 12,
    },
    globalSearchList: {
      maxHeight: 400,
    },
    globalSearchItem: {
      flexDirection: 'row',
      padding: 12,
      backgroundColor: theme.color.surface.base,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      alignItems: 'center',
    },
    globalSearchItemPreliminary: {
      backgroundColor: theme.color.state.warning.background,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.icon.warning,
    },
    globalSearchItemDisabled: {
      backgroundColor: theme.color.surface.muted,
      opacity: 0.6,
    },
    globalSearchImage: {
      width: 50,
      height: 50,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: theme.color.surface.muted,
    },
    globalSearchImagePlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    globalSearchContent: {
      flex: 1,
    },
    globalSearchItemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    globalSearchItemTitleDisabled: {
      color: theme.color.text.subtle,
    },
    globalSearchWarning: {
      fontSize: 12,
      color: theme.color.icon.warning,
      fontWeight: '600',
      marginBottom: 4,
    },
    globalSearchMeta: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    globalSearchStock: {
      fontSize: 12,
      fontWeight: '600',
    },
    stockInfoContainer: {
      flexDirection: 'column',
      gap: 2,
    },
    stockReserved: {
      fontSize: 11,
      color: theme.color.icon.warning,
      fontWeight: '500',
    },
    stockTotal: {
      fontSize: 11,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    globalSearchStatus: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    globalSearchActions: {
      flexDirection: 'column',
      gap: 6,
      minWidth: 100,
    },
    globalSearchActionButton: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      alignItems: 'center',
    },
    globalSearchActionButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    globalSearchActionButtonSecondary: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.color.brand.primary,
      alignItems: 'center',
    },
    globalSearchActionButtonSecondaryText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    globalSearchBannerButtonLeft: {
      backgroundColor: theme.color.brand.accent,
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    globalSearchBannerButtonLeftText: {
      fontSize: 20,
    },
    stockAvailable: {
      color: theme.color.icon.success,
    },
    stockUnavailable: {
      color: theme.color.icon.danger,
    },
    editPriceIconButton: {
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    editPriceIcon: {
      fontSize: 14,
    },
    savePriceIconButton: {
      backgroundColor: theme.color.icon.success,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      minWidth: 32,
      alignItems: 'center',
    },
    savePriceIcon: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.surface.base,
    },
    cancelPriceIconButton: {
      backgroundColor: theme.color.icon.danger,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      minWidth: 32,
      alignItems: 'center',
    },
    cancelPriceIcon: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.surface.base,
    },
    calculateFranquiciaContainer: {
      marginTop: 8,
    },
    calculateFranquiciaButton: {
      backgroundColor: theme.color.icon.warning,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      alignItems: 'center',
    },
    calculateFranquiciaButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    calculatedBadge: {
      backgroundColor: theme.color.icon.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignItems: 'center',
      marginTop: 4,
    },
    calculatedBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    // Custom Add Modal Styles
    customAddModalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    customAddModalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    customAddModalContent: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      maxHeight: '80%',
    },
    customAddModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    customAddModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      flex: 1,
    },
    customAddModalCloseButton: {
      fontSize: 28,
      color: theme.color.text.muted,
      fontWeight: '300',
      paddingHorizontal: 8,
    },
    customAddModalProductInfo: {
      backgroundColor: theme.color.background.subtle,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    customAddModalProductTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    customAddModalWarning: {
      fontSize: 13,
      color: theme.color.icon.warning,
      fontWeight: '500',
      marginTop: 4,
    },
    customAddModalStockInfo: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    customAddModalStockTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 12,
    },
    customAddModalStockRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
    },
    customAddModalStockLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    customAddModalStockValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    customAddModalQuantitySection: {
      marginBottom: 24,
    },
    customAddModalQuantityLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 8,
    },
    customAddModalQuantityInput: {
      backgroundColor: theme.color.background.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
      color: theme.color.text.heading,
    },
    customAddModalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    customAddModalCancelButton: {
      flex: 1,
      backgroundColor: theme.color.surface.muted,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    customAddModalCancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    customAddModalConfirmButton: {
      flex: 1,
      backgroundColor: theme.color.brand.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    customAddModalConfirmButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    // Pagination styles
    loadMoreButton: {
      backgroundColor: theme.color.brand.primary,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 8,
      marginVertical: 16,
      marginHorizontal: 16,
      alignItems: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    loadMoreButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    loadingMoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      gap: 12,
    },
    loadingMoreText: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    endOfListContainer: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    endOfListText: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
  });
