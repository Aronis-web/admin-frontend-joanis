import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  TextInput,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { campaignsService, repartosService } from '@/services/api';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { productsApi, priceProfilesApi } from '@/services/api';
import { inventoryApi, StockItem } from '@/services/api/inventory';
import logger from '@/utils/logger';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusLabels,
  CampaignStatusColors,
  CampaignProduct,
  ProductSourceType,
  ProductStatus,
  DistributionType,
  AddProductRequest,
} from '@/types/campaigns';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { Product } from '@/services/api/products';
import { PriceProfile, ProductSalePrice } from '@/types/price-profiles';
import { ParticipantTotalsResponse } from '@/types/participant-totals';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { CampaignProductBannerModal } from '@/components/Campaigns/CampaignProductBannerModal';
import { BulkUpdateModal } from '@/components/Products/BulkUpdateModal';
import { AddButton } from '@/components/Navigation/AddButton';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

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

export const CampaignDetailScreen: React.FC<CampaignDetailScreenProps> = ({
  navigation,
  route,
}) => {
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
  const [participantTotals, setParticipantTotals] = useState<ParticipantTotalsResponse | null>(
    null
  );
  const [downloadingReport, setDownloadingReport] = useState(false);
  const { width, height } = useWindowDimensions();
  const hasLoadedRef = useRef(false);
  const [isBulkUpdateModalVisible, setIsBulkUpdateModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);

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

  const isTablet = width >= 768 || height >= 768;

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
      if (data.products && data.products.length > 0) {
        const productsMap: Record<string, Product> = {};

        logger.info(`📦 Total campaign products: ${data.products.length}`);

        // ✅ SIEMPRE usar batch endpoint para obtener fotos y datos completos
        // Los productos embebidos en la campaña NO tienen photoUrls ni stockItems completos
        const allProductIds = data.products
          .map((p) => p.productId)
          .filter((id, index, self) => self.indexOf(id) === index); // unique IDs

        if (allProductIds.length > 0) {
          try {
            logger.info(
              `🔍 Fetching ${allProductIds.length} products using V2 batch endpoint (with photos)`
            );

            // ✅ Usar getProductsByIds para traer productos con fotos
            const response = await (productsApi as any).getProductsByIds(
              allProductIds,
              true // includePhotos
            );

            // Agregar los productos obtenidos al mapa
            response.products.forEach((product: Product) => {
              productsMap[product.id] = product;
              logger.info(
                `✅ Fetched product: ${product.id} - ${product.title || product.sku}`
              );
            });

            // Verificar si faltó algún producto
            const fetchedIds = new Set(response.products.map((p: Product) => p.id));
            const notFoundIds = allProductIds.filter(id => !fetchedIds.has(id));
            if (notFoundIds.length > 0) {
              logger.warn(`⚠️ ${notFoundIds.length} products not found:`, notFoundIds);
            }

            logger.info(
              `✅ Successfully fetched ${response.products.length}/${allProductIds.length} products (cached: ${response.cached || false})`
            );
          } catch (error) {
            logger.error('Error loading products with batch endpoint:', error);

            // Fallback: Si falla V2 batch, usar productos embebidos
            logger.warn('⚠️ Fallback to embedded products');
            data.products.forEach((campaignProduct) => {
              if (campaignProduct.product) {
                productsMap[campaignProduct.productId] = campaignProduct.product as any;
              }
            });
          }
        }

        logger.info(`📋 Final products map size: ${Object.keys(productsMap).length}`);
        logger.info(`📋 Sample product from map:`, Object.values(productsMap)[0]);

        setProducts(productsMap);

        // OPTIMIZATION: Cargar precios de venta para todos los productos visibles
        // Esto permite mostrar los primeros 2 perfiles en la vista de lista
        // Se cargan en paralelo para mejor rendimiento
        // Solo se cargan para productos que existen en el catálogo (no preliminares)
        logger.debug('⚡ [PERF] Cargando precios de venta para productos visibles...');

        const productIds = data.products
          .filter(p => {
            // Solo cargar precios para productos que tienen datos embebidos o están en productsMap
            const productExists = p.product || productsMap[p.productId];
            const isPreliminary = productExists && (productExists as any).status === 'preliminary';
            return productExists && !isPreliminary;
          })
          .map(p => p.productId);

        if (productIds.length > 0) {
          const salePricesPromises = productIds.map(productId =>
            priceProfilesApi.getProductSalePrices(productId)
              .then((response) => {
                const salePricesArray = (response as any).salePrices || response.data || [];
                return { productId, salePrices: salePricesArray };
              })
              .catch((error) => {
                logger.debug(`⚠️ [PERF] No se pudieron cargar precios para producto ${productId} (puede ser preliminar o no existir)`);
                return { productId, salePrices: [] };
              })
          );

          Promise.all(salePricesPromises).then((results) => {
            const salePricesMap: Record<string, any[]> = {};
            results.forEach(({ productId, salePrices }) => {
              salePricesMap[productId] = salePrices;
            });
            setProductSalePrices(salePricesMap);
            logger.debug(`✅ [PERF] Precios de venta cargados para ${Object.keys(salePricesMap).length} productos`);
          });
        } else {
          logger.debug('⚠️ [PERF] No hay productos válidos para cargar precios');
        }
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

      logger.debug('🔄 [CAMPAIGN] useFocusEffect triggered:', {
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
        campaignsService.getProduct(campaignId, updatedProductId)
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
        logger.debug('🔄 [CAMPAIGN] Reloading due to shouldReload/forceReload param');
        navigation.setParams({ shouldReload: undefined, forceReload: undefined, timestamp: undefined } as any);
        hasLoadedRef.current = true;
        loadCampaign();
      } else if (skipReloadOnce) {
        // Skip reload this time (coming back from product detail)
        logger.debug('⏭️ [CAMPAIGN] Skipping reload due to skipReloadOnce param');
        navigation.setParams({ skipReloadOnce: undefined } as any);
        // Don't reload, just mark as loaded
        hasLoadedRef.current = true;
      } else if (!hasLoadedRef.current) {
        // Only load on first mount, not on every focus
        logger.debug('📥 [CAMPAIGN] Loading campaign (first time)');
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
    }, [loadCampaign, route.params?.shouldReload, route.params?.skipReloadOnce, route.params?.updatedProductId, navigation, campaignId])
  );

  // Load stock items on mount for quick add functionality
  React.useEffect(() => {
    loadStockItems();
  }, []);

  // Load stock items for quick add functionality
  const loadStockItems = useCallback(async () => {
    try {
      const stockResponse = await inventoryApi.getAllStock({});
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
    } catch (error) {
      console.error('Error loading stock:', error);
      setStockItems([]);
    }
  }, []);

  // Get product stock from search results (backend now returns stock structure)
  const getProductStock = useCallback((product: any): { available: number; reserved: number; total: number } => {
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
  }, [stockItems]);

  // Global search for products not in campaign
  const searchGlobalProducts = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setGlobalSearchResults([]);
      setShowGlobalSearchSuggestions(false);
      return;
    }

    try {
      setIsGlobalSearching(true);
      console.log('🔍 Global search:', query);

      try {
        const response = await productsApi.searchProductsV2({
          q: query.trim(),
          limit: 20,
          status: 'active,preliminary',
          includePhotos: true,
        });

        console.log('🔍 Search results:', response.results.length, 'products found');
        console.log('⚡ Search time:', response.searchTime, 'ms');
        console.log('💾 Cached:', response.cached);

        // Log product statuses for debugging
        const statusCounts = response.results.reduce((acc: any, p: any) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {});
        console.log('📊 Products by status:', statusCounts);
        console.log('📦 Sample products:', response.results.slice(0, 5).map((p: any) => ({
          id: p.id,
          sku: p.sku,
          title: p.title,
          status: p.status,
        })));

        setGlobalSearchResults(response.results);
        setShowGlobalSearchSuggestions(response.results.length > 0);
      } catch (v2Error) {
        console.warn('⚠️ V2 endpoint failed, falling back to v1:', v2Error);
        const response = await productsApi.getProducts({
          q: query.trim(),
          limit: 20,
        });
        console.log('🔍 Search results (v1):', response.products.length, 'products found');
        setGlobalSearchResults(response.products);
        setShowGlobalSearchSuggestions(response.products.length > 0);
      }
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsGlobalSearching(false);
    }
  }, []);

  // Handle search query change with debounce
  const handleSearchQueryChange = useCallback((text: string) => {
    setSearchQuery(text);

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
  }, [searchTimeout, searchGlobalProducts]);

  // Quick add product with available stock
  const handleQuickAddProduct = useCallback(async (product: any) => {
    if (!campaign) return;

    const stockInfo = getProductStock(product);

    if (stockInfo.available <= 0) {
      Alert.alert('Sin stock', 'Este producto no tiene stock disponible');
      return;
    }

    setAddingQuickProduct(true);
    try {
      const actualProductStatus =
        product.status === 'preliminary'
          ? ProductStatus.PRELIMINARY
          : ProductStatus.ACTIVE;

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
  }, [campaign, campaignId, getProductStock, loadCampaign]);

  // Open custom add modal
  const handleOpenCustomAddModal = useCallback((product: any) => {
    const stockInfo = getProductStock(product);
    setSelectedProductForCustomAdd(product);
    setCustomQuantity(stockInfo.available.toString());
    setShowCustomAddModal(true);
  }, [getProductStock]);

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
      Alert.alert('Error', `La cantidad no puede ser mayor al stock disponible (${stockInfo.available})`);
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
  }, [campaign, campaignId, selectedProductForCustomAdd, customQuantity, getProductStock, loadCampaign]);

  const handleRefresh = () => {
    setRefreshing(true);
    hasLoadedRef.current = true; // Mark as loaded to prevent duplicate loads
    loadCampaign();
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

  const getStatusBadgeStyle = useCallback(
    (status: CampaignStatus) => {
      return {
        backgroundColor: CampaignStatusColors[status] + '20',
        borderColor: CampaignStatusColors[status],
      };
    },
    []
  );

  const getStatusTextStyle = useCallback(
    (status: CampaignStatus) => {
      return {
        color: CampaignStatusColors[status],
      };
    },
    []
  );

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

  // Early returns for loading and null campaign
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando campaña...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return null;
  }

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

      logger.info('🔄 Descargando reporte general de totales de participantes...');
      const startTime = new Date().getTime();

      // Call the campaigns API to get the participant totals PDF (uses VALIDATED quantities)
      const pdfBlob = await campaignsService.exportParticipantTotalsPdf(campaignId);

      const endTime = new Date().getTime();
      logger.info('✅ PDF descargado del servidor');
      logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
      logger.info('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `reporte-totales-participantes-${campaign?.code || campaignId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', 'El reporte se está descargando');
      } else {
        // For mobile (iOS/Android), save to file system and share
        const timestamp = new Date().getTime();
        const fileName = `reporte-totales-participantes-${timestamp}.pdf`;
        const file = new FileSystem.File(FileSystem.Paths.document, fileName);

        // Convert blob to array buffer using FileReader
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(pdfBlob);
        });

        // Write to file
        await file.create();
        const writer = file.writableStream().getWriter();
        await writer.write(new Uint8Array(arrayBuffer));
        await writer.close();

        // Share the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Reporte de Totales de Participantes',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${file.uri}`);
        }
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

  const handleCopyParticipantsFromCampaign = useCallback(async (sourceCampaign: Campaign) => {
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
  }, [campaignId, loadCampaign]);

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
      logger.info('📥 Cargando participantes de la campaña:', latestCampaign.code);
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
                <TouchableOpacity
                  style={[styles.copyButton, isTablet && styles.copyButtonTablet]}
                  onPress={handleOpenCopyParticipantsModal}
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
          {campaign.participants && campaign.participants.length > 0 && !permissionsLoading && hasPermission(PERMISSIONS.REPARTOS.REPORTS) && (
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
                {downloadingReport ? '📄 Generando...' : '📄 Descargar Reporte General de Totales de Participantes'}
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
                  nameA = a.company?.alias || a.company?.name || companies[a.companyId!]?.alias || companies[a.companyId!]?.name || '';
                  nameB = b.company?.alias || b.company?.name || companies[b.companyId!]?.alias || companies[b.companyId!]?.name || '';
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
                            <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
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
                            <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
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
                            <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
                              Venta:
                            </Text>
                            <Text
                              style={[styles.totalValueSale, isTablet && styles.totalValueTablet]}
                            >
                              {formatCurrency(participantTotal.totalSaleCents)}
                            </Text>
                          </View>
                          <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
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
                    <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
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

  const handleDeleteProduct = useCallback(async (product: CampaignProduct) => {
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
  }, [campaignId]);

  const handleShowBanner = useCallback((product: CampaignProduct) => {
    setSelectedProduct(product);
    setShowBannerModal(true);
  }, []);

  const handleCloseBanner = useCallback(() => {
    setShowBannerModal(false);
    setSelectedProduct(null);
    // No need to reload campaign - the modal updates its own state locally
  }, []);

  const handleRefreshProductFromBanner = useCallback(async (updatedProductParam?: CampaignProduct) => {
    if (!selectedProduct) {
      return;
    }

    logger.debug('🔄 [BANNER] Actualizando producto específico:', selectedProduct.id);

    try {
      // Use provided updated product or fetch it
      let updatedProduct: CampaignProduct;

      if (updatedProductParam) {
        logger.debug('✅ [BANNER] Usando producto actualizado proporcionado');
        updatedProduct = updatedProductParam;
      } else {
        logger.debug('🔄 [BANNER] Obteniendo producto actualizado del servidor');
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
          products: prev.products.map((p) =>
            p.id === updatedProduct.id ? updatedProduct : p
          ),
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
  }, [selectedProduct, campaignId, loadCampaign]);

  const toggleProductExpanded = useCallback(async (productId: string) => {
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
          const isPreliminary = productDetails && (productDetails as any).status === 'preliminary';

          if (productDetails && !isPreliminary) {
            logger.debug('⚡ [PERF] Cargando precios para producto expandido:', productId);

            // Cargar precios en background
            priceProfilesApi.getProductSalePrices(productId)
              .then((response) => {
                const salePricesArray = (response as any).salePrices || response.data || [];

                setProductSalePrices((prevPrices) => ({
                  ...prevPrices,
                  [productId]: salePricesArray,
                }));

                logger.debug('✅ [PERF] Precios cargados para producto:', productId);
              })
              .catch((error) => {
                logger.debug('⚠️ [PERF] No se pudieron cargar precios para producto (puede ser preliminar o no existir)');
              });
          } else {
            logger.debug('⚠️ [PERF] Producto preliminar o no existe, no se cargan precios');
          }
        }
      }
      return newSet;
    });
  }, [productSalePrices, products]);

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

  const handleSaveCost = useCallback(async (productId: string) => {
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
  }, [editingCost]);

  const handleSavePrice = useCallback(async (productId: string, profileId: string) => {
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
  }, [editingPrice]);

  const getSalePriceForProfile = useCallback((productId: string, profileId: string): number => {
    const prices = productSalePrices[productId] || [];
    const priceEntry = prices.find((p) => p.profileId === profileId && p.presentationId === null);
    return priceEntry?.priceCents || 0;
  }, [productSalePrices]);

  const handleCalculateFranquiciaFromSocia = useCallback(async (productId: string) => {
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
  }, [priceProfiles, getSalePriceForProfile]);

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

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((product) => {
        const productDetails = product.product || products[product.productId];
        const title = productDetails?.title?.toLowerCase() || '';
        const sku = productDetails?.sku?.toLowerCase() || '';
        const quantity = product.totalQuantityBase.toString();

        return title.includes(query) || sku.includes(query) || quantity.includes(query);
      });
    }

    return filtered;
  }, [campaign?.products, products, searchQuery, distributionFilter]);

  // Calculate total estimated purchase based on filtered products
  const estimatedTotalPurchase = useMemo(() => {
    if (!filteredProducts || filteredProducts.length === 0) {
      return 0;
    }

    return filteredProducts.reduce((total, product) => {
      const productDetails = products[product.productId] || product.product;
      const costCents = productDetails?.costCents || 0;
      const quantity = product.totalQuantityBase || 0;

      return total + (costCents * quantity);
    }, 0);
  }, [filteredProducts, products]);

  // Render individual product item for FlatList
  const renderProductItem = useCallback(({ item: product }: { item: CampaignProduct }) => {
    // ✅ PRIORIZAR batch endpoint sobre producto embebido (batch tiene photoUrls)
    const productDetails = products[product.productId] || product.product;
    const costCents = productDetails?.costCents || 0;
    const isExpanded = expandedProducts.has(product.id);
    // Resaltar productos cuyo estado del producto es 'preliminary' (no validado aún)
    const isPreliminary = (productDetails?.status as any) === 'preliminary';

    return (
      <View
        style={[
          styles.productCard,
          isTablet && styles.productCardTablet,
          isPreliminary && styles.productCardPreliminary,
        ]}
      >
        <TouchableOpacity
          style={styles.productCardMain}
          onPress={() =>
            navigation.navigate('CampaignProductDetail', {
              campaignId,
              productId: product.id,
              fromCampaignDetail: true,
            })
          }
        >
          {/* Product content - keeping existing code */}
          {(() => {
            const batchProduct = products[product.productId];
            const embeddedProduct = product.product;

            logger.debug(`📸 Image data for ${product.productId}:`, {
              hasBatchProduct: !!batchProduct,
              hasEmbeddedProduct: !!embeddedProduct,
              batchPhotoUrls: (batchProduct as any)?.photoUrls,
              embeddedPhotoUrls: (embeddedProduct as any)?.photoUrls,
              productDetailsSource: productDetails === batchProduct ? 'batch' : 'embedded',
            });

            const imageUri =
              (productDetails as any)?.photoUrls?.[0] ||
              (productDetails as any)?.photos?.[0] ||
              (productDetails as any)?.imageUrl ||
              (productDetails as any)?.imageUrls?.[0];

            logger.debug(`📸 Final imageUri for ${product.productId}:`, imageUri);

            return imageUri ? (
              <TouchableOpacity
                onPress={() => handleOpenImageModal(imageUri)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.productImagePlaceholderText}>📦</Text>
              </View>
            );
          })()}

          <View style={styles.listItemContent}>
            <View style={styles.productTitleRow}>
              <Text
                style={[styles.listItemTitle, isTablet && styles.listItemTitleTablet]}
              >
                {productDetails?.title || `Producto ID: ${product.productId}`}
              </Text>
              {isPreliminary && (
                <View style={styles.preliminaryIndicator}>
                  <Text style={styles.preliminaryIndicatorText}>⚠️ PRELIMINAR</Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.listItemSubtitle, isTablet && styles.listItemSubtitleTablet]}
            >
              SKU: {productDetails?.sku || 'N/A'} |{' '}
              {(() => {
                // Calcular cantidad repartida desde customDistributions.items.assignedQuantityBase
                const distributedQty = product.customDistributions?.[0]?.items?.reduce(
                  (sum: number, item: any) => sum + parseFloat(item.assignedQuantityBase || '0'),
                  0
                );

                // Si tiene distribución generada, mostrar cantidad repartida
                if (product.distributionGenerated && distributedQty) {
                  return (
                    <>
                      Repartido:{' '}
                      <Text style={styles.quickPriceValue}>
                        {Math.floor(distributedQty)}
                      </Text>{' '}
                      ✓
                    </>
                  );
                }
                return <>Cant: {product.totalQuantityBase}</>;
              })()}{' '}
              | Costo:{' '}
              <Text style={styles.quickPriceValue}>
                S/ {(costCents / 100).toFixed(2)}
              </Text>
              {priceProfiles.slice(0, 2).map((profile, index) => {
                const priceCents = getSalePriceForProfile(product.productId, profile.id);
                const isPriceLowerThanCost = priceCents < costCents;
                return (
                  <Text key={profile.id}>
                    {' | '}
                    {profile.name}:{' '}
                    <Text style={[
                      styles.quickPriceValue,
                      isPriceLowerThanCost && styles.priceLowerThanCost
                    ]}>
                      S/ {(priceCents / 100).toFixed(2)}
                      {isPriceLowerThanCost && ' ⚠️'}
                    </Text>
                  </Text>
                );
              })}
              {priceProfiles.length > 2 && <Text> (+{priceProfiles.length - 2})</Text>}
            </Text>

            <View style={styles.productBadges}>
              <View
                style={[
                  styles.badge,
                  product.productStatus === 'ACTIVE'
                    ? styles.badgeActive
                    : styles.badgePreliminary,
                ]}
              >
                <Text style={styles.badgeText}>
                  {product.productStatus === 'ACTIVE' ? 'Activo' : 'Preliminar'}
                </Text>
              </View>
              {product.distributionGenerated && (
                <View style={[styles.badge, styles.badgeGenerated]}>
                  <Text style={styles.badgeText}>Generado</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>

        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.productCardActions}>
          <TouchableOpacity
            style={[styles.productActionButton, styles.productExpandButton]}
            onPress={() => toggleProductExpanded(product.id)}
          >
            <Text style={styles.productActionButtonText}>
              {isExpanded ? '▼ Ocultar Precios' : '▶ Ver Precios'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.productActionButton, styles.productBannerButton]}
            onPress={() => handleShowBanner(product)}
          >
            <Text style={styles.productActionButtonText}>📊 Banner</Text>
          </TouchableOpacity>

          {(campaign.status === CampaignStatus.DRAFT ||
            campaign.status === CampaignStatus.ACTIVE) && (
            <TouchableOpacity
              style={[styles.productActionButton, styles.productDeleteButton]}
              onPress={() => handleDeleteProduct(product)}
            >
              <Text style={styles.productDeleteButtonText}>🗑️</Text>
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
                    onChangeText={(text) =>
                      setEditingCost({ ...editingCost, value: text })
                    }
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
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>✓</Text>
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
                        onChangeText={(value) =>
                          setEditingPrice({ ...editingPrice, value })
                        }
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.savePriceIconButton}
                        onPress={() => handleSavePrice(product.productId, profile.id)}
                        disabled={savingPrice}
                      >
                        <Text style={styles.savePriceIcon}>
                          {savingPrice ? '⏳' : '✓'}
                        </Text>
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
                      <Text style={styles.priceValue}>
                        {formatCurrency(salePriceCents)}
                      </Text>
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
                    <Text style={styles.calculatedBadgeText}>✓ Calculado</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  }, [
    products,
    expandedProducts,
    isTablet,
    navigation,
    campaignId,
    priceProfiles,
    getSalePriceForProfile,
    editingCost,
    editingPrice,
    savingPrice,
    calculatedFranquicia,
    toggleProductExpanded,
    handleShowBanner,
    handleDeleteProduct,
    handleSaveCost,
    handleStartEditCost,
    handleSavePrice,
    handleStartEditPrice,
    handleCalculateFranquiciaFromSocia,
    formatCurrency,
    handleOpenImageModal,
    campaign,
    setEditingCost,
    setEditingPrice,
  ]);

  // Header component for products FlatList
  const renderProductsListHeader = useCallback(() => {
    if (!campaign) return null;

    return (
      <>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Productos ({campaign.products?.length || 0})
            </Text>
            {/* Estimated Total Purchase in Header */}
            {campaign.products && campaign.products.length > 0 && (
              <View style={styles.estimatedTotalHeaderCard}>
                <Text style={styles.estimatedTotalHeaderLabel}>💰 Compra Total:</Text>
                <Text style={styles.estimatedTotalHeaderValue}>
                  {formatCurrency(estimatedTotalPurchase)}
                </Text>
              </View>
            )}
          </View>
          {(campaign.status === CampaignStatus.DRAFT ||
            campaign.status === CampaignStatus.ACTIVE) && (
            <TouchableOpacity
              style={[styles.addButton, isTablet && styles.addButtonTablet]}
              onPress={() => navigation.navigate('AddCampaignProduct', { campaignId })}
            >
              <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                + Agregar
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search bar */}
        {campaign.products && campaign.products.length > 0 && (
          <>
            <View style={styles.searchContainer}>
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                placeholder="Buscar por nombre, SKU o cantidad..."
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                placeholderTextColor="#94A3B8"
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

            {/* Distribution filter */}
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
                    ✓ Generado ({campaign.products.filter((p) => p.distributionGenerated).length})
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
          </>
        )}

        {filteredProducts.length === 0 && searchQuery.trim() && (
          <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
            No se encontraron productos en la campaña que coincidan con "{searchQuery}"
          </Text>
        )}
      </>
    );
  }, [
    campaign,
    isTablet,
    estimatedTotalPurchase,
    formatCurrency,
    navigation,
    campaignId,
    searchQuery,
    handleSearchQueryChange,
    setSearchQuery,
    setGlobalSearchResults,
    setShowGlobalSearchSuggestions,
    distributionFilter,
    setDistributionFilter,
    filteredProducts,
    isGlobalSearching,
    showGlobalSearchSuggestions,
    globalSearchResults,
    getProductStock,
    handleQuickAddProduct,
    addingQuickProduct,
    handleOpenCustomAddModal,
  ]);

  const renderProducts = () => {
    if (!campaign) {
      return null;
    }

    if (!campaign.products || campaign.products.length === 0) {
      return (
        <View style={styles.tabContent}>
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            {renderProductsListHeader()}
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay productos agregados
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderProductsListHeader}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={5}
          />
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>{campaign.code}</Text>
        </View>

        {/* Tabs */}
        {renderTabs}

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          removeClippedSubviews={true}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'participants' && renderParticipants()}
          {activeTab === 'products' && renderProducts()}
        </ScrollView>

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
                <ActivityIndicator color="#FFFFFF" />
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
                <ActivityIndicator color="#FFFFFF" />
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
          onOpenDistribution={
            selectedProduct
              ? () => {
                  // Navigate to product detail and auto-open distribution
                  handleCloseBanner();
                  setTimeout(() => {
                    navigation.navigate('CampaignProductDetail', {
                      campaignId,
                      productId: selectedProduct.id,
                      fromCampaignDetail: true,
                      openDistributionModal: true,
                    });
                  }, 100);
                }
              : undefined
          }
        />

        {/* Bulk Update Modal */}
        <BulkUpdateModal
          visible={isBulkUpdateModalVisible}
          onClose={() => setIsBulkUpdateModalVisible(false)}
          onSuccess={loadCampaign}
          mode="campaign"
          campaignProducts={campaign?.products}
          productsMap={products}
        />

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
                      {selectedProductForCustomAdd.correlativeNumber && `#${selectedProductForCustomAdd.correlativeNumber} | `}
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
                            <Text style={styles.customAddModalStockValue}>{stockInfo.available}</Text>
                          </View>
                          {!isPreliminary && stockInfo.reserved > 0 && (
                            <View style={styles.customAddModalStockRow}>
                              <Text style={styles.customAddModalStockLabel}>🔒 Reservado:</Text>
                              <Text style={styles.customAddModalStockValue}>{stockInfo.reserved}</Text>
                            </View>
                          )}
                          {!isPreliminary && (
                            <View style={styles.customAddModalStockRow}>
                              <Text style={styles.customAddModalStockLabel}>📊 Total:</Text>
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
                        <ActivityIndicator color="#FFFFFF" />
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

        {/* Floating Action Button for Bulk Update */}
        {activeTab === 'products' && campaign?.products && campaign.products.length > 0 && (
          <View style={styles.floatingButtonContainer} pointerEvents="box-none">
            <ProtectedElement
              requiredPermissions={[PERMISSIONS.PRODUCTS.PRICES_DOWNLOAD, PERMISSIONS.PRODUCTS.PRICES_UPDATE]}
              requireAll={false}
              fallback={null}
            >
              <AddButton
                onPress={() => setIsBulkUpdateModalVisible(true)}
                icon="💵"
                label="Precios"
              />
            </ProtectedElement>
          </View>
        )}
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    borderBottomColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextTablet: {
    fontSize: 16,
  },
  tabTextActive: {
    color: '#6366F1',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
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
    color: '#1E293B',
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
    color: '#64748B',
    minWidth: 120,
  },
  infoLabelTablet: {
    fontSize: 16,
    minWidth: 150,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
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
    backgroundColor: '#F8FAFC',
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
    color: '#6366F1',
    marginBottom: 4,
  },
  statValueTablet: {
    fontSize: 28,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  statLabelTablet: {
    fontSize: 14,
  },
  notesText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  notesTextTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  addButtonTextTablet: {
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
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
    borderBottomColor: '#E2E8F0',
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
    color: '#1E293B',
    marginBottom: 4,
  },
  listItemTitleTablet: {
    fontSize: 18,
  },
  listItemSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  listItemSubtitleTablet: {
    fontSize: 15,
  },
  listItemAmount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  listItemAmountTablet: {
    fontSize: 16,
  },
  participantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F59E0B',
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
    color: '#FFFFFF',
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
    borderTopColor: '#E2E8F0',
    gap: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  totalLabelTablet: {
    fontSize: 15,
  },
  totalValuePurchase: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  totalValueSale: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  totalValueMargin: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  totalValueExpected: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
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
    color: '#6366F1',
    opacity: 0.8,
  },
  marginPercentageTablet: {
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  summaryCardTablet: {
    padding: 24,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
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
    color: '#F59E0B',
    textAlign: 'center',
  },
  summaryValueSale: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  summaryValueMargin: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
    textAlign: 'center',
  },
  summaryValueExpected: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
    textAlign: 'center',
  },
  summaryValueTablet: {
    fontSize: 22,
  },
  summaryPercentage: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    marginTop: 2,
  },
  summaryPercentageTablet: {
    fontSize: 14,
  },
  downloadGeneralReportButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
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
    color: '#FFFFFF',
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
    color: '#10B981',
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
    backgroundColor: '#10B98120',
  },
  badgePreliminary: {
    backgroundColor: '#F59E0B40',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  badgeGenerated: {
    backgroundColor: '#6366F120',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  preliminaryIndicator: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  preliminaryIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#CBD5E1',
    fontWeight: 'bold',
  },
  arrowIconTablet: {
    fontSize: 32,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  productCardPreliminary: {
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F59E0B',
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
    backgroundColor: '#F1F5F9',
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 28,
  },
  productCardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  productActionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBannerButton: {
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  productActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  productDeleteButton: {
    backgroundColor: '#FEF2F2',
  },
  productDeleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  productExpandButton: {
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  priceDetailsContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
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
    color: '#1E293B',
  },
  priceLowerThanCost: {
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
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
    color: '#64748B',
  },
  priceInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    minWidth: 80,
  },
  editButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#3B82F6',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelEditButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  cancelEditButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  calculateButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 4,
  },
  calculateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
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
    backgroundColor: '#94A3B8',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  estimatedTotalHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  estimatedTotalHeaderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
  },
  estimatedTotalHeaderValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
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
  cancelCampaignButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelCampaignButtonTablet: {
    paddingVertical: 16,
  },
  cancelCampaignButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  cancelCampaignButtonTextTablet: {
    fontSize: 18,
  },
  activateButton: {
    flex: 1,
    backgroundColor: '#10B981',
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
    color: '#FFFFFF',
  },
  activateButtonTextTablet: {
    fontSize: 18,
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#6366F1',
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
    color: '#FFFFFF',
  },
  closeButtonTextTablet: {
    fontSize: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  copyButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  copyButtonTextTablet: {
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
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
    color: '#1E293B',
    marginBottom: 12,
  },
  modalTitleTablet: {
    fontSize: 24,
  },
  modalDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  modalDescriptionTablet: {
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  pickerContainerTablet: {
    borderRadius: 10,
  },
  picker: {
    height: 50,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#6366F1',
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
    color: '#64748B',
  },
  modalConfirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonTextTablet: {
    fontSize: 16,
  },
  floatingButtonContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    zIndex: 9998,
    pointerEvents: 'box-none',
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
    color: '#FFFFFF',
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
    color: '#64748B',
  },
  globalSearchContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  globalSearchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  globalSearchHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  globalSearchList: {
    maxHeight: 400,
  },
  globalSearchItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  globalSearchItemPreliminary: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  globalSearchItemDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  globalSearchImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F1F5F9',
  },
  globalSearchContent: {
    flex: 1,
  },
  globalSearchItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  globalSearchItemTitleDisabled: {
    color: '#94A3B8',
  },
  globalSearchWarning: {
    fontSize: 12,
    color: '#F59E0B',
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
    color: '#F59E0B',
    fontWeight: '500',
  },
  stockTotal: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  globalSearchStatus: {
    fontSize: 12,
    color: '#64748B',
  },
  globalSearchActions: {
    flexDirection: 'column',
    gap: 6,
    minWidth: 100,
  },
  globalSearchActionButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  globalSearchActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  globalSearchActionButtonSecondary: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6366F1',
    alignItems: 'center',
  },
  globalSearchActionButtonSecondaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
  },
  stockAvailable: {
    color: '#10B981',
  },
  stockUnavailable: {
    color: '#EF4444',
  },
  priceDetailsContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  editPriceIconButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editPriceIcon: {
    fontSize: 14,
  },
  savePriceIconButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  savePriceIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelPriceIconButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  cancelPriceIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  calculateFranquiciaContainer: {
    marginTop: 8,
  },
  calculateFranquiciaButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  calculateFranquiciaButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  calculatedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  calculatedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    color: '#1E293B',
    flex: 1,
  },
  customAddModalCloseButton: {
    fontSize: 28,
    color: '#64748B',
    fontWeight: '300',
    paddingHorizontal: 8,
  },
  customAddModalProductInfo: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  customAddModalProductTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  customAddModalWarning: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
    marginTop: 4,
  },
  customAddModalStockInfo: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  customAddModalStockTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  customAddModalStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  customAddModalStockLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  customAddModalStockValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  customAddModalQuantitySection: {
    marginBottom: 24,
  },
  customAddModalQuantityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  customAddModalQuantityInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#1E293B',
  },
  customAddModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  customAddModalCancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  customAddModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  customAddModalConfirmButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  customAddModalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

