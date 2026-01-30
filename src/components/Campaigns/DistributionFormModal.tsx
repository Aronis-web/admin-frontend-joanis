import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { campaignsService, inventoryApi } from '@/services/api';
import logger from '@/utils/logger';
import {
  CampaignProduct,
  DistributionPreviewResponse,
  DistributionType,
  DistributionTypeLabels,
  DistributionTypeDescriptions,
  StockDetailByWarehouse,
} from '@/types/campaigns';

interface DistributionFormModalProps {
  visible: boolean;
  campaignId: string;
  product: CampaignProduct | null;
  localStockData?: StockDetailByWarehouse[];
  onClose: () => void;
  onSuccess: () => void;
  asContent?: boolean; // If true, renders as content instead of Modal (for nested usage)
}

export const DistributionFormModal: React.FC<DistributionFormModalProps> = ({
  visible,
  campaignId,
  product,
  localStockData,
  onClose,
  onSuccess,
  asContent = false,
}) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  // Estados del formulario de distribución
  const [adjustedDistribution, setAdjustedDistribution] =
    useState<DistributionPreviewResponse | null>(null);
  const [selectedDistributionType, setSelectedDistributionType] = useState<DistributionType | null>(
    null
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  // Include in sheet state (for PDF generation)
  const [includeInSheet, setIncludeInSheet] = useState<boolean>(true);

  // Editable total quantity
  const [editableTotalQuantity, setEditableTotalQuantity] = useState<number>(0);

  // Custom quantities for CUSTOM distribution type
  const [customQuantities, setCustomQuantities] = useState<{ [participantId: string]: number }>({});

  // Helper function to get stock details from product
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

  // Load initial distribution preview when modal opens
  useEffect(() => {
    if (visible && product && !adjustedDistribution) {
      handleGenerateDistribution();
    }
  }, [visible, product]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setAdjustedDistribution(null);
      setSelectedDistributionType(null);
      setEditableDistributions({});
      setGlobalRoundingFactor(1);
      setUsePresentation(false);
      setSelectedPresentationId(null);
      setSelectedPresentation(null);
      setIncludeInSheet(true);
      setEditableTotalQuantity(0);
      setCustomQuantities({});
    }
  }, [visible]);

  const handleGenerateDistribution = useCallback(async () => {
    if (!product) {
      return;
    }

    logger.debug('🚀 [MODAL] Iniciando cálculo local de reparto para producto:', {
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

    try {
      setPreviewLoading(true);

      // Obtener stock disponible desde localStockData o product.product.stockItems
      const stockDetails = getStockDetailsFromProduct() || [];
      const totalAvailableStock = stockDetails.reduce((sum, stock) => sum + stock.available, 0);

      logger.debug('📦 [MODAL] Stock disponible calculado:', {
        stockDetails,
        totalAvailableStock,
      });

      // Usar stock disponible como cantidad inicial
      const initialQuantity = totalAvailableStock > 0 ? totalAvailableStock : 0;
      setEditableTotalQuantity(initialQuantity);

      // Inicializar con roundingFactor = 1 (unidades) por defecto para TODOS
      const initialRoundingFactor = 1;
      setGlobalRoundingFactor(initialRoundingFactor);

      // Obtener participantes de la campaña (necesitamos hacer una llamada para esto)
      const campaignData = await campaignsService.getCampaign(campaignId);
      const participants = campaignData.participants || [];

      logger.debug('✅ [MODAL] Participantes obtenidos:', {
        totalParticipants: participants.length,
        participants: participants.map(p => ({ id: p.id, name: p.company?.name || p.site?.name, amount: p.assignedAmount })),
      });

      // Calcular distribución localmente usando (montoEsperado / factorPerfilPrecio)
      // Primero calcular el monto ajustado para cada participante
      const participantsWithAdjustedAmount = participants.map((participant) => {
        const assignedAmount = participant.assignedAmount || 0;
        const priceProfileFactor = participant.priceProfile?.factor || 1;
        const adjustedAmount = assignedAmount / priceProfileFactor;

        logger.debug('💰 [CALC] Monto ajustado para participante:', {
          name: participant.company?.name || participant.site?.name,
          assignedAmount,
          priceProfileFactor,
          adjustedAmount,
        });

        return {
          ...participant,
          adjustedAmount,
        };
      });

      const totalAdjustedAmount = participantsWithAdjustedAmount.reduce(
        (sum, p) => sum + p.adjustedAmount,
        0
      );

      logger.debug('💰 [CALC] Total monto ajustado:', totalAdjustedAmount);

      const initialDistributions: typeof editableDistributions = {};
      let totalDistributed = 0;

      participantsWithAdjustedAmount.forEach((participant) => {
        const percentage = totalAdjustedAmount > 0
          ? (participant.adjustedAmount / totalAdjustedAmount) * 100
          : 100 / participants.length;

        const exactQuantity = (percentage / 100) * initialQuantity;
        const flooredQuantity = Math.floor(exactQuantity);

        initialDistributions[participant.id] = {
          participantId: participant.id,
          participantName: participant.company?.name || participant.site?.name || 'Sin nombre',
          quantityBase: flooredQuantity,
          roundingFactor: initialRoundingFactor,
          presentationId: undefined,
          quantityPresentation: undefined,
          percentage: percentage,
        };

        totalDistributed += flooredQuantity;

        logger.debug('📊 [CALC] Distribución calculada:', {
          name: participant.company?.name || participant.site?.name,
          percentage: percentage.toFixed(2),
          quantity: flooredQuantity,
        });
      });

      // Asignar remanente al primer participante (o sede de redondeo si existe)
      const remainder = initialQuantity - totalDistributed;
      if (remainder > 0 && participants.length > 0) {
        const firstParticipantId = participants[0].id;
        if (initialDistributions[firstParticipantId]) {
          initialDistributions[firstParticipantId].quantityBase += remainder;
          totalDistributed += remainder;
        }
      }

      setEditableDistributions(initialDistributions);

      // Crear objeto adjustedDistribution para compatibilidad con el resto del código
      const mockPreview: DistributionPreviewResponse = {
        productId: product.id,
        productName: product.product?.title || 'Producto',
        totalQuantity: initialQuantity,
        distributionType: product.distributionType,
        isPreliminary: product.productStatus !== 'ACTIVE',
        currency: 'PEN',
        totalDistributed: totalDistributed,
        remainder: initialQuantity - totalDistributed,
        totalParticipants: participants.length,
        stockDetails: stockDetails,
        preview: Object.values(initialDistributions).map(dist => ({
          participantId: dist.participantId,
          participantName: dist.participantName,
          participantType: participants.find(p => p.id === dist.participantId)?.company ? 'EXTERNAL_COMPANY' : 'INTERNAL_SITE',
          assignedAmount: participants.find(p => p.id === dist.participantId)?.assignedAmount || 0,
          percentage: dist.percentage,
          calculatedQuantity: dist.quantityBase,
          roundingFactor: dist.roundingFactor,
          presentationId: dist.presentationId,
          quantityPresentation: dist.quantityPresentation,
        })),
        presentationInfo: product.product?.presentations && product.product.presentations.length > 0 ? {
          hasPresentations: true,
          largestFactor: Math.max(...product.product.presentations.map(p => p.factorToBase)),
          largestPresentation: product.product.presentations.reduce((max, p) =>
            p.factorToBase > (max?.factorToBase || 0) ? p : max
          ),
        } : undefined,
      };

      setAdjustedDistribution(mockPreview);

      logger.debug('💾 [MODAL] Distribuciones calculadas localmente:', {
        count: Object.keys(initialDistributions).length,
        totalDistributed,
        remainder: initialQuantity - totalDistributed,
      });

      // Inicializar como incluido en el PDF por defecto
      setIncludeInSheet(true);

      logger.debug('✅ [MODAL] Modal listo para mostrarse');
    } catch (error: any) {
      logger.error('❌ [MODAL] Error calculando distribución:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo calcular la distribución'
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [product, campaignId, getStockDetailsFromProduct]);

  const handleDistributionTypeChange = useCallback(
    async (type: DistributionType) => {
      if (!product || !adjustedDistribution) {
        return;
      }

      logger.debug('🔄 [DISTRIBUTION TYPE] Cambiando tipo de distribución:', {
        oldType: selectedDistributionType,
        newType: type,
      });

      setSelectedDistributionType(type);

      // Si es INTERNAL_ONLY o INTERNAL_EQUAL, filtrar localmente y recalcular
      if (type === DistributionType.INTERNAL_ONLY || type === DistributionType.INTERNAL_EQUAL) {
        logger.debug('🏢 [INTERNAL SITES] Filtrando solo sedes internas...');

        // Filtrar solo participantes que son sedes internas
        const internalSitesOnly = adjustedDistribution.preview.filter(
          (item) => item.participantType === 'INTERNAL_SITE'
        );

        logger.debug('✅ [INTERNAL SITES] Sedes internas encontradas:', {
          total: internalSitesOnly.length,
          sites: internalSitesOnly.map((s) => s.participantName),
        });

        if (internalSitesOnly.length === 0) {
          Alert.alert('Error', 'No hay sedes internas en esta campaña');
          return;
        }

        // Recalcular distribución solo entre sedes internas
        const totalQuantity = editableTotalQuantity || adjustedDistribution.totalQuantity;

        const newDistributions: typeof editableDistributions = {};
        let totalDistributed = 0;
        let remainderParticipantId: string | null = null;

        if (type === DistributionType.INTERNAL_EQUAL) {
          // INTERNAL_EQUAL: Distribuir cantidad igual entre todas las sedes
          logger.debug('⚖️ [INTERNAL EQUAL] Distribuyendo cantidades iguales...');

          const quantityPerSite = Math.floor(totalQuantity / internalSitesOnly.length);
          const percentagePerSite = 100 / internalSitesOnly.length;

          internalSitesOnly.forEach((site) => {
            newDistributions[site.participantId] = {
              participantId: site.participantId,
              participantName: site.participantName,
              quantityBase: quantityPerSite,
              roundingFactor: globalRoundingFactor,
              presentationId: site.presentationId,
              quantityPresentation:
                globalRoundingFactor > 1 ? Math.floor(quantityPerSite / globalRoundingFactor) : undefined,
              percentage: percentagePerSite,
            };

            totalDistributed += quantityPerSite;
          });

          // Asignar remanente a la sede de redondeo (o primera sede)
          const remainder = totalQuantity - totalDistributed;
          if (remainder > 0 && internalSitesOnly.length > 0) {
            // Buscar la sede de redondeo del preview original
            remainderParticipantId =
              adjustedDistribution.remainderAssignedTo?.participantId ||
              adjustedDistribution.preview.find((p) => p.participantType === 'INTERNAL_SITE')?.participantId ||
              internalSitesOnly[0].participantId;

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

          logger.debug('✅ [INTERNAL EQUAL] Distribución igual calculada:', {
            totalQuantity,
            quantityPerSite,
            totalDistributed,
            remainder,
            remainderAssignedTo: remainderParticipantId,
            sitesCount: Object.keys(newDistributions).length,
          });
        } else {
          // INTERNAL_ONLY: Distribuir porcentualmente entre sedes internas según sus porcentajes originales
          logger.debug('📊 [INTERNAL ONLY] Distribuyendo porcentualmente según montos esperados...');

          // Calcular el total de porcentajes de las sedes internas
          const totalInternalPercentage = internalSitesOnly.reduce((sum, site) => sum + site.percentage, 0);

          logger.debug('📊 [INTERNAL ONLY] Porcentajes originales:', {
            sites: internalSitesOnly.map((s) => ({ name: s.participantName, percentage: s.percentage })),
            totalInternalPercentage,
          });

          // Calcular cantidades usando Math.floor para evitar excedentes
          internalSitesOnly.forEach((site) => {
            // Usar el porcentaje original del participante (basado en su monto esperado)
            // y recalcular proporcionalmente solo entre las sedes internas
            const adjustedPercentage = (site.percentage / totalInternalPercentage) * 100;
            const exactQuantity = (adjustedPercentage / 100) * totalQuantity;
            const flooredQuantity = Math.floor(exactQuantity);

            newDistributions[site.participantId] = {
              participantId: site.participantId,
              participantName: site.participantName,
              quantityBase: flooredQuantity,
              roundingFactor: globalRoundingFactor,
              presentationId: site.presentationId,
              quantityPresentation:
                globalRoundingFactor > 1 ? Math.floor(flooredQuantity / globalRoundingFactor) : undefined,
              percentage: adjustedPercentage,
            };

            totalDistributed += flooredQuantity;
          });

          // Asignar remanente a la sede de redondeo (o primera sede)
          const remainder = totalQuantity - totalDistributed;
          if (remainder > 0 && internalSitesOnly.length > 0) {
            // Buscar la sede de redondeo del preview original
            remainderParticipantId =
              adjustedDistribution.remainderAssignedTo?.participantId ||
              adjustedDistribution.preview.find((p) => p.participantType === 'INTERNAL_SITE')?.participantId ||
              internalSitesOnly[0].participantId;

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

          logger.debug('✅ [INTERNAL ONLY] Distribución porcentual calculada:', {
            totalQuantity,
            totalDistributed,
            remainder,
            remainderAssignedTo: remainderParticipantId,
            sitesCount: Object.keys(newDistributions).length,
          });
        }

        setEditableDistributions(newDistributions);
      } else {
        // Para otros tipos, usar la distribución original del preview
        logger.debug('📊 [ALL PARTICIPANTS] Usando distribución original del preview');

        const updatedDistributions: typeof editableDistributions = {};
        adjustedDistribution.preview.forEach((item) => {
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
      }
    },
    [product, campaignId, adjustedDistribution, editableTotalQuantity, globalRoundingFactor, selectedDistributionType, editableDistributions]
  );

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

  const getTotalDistributed = useCallback(() => {
    return Object.values(editableDistributions).reduce((sum, dist) => sum + dist.quantityBase, 0);
  }, [editableDistributions]);

  const recalculateDistributions = useCallback(async (newTotalQuantity: number) => {
    if (!adjustedDistribution) {
      return;
    }

    logger.debug(
      '🔄 [RECALC] Recalculando distribuciones localmente con nueva cantidad:',
      newTotalQuantity
    );

    try {
      // Obtener participantes frescos de la campaña para tener los factores actualizados
      const campaignData = await campaignsService.getCampaign(campaignId);
      const participants = campaignData.participants || [];

      // Calcular monto ajustado para cada participante usando (montoEsperado / factorPerfilPrecio)
      const participantsWithAdjustedAmount = participants.map((participant) => {
        const assignedAmount = participant.assignedAmount || 0;
        const priceProfileFactor = participant.priceProfile?.factor || 1;
        const adjustedAmount = assignedAmount / priceProfileFactor;

        return {
          ...participant,
          adjustedAmount,
        };
      });

      const totalAdjustedAmount = participantsWithAdjustedAmount.reduce(
        (sum, p) => sum + p.adjustedAmount,
        0
      );

      // Recalcular cantidades basadas en porcentajes ajustados
      const newDistributions: typeof editableDistributions = {};
      let totalDistributed = 0;
      let remainderParticipantId: string | null = null;

      // Primero, calcular cantidades usando Math.floor para evitar excedentes
      participantsWithAdjustedAmount.forEach((participant) => {
        const percentage = totalAdjustedAmount > 0
          ? (participant.adjustedAmount / totalAdjustedAmount) * 100
          : 100 / participants.length;

        const exactQuantity = (percentage / 100) * newTotalQuantity;
        const flooredQuantity = Math.floor(exactQuantity);

        // Buscar la distribución existente para mantener el roundingFactor
        const existingDist = editableDistributions[participant.id];

        newDistributions[participant.id] = {
          participantId: participant.id,
          participantName: participant.company?.name || participant.site?.name || 'Sin nombre',
          quantityBase: flooredQuantity,
          roundingFactor: existingDist?.roundingFactor || globalRoundingFactor,
          presentationId: existingDist?.presentationId,
          quantityPresentation:
            globalRoundingFactor > 1 ? Math.floor(flooredQuantity / globalRoundingFactor) : undefined,
          percentage: percentage,
        };

        totalDistributed += flooredQuantity;
      });

      // Calcular remanente (ahora siempre será >= 0)
      const remainder = newTotalQuantity - totalDistributed;

      // Asignar remanente a la sede de ajuste (o al primer participante si no hay sede de ajuste)
      if (remainder > 0 && participants.length > 0) {
        // Buscar la sede de ajuste del preview original
        remainderParticipantId =
          adjustedDistribution.remainderAssignedTo?.participantId ||
          participants[0]?.id;

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
        percentage: newDistributions[item.participantId]?.percentage || item.percentage,
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
    } catch (error: any) {
      logger.error('❌ [RECALC] Error recalculando distribuciones:', error);
      Alert.alert('Error', 'No se pudo recalcular las distribuciones');
    }
  }, [adjustedDistribution, editableDistributions, globalRoundingFactor, campaignId]);

  const handleGlobalRoundingFactorChange = useCallback(
    async (newFactor: number) => {
      if (!product || !adjustedDistribution) {
        return;
      }

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

      // Actualizar roundingFactor localmente sin llamar al backend
      setGlobalRoundingFactor(newFactor);

      // Actualizar distribuciones editables con el nuevo factor
      const updatedDistributions: typeof editableDistributions = {};
      Object.values(editableDistributions).forEach((dist) => {
        updatedDistributions[dist.participantId] = {
          ...dist,
          roundingFactor: newFactor,
          quantityPresentation: newFactor > 1 ? Math.floor(dist.quantityBase / newFactor) : undefined,
        };
      });
      setEditableDistributions(updatedDistributions);

      // Actualizar adjustedDistribution
      const updatedPreview = adjustedDistribution.preview.map((item) => ({
        ...item,
        roundingFactor: newFactor,
        quantityPresentation: newFactor > 1 ? Math.floor(item.calculatedQuantity / newFactor) : undefined,
      }));

      setAdjustedDistribution({
        ...adjustedDistribution,
        preview: updatedPreview,
      });

      logger.debug('✅ [MODAL] RoundingFactor actualizado localmente');
    },
    [globalRoundingFactor, editableDistributions, adjustedDistribution, product]
  );

  const getSortedDistributions = useMemo(() => {
    const distributions = Object.values(editableDistributions);

    const sorted = distributions.sort((a, b) => {
      const typeA =
        adjustedDistribution?.preview.find((p) => p.participantId === a.participantId)
          ?.participantType || 'EXTERNAL_COMPANY';
      const typeB =
        adjustedDistribution?.preview.find((p) => p.participantId === b.participantId)
          ?.participantType || 'EXTERNAL_COMPANY';

      if (typeA === 'INTERNAL_SITE' && typeB !== 'INTERNAL_SITE') {
        return -1;
      }
      if (typeA !== 'INTERNAL_SITE' && typeB === 'INTERNAL_SITE') {
        return 1;
      }

      return a.participantName.localeCompare(b.participantName);
    });

    return sorted;
  }, [editableDistributions, adjustedDistribution]);

  const handlePresentationChange = useCallback(
    (presentationId: string) => {
      const presentation = product?.product?.presentations?.find(
        (p) => p.presentationId === presentationId
      );
      if (presentation) {
        setSelectedPresentationId(presentationId);
        setSelectedPresentation(presentation);
      }
    },
    [product]
  );

  const validateDistributions = useCallback((): boolean => {
    const totalDistributed = getTotalDistributed();

    // Calculate total available stock
    const stockDetails = adjustedDistribution?.stockDetails || localStockData || [];
    const totalAvailableStock = stockDetails.reduce((sum, stock) => sum + stock.available, 0);

    // Use the minimum between editableTotalQuantity and actual available stock
    const maxAllowedQuantity = totalAvailableStock > 0
      ? Math.min(editableTotalQuantity, totalAvailableStock)
      : editableTotalQuantity;

    if (totalDistributed > maxAllowedQuantity) {
      Alert.alert(
        'Error de Validación',
        `La cantidad total distribuida (${totalDistributed}) excede la cantidad disponible (${maxAllowedQuantity}).\n\nPor favor, ajusta las cantidades.`
      );
      return false;
    }

    if (totalDistributed === 0) {
      Alert.alert('Error de Validación', 'Debes distribuir al menos 1 unidad.');
      return false;
    }

    return true;
  }, [getTotalDistributed, editableTotalQuantity, adjustedDistribution, localStockData]);

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
      const result = await campaignsService.generateDistribution(campaignId, product.id, {
        distributions,
        notes: `Reparto generado desde preview - ${new Date().toLocaleString()}`,
      });

      logger.debug('✅ [MODAL] Reparto generado exitosamente:', result.repartoCode);

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
              onSuccess();
              onClose();
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
  }, [product, adjustedDistribution, validateDistributions, editableDistributions, campaignId, includeInSheet, onSuccess, onClose]);

  if (!product) {
    return null;
  }

  // Content to render (same for both modal and inline)
  const content = (
    <>
      <View style={asContent ? styles.contentContainer : styles.modalOverlay}>
        <View style={asContent ? styles.contentInner : [styles.modalContent, isTablet && styles.modalContentTablet]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
              Ajustar y Generar Reparto
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
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

                {/* Selector de Tipo de Distribución */}
                <View style={styles.previewSection}>
                  <Text style={styles.previewSectionTitle}>Tipo de Reparto</Text>
                  <Text style={styles.distributionTypeHint}>
                    Selecciona cómo deseas distribuir este producto:
                  </Text>

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

                {/* Stock Information */}
                {(() => {
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
              onPress={onClose}
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
    </>
  );

  // Return as Modal or as content depending on asContent prop
  if (asContent) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Styles for when rendered as content (inside banner)
  contentContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentInner: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Styles for when rendered as modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalContentTablet: {
    width: '70%',
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalTitleTablet: {
    fontSize: 24,
  },
  modalClose: {
    fontSize: 28,
    fontWeight: '600',
    color: '#64748B',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    flexGrow: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonTablet: {
    paddingVertical: 16,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  modalCancelButtonTextTablet: {
    fontSize: 18,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonTablet: {
    paddingVertical: 16,
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalConfirmButtonTextTablet: {
    fontSize: 18,
  },
  previewHeader: {
    marginBottom: 16,
  },
  previewProductName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  previewProductStatus: {
    fontSize: 14,
    color: '#64748B',
  },
  stockDifferenceWarning: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  stockDifferenceWarningIcon: {
    fontSize: 24,
  },
  stockDifferenceWarningTextContainer: {
    flex: 1,
  },
  stockDifferenceWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  stockDifferenceWarningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  previewSection: {
    marginBottom: 20,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  distributionTypeHint: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  distributionTypeContainer: {
    gap: 12,
  },
  distributionTypeOption: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  distributionTypeOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  distributionTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  distributionTypeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  distributionTypeLabelSelected: {
    color: '#6366F1',
  },
  distributionTypeDescription: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 32,
  },
  previewLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  previewLoadingText: {
    fontSize: 14,
    color: '#6366F1',
  },
  stockDetailCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  stockWarehouseName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  stockDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stockDetailLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  stockDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  stockReserved: {
    color: '#F59E0B',
  },
  stockAvailable: {
    color: '#10B981',
  },
  previewSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewSummaryLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  previewSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  previewSummaryError: {
    color: '#EF4444',
  },
  previewRemainder: {
    color: '#F59E0B',
  },
  editableTotalQuantityContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  editableTotalQuantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  editableTotalQuantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editableTotalQuantityInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  editableTotalQuantityUnit: {
    fontSize: 14,
    color: '#64748B',
  },
  recalculateButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  recalculateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editableTotalQuantityHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  adjustHint: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  roundingFactorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roundingFactorButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  roundingFactorButtonSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  roundingFactorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  roundingFactorButtonTextSelected: {
    color: '#6366F1',
  },
  editableItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editableItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editableParticipantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  editableParticipantType: {
    fontSize: 13,
    color: '#64748B',
  },
  editableItemDetails: {
    gap: 8,
  },
  editableDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editableDetailLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  editablePercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  editableQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editableQuantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    minWidth: 80,
  },
  editableQuantityInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  editableQuantityUnit: {
    fontSize: 14,
    color: '#64748B',
  },
  presentationEquivalence: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  presentationEquivalenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  includeInSheetGlobalContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  includeInSheetCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  includeInSheetCheckboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  includeInSheetCheckmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  includeInSheetTextContainer: {
    flex: 1,
  },
  includeInSheetLabelLarge: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  includeInSheetDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
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
});
