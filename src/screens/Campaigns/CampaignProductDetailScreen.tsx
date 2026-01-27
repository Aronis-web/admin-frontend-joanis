import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { campaignsService, inventoryApi } from '@/services/api';
import logger from '@/utils/logger';
import {
  CampaignProduct,
  DistributionPreviewResponse,
  DistributionTypeLabels,
  DistributionTypeDescriptions,
  ProductStatusLabels,
  ProductStatusColors,
  ProductStatus,
  ProductSourceType,
  DistributionType,
  SetCustomDistributionRequest,
  StockDetailByWarehouse,
} from '@/types/campaigns';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

interface CampaignProductDetailScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
      productId: string;
      fromCampaignDetail?: boolean;
    };
  };
}

export const CampaignProductDetailScreen: React.FC<CampaignProductDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId, productId, fromCampaignDetail } = route.params;
  const [product, setProduct] = useState<CampaignProduct | null>(null);
  const [preview, setPreview] = useState<DistributionPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustedDistribution, setAdjustedDistribution] =
    useState<DistributionPreviewResponse | null>(null);
  const [selectedDistributionType, setSelectedDistributionType] = useState<DistributionType | null>(
    null
  );
  const [customQuantities, setCustomQuantities] = useState<{ [participantId: string]: number }>({});
  const [previewLoading, setPreviewLoading] = useState(false);

  // Editable distributions - cada participante puede tener su propia cantidad
  const [editableDistributions, setEditableDistributions] = useState<{
    [participantId: string]: {
      participantId: string;
      participantName: string;
      quantityBase: number;
      roundingFactor: number;
      presentationId?: string;
      quantityPresentation?: number;
      percentage: number;
    };
  }>({});

  // Global rounding factor - aplica a TODOS los participantes
  const [globalRoundingFactor, setGlobalRoundingFactor] = useState<number>(1);

  // Presentation states (deprecated - ahora se maneja globalmente)
  const [usePresentation, setUsePresentation] = useState(false);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [selectedPresentation, setSelectedPresentation] = useState<any | null>(null);

  // Include in sheet state (for PDF generation) - applies to ALL participants for this product
  const [includeInSheet, setIncludeInSheet] = useState<boolean>(true);

  // Editable total quantity - allows modifying the total quantity to distribute
  const [editableTotalQuantity, setEditableTotalQuantity] = useState<number>(0);

  // Local stock data fetched from inventory API
  const [localStockData, setLocalStockData] = useState<StockDetailByWarehouse[] | undefined>(
    undefined
  );

  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  // Helper function to convert product stockItems to stockDetails format
  const getStockDetailsFromProduct = useCallback((): StockDetailByWarehouse[] | undefined => {
    // First check if we have local stock data from the API call
    if (localStockData && localStockData.length > 0) {
      logger.debug('✅ [STOCK] Usando stock local del API:', localStockData);
      return localStockData;
    }

    logger.debug('🔍 [STOCK] Verificando stockItems del producto:', {
      hasProduct: !!product,
      hasProductData: !!product?.product,
      hasStockItems: !!product?.product?.stockItems,
      stockItemsLength: product?.product?.stockItems?.length || 0,
      stockItems: product?.product?.stockItems,
    });

    if (!product?.product?.stockItems || product.product.stockItems.length === 0) {
      logger.debug('⚠️ [STOCK] No hay stockItems disponibles en el producto');
      return undefined;
    }

    const stockDetails = product.product.stockItems.map((item) => ({
      warehouse: item.warehouse?.name || 'Almacén desconocido',
      total: item.quantityBase || 0,
      reserved: item.reservedQuantityBase || 0,
      available: item.availableQuantityBase || item.quantityBase || 0,
    }));

    logger.debug('✅ [STOCK] Stock details generados desde producto:', stockDetails);
    return stockDetails;
  }, [product, localStockData]);

  const loadProduct = useCallback(async () => {
    try {
      // Optimized: Load only the specific product instead of all campaign products
      const foundProduct = await campaignsService.getProduct(campaignId, productId);
      logger.debug('📦 Producto cargado:', {
        id: foundProduct.id,
        productId: foundProduct.productId,
        hasProduct: !!foundProduct.product,
        hasPresentations: !!foundProduct.product?.presentations,
        presentationsCount: foundProduct.product?.presentations?.length || 0,
        presentations: foundProduct.product?.presentations,
        hasStockItems: !!foundProduct.product?.stockItems,
        stockItemsCount: foundProduct.product?.stockItems?.length || 0,
        stockItems: foundProduct.product?.stockItems,
      });
      setProduct(foundProduct);
    } catch (error: any) {
      logger.error('Error loading product:', error);
      Alert.alert('Error', 'No se pudo cargar el producto');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, productId, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProduct();
  }, [loadProduct]);

  const handleShowPreview = useCallback(async () => {
    if (!product) {
      return;
    }

    setActionLoading(true);
    try {
      const previewData = await campaignsService.getDistributionPreview(campaignId, productId);
      setPreview(previewData);
      setShowPreviewModal(true);
    } catch (error: any) {
      logger.error('Error loading preview:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo cargar la vista previa');
    } finally {
      setActionLoading(false);
    }
  }, [campaignId, productId]);

  const handleGenerateDistribution = useCallback(async () => {
    if (!product) {
      return;
    }

    if (product.productStatus !== 'ACTIVE') {
      Alert.alert('Error', 'Solo se pueden generar repartos de productos en estado ACTIVO');
      return;
    }

    logger.debug('🚀 [MODAL] Iniciando generación de reparto para producto:', {
      productId: product.id,
      productName: product.product?.title,
      productStatus: product.productStatus,
      distributionType: product.distributionType,
    });

    // Inicializar con el tipo de distribución actual del producto
    setSelectedDistributionType(product.distributionType);
    setCustomQuantities({});

    // Inicializar presentaciones
    setUsePresentation(false);
    setSelectedPresentationId(null);
    setSelectedPresentation(null);

    // Si el producto tiene presentaciones, seleccionar la base por defecto
    if (product.product?.presentations && product.product.presentations.length > 0) {
      const basePresentation = product.product.presentations.find((p) => p.isBase);
      if (basePresentation) {
        setSelectedPresentationId(basePresentation.presentationId);
        setSelectedPresentation(basePresentation);
      }
    }

    // Cargar stock directamente desde el API de inventario
    logger.debug('📦 [STOCK] Consultando stock directamente del API de inventario...');
    try {
      const stockData = await inventoryApi.getAllStock({ productId: product.productId });
      logger.debug('✅ [STOCK] Stock obtenido del API:', {
        stockItemsCount: stockData.length,
        stockData: stockData,
      });

      // Guardar en estado local sin actualizar el producto (evita recargar la campaña)
      if (stockData && stockData.length > 0) {
        const stockDetails: StockDetailByWarehouse[] = stockData.map((item) => ({
          warehouse: item.warehouse?.name || 'Almacén desconocido',
          total: item.quantityBase || 0,
          reserved: item.reservedQuantityBase || 0,
          available: item.availableQuantityBase || item.quantityBase || 0,
        }));

        setLocalStockData(stockDetails);
        logger.debug('✅ [STOCK] Stock guardado en estado local:', stockDetails);
      }
    } catch (error: any) {
      logger.error('❌ [STOCK] Error obteniendo stock del API:', error);
      // Continuar sin stock si hay error
    }

    // Cargar la vista previa para ajustar
    setActionLoading(true);
    try {
      logger.debug('📡 [MODAL] Llamando a preview inicial (sin preferencias)...');
      // Primero obtener preview inicial para saber cuántos participantes hay
      // NOTA: El backend debe manejar la lógica de filtrado de participantes:
      // - Si solo hay sedes internas, distribuir solo entre sedes
      // - Si hay empresas externas, incluir todos los participantes
      const initialPreview = await campaignsService.getDistributionPreview(
        campaignId,
        productId,
        {} // Sin preferencias
      );

      logger.debug('✅ [MODAL] Preview inicial recibido:', {
        totalParticipants: initialPreview.totalParticipants,
        totalQuantity: initialPreview.totalQuantity,
        totalDistributed: initialPreview.totalDistributed,
        remainder: initialPreview.remainder,
        participantCount: initialPreview.preview.length,
      });

      // Inicializar con roundingFactor = 1 (unidades) por defecto para TODOS
      const initialRoundingFactor = 1;
      setGlobalRoundingFactor(initialRoundingFactor);

      logger.debug(
        '🔄 [MODAL] Creando preferencias con roundingFactor global:',
        initialRoundingFactor
      );
      // Crear preferencias para TODOS los participantes con el mismo roundingFactor
      const participantPreferences = initialPreview.preview.map((item) => ({
        participantId: item.participantId,
        roundingFactor: initialRoundingFactor,
      }));

      // Recalcular con las preferencias
      const previewDataWithPreferences = await campaignsService.getDistributionPreview(
        campaignId,
        productId,
        { participantPreferences }
      );

      logger.debug('✅ [MODAL] Preview con preferencias recibido:', {
        totalParticipants: previewDataWithPreferences.totalParticipants,
        totalQuantity: previewDataWithPreferences.totalQuantity,
        totalDistributed: previewDataWithPreferences.totalDistributed,
        remainder: previewDataWithPreferences.remainder,
        participantCount: previewDataWithPreferences.preview.length,
        stockDetails: previewDataWithPreferences.stockDetails,
        hasStockDetails: !!previewDataWithPreferences.stockDetails,
      });

      logger.debug(
        '📦 [MODAL] Stock Details completo:',
        JSON.stringify(previewDataWithPreferences.stockDetails, null, 2)
      );

      setAdjustedDistribution(previewDataWithPreferences);

      // Initialize editable total quantity with available stock (if available), otherwise use totalQuantity
      const stockDetails = previewDataWithPreferences.stockDetails || localStockData || [];
      const totalAvailableStock = stockDetails.reduce(
        (sum, stock) => sum + stock.available,
        0
      );
      const initialQuantity = totalAvailableStock > 0
        ? totalAvailableStock
        : previewDataWithPreferences.totalQuantity;

      setEditableTotalQuantity(initialQuantity);

      // Inicializar distribuciones editables desde el preview
      const initialDistributions: typeof editableDistributions = {};
      previewDataWithPreferences.preview.forEach((item) => {
        initialDistributions[item.participantId] = {
          participantId: item.participantId,
          participantName: item.participantName,
          quantityBase: item.calculatedQuantity,
          roundingFactor: item.roundingFactor,
          presentationId: item.presentationId,
          quantityPresentation: item.quantityPresentation,
          percentage: item.percentage,
        };
      });
      setEditableDistributions(initialDistributions);

      logger.debug('💾 [MODAL] Distribuciones editables inicializadas:', {
        count: Object.keys(initialDistributions).length,
      });

      // Inicializar como incluido en el PDF por defecto
      setIncludeInSheet(true);

      logger.debug('✅ [MODAL] Modal listo para mostrarse');
      setShowAdjustModal(true);
    } catch (error: any) {
      logger.error('❌ [MODAL] Error loading preview:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo cargar la vista previa del reparto'
      );
    } finally {
      setActionLoading(false);
    }
  }, [product, campaignId, productId, localStockData]);

  const handleDistributionTypeChange = useCallback(async (newType: DistributionType) => {
    if (!product) {
      return;
    }

    setSelectedDistributionType(newType);
    setCustomQuantities({});

    // Si cambia a CUSTOM, inicializar cantidades vacías
    if (newType === DistributionType.CUSTOM) {
      const initialQuantities: { [key: string]: number } = {};
      adjustedDistribution?.preview.forEach((item) => {
        initialQuantities[item.participantId] = 0;
      });
      setCustomQuantities(initialQuantities);
      return;
    }

    // Para otros tipos, actualizar el producto y recargar preview
    setPreviewLoading(true);
    try {
      await campaignsService.updateProduct(campaignId, productId, {
        distributionType: newType,
      });

      const previewData = await campaignsService.getDistributionPreview(campaignId, productId);
      setAdjustedDistribution(previewData);
    } catch (error: any) {
      logger.error('Error updating distribution type:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo actualizar el tipo de distribución'
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [product, campaignId, productId, adjustedDistribution]);

  const handleCustomQuantityChange = useCallback((participantId: string, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0;
    setCustomQuantities((prev) => ({
      ...prev,
      [participantId]: numQuantity,
    }));
  }, []);

  const getTotalCustomQuantity = useCallback(() => {
    return Object.values(customQuantities).reduce((sum, qty) => sum + qty, 0);
  }, [customQuantities]);

  // Nuevas funciones para manejar distribuciones editables
  const handleQuantityChange = useCallback((participantId: string, newQuantity: number) => {
    setEditableDistributions((prev) => {
      const dist = prev[participantId];
      if (!dist) {
        return prev;
      }

      const updated = { ...prev };
      updated[participantId] = {
        ...dist,
        quantityBase: newQuantity,
        quantityPresentation:
          dist.roundingFactor > 1 ? Math.floor(newQuantity / dist.roundingFactor) : undefined,
      };
      return updated;
    });
  }, []);

  const handleGlobalRoundingFactorChange = useCallback(async (newFactor: number) => {
    logger.debug('🔄 [MODAL] Cambiando roundingFactor global:', {
      oldFactor: globalRoundingFactor,
      newFactor: newFactor,
      totalDistributions: Object.keys(editableDistributions).length,
    });

    // Validar si todas las cantidades son divisibles por el nuevo factor
    if (newFactor > 1) {
      const nonDivisibleParticipants: string[] = [];

      Object.values(editableDistributions).forEach((dist) => {
        const remainder = dist.quantityBase % newFactor;
        const quotient = dist.quantityBase / newFactor;

        if (remainder !== 0) {
          nonDivisibleParticipants.push(
            `${dist.participantName} (${dist.quantityBase} unidades = ${quotient.toFixed(2)} cajas)`
          );
        }
      });

      if (nonDivisibleParticipants.length > 0) {
        logger.debug(
          '⚠️ [MODAL] BLOQUEANDO cambio - Participantes con cantidades no divisibles:',
          nonDivisibleParticipants.length
        );
        Alert.alert(
          'No se puede usar presentación',
          `Las siguientes cantidades no son divisibles exactamente por ${newFactor}:\n\n${nonDivisibleParticipants.slice(0, 5).join('\n')}${nonDivisibleParticipants.length > 5 ? `\n\n...y ${nonDivisibleParticipants.length - 5} más` : ''}\n\nPor favor, usa distribución por unidades o ajusta las cantidades manualmente primero para que sean múltiplos de ${newFactor}.`,
          [{ text: 'Entendido' }]
        );
        return;
      }
    }

    // Recalcular preview con el nuevo roundingFactor GLOBAL para TODOS los participantes
    setPreviewLoading(true);
    try {
      setGlobalRoundingFactor(newFactor);

      // Aplicar el mismo roundingFactor a TODOS los participantes
      const participantPreferences = Object.values(editableDistributions).map((dist) => ({
        participantId: dist.participantId,
        roundingFactor: newFactor,
      }));

      const previewData = await campaignsService.getDistributionPreview(campaignId, productId, {
        participantPreferences,
      });

      logger.debug('✅ [MODAL] Preview recalculado recibido:', {
        totalParticipants: previewData.totalParticipants,
        totalQuantity: previewData.totalQuantity,
        totalDistributed: previewData.totalDistributed,
        remainder: previewData.remainder,
        participantCount: previewData.preview.length,
      });

      setAdjustedDistribution(previewData);

      // Actualizar distribuciones editables con los nuevos valores calculados
      const updatedDistributions: typeof editableDistributions = {};
      previewData.preview.forEach((item) => {
        updatedDistributions[item.participantId] = {
          participantId: item.participantId,
          participantName: item.participantName,
          quantityBase: item.calculatedQuantity,
          roundingFactor: item.roundingFactor,
          presentationId: item.presentationId,
          quantityPresentation: item.quantityPresentation,
          percentage: item.percentage,
        };
      });
      setEditableDistributions(updatedDistributions);

      logger.debug('💾 [MODAL] Distribuciones editables actualizadas:', {
        count: Object.keys(updatedDistributions).length,
      });
    } catch (error: any) {
      logger.error('❌ [MODAL] Error recalculating preview:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo recalcular la distribución'
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [globalRoundingFactor, editableDistributions, campaignId, productId]);

  const getTotalDistributed = useCallback(() => {
    return Object.values(editableDistributions).reduce((sum, dist) => sum + dist.quantityBase, 0);
  }, [editableDistributions]);

  // Función para ordenar participantes: primero sedes alfabéticamente, luego empresas alfabéticamente
  const getSortedDistributions = useMemo(() => {
    const distributions = Object.values(editableDistributions);

    const sorted = distributions.sort((a, b) => {
      // Obtener el tipo de participante desde adjustedDistribution.preview
      const typeA =
        adjustedDistribution?.preview.find((p) => p.participantId === a.participantId)
          ?.participantType || 'EXTERNAL_COMPANY';
      const typeB =
        adjustedDistribution?.preview.find((p) => p.participantId === b.participantId)
          ?.participantType || 'EXTERNAL_COMPANY';

      // Si uno es INTERNAL_SITE y el otro no, INTERNAL_SITE va primero
      if (typeA === 'INTERNAL_SITE' && typeB !== 'INTERNAL_SITE') {
        return -1;
      }
      if (typeA !== 'INTERNAL_SITE' && typeB === 'INTERNAL_SITE') {
        return 1;
      }

      // Si ambos son del mismo tipo, ordenar alfabéticamente por nombre
      return a.participantName.localeCompare(b.participantName);
    });

    return sorted;
  }, [editableDistributions, adjustedDistribution]);

  // Helper function to calculate quantity in presentation
  const calculateQuantityInPresentation = useCallback((quantityBase: number): number => {
    if (!selectedPresentation || selectedPresentation.factorToBase <= 0) {
      return quantityBase;
    }
    return quantityBase / selectedPresentation.factorToBase;
  }, [selectedPresentation]);

  // Helper function to calculate quantity in base units
  const calculateQuantityInBase = useCallback((quantityPresentation: number): number => {
    if (!selectedPresentation || selectedPresentation.factorToBase <= 0) {
      return quantityPresentation;
    }
    return quantityPresentation * selectedPresentation.factorToBase;
  }, [selectedPresentation]);

  // Handle presentation selection change
  const handlePresentationChange = useCallback((presentationId: string) => {
    const presentation = product?.product?.presentations?.find(
      (p) => p.presentationId === presentationId
    );
    if (presentation) {
      setSelectedPresentationId(presentationId);
      setSelectedPresentation(presentation);
    }
  }, [product]);

  const validateCustomDistribution = useCallback((): boolean => {
    if (selectedDistributionType !== DistributionType.CUSTOM) {
      return true;
    }

    const total = getTotalCustomQuantity();
    const productTotal = product?.totalQuantityBase || 0;

    if (total === 0) {
      Alert.alert('Error', 'Debes asignar al menos una cantidad a un participante');
      return false;
    }

    if (total > productTotal) {
      Alert.alert(
        'Error',
        `La suma de cantidades (${total}) excede el total disponible (${productTotal})`
      );
      return false;
    }

    return true;
  }, [selectedDistributionType, customQuantities, product]);

  const recalculateDistributions = useCallback((newTotalQuantity: number) => {
    if (!adjustedDistribution) {
      return;
    }

    logger.debug(
      '🔄 [RECALC] Recalculando distribuciones localmente con nueva cantidad:',
      newTotalQuantity
    );

    // Recalcular cantidades basadas en porcentajes
    const newDistributions: typeof editableDistributions = {};
    let totalDistributed = 0;
    let remainderParticipantId: string | null = null;

    // Primero, calcular cantidades usando Math.floor para evitar excedentes
    Object.values(editableDistributions).forEach((dist) => {
      const exactQuantity = (dist.percentage / 100) * newTotalQuantity;
      // Usar Math.floor para asegurar que nunca excedemos el total
      const flooredQuantity = Math.floor(exactQuantity);

      newDistributions[dist.participantId] = {
        ...dist,
        quantityBase: flooredQuantity,
        quantityPresentation:
          globalRoundingFactor > 1 ? Math.floor(flooredQuantity / globalRoundingFactor) : undefined,
      };

      totalDistributed += flooredQuantity;
    });

    // Calcular remanente (ahora siempre será >= 0)
    const remainder = newTotalQuantity - totalDistributed;

    // Asignar remanente a la sede de ajuste (o al primer participante si no hay sede de ajuste)
    if (remainder > 0) {
      // Buscar la sede de ajuste del preview original
      remainderParticipantId =
        adjustedDistribution.remainderAssignedTo?.participantId ||
        adjustedDistribution.preview[0]?.participantId;

      if (remainderParticipantId && newDistributions[remainderParticipantId]) {
        newDistributions[remainderParticipantId].quantityBase += remainder;
        if (globalRoundingFactor > 1) {
          newDistributions[remainderParticipantId].quantityPresentation = Math.floor(
            newDistributions[remainderParticipantId].quantityBase / globalRoundingFactor
          );
        }
        totalDistributed += remainder;
      }
    }

    logger.debug('✅ [RECALC] Distribuciones recalculadas:', {
      newTotalQuantity,
      totalDistributed,
      remainder,
      remainderAssignedTo: remainderParticipantId,
    });

    // Actualizar el estado
    setEditableDistributions(newDistributions);

    // Actualizar adjustedDistribution con los nuevos valores
    const updatedPreview = adjustedDistribution.preview.map((item) => ({
      ...item,
      calculatedQuantity: newDistributions[item.participantId]?.quantityBase || 0,
      quantityPresentation: newDistributions[item.participantId]?.quantityPresentation,
    }));

    setAdjustedDistribution({
      ...adjustedDistribution,
      totalQuantity: newTotalQuantity,
      totalDistributed,
      remainder: newTotalQuantity - totalDistributed,
      preview: updatedPreview,
      remainderAssignedTo: remainderParticipantId
        ? {
            participantId: remainderParticipantId,
            participantName: newDistributions[remainderParticipantId]?.participantName || '',
            remainderQuantity: remainder,
          }
        : undefined,
    });

    logger.debug('✅ [RECALC] Estado actualizado');
  }, [adjustedDistribution, editableDistributions, globalRoundingFactor]);

  const validateDistributions = useCallback((): boolean => {
    const totalDistributed = getTotalDistributed();

    // Calculate available stock from stock details
    const stockDetails = adjustedDistribution?.stockDetails || localStockData || [];
    const totalAvailableStock = stockDetails.reduce(
      (sum, stock) => sum + stock.available,
      0
    );

    // Use the minimum between editableTotalQuantity and available stock
    // This ensures we don't exceed what's actually available in inventory
    const maxAllowed = totalAvailableStock > 0
      ? Math.min(editableTotalQuantity, totalAvailableStock)
      : editableTotalQuantity;

    if (totalDistributed === 0) {
      Alert.alert('Error', 'Debes asignar al menos una cantidad a un participante');
      return false;
    }

    if (totalDistributed > maxAllowed) {
      const errorMessage = totalAvailableStock > 0 && totalAvailableStock < editableTotalQuantity
        ? `La suma de cantidades (${totalDistributed}) excede el stock disponible (${totalAvailableStock})`
        : `La suma de cantidades (${totalDistributed}) excede el total disponible (${editableTotalQuantity})`;

      Alert.alert('Error', errorMessage);
      return false;
    }

    return true;
  }, [editableTotalQuantity, adjustedDistribution, localStockData, getTotalDistributed]);

  const handleConfirmGeneration = useCallback(async () => {
    if (!product || !adjustedDistribution) {
      return;
    }

    logger.debug('🎯 [MODAL] Confirmando generación de reparto...');

    // Validar distribuciones
    if (!validateDistributions()) {
      return;
    }

    setActionLoading(true);
    try {
      // Preparar distribuciones con cantidades exactas desde editableDistributions
      const distributions = Object.values(editableDistributions).map((dist) => ({
        participantId: dist.participantId,
        quantityBase: dist.quantityBase,
        roundingFactor: dist.roundingFactor,
        presentationId: dist.presentationId,
        quantityPresentation: dist.quantityPresentation,
        notes: `${dist.participantName} - ${dist.percentage.toFixed(2)}%`,
      }));

      // Generar distribución con cantidades exactas
      const result = await campaignsService.generateDistribution(campaignId, productId, {
        distributions,
        notes: `Reparto generado desde preview - ${new Date().toLocaleString()}`,
      });

      logger.debug('✅ [MODAL] Reparto generado exitosamente:', result.repartoCode);

      setShowAdjustModal(false);

      const pdfInfo = includeInSheet
        ? '\n\n✅ Este producto se incluirá en las hojas de reparto (PDF)'
        : '\n\n❌ Este producto NO se incluirá en las hojas de reparto (PDF)';

      Alert.alert(
        'Éxito',
        `Distribución generada exitosamente\n\nReparto: ${result.repartoCode}\nSe creó automáticamente el reparto con reserva de stock${pdfInfo}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Si venimos de CampaignDetail, navegar de vuelta con updatedProductId
              // Esto actualiza SOLO este producto sin recargar toda la campaña
              if (fromCampaignDetail) {
                navigation.navigate('CampaignDetail', {
                  campaignId,
                  updatedProductId: productId,
                });
              } else {
                loadProduct();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      logger.error('❌ [MODAL] Error generando reparto:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo generar el reparto');
    } finally {
      setActionLoading(false);
    }
  }, [product, adjustedDistribution, validateDistributions, editableDistributions, campaignId, productId, includeInSheet, loadProduct]);

  const handleManageCustomDistribution = useCallback(() => {
    navigation.navigate('ManageCustomDistribution', {
      campaignId,
      productId,
    });
  }, [navigation, campaignId, productId]);

  const handleChangeToActive = useCallback(async () => {
    if (!product) {
      return;
    }

    Alert.alert(
      'Cambiar a Activo',
      '¿Estás seguro de cambiar este producto a estado ACTIVO? Esto permitirá generar el reparto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await campaignsService.updateProduct(campaignId, productId, {
                productStatus: ProductStatus.ACTIVE,
              });

              Alert.alert('Éxito', 'El producto ahora está en estado ACTIVO', [
                {
                  text: 'OK',
                  onPress: () => loadProduct(),
                },
              ]);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo actualizar el producto'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [product, campaignId, productId, loadProduct]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando producto...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity
            onPress={() => {
              if (fromCampaignDetail) {
                // Navigate back with skipReloadOnce flag to prevent reload
                navigation.navigate('CampaignDetail', {
                  campaignId,
                  skipReloadOnce: true,
                });
              } else {
                navigation.goBack();
              }
            }}
            style={styles.backButton}
          >
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Detalle del Producto</Text>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {/* Product Info */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Información del Producto
            </Text>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Producto:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {product.product?.title || 'N/A'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>SKU:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {product.product?.correlativeNumber && `#${product.product.correlativeNumber} | `}
                {product.product?.sku || 'N/A'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Cantidad Total:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {product.totalQuantityBase}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Estado:</Text>
              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusBadge,
                    isTablet && styles.statusBadgeTablet,
                    {
                      backgroundColor: ProductStatusColors[product.productStatus] + '20',
                      borderColor: ProductStatusColors[product.productStatus],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isTablet && styles.statusTextTablet,
                      { color: ProductStatusColors[product.productStatus] },
                    ]}
                  >
                    {ProductStatusLabels[product.productStatus]}
                  </Text>
                </View>
                {product.productStatus === 'PRELIMINARY' && !product.distributionGenerated && (
                  <TouchableOpacity
                    style={[styles.changeStatusButton, isTablet && styles.changeStatusButtonTablet]}
                    onPress={handleChangeToActive}
                    disabled={actionLoading}
                  >
                    <Text
                      style={[
                        styles.changeStatusButtonText,
                        isTablet && styles.changeStatusButtonTextTablet,
                      ]}
                    >
                      Cambiar a Activo
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Tipo de Distribución:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {DistributionTypeLabels[product.distributionType]}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Reparto Generado:
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  isTablet && styles.infoValueTablet,
                  product.distributionGenerated ? styles.generatedYes : styles.generatedNo,
                ]}
              >
                {product.distributionGenerated ? 'Sí' : 'No'}
              </Text>
            </View>

            {/* @ts-ignore */}
            {product.purchase && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Compra:</Text>
                <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                  {product.purchase.code}
                </Text>
              </View>
            )}
          </View>

          {/* Custom Distributions */}
          {product.distributionType === 'CUSTOM' && (
            <View style={[styles.section, isTablet && styles.sectionTablet]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Distribuciones Personalizadas
                </Text>
                <TouchableOpacity
                  style={[styles.manageButton, isTablet && styles.manageButtonTablet]}
                  onPress={handleManageCustomDistribution}
                >
                  <Text
                    style={[styles.manageButtonText, isTablet && styles.manageButtonTextTablet]}
                  >
                    Gestionar
                  </Text>
                </TouchableOpacity>
              </View>

              {!product.customDistributions || product.customDistributions.length === 0 ? (
                <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                  No hay distribuciones personalizadas configuradas
                </Text>
              ) : (
                product.customDistributions.map((dist) => (
                  <View key={dist.id} style={styles.distributionItem}>
                    <Text style={styles.distributionName}>{dist.name || 'Sin nombre'}</Text>
                    <Text style={styles.distributionItems}>
                      {dist.items?.length || 0} participantes
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Actions Info */}
          <View style={[styles.infoBox, isTablet && styles.infoBoxTablet]}>
            <Text style={[styles.infoTitle, isTablet && styles.infoTitleTablet]}>
              ℹ️ Acciones Disponibles
            </Text>
            <Text style={[styles.infoText, isTablet && styles.infoTextTablet]}>
              • Vista Previa: Ver cómo se distribuirá el producto{'\n'}• Generar Reparto: Crear los
              registros de distribución{'\n'}• Solo productos ACTIVOS pueden generar reparto{'\n'}•
              El reparto se genera una sola vez por producto
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, isTablet && styles.footerTablet]}>
          <TouchableOpacity
            style={[styles.previewButton, isTablet && styles.previewButtonTablet]}
            onPress={handleShowPreview}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#6366F1" />
            ) : (
              <Text style={[styles.previewButtonText, isTablet && styles.previewButtonTextTablet]}>
                Vista Previa
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.generateButton,
              isTablet && styles.generateButtonTablet,
              (product.distributionGenerated || product.productStatus !== 'ACTIVE') &&
                styles.generateButtonDisabled,
            ]}
            onPress={handleGenerateDistribution}
            disabled={
              actionLoading || product.distributionGenerated || product.productStatus !== 'ACTIVE'
            }
          >
            <Text style={[styles.generateButtonText, isTablet && styles.generateButtonTextTablet]}>
              {product.distributionGenerated ? 'Ya Generado' : 'Generar Reparto'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preview Modal */}
        <Modal
          visible={showPreviewModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPreviewModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
                  Vista Previa de Distribución
                </Text>
                <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {preview && (
                  <>
                    {/* Información del Producto */}
                    <View style={styles.previewHeader}>
                      <Text style={styles.previewProductName}>{preview.productName}</Text>
                      <Text style={styles.previewProductStatus}>
                        Estado: {preview.isPreliminary ? '⚠️ Preliminar' : '✓ Activo'}
                      </Text>
                    </View>

                    {/* Tipo de Distribución */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>Tipo de Reparto</Text>
                      <Text style={styles.previewType}>
                        {DistributionTypeLabels[preview.distributionType]}
                      </Text>
                      {preview.distributionDescription && (
                        <Text style={styles.previewDescription}>
                          {preview.distributionDescription}
                        </Text>
                      )}
                    </View>

                    {/* Resumen de Distribución */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>Resumen</Text>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Total de participantes:</Text>
                        <Text style={styles.previewSummaryValue}>{preview.totalParticipants}</Text>
                      </View>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Monto total asignado:</Text>
                        <Text style={styles.previewSummaryValue}>
                          {preview.currency} {preview.totalAssignedAmount?.toFixed(2) || '0.00'}
                        </Text>
                      </View>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Cantidad total:</Text>
                        <Text style={styles.previewSummaryValue}>
                          {preview.totalQuantity} unidades
                        </Text>
                      </View>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Total distribuido:</Text>
                        <Text style={styles.previewSummaryValue}>
                          {preview.totalDistributed} unidades
                        </Text>
                      </View>
                      {preview.remainder > 0 && (
                        <View style={styles.previewSummaryRow}>
                          <Text style={styles.previewSummaryLabel}>Remanente (por redondeo):</Text>
                          <Text style={[styles.previewSummaryValue, styles.previewRemainder]}>
                            {preview.remainder} unidades
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Detalle por Participante */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>Distribución por Participante</Text>
                      {preview.preview.map((item, index) => (
                        <View key={index} style={styles.previewItem}>
                          <View style={styles.previewItemHeader}>
                            <Text style={styles.previewParticipantName}>
                              {item.participantName}
                            </Text>
                            <Text style={styles.previewParticipantType}>
                              {item.participantType === 'EXTERNAL_COMPANY'
                                ? '🏢 Empresa'
                                : '🏛️ Sede'}
                            </Text>
                          </View>
                          <View style={styles.previewItemDetails}>
                            <View style={styles.previewDetailRow}>
                              <Text style={styles.previewDetailLabel}>Monto asignado:</Text>
                              <Text style={styles.previewAmount}>
                                {preview.currency} {(item.assignedAmount || 0).toFixed(2)}
                              </Text>
                            </View>
                            <View style={styles.previewDetailRow}>
                              <Text style={styles.previewDetailLabel}>Porcentaje:</Text>
                              <Text style={styles.previewPercentage}>
                                {(item.percentage || 0).toFixed(2)}%
                              </Text>
                            </View>
                            <View style={styles.previewDetailRow}>
                              <Text style={styles.previewDetailLabel}>Cantidad calculada:</Text>
                              <Text style={styles.previewCalculated}>
                                {item.calculatedQuantity} unidades
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowPreviewModal(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Adjust Distribution Modal */}
        <Modal
          visible={showAdjustModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAdjustModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
                  Ajustar y Generar Reparto
                </Text>
                <TouchableOpacity onPress={() => setShowAdjustModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {adjustedDistribution && (
                  <>
                    {/* Información del Producto */}
                    <View style={styles.previewHeader}>
                      <Text style={styles.previewProductName}>
                        {adjustedDistribution.productName}
                      </Text>
                      <Text style={styles.previewProductStatus}>
                        Estado: {adjustedDistribution.isPreliminary ? '⚠️ Preliminar' : '✓ Activo'}
                      </Text>
                    </View>

                    {/* Advertencia de diferencia entre stock disponible y cantidad a distribuir */}
                    {(() => {
                      const stockDetails =
                        adjustedDistribution.stockDetails || localStockData || [];
                      const totalAvailableStock = stockDetails.reduce(
                        (sum, stock) => sum + stock.available,
                        0
                      );
                      const quantityToDistribute = editableTotalQuantity || adjustedDistribution.totalQuantity;

                      if (totalAvailableStock !== quantityToDistribute && totalAvailableStock > 0) {
                        return (
                          <View style={styles.stockDifferenceWarning}>
                            <Text style={styles.stockDifferenceWarningIcon}>⚠️</Text>
                            <View style={styles.stockDifferenceWarningTextContainer}>
                              <Text style={styles.stockDifferenceWarningTitle}>
                                Stock disponible y cantidad a distribuir son diferentes
                              </Text>
                              <Text style={styles.stockDifferenceWarningText}>
                                Stock disponible: {totalAvailableStock} unidades{'\n'}
                                Cantidad a distribuir: {quantityToDistribute} unidades
                                {totalAvailableStock < quantityToDistribute
                                  ? '\n\n⚠️ No hay suficiente stock disponible'
                                  : totalAvailableStock > quantityToDistribute
                                  ? '\n\nℹ️ Quedará stock sin distribuir'
                                  : ''}
                              </Text>
                            </View>
                          </View>
                        );
                      }
                      return null;
                    })()}

                    {/* Selector de Presentación */}
                    {product?.product?.presentations &&
                      product.product.presentations.length > 0 && (
                        <View style={styles.previewSection}>
                          <Text style={styles.previewSectionTitle}>📦 Unidad de Distribución</Text>
                          <Text style={styles.distributionTypeHint}>
                            Selecciona si deseas distribuir en unidades base o por presentación:
                          </Text>

                          {/* Toggle: Unidades vs Presentaciones */}
                          <View style={styles.presentationToggleContainer}>
                            <TouchableOpacity
                              style={[
                                styles.presentationToggleOption,
                                !usePresentation && styles.presentationToggleOptionSelected,
                              ]}
                              onPress={() => setUsePresentation(false)}
                            >
                              <View style={styles.presentationToggleHeader}>
                                <View
                                  style={[
                                    styles.presentationToggleRadio,
                                    !usePresentation && styles.presentationToggleRadioSelected,
                                  ]}
                                >
                                  {!usePresentation && (
                                    <View style={styles.presentationToggleRadioInner} />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.presentationToggleLabel,
                                    !usePresentation && styles.presentationToggleLabelSelected,
                                  ]}
                                >
                                  Unidades Base
                                </Text>
                              </View>
                              <Text style={styles.presentationToggleDescription}>
                                Distribuir en unidades individuales
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.presentationToggleOption,
                                usePresentation && styles.presentationToggleOptionSelected,
                              ]}
                              onPress={() => setUsePresentation(true)}
                            >
                              <View style={styles.presentationToggleHeader}>
                                <View
                                  style={[
                                    styles.presentationToggleRadio,
                                    usePresentation && styles.presentationToggleRadioSelected,
                                  ]}
                                >
                                  {usePresentation && (
                                    <View style={styles.presentationToggleRadioInner} />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.presentationToggleLabel,
                                    usePresentation && styles.presentationToggleLabelSelected,
                                  ]}
                                >
                                  Por Presentación
                                </Text>
                              </View>
                              <Text style={styles.presentationToggleDescription}>
                                Distribuir en cajas, packs, etc.
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Selector de Presentación */}
                          {usePresentation && (
                            <View style={styles.presentationSelectorContainer}>
                              <Text style={styles.presentationSelectorLabel}>
                                Selecciona la presentación:
                              </Text>
                              <View style={styles.presentationOptions}>
                                {product.product.presentations
                                  .filter((p) => !p.isBase)
                                  .map((pres) => (
                                    <TouchableOpacity
                                      key={pres.presentationId}
                                      style={[
                                        styles.presentationOption,
                                        selectedPresentationId === pres.presentationId &&
                                          styles.presentationOptionSelected,
                                      ]}
                                      onPress={() => handlePresentationChange(pres.presentationId)}
                                    >
                                      <View style={styles.presentationOptionHeader}>
                                        <View
                                          style={[
                                            styles.presentationOptionRadio,
                                            selectedPresentationId === pres.presentationId &&
                                              styles.presentationOptionRadioSelected,
                                          ]}
                                        >
                                          {selectedPresentationId === pres.presentationId && (
                                            <View style={styles.presentationOptionRadioInner} />
                                          )}
                                        </View>
                                        <Text
                                          style={[
                                            styles.presentationOptionLabel,
                                            selectedPresentationId === pres.presentationId &&
                                              styles.presentationOptionLabelSelected,
                                          ]}
                                        >
                                          {pres.presentation.code} - {pres.presentation.name}
                                        </Text>
                                      </View>
                                      <Text style={styles.presentationOptionFactor}>
                                        1 {pres.presentation.name} = {pres.factorToBase} unidades
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                              </View>
                            </View>
                          )}
                        </View>
                      )}

                    {/* Selector de Tipo de Distribución */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>Tipo de Reparto</Text>
                      <Text style={styles.distributionTypeHint}>
                        Selecciona cómo deseas distribuir este producto:
                      </Text>

                      {/* Opciones de tipo de distribución */}
                      <View style={styles.distributionTypeContainer}>
                        {Object.values(DistributionType).map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[
                              styles.distributionTypeOption,
                              selectedDistributionType === type &&
                                styles.distributionTypeOptionSelected,
                            ]}
                            onPress={() => handleDistributionTypeChange(type)}
                            disabled={previewLoading}
                          >
                            <View style={styles.distributionTypeHeader}>
                              <View
                                style={[
                                  styles.distributionTypeRadio,
                                  selectedDistributionType === type &&
                                    styles.distributionTypeRadioSelected,
                                ]}
                              >
                                {selectedDistributionType === type && (
                                  <View style={styles.distributionTypeRadioInner} />
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.distributionTypeLabel,
                                  selectedDistributionType === type &&
                                    styles.distributionTypeLabelSelected,
                                ]}
                              >
                                {DistributionTypeLabels[type]}
                              </Text>
                            </View>
                            <Text style={styles.distributionTypeDescription}>
                              {DistributionTypeDescriptions[type]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {previewLoading && (
                        <View style={styles.previewLoadingContainer}>
                          <ActivityIndicator color="#6366F1" />
                          <Text style={styles.previewLoadingText}>
                            Actualizando vista previa...
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Stock Information - Solo si viene de compra */}
                    {product?.sourceType === 'PURCHASE' && product?.purchaseProduct && (
                      <View style={styles.stockInfoSection}>
                        <Text style={styles.stockInfoTitle}>📦 Información de Stock</Text>

                        {product.purchaseProduct.validatedStock !== undefined && (
                          <View style={styles.stockInfoRow}>
                            <Text style={styles.stockInfoLabel}>Stock Validado (Compra):</Text>
                            <Text style={styles.stockInfoValue}>
                              {product.purchaseProduct.validatedStock} unidades
                            </Text>
                          </View>
                        )}

                        <View style={styles.stockInfoRow}>
                          <Text style={styles.stockInfoLabel}>Stock Actual (Campaña):</Text>
                          <Text
                            style={[
                              styles.stockInfoValue,
                              product.purchaseProduct.validatedStock !== undefined &&
                                product.totalQuantityBase !==
                                  product.purchaseProduct.validatedStock &&
                                styles.stockInfoValueDifferent,
                            ]}
                          >
                            {product.totalQuantityBase} unidades
                          </Text>
                        </View>

                        {product.purchaseProduct.validatedStock !== undefined &&
                          product.totalQuantityBase !== product.purchaseProduct.validatedStock && (
                            <View style={styles.stockDifferenceWarning}>
                              <Text style={styles.stockDifferenceWarningIcon}>⚠️</Text>
                              <View style={styles.stockDifferenceWarningTextContainer}>
                                <Text style={styles.stockDifferenceWarningTitle}>
                                  Diferencia detectada
                                </Text>
                                <Text style={styles.stockDifferenceWarningText}>
                                  El stock actual ({product.totalQuantityBase}) difiere del stock
                                  validado en la compra ({product.purchaseProduct.validatedStock}).
                                  {product.totalQuantityBase >
                                  product.purchaseProduct.validatedStock
                                    ? ` Hay ${product.totalQuantityBase - product.purchaseProduct.validatedStock} unidades adicionales.`
                                    : ` Faltan ${product.purchaseProduct.validatedStock - product.totalQuantityBase} unidades.`}
                                </Text>
                              </View>
                            </View>
                          )}
                      </View>
                    )}

                    {/* Stock Information */}
                    {(() => {
                      // Use stockDetails from API if available, otherwise fallback to product stockItems
                      const stockDetails =
                        adjustedDistribution.stockDetails || getStockDetailsFromProduct();

                      if (!stockDetails || stockDetails.length === 0) {
                        return null;
                      }

                      return (
                        <View style={styles.previewSection}>
                          <Text style={styles.previewSectionTitle}>📦 Stock Disponible</Text>
                          {stockDetails.map((stock, index) => (
                            <View key={index} style={styles.stockDetailCard}>
                              <Text style={styles.stockWarehouseName}>{stock.warehouse}</Text>
                              <View style={styles.stockDetailRow}>
                                <Text style={styles.stockDetailLabel}>Total:</Text>
                                <Text style={styles.stockDetailValue}>{stock.total} unidades</Text>
                              </View>
                              <View style={styles.stockDetailRow}>
                                <Text style={styles.stockDetailLabel}>Reservado:</Text>
                                <Text style={[styles.stockDetailValue, styles.stockReserved]}>
                                  {stock.reserved} unidades
                                </Text>
                              </View>
                              <View style={styles.stockDetailRow}>
                                <Text style={styles.stockDetailLabel}>Disponible:</Text>
                                <Text style={[styles.stockDetailValue, styles.stockAvailable]}>
                                  {stock.available} unidades
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })()}

                    {/* Resumen de Distribución */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>Resumen</Text>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Total de participantes:</Text>
                        <Text style={styles.previewSummaryValue}>
                          {adjustedDistribution.totalParticipants}
                        </Text>
                      </View>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Monto total asignado:</Text>
                        <Text style={styles.previewSummaryValue}>
                          {adjustedDistribution.currency}{' '}
                          {adjustedDistribution.totalAssignedAmount?.toFixed(2) || '0.00'}
                        </Text>
                      </View>

                      {/* Editable Total Quantity */}
                      <View style={styles.editableTotalQuantityContainer}>
                        <Text style={styles.editableTotalQuantityLabel}>
                          Cantidad total a distribuir:
                        </Text>
                        <View style={styles.editableTotalQuantityInputContainer}>
                          <TextInput
                            style={styles.editableTotalQuantityInput}
                            keyboardType="numeric"
                            placeholder="0"
                            value={editableTotalQuantity.toString()}
                            onChangeText={(text) => {
                              const newQuantity = parseInt(text) || 0;
                              setEditableTotalQuantity(newQuantity);
                            }}
                            onBlur={() => {
                              // Recalculate distributions when user finishes editing
                              if (editableTotalQuantity !== adjustedDistribution?.totalQuantity) {
                                recalculateDistributions(editableTotalQuantity);
                              }
                            }}
                          />
                          <Text style={styles.editableTotalQuantityUnit}>unidades</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.recalculateButton}
                          onPress={() => recalculateDistributions(editableTotalQuantity)}
                        >
                          <Text style={styles.recalculateButtonText}>
                            🔄 Actualizar Distribuciones
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.editableTotalQuantityHint}>
                          💡 Modifica la cantidad y presiona "Actualizar Distribuciones" para
                          recalcular
                        </Text>
                      </View>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Total distribuido:</Text>
                        <Text
                          style={[
                            styles.previewSummaryValue,
                            getTotalDistributed() > editableTotalQuantity &&
                              styles.previewSummaryError,
                          ]}
                        >
                          {getTotalDistributed()} unidades
                        </Text>
                      </View>
                      {editableTotalQuantity - getTotalDistributed() > 0 && (
                        <View style={styles.previewSummaryRow}>
                          <Text style={styles.previewSummaryLabel}>Remanente:</Text>
                          <Text style={[styles.previewSummaryValue, styles.previewRemainder]}>
                            {editableTotalQuantity - getTotalDistributed()} unidades
                          </Text>
                        </View>
                      )}
                      {getTotalDistributed() > editableTotalQuantity && (
                        <View style={styles.previewSummaryRow}>
                          <Text style={styles.previewSummaryLabel}>Excedente:</Text>
                          <Text style={[styles.previewSummaryValue, styles.previewSummaryError]}>
                            {getTotalDistributed() - editableTotalQuantity} unidades
                          </Text>
                        </View>
                      )}

                      {/* Información de Remanente */}
                      {adjustedDistribution.remainder > 0 && (
                        <>
                          <View style={styles.previewSummaryRow}>
                            <Text style={styles.previewSummaryLabel}>
                              Remanente (por redondeo):
                            </Text>
                            <Text style={[styles.previewSummaryValue, styles.previewRemainder]}>
                              {adjustedDistribution.remainder} unidades
                            </Text>
                          </View>
                          {adjustedDistribution.remainderSite && (
                            <View style={styles.remainderInfoBox}>
                              <Text style={styles.remainderInfoTitle}>
                                ✓ Sede de Remanente Configurada
                              </Text>
                              <Text style={styles.remainderInfoText}>
                                La sede{' '}
                                <Text style={styles.remainderSiteName}>
                                  {adjustedDistribution.remainderSite.name}
                                </Text>{' '}
                                absorberá las {adjustedDistribution.remainder} unidades del
                                remanente.
                              </Text>
                            </View>
                          )}
                          {!adjustedDistribution.remainderSite && (
                            <View style={styles.remainderWarningBox}>
                              <Text style={styles.remainderWarningTitle}>
                                ⚠️ Sin Sede de Remanente
                              </Text>
                              <Text style={styles.remainderWarningText}>
                                Hay {adjustedDistribution.remainder} unidades sin asignar. Configura
                                una sede de remanente en el resumen de la campaña para distribuir el
                                100% del stock.
                              </Text>
                            </View>
                          )}
                        </>
                      )}

                      {adjustedDistribution.remainderAssignedTo && (
                        <View style={styles.remainderAssignedBox}>
                          <Text style={styles.remainderAssignedTitle}>📦 Remanente Asignado</Text>
                          <Text style={styles.remainderAssignedText}>
                            <Text style={styles.remainderParticipantName}>
                              {adjustedDistribution.remainderAssignedTo.participantName}
                            </Text>{' '}
                            recibirá {adjustedDistribution.remainderAssignedTo.remainderQuantity}{' '}
                            unidades adicionales del remanente.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Selector GLOBAL de tipo de distribución */}
                    {adjustedDistribution.presentationInfo &&
                      adjustedDistribution.presentationInfo.hasPresentations && (
                        <View style={styles.previewSection}>
                          <Text style={styles.previewSectionTitle}>📦 Unidad de Distribución</Text>
                          <Text style={styles.adjustHint}>
                            Selecciona cómo distribuir a TODOS los participantes:
                          </Text>
                          <View style={styles.roundingFactorButtons}>
                            <TouchableOpacity
                              style={[
                                styles.roundingFactorButton,
                                globalRoundingFactor === 1 && styles.roundingFactorButtonSelected,
                              ]}
                              onPress={() => handleGlobalRoundingFactorChange(1)}
                              disabled={previewLoading}
                            >
                              <Text
                                style={[
                                  styles.roundingFactorButtonText,
                                  globalRoundingFactor === 1 &&
                                    styles.roundingFactorButtonTextSelected,
                                ]}
                              >
                                Unidades
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.roundingFactorButton,
                                globalRoundingFactor ===
                                  adjustedDistribution.presentationInfo.largestFactor &&
                                  styles.roundingFactorButtonSelected,
                              ]}
                              onPress={() =>
                                handleGlobalRoundingFactorChange(
                                  adjustedDistribution.presentationInfo!.largestFactor
                                )
                              }
                              disabled={previewLoading}
                            >
                              <Text
                                style={[
                                  styles.roundingFactorButtonText,
                                  globalRoundingFactor ===
                                    adjustedDistribution.presentationInfo.largestFactor &&
                                    styles.roundingFactorButtonTextSelected,
                                ]}
                              >
                                {adjustedDistribution.presentationInfo.largestPresentation?.name ||
                                  'Presentación'}{' '}
                                ({adjustedDistribution.presentationInfo.largestFactor} unidades)
                              </Text>
                            </TouchableOpacity>
                          </View>
                          {previewLoading && (
                            <View style={styles.previewLoadingContainer}>
                              <ActivityIndicator color="#6366F1" />
                              <Text style={styles.previewLoadingText}>
                                Recalculando cantidades...
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                    {/* Detalle por Participante - EDITABLE */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>Distribución por Participante</Text>
                      <Text style={styles.adjustHint}>
                        ✏️ Puedes editar las cantidades manualmente si es necesario
                      </Text>

                      {getSortedDistributions.map((dist: any, index: number) => (
                        <View key={dist.participantId} style={styles.editableItem}>
                          <View style={styles.editableItemHeader}>
                            <Text style={styles.editableParticipantName}>
                              {dist.participantName}
                            </Text>
                            <Text style={styles.editableParticipantType}>
                              {adjustedDistribution.preview.find(
                                (p) => p.participantId === dist.participantId
                              )?.participantType === 'EXTERNAL_COMPANY'
                                ? '🏢 Empresa'
                                : '🏛️ Sede'}
                            </Text>
                          </View>

                          <View style={styles.editableItemDetails}>
                            <View style={styles.editableDetailRow}>
                              <Text style={styles.editableDetailLabel}>Porcentaje:</Text>
                              <Text style={styles.editablePercentage}>
                                {dist.percentage.toFixed(2)}%
                              </Text>
                            </View>

                            {/* Input de cantidad editable */}
                            <View style={styles.editableQuantityContainer}>
                              <Text style={styles.editableQuantityLabel}>Cantidad:</Text>
                              <TextInput
                                style={styles.editableQuantityInput}
                                keyboardType="numeric"
                                placeholder="0"
                                value={dist.quantityBase.toString()}
                                onChangeText={(text) =>
                                  handleQuantityChange(dist.participantId, parseInt(text) || 0)
                                }
                              />
                              <Text style={styles.editableQuantityUnit}>unidades</Text>
                            </View>

                            {/* Mostrar equivalencia en presentación si aplica */}
                            {dist.roundingFactor > 1 && dist.quantityPresentation !== undefined && (
                              <View style={styles.presentationEquivalence}>
                                <Text style={styles.presentationEquivalenceText}>
                                  = {dist.quantityPresentation}{' '}
                                  {adjustedDistribution.presentationInfo?.largestPresentation
                                    ?.name || 'presentaciones'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Checkbox global para incluir en PDF */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>📄 Hojas de Reparto (PDF)</Text>
                      <TouchableOpacity
                        style={styles.includeInSheetGlobalContainer}
                        onPress={() => setIncludeInSheet(!includeInSheet)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.includeInSheetCheckbox,
                            includeInSheet && styles.includeInSheetCheckboxChecked,
                          ]}
                        >
                          {includeInSheet && <Text style={styles.includeInSheetCheckmark}>✓</Text>}
                        </View>
                        <View style={styles.includeInSheetTextContainer}>
                          <Text style={styles.includeInSheetLabelLarge}>
                            Incluir este producto en las hojas de reparto (PDF)
                          </Text>
                          <Text style={styles.includeInSheetDescription}>
                            {includeInSheet
                              ? '✅ Este producto aparecerá en el PDF consolidado de todos los participantes'
                              : '❌ Este producto NO aparecerá en el PDF (pero el reparto se creará normalmente)'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>


                  </>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalCancelButton, isTablet && styles.modalCancelButtonTablet]}
                  onPress={() => setShowAdjustModal(false)}
                  disabled={actionLoading}
                >
                  <Text
                    style={[
                      styles.modalCancelButtonText,
                      isTablet && styles.modalCancelButtonTextTablet,
                    ]}
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmButton, isTablet && styles.modalConfirmButtonTablet]}
                  onPress={handleConfirmGeneration}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.modalConfirmButtonText,
                        isTablet && styles.modalConfirmButtonTextTablet,
                      ]}
                    >
                      Confirmar y Generar
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    padding: 32,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    minWidth: 150,
  },
  infoLabelTablet: {
    fontSize: 16,
    minWidth: 180,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  infoValueTablet: {
    fontSize: 16,
  },
  statusContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  changeStatusButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeStatusButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  changeStatusButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  changeStatusButtonTextTablet: {
    fontSize: 14,
  },
  generatedYes: {
    color: '#10B981',
    fontWeight: '600',
  },
  generatedNo: {
    color: '#EF4444',
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manageButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  manageButtonTextTablet: {
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
  distributionItem: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
  },
  distributionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  distributionItems: {
    fontSize: 12,
    color: '#64748B',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoBoxTablet: {
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoTitleTablet: {
    fontSize: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
  infoTextTablet: {
    fontSize: 15,
    lineHeight: 24,
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
  previewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonTablet: {
    paddingVertical: 16,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  previewButtonTextTablet: {
    fontSize: 18,
  },
  generateButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonTablet: {
    paddingVertical: 16,
  },
  generateButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generateButtonTextTablet: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContentTablet: {
    width: '80%',
    maxWidth: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  modalTitleTablet: {
    fontSize: 22,
  },
  modalClose: {
    fontSize: 24,
    color: '#64748B',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  previewHeader: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewProductName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  previewProductStatus: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  previewSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  previewType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 8,
  },
  previewDescription: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  previewSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewSummaryLabel: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  previewSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  previewRemainder: {
    color: '#F59E0B',
  },
  previewQuantity: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  previewItem: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
  },
  previewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewParticipantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  previewParticipantType: {
    fontSize: 12,
    color: '#64748B',
  },
  previewItemDetails: {
    marginTop: 8,
  },
  previewDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewDetailLabel: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  // Adjust Modal Styles
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  adjustHint: {
    fontSize: 13,
    color: '#6366F1',
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  infoBoxModal: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 18,
  },
  adjustItem: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  adjustItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  adjustParticipantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  adjustParticipantType: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  adjustItemDetails: {
    marginTop: 4,
  },
  adjustDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  adjustDetailLabel: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  adjustAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  adjustPercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  adjustQuantity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalCancelButtonTablet: {
    paddingVertical: 14,
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  modalCancelButtonTextTablet: {
    fontSize: 17,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalConfirmButtonTablet: {
    paddingVertical: 14,
  },
  modalConfirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalConfirmButtonTextTablet: {
    fontSize: 17,
  },
  // Distribution Type Selector Styles
  distributionTypeHint: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  // Presentation Styles
  presentationToggleContainer: {
    gap: 10,
    marginBottom: 16,
  },
  presentationToggleOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  presentationToggleOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  presentationToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  presentationToggleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentationToggleRadioSelected: {
    borderColor: '#10B981',
  },
  presentationToggleRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  presentationToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  presentationToggleLabelSelected: {
    color: '#10B981',
  },
  presentationToggleDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginLeft: 30,
  },
  presentationSelectorContainer: {
    marginTop: 12,
  },
  presentationSelectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  presentationOptions: {
    gap: 8,
  },
  presentationOption: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  presentationOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  presentationOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  presentationOptionRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentationOptionRadioSelected: {
    borderColor: '#10B981',
  },
  presentationOptionRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  presentationOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  presentationOptionLabelSelected: {
    color: '#10B981',
  },
  presentationOptionFactor: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 24,
  },
  previewSummarySecondary: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '400',
  },
  adjustQuantitySecondary: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '400',
  },
  distributionTypeContainer: {
    gap: 10,
  },
  distributionTypeOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  distributionTypeOptionSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  distributionTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  distributionTypeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distributionTypeRadioSelected: {
    borderColor: '#6366F1',
  },
  distributionTypeRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  distributionTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  distributionTypeLabelSelected: {
    color: '#6366F1',
  },
  distributionTypeDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginLeft: 30,
  },
  previewLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  previewLoadingText: {
    fontSize: 13,
    color: '#6366F1',
  },
  // Custom Distribution Styles
  customTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginBottom: 12,
  },
  customTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  customTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  customTotalError: {
    color: '#EF4444',
  },
  customItem: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customParticipantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  customParticipantType: {
    fontSize: 12,
    color: '#64748B',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInputLabel: {
    fontSize: 13,
    color: '#64748B',
    minWidth: 70,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  customInputUnit: {
    fontSize: 13,
    color: '#64748B',
  },
  // Remainder Info Styles
  remainderInfoBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  remainderInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 6,
  },
  remainderInfoText: {
    fontSize: 12,
    color: '#065F46',
    lineHeight: 16,
  },
  remainderSiteName: {
    fontWeight: '700',
    color: '#047857',
  },
  remainderWarningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  remainderWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  remainderWarningText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  remainderAssignedBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  remainderAssignedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 6,
  },
  remainderAssignedText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
  },
  remainderParticipantName: {
    fontWeight: '700',
    color: '#1D4ED8',
  },
  previewAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  previewPercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  previewCalculated: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  modalCloseButton: {
    margin: 16,
    padding: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Stock Info Styles
  stockInfoSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
  },
  stockInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C4A6E',
    marginBottom: 12,
  },
  stockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stockInfoLabel: {
    fontSize: 13,
    color: '#075985',
    fontWeight: '500',
  },
  stockInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C4A6E',
  },
  stockInfoValueDifferent: {
    color: '#DC2626',
  },
  stockDifferenceWarning: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    gap: 10,
  },
  stockDifferenceWarningIcon: {
    fontSize: 18,
  },
  stockDifferenceWarningTextContainer: {
    flex: 1,
  },
  stockDifferenceWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  stockDifferenceWarningText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  previewSummaryError: {
    color: '#EF4444',
  },
  // Include in Sheet Checkbox Styles
  includeInSheetGlobalContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  includeInSheetCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  includeInSheetCheckboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  includeInSheetCheckmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  includeInSheetTextContainer: {
    flex: 1,
  },
  includeInSheetLabelLarge: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
    lineHeight: 20,
  },
  includeInSheetDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  // Stock Detail Styles
  stockDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stockWarehouseName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stockDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stockDetailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  stockDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  stockReserved: {
    color: '#F59E0B',
  },
  stockAvailable: {
    color: '#10B981',
  },
  // Editable Total Quantity Styles
  editableTotalQuantityContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  editableTotalQuantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 10,
  },
  editableTotalQuantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  editableTotalQuantityInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0C4A6E',
    backgroundColor: '#FFFFFF',
  },
  editableTotalQuantityUnit: {
    fontSize: 14,
    color: '#0C4A6E',
    fontWeight: '600',
  },
  editableTotalQuantityHint: {
    fontSize: 12,
    color: '#0369A1',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  recalculateButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recalculateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Editable Distribution Styles
  editableItem: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  editableItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editableParticipantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  editableParticipantType: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  editableItemDetails: {
    gap: 10,
  },
  editableDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editableDetailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  editablePercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  roundingFactorContainer: {
    marginTop: 4,
  },
  roundingFactorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  roundingFactorButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  roundingFactorButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  roundingFactorButtonSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  roundingFactorButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  roundingFactorButtonTextSelected: {
    color: '#10B981',
  },
  editableQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editableQuantityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    minWidth: 70,
  },
  editableQuantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    fontWeight: '600',
  },
  editableQuantityUnit: {
    fontSize: 13,
    color: '#64748B',
  },
  presentationEquivalence: {
    marginTop: 6,
    paddingLeft: 78,
  },
  presentationEquivalenceText: {
    fontSize: 12,
    color: '#6366F1',
    fontStyle: 'italic',
  },
});
