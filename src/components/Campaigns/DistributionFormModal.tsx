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
  ParticipantType,
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

  // Distribution mode: 'units' or 'presentation'
  const [distributionMode, setDistributionMode] = useState<'units' | 'presentation'>('units');

  // Source warehouse and area selection
  const [selectedSourceWarehouseId, setSelectedSourceWarehouseId] = useState<string | null>(null);
  const [selectedSourceAreaId, setSelectedSourceAreaId] = useState<string | null>(null);

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
  // Use a ref to track if we've already loaded to prevent double execution
  const hasLoadedRef = React.useRef(false);

  useEffect(() => {
    if (visible && product && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      handleGenerateDistribution();
    }

    // Reset the ref when modal closes
    if (!visible) {
      hasLoadedRef.current = false;
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
      setDistributionMode('units'); // Reset to units by default
      setSelectedSourceWarehouseId(null);
      setSelectedSourceAreaId(null);
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
        participants: participants.map(p => ({
          id: p.id,
          name: p.company?.name || p.site?.name,
          amountCents: p.assignedAmountCents,
          fullParticipant: p
        })),
      });

      console.log('🔍 [DEBUG] Participantes completos:', JSON.stringify(participants, null, 2));

      // Calcular distribución localmente usando solo el monto esperado
      const participantsWithAdjustedAmount = participants.map((participant) => {
        // Convertir a número porque puede venir como string del backend
        const assignedAmountCents = Number(participant.assignedAmountCents) || 0;

        logger.debug('💰 [CALC] Monto esperado para participante:', {
          name: participant.company?.name || participant.site?.name,
          assignedAmountCents,
        });

        return {
          ...participant,
          adjustedAmount: assignedAmountCents,
        };
      });

      const totalAdjustedAmount = participantsWithAdjustedAmount.reduce(
        (sum, p) => sum + p.adjustedAmount,
        0
      );

      logger.debug('💰 [CALC] Total monto esperado:', totalAdjustedAmount);
      logger.debug('📦 [CALC] Cantidad inicial a distribuir:', initialQuantity);

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
          assignedAmountCents: participant.assignedAmountCents,
          adjustedAmount: participant.adjustedAmount,
          percentage: percentage.toFixed(2),
          exactQuantity: exactQuantity.toFixed(2),
          quantity: flooredQuantity,
        });
      });

      // Asignar remanente a la sede de ajuste configurada en la campaña
      const remainder = initialQuantity - totalDistributed;
      if (remainder > 0 && participants.length > 0) {
        // Buscar el participante que corresponde a la sede de ajuste
        // remainderSiteId es el ID de la SEDE, no del participante
        const remainderParticipant = campaignData.remainderSiteId
          ? participants.find(p => p.siteId === campaignData.remainderSiteId)
          : participants[0];

        const remainderParticipantId = remainderParticipant?.id || participants[0].id;

        logger.debug('🎯 [MODAL] Asignando remanente:', {
          campaignRemainderSiteId: campaignData.remainderSiteId,
          foundParticipant: remainderParticipant ? {
            id: remainderParticipant.id,
            siteId: remainderParticipant.siteId,
            name: remainderParticipant.company?.name || remainderParticipant.site?.name
          } : null,
          remainderParticipantId,
          remainder,
        });

        if (initialDistributions[remainderParticipantId]) {
          initialDistributions[remainderParticipantId].quantityBase += remainder;

          // Recalcular quantityPresentation si hay factor de redondeo
          if (initialDistributions[remainderParticipantId].roundingFactor > 1) {
            initialDistributions[remainderParticipantId].quantityPresentation = Math.floor(
              initialDistributions[remainderParticipantId].quantityBase / initialDistributions[remainderParticipantId].roundingFactor
            );
          }

          totalDistributed += remainder;

          logger.debug('✅ [MODAL] Remanente asignado a sede de ajuste:', {
            participantId: remainderParticipantId,
            siteName: initialDistributions[remainderParticipantId].participantName,
            remainder,
            newQuantityBase: initialDistributions[remainderParticipantId].quantityBase,
            newQuantityPresentation: initialDistributions[remainderParticipantId].quantityPresentation,
          });
        } else {
          logger.error('❌ [MODAL] No se encontró el participante para asignar remanente:', {
            remainderParticipantId,
            availableIds: Object.keys(initialDistributions),
          });
        }
      }

      setEditableDistributions(initialDistributions);

      // Crear objeto adjustedDistribution para compatibilidad con el resto del código
      // @ts-expect-error - Tipos compatibles en runtime, diferencias menores en enums
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
        preview: Object.values(initialDistributions).map(dist => {
          const participant = participants.find(p => p.id === dist.participantId);
          return {
            participantId: dist.participantId,
            participantName: dist.participantName,
            participantType: participant?.company ? ParticipantType.EXTERNAL_COMPANY : ParticipantType.INTERNAL_SITE,
            assignedAmount: Number(participant?.assignedAmountCents || 0) / 100,
            percentage: dist.percentage,
            calculatedQuantity: dist.quantityBase,
            roundingFactor: dist.roundingFactor,
            presentationId: dist.presentationId,
            quantityPresentation: dist.quantityPresentation,
          };
        }),
        presentationInfo: product.product?.presentations && product.product.presentations.length > 0 ? {
          hasPresentations: true,
          largestFactor: Math.max(...product.product.presentations.map(p => p.factorToBase)),
          largestPresentation: (() => {
            const largest = product.product.presentations.reduce((max, p) =>
              p.factorToBase > (max?.factorToBase || 0) ? p : max
            );
            return {
              id: largest.presentationId,
              name: largest.presentation?.name || 'Presentación',
              factorToBase: largest.factorToBase,
              description: largest.presentation?.name,
            };
          })(),
          totalPresentations: product.product.presentations.length,
          roundingApplied: false,
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

        // Obtener campaignData para acceder a remainderSiteId
        const campaignData = await campaignsService.getCampaign(campaignId);

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
          // INTERNAL_EQUAL: Distribuir proporcionalmente según monto esperado entre sedes internas
          logger.debug('⚖️ [INTERNAL EQUAL] Distribuyendo proporcionalmente según montos esperados...');

          // Calcular el total de porcentajes de las sedes internas
          const totalInternalPercentage = internalSitesOnly.reduce((sum, site) => sum + site.percentage, 0);

          logger.debug('📊 [INTERNAL EQUAL] Porcentajes originales:', {
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

          // Asignar remanente a la sede de ajuste configurada en la campaña
          const remainder = totalQuantity - totalDistributed;
          if (remainder > 0 && internalSitesOnly.length > 0) {
            // Buscar el participante que corresponde a la sede de ajuste
            // remainderSiteId es el ID de la SEDE, no del participante
            const remainderParticipant = campaignData.remainderSiteId
              ? internalSitesOnly.find(s => {
                  const participant = adjustedDistribution.preview.find(p => p.participantId === s.participantId);
                  return participant && participant.participantType === 'INTERNAL_SITE';
                })
              : null;

            // Buscar por siteId en los participantes originales
            const allParticipants = await campaignsService.getCampaign(campaignId).then(c => c.participants || []);
            const siteParticipant = campaignData.remainderSiteId
              ? allParticipants.find(p => p.siteId === campaignData.remainderSiteId)
              : null;

            remainderParticipantId = siteParticipant?.id || internalSitesOnly[0].participantId;

            logger.debug('🎯 [INTERNAL EQUAL] Asignando remanente:', {
              campaignRemainderSiteId: campaignData.remainderSiteId,
              foundParticipant: siteParticipant ? {
                id: siteParticipant.id,
                siteId: siteParticipant.siteId,
                name: siteParticipant.site?.name
              } : null,
              remainderParticipantId,
              remainder,
            });

            if (remainderParticipantId && newDistributions[remainderParticipantId]) {
              newDistributions[remainderParticipantId].quantityBase += remainder;
              if (globalRoundingFactor > 1) {
                newDistributions[remainderParticipantId].quantityPresentation = Math.floor(
                  newDistributions[remainderParticipantId].quantityBase / globalRoundingFactor
                );
              }
              totalDistributed += remainder;

              logger.debug('✅ [INTERNAL EQUAL] Remanente asignado a sede de ajuste:', {
                participantId: remainderParticipantId,
                siteName: newDistributions[remainderParticipantId].participantName,
                remainder,
                newQuantityBase: newDistributions[remainderParticipantId].quantityBase,
              });
            } else {
              logger.error('❌ [INTERNAL EQUAL] No se encontró el participante para asignar remanente:', {
                remainderParticipantId,
                availableIds: Object.keys(newDistributions),
              });
            }
          }

          logger.debug('✅ [INTERNAL EQUAL] Distribución igual calculada:', {
            totalQuantity,
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

          // Asignar remanente a la sede de ajuste configurada en la campaña
          const remainder = totalQuantity - totalDistributed;
          if (remainder > 0 && internalSitesOnly.length > 0) {
            // Buscar el participante que corresponde a la sede de ajuste
            // remainderSiteId es el ID de la SEDE, no del participante
            const allParticipants = await campaignsService.getCampaign(campaignId).then(c => c.participants || []);
            const siteParticipant = campaignData.remainderSiteId
              ? allParticipants.find(p => p.siteId === campaignData.remainderSiteId)
              : null;

            remainderParticipantId = siteParticipant?.id || internalSitesOnly[0].participantId;

            logger.debug('🎯 [INTERNAL ONLY] Asignando remanente:', {
              campaignRemainderSiteId: campaignData.remainderSiteId,
              foundParticipant: siteParticipant ? {
                id: siteParticipant.id,
                siteId: siteParticipant.siteId,
                name: siteParticipant.site?.name
              } : null,
              remainderParticipantId,
              remainder,
            });

            if (remainderParticipantId && newDistributions[remainderParticipantId]) {
              newDistributions[remainderParticipantId].quantityBase += remainder;
              if (globalRoundingFactor > 1) {
                newDistributions[remainderParticipantId].quantityPresentation = Math.floor(
                  newDistributions[remainderParticipantId].quantityBase / globalRoundingFactor
                );
              }
              totalDistributed += remainder;

              logger.debug('✅ [INTERNAL ONLY] Remanente asignado a sede de ajuste:', {
                participantId: remainderParticipantId,
                siteName: newDistributions[remainderParticipantId].participantName,
                remainder,
                newQuantityBase: newDistributions[remainderParticipantId].quantityBase,
              });
            } else {
              logger.error('❌ [INTERNAL ONLY] No se encontró el participante para asignar remanente:', {
                remainderParticipantId,
                availableIds: Object.keys(newDistributions),
              });
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

  const handlePresentationQuantityChange = useCallback((participantId: string, newQuantityPresentation: number) => {
    setEditableDistributions((prev) => {
      const dist = prev[participantId];
      if (!dist) {
        return prev;
      }

      const updated = { ...prev };
      const newQuantityBase = newQuantityPresentation * dist.roundingFactor;

      updated[participantId] = {
        ...dist,
        quantityPresentation: newQuantityPresentation,
        quantityBase: newQuantityBase,
      };

      logger.debug('📝 [EDIT] Cantidad en presentación editada:', {
        participantId,
        participantName: dist.participantName,
        newQuantityPresentation,
        newQuantityBase,
        roundingFactor: dist.roundingFactor,
      });

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
      '🔄 [RECALC] Recalculando distribuciones con nueva cantidad:',
      newTotalQuantity,
      'Modo:',
      distributionMode
    );

    try {
      // Obtener participantes frescos de la campaña
      const campaignData = await campaignsService.getCampaign(campaignId);
      const participants = campaignData.participants || [];

      // Calcular distribución usando solo el monto esperado
      const participantsWithAdjustedAmount = participants.map((participant) => {
        // Convertir a número porque puede venir como string del backend
        const assignedAmountCents = Number(participant.assignedAmountCents) || 0;

        return {
          ...participant,
          adjustedAmount: assignedAmountCents,
        };
      });

      const totalAdjustedAmount = participantsWithAdjustedAmount.reduce(
        (sum, p) => sum + p.adjustedAmount,
        0
      );

      // Recalcular cantidades basadas en porcentajes ajustados
      const newDistributions: typeof editableDistributions = {};
      let totalDistributed = 0;

      if (distributionMode === 'presentation' && globalRoundingFactor > 1) {
        // MODO PRESENTACIÓN: Redondeo hacia abajo para empresas externas
        logger.debug('📦 [RECALC] Calculando en modo PRESENTACIÓN', {
          globalRoundingFactor,
          selectedPresentationId,
          newTotalQuantity,
        });

        participantsWithAdjustedAmount.forEach((participant) => {
          const percentage = totalAdjustedAmount > 0
            ? (participant.adjustedAmount / totalAdjustedAmount) * 100
            : 100 / participants.length;

          const exactQuantityBase = (percentage / 100) * newTotalQuantity;
          const exactQuantityPresentation = exactQuantityBase / globalRoundingFactor;

          // Redondeo hacia ABAJO para todos (empresas y sedes)
          const quantityPresentation = Math.floor(exactQuantityPresentation);
          const quantityBase = quantityPresentation * globalRoundingFactor;

          newDistributions[participant.id] = {
            participantId: participant.id,
            participantName: participant.company?.name || participant.site?.name || 'Sin nombre',
            quantityBase: quantityBase,
            roundingFactor: globalRoundingFactor,
            presentationId: selectedPresentationId || undefined,
            quantityPresentation: quantityPresentation,
            percentage: percentage,
          };

          totalDistributed += quantityBase;

          logger.debug('📊 [RECALC] Participante:', {
            name: participant.company?.name || participant.site?.name,
            type: participant.company ? 'EMPRESA' : 'SEDE',
            percentage: percentage.toFixed(2),
            exactQuantityBase: exactQuantityBase.toFixed(2),
            exactPresentation: exactQuantityPresentation.toFixed(2),
            quantityPresentation,
            quantityBase,
            roundingFactor: globalRoundingFactor,
          });
        });

        // Asignar remanente a la sede de ajuste EN UNIDADES
        const remainder = newTotalQuantity - totalDistributed;
        if (remainder > 0) {
          // Buscar el participante que corresponde a la sede de ajuste
          // remainderSiteId es el ID de la SEDE, no del participante
          const remainderParticipant = campaignData.remainderSiteId
            ? participants.find(p => p.siteId === campaignData.remainderSiteId)
            : participants[0];

          const remainderParticipantId = remainderParticipant?.id || participants[0]?.id;

          logger.debug('🎯 [RECALC PRESENTATION] Asignando remanente:', {
            campaignRemainderSiteId: campaignData.remainderSiteId,
            foundParticipant: remainderParticipant ? {
              id: remainderParticipant.id,
              siteId: remainderParticipant.siteId,
              name: remainderParticipant.company?.name || remainderParticipant.site?.name
            } : null,
            remainderParticipantId,
            remainder,
          });

          if (remainderParticipantId && newDistributions[remainderParticipantId]) {
            newDistributions[remainderParticipantId].quantityBase += remainder;

            // Recalcular quantityPresentation si hay factor de redondeo
            if (newDistributions[remainderParticipantId].roundingFactor > 1) {
              newDistributions[remainderParticipantId].quantityPresentation = Math.floor(
                newDistributions[remainderParticipantId].quantityBase / newDistributions[remainderParticipantId].roundingFactor
              );
            }

            totalDistributed += remainder;

            logger.debug('✅ [RECALC] Remanente asignado a sede de ajuste:', {
              participantId: remainderParticipantId,
              siteName: newDistributions[remainderParticipantId].participantName,
              remainder,
              totalFinal: newDistributions[remainderParticipantId].quantityBase,
              quantityPresentation: newDistributions[remainderParticipantId].quantityPresentation,
            });
          } else {
            logger.error('❌ [RECALC PRESENTATION] No se encontró el participante para asignar remanente:', {
              remainderParticipantId,
              availableIds: Object.keys(newDistributions),
            });
          }
        }
      } else {
        // MODO UNIDADES: Cálculo normal
        logger.debug('📦 [RECALC] Calculando en modo UNIDADES');

        participantsWithAdjustedAmount.forEach((participant) => {
          const percentage = totalAdjustedAmount > 0
            ? (participant.adjustedAmount / totalAdjustedAmount) * 100
            : 100 / participants.length;

          const exactQuantity = (percentage / 100) * newTotalQuantity;
          const flooredQuantity = Math.floor(exactQuantity);

          newDistributions[participant.id] = {
            participantId: participant.id,
            participantName: participant.company?.name || participant.site?.name || 'Sin nombre',
            quantityBase: flooredQuantity,
            roundingFactor: 1,
            presentationId: undefined,
            quantityPresentation: undefined,
            percentage: percentage,
          };

          totalDistributed += flooredQuantity;
        });

        // Asignar remanente a la sede de ajuste
        const remainder = newTotalQuantity - totalDistributed;

        logger.debug('🔍 [RECALC UNITS] Verificando condiciones para asignar remanente:', {
          remainder,
          remainderGreaterThanZero: remainder > 0,
          participantsLength: participants.length,
          participantsLengthGreaterThanZero: participants.length > 0,
          willEnterCondition: remainder > 0 && participants.length > 0,
        });

        if (remainder > 0 && participants.length > 0) {
          // Buscar el participante que corresponde a la sede de ajuste
          // remainderSiteId es el ID de la SEDE, no del participante
          const remainderParticipant = campaignData.remainderSiteId
            ? participants.find(p => p.siteId === campaignData.remainderSiteId)
            : participants[0];

          const remainderParticipantId = remainderParticipant?.id || participants[0]?.id;

          logger.debug('🎯 [RECALC UNITS] Asignando remanente:', {
            campaignRemainderSiteId: campaignData.remainderSiteId,
            foundParticipant: remainderParticipant ? {
              id: remainderParticipant.id,
              siteId: remainderParticipant.siteId,
              name: remainderParticipant.company?.name || remainderParticipant.site?.name
            } : null,
            remainderParticipantId,
            remainder,
          });

          if (remainderParticipantId && newDistributions[remainderParticipantId]) {
            newDistributions[remainderParticipantId].quantityBase += remainder;

            // Recalcular quantityPresentation si hay factor de redondeo
            if (newDistributions[remainderParticipantId].roundingFactor > 1) {
              newDistributions[remainderParticipantId].quantityPresentation = Math.floor(
                newDistributions[remainderParticipantId].quantityBase / newDistributions[remainderParticipantId].roundingFactor
              );
            }

            totalDistributed += remainder;

            logger.debug('✅ [RECALC] Remanente asignado a sede de ajuste:', {
              participantId: remainderParticipantId,
              siteName: newDistributions[remainderParticipantId].participantName,
              remainder,
              newQuantityBase: newDistributions[remainderParticipantId].quantityBase,
              newQuantityPresentation: newDistributions[remainderParticipantId].quantityPresentation,
            });
          } else {
            logger.error('❌ [RECALC UNITS] No se encontró el participante para asignar remanente:', {
              remainderParticipantId,
              availableIds: Object.keys(newDistributions),
            });
          }
        } else {
          logger.warn('⚠️ [RECALC UNITS] No se cumplieron las condiciones para asignar remanente');
        }
      }

      logger.debug('✅ [RECALC] Distribuciones recalculadas:', {
        newTotalQuantity,
        totalDistributed,
        remainder: newTotalQuantity - totalDistributed,
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
      });

      logger.debug('✅ [RECALC] Estado actualizado');
    } catch (error: any) {
      logger.error('❌ [RECALC] Error recalculando distribuciones:', error);
      Alert.alert('Error', 'No se pudo recalcular las distribuciones');
    }
  }, [adjustedDistribution, editableDistributions, globalRoundingFactor, campaignId, distributionMode, selectedPresentationId]);

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

    // Calculate available stock based on selected source area
    let totalAvailableStock = 0;

    if (selectedSourceWarehouseId && selectedSourceAreaId) {
      // Si hay un área seleccionada, usar solo el stock de esa área
      const stockItems = product?.product?.stockItems || [];
      const selectedStockItem = stockItems.find(
        (item) => item.warehouseId === selectedSourceWarehouseId && item.areaId === selectedSourceAreaId
      );

      if (selectedStockItem) {
        const availableStock = selectedStockItem.availableQuantityBase ?? selectedStockItem.quantityBase ?? 0;
        // Convertir explícitamente a número para evitar concatenación de strings
        totalAvailableStock = typeof availableStock === 'number' ? availableStock : parseFloat(availableStock) || 0;
        logger.debug('✅ [VALIDATION] Usando stock del área seleccionada:', {
          warehouse: selectedStockItem.warehouse?.name,
          area: selectedStockItem.area?.name,
          availableStockRaw: availableStock,
          availableStockParsed: totalAvailableStock,
          type: typeof availableStock,
        });
      } else {
        logger.warn('⚠️ [VALIDATION] No se encontró el stock item seleccionado');
      }
    } else {
      // Si no hay área seleccionada, usar el total de todas las áreas
      const stockDetails = adjustedDistribution?.stockDetails || localStockData || [];
      totalAvailableStock = stockDetails.reduce((sum, stock) => {
        const stockValue = typeof stock.available === 'number' ? stock.available : parseFloat(stock.available) || 0;
        return sum + stockValue;
      }, 0);
      logger.debug('ℹ️ [VALIDATION] Usando stock total de todas las áreas:', totalAvailableStock);
    }

    // Use the minimum between editableTotalQuantity and actual available stock
    const maxAllowedQuantity = totalAvailableStock > 0
      ? Math.min(editableTotalQuantity, totalAvailableStock)
      : editableTotalQuantity;

    if (totalDistributed > maxAllowedQuantity) {
      const areaInfo = selectedSourceWarehouseId && selectedSourceAreaId
        ? '\n\nÁrea seleccionada: ' + (product?.product?.stockItems?.find(
            (item) => item.warehouseId === selectedSourceWarehouseId && item.areaId === selectedSourceAreaId
          )?.area?.name || 'Desconocida')
        : '\n\nNota: No has seleccionado un área específica';

      Alert.alert(
        'Error de Validación',
        `La cantidad total distribuida (${totalDistributed}) excede la cantidad disponible (${maxAllowedQuantity}).${areaInfo}\n\nPor favor, ajusta las cantidades o selecciona otra área con más stock.`
      );
      return false;
    }

    if (totalDistributed === 0) {
      Alert.alert('Error de Validación', 'Debes distribuir al menos 1 unidad.');
      return false;
    }

    return true;
  }, [getTotalDistributed, editableTotalQuantity, adjustedDistribution, localStockData, selectedSourceWarehouseId, selectedSourceAreaId, product]);

  const handleConfirmGeneration = useCallback(async () => {
    if (!product || !adjustedDistribution) {
      return;
    }

    logger.debug('🎯 [MODAL] Confirmando generación de reparto...', {
      mode: distributionMode,
      totalDistributions: Object.keys(editableDistributions).length,
    });

    // Validar distribuciones
    if (!validateDistributions()) {
      return;
    }

    setActionLoading(true);
    try {
      // Preparar distribuciones según el modo
      const distributions = Object.values(editableDistributions).map((dist) => {
        const baseData = {
          participantId: dist.participantId,
          quantityBase: dist.quantityBase,
          notes: `${dist.participantName} - ${dist.percentage.toFixed(2)}%`,
          // Agregar información de área de origen si está seleccionada
          ...(selectedSourceWarehouseId && { sourceWarehouseId: selectedSourceWarehouseId }),
          ...(selectedSourceAreaId && { sourceAreaId: selectedSourceAreaId }),
        };

        // SOLO agregar datos de presentación si:
        // 1. Modo es 'presentation' Y
        // 2. La cantidad en presentación es > 0
        if (distributionMode === 'presentation' && dist.quantityPresentation && dist.quantityPresentation > 0) {
          logger.debug('📦 [GENERATE] Enviando con presentación:', {
            participant: dist.participantName,
            quantityBase: dist.quantityBase,
            quantityPresentation: dist.quantityPresentation,
            presentationId: dist.presentationId,
            factorToBase: dist.roundingFactor,
            sourceWarehouseId: selectedSourceWarehouseId,
            sourceAreaId: selectedSourceAreaId,
          });

          return {
            ...baseData,
            presentationId: dist.presentationId,
            quantityPresentation: dist.quantityPresentation,
            factorToBase: dist.roundingFactor,
          };
        }

        // Si es modo 'units' o es remanente en unidades, NO enviar datos de presentación
        logger.debug('📦 [GENERATE] Enviando solo unidades:', {
          participant: dist.participantName,
          quantityBase: dist.quantityBase,
          sourceWarehouseId: selectedSourceWarehouseId,
          sourceAreaId: selectedSourceAreaId,
        });

        return baseData;
      });

      logger.debug('📤 [GENERATE] Distribuciones a enviar:', distributions);

      // Generar distribución con cantidades exactas
      const result = await campaignsService.generateDistribution(campaignId, product.id, {
        distributions,
        notes: `Reparto generado - ${distributionMode === 'presentation' ? 'Por presentación' : 'Por unidades'} - ${new Date().toLocaleString()}`,
      });

      logger.debug('✅ [MODAL] Reparto generado exitosamente:', result.repartoCode);

      const modeInfo = distributionMode === 'presentation'
        ? '\n\n📦 Generado por presentación (empresas reciben cantidades exactas)'
        : '\n\n📦 Generado por unidades';

      const pdfInfo = includeInSheet
        ? '\n✅ Este producto se incluirá en las hojas de reparto (PDF)'
        : '\n❌ Este producto NO se incluirá en las hojas de reparto (PDF)';

      Alert.alert(
        'Éxito',
        `Distribución generada exitosamente\n\nReparto: ${result.repartoCode}\nSe creó automáticamente el reparto con reserva de stock${modeInfo}${pdfInfo}`,
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
  }, [product, adjustedDistribution, validateDistributions, editableDistributions, campaignId, includeInSheet, distributionMode, onSuccess, onClose]);

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
                  // Calcular stock disponible según área seleccionada
                  let totalAvailableStock = 0;
                  let sourceAreaName = '';

                  if (selectedSourceWarehouseId && selectedSourceAreaId) {
                    // Si hay un área seleccionada, usar solo el stock de esa área
                    const stockItems = product?.product?.stockItems || [];
                    const selectedStockItem = stockItems.find(
                      (item) => item.warehouseId === selectedSourceWarehouseId && item.areaId === selectedSourceAreaId
                    );

                    if (selectedStockItem) {
                      const availableStock = selectedStockItem.availableQuantityBase ?? selectedStockItem.quantityBase ?? 0;
                      // Convertir explícitamente a número para evitar concatenación de strings
                      totalAvailableStock = typeof availableStock === 'number' ? availableStock : parseFloat(availableStock) || 0;
                      sourceAreaName = selectedStockItem.area?.name || 'Área seleccionada';
                    }
                  } else {
                    // Si no hay área seleccionada, usar el total de todas las áreas
                    const stockDetails = adjustedDistribution.stockDetails || localStockData || [];
                    totalAvailableStock = stockDetails.reduce((sum, stock) => {
                      const stockValue = typeof stock.available === 'number' ? stock.available : parseFloat(stock.available) || 0;
                      return sum + stockValue;
                    }, 0);
                    sourceAreaName = 'Todas las áreas';
                  }

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
                            Stock disponible ({sourceAreaName}): {totalAvailableStock} unidades{'\n'}
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

                {/* Source Area Selection */}
                {(() => {
                  // Obtener las ubicaciones de stock del producto
                  const stockItems = product?.product?.stockItems || [];

                  // Si hay más de una ubicación, mostrar selector
                  if (stockItems.length > 1) {
                    return (
                      <View style={styles.previewSection}>
                        <Text style={styles.previewSectionTitle}>📍 Área de Origen del Stock</Text>
                        <Text style={styles.sourceAreaHint}>
                          Este producto tiene stock en múltiples ubicaciones. Selecciona de dónde deseas tomar el stock:
                        </Text>

                        {stockItems.map((stockItem, index) => {
                          const isSelected =
                            selectedSourceWarehouseId === stockItem.warehouseId &&
                            selectedSourceAreaId === stockItem.areaId;

                          const availableStock = stockItem.availableQuantityBase ?? stockItem.quantityBase ?? 0;
                          const parsedStock = typeof availableStock === 'number' ? availableStock : parseFloat(availableStock) || 0;

                          return (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.sourceAreaCard,
                                isSelected && styles.sourceAreaCardSelected,
                                parsedStock === 0 && styles.sourceAreaCardDisabled,
                              ]}
                              onPress={() => {
                                if (parsedStock > 0) {
                                  setSelectedSourceWarehouseId(stockItem.warehouseId);
                                  setSelectedSourceAreaId(stockItem.areaId);
                                }
                              }}
                              disabled={parsedStock === 0}
                            >
                              <View style={styles.sourceAreaInfo}>
                                <Text style={styles.sourceAreaWarehouse}>
                                  📦 Almacén: {stockItem.warehouse?.name || 'Sin nombre'}
                                </Text>
                                <Text style={styles.sourceAreaArea}>
                                  📍 Área: {stockItem.area?.name || 'Sin área asignada'}
                                </Text>
                                <Text style={[
                                  styles.sourceAreaStock,
                                  parsedStock === 0 && styles.sourceAreaStockZero,
                                ]}>
                                  ✅ Disponible: {parsedStock.toFixed(2)} unidades
                                </Text>
                              </View>
                              {isSelected && (
                                <Text style={styles.sourceAreaSelectedIcon}>✓</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}

                        {!selectedSourceWarehouseId && (
                          <View style={styles.sourceAreaWarning}>
                            <Text style={styles.sourceAreaWarningText}>
                              ⚠️ Si no seleccionas un área específica, el sistema tomará el stock de cualquier ubicación disponible.
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  }

                  return null;
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

                {/* Selector de Modo de Distribución */}
                {product?.product?.presentations && product.product.presentations.length > 0 && (
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>📦 Modo de Distribución</Text>
                      <Text style={styles.adjustHint}>
                        Selecciona cómo deseas generar el reparto:
                      </Text>
                      <View style={styles.roundingFactorButtons}>
                        <TouchableOpacity
                          style={[
                            styles.roundingFactorButton,
                            distributionMode === 'units' && styles.roundingFactorButtonSelected,
                          ]}
                          onPress={() => {
                            setDistributionMode('units');
                            setGlobalRoundingFactor(1);
                            setSelectedPresentationId(null);
                            recalculateDistributions(editableTotalQuantity);
                          }}
                          disabled={previewLoading}
                        >
                          <Text
                            style={[
                              styles.roundingFactorButtonText,
                              distributionMode === 'units' &&
                                styles.roundingFactorButtonTextSelected,
                            ]}
                          >
                            Por Unidades
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.roundingFactorButton,
                            distributionMode === 'presentation' &&
                              styles.roundingFactorButtonSelected,
                          ]}
                          onPress={() => {
                            setDistributionMode('presentation');
                            // Si no hay presentación seleccionada, seleccionar la primera no-base o la base
                            if (!selectedPresentationId && product.product?.presentations) {
                              const firstNonBase = product.product.presentations.find(p => !p.isBase);
                              const presentationToUse = firstNonBase || product.product.presentations[0];
                              setSelectedPresentationId(presentationToUse.presentationId);
                              setSelectedPresentation(presentationToUse);
                              setGlobalRoundingFactor(presentationToUse.factorToBase);
                            }
                            recalculateDistributions(editableTotalQuantity);
                          }}
                          disabled={previewLoading}
                        >
                          <Text
                            style={[
                              styles.roundingFactorButtonText,
                              distributionMode === 'presentation' &&
                                styles.roundingFactorButtonTextSelected,
                            ]}
                          >
                            Por Presentación
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Selector de Presentación */}
                      {distributionMode === 'presentation' && (
                        <>
                          <View style={styles.presentationSelectorContainer}>
                            <Text style={styles.presentationSelectorLabel}>
                              Selecciona la presentación:
                            </Text>
                            <View style={styles.presentationOptions}>
                              {product.product.presentations
                                .filter(p => !p.isBase) // Filtrar solo presentaciones no-base
                                .map((presentation) => (
                                  <TouchableOpacity
                                    key={presentation.presentationId}
                                    style={[
                                      styles.presentationOption,
                                      selectedPresentationId === presentation.presentationId &&
                                        styles.presentationOptionSelected,
                                    ]}
                                    onPress={() => {
                                      setSelectedPresentationId(presentation.presentationId);
                                      setSelectedPresentation(presentation);
                                      setGlobalRoundingFactor(presentation.factorToBase);
                                      recalculateDistributions(editableTotalQuantity);
                                    }}
                                    disabled={previewLoading}
                                  >
                                    <View style={styles.presentationOptionHeader}>
                                      <View
                                        style={[
                                          styles.presentationRadio,
                                          selectedPresentationId === presentation.presentationId &&
                                            styles.presentationRadioSelected,
                                        ]}
                                      >
                                        {selectedPresentationId === presentation.presentationId && (
                                          <View style={styles.presentationRadioInner} />
                                        )}
                                      </View>
                                      <Text
                                        style={[
                                          styles.presentationOptionName,
                                          selectedPresentationId === presentation.presentationId &&
                                            styles.presentationOptionNameSelected,
                                        ]}
                                      >
                                        {presentation.presentation?.name || 'Presentación'}
                                      </Text>
                                    </View>
                                    <Text style={styles.presentationOptionFactor}>
                                      Factor: {presentation.factorToBase} unidades
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                            </View>
                          </View>

                          <View style={styles.presentationInfoBox}>
                            <Text style={styles.presentationInfoText}>
                              ℹ️ Todos los participantes recibirán cantidades en{' '}
                              {selectedPresentation?.presentation?.name?.toLowerCase() || 'presentación'}.
                              {'\n'}El remanente se asignará a la sede de ajuste en unidades.
                              {'\n'}Factor de conversión: 1 {selectedPresentation?.presentation?.name || 'presentación'} = {globalRoundingFactor} unidades
                            </Text>
                          </View>
                        </>
                      )}

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

                        {/* Mostrar según el modo de distribución */}
                        {distributionMode === 'presentation' && dist.roundingFactor > 1 ? (
                          <>
                            {/* MODO PRESENTACIÓN: Mostrar presentaciones primero (EDITABLE) */}
                            <View style={styles.editableQuantityContainer}>
                              <Text style={styles.editableQuantityLabel}>Cantidad:</Text>
                              <TextInput
                                style={styles.editablePresentationInput}
                                keyboardType="numeric"
                                placeholder="0"
                                value={(dist.quantityPresentation || 0).toString()}
                                onChangeText={(text) =>
                                  handlePresentationQuantityChange(dist.participantId, parseInt(text) || 0)
                                }
                              />
                              <Text style={styles.editablePresentationUnit}>
                                {selectedPresentation?.presentation?.name || 'presentaciones'}
                              </Text>
                            </View>
                            {/* Equivalencia en unidades (secundario) */}
                            <View style={styles.unitsEquivalence}>
                              <Text style={styles.unitsEquivalenceText}>
                                = {dist.quantityBase} unidades
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            {/* MODO UNIDADES: Mostrar unidades (comportamiento original) */}
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
                                  {selectedPresentation?.presentation?.name || 'presentaciones'}
                                </Text>
                              </View>
                            )}
                          </>
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
  presentationInfoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  presentationInfoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  // Presentation quantity display (when in presentation mode)
  presentationQuantityDisplay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presentationQuantityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
  },
  presentationQuantityUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  // Editable presentation input
  editablePresentationInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
    textAlign: 'center',
  },
  editablePresentationUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 8,
  },
  // Units equivalence (when in presentation mode, shows units as secondary info)
  unitsEquivalence: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  unitsEquivalenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  // Presentation selector styles
  presentationSelectorContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  presentationSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  presentationOptions: {
    gap: 8,
  },
  presentationOption: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  presentationOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  presentationOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  presentationRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presentationRadioSelected: {
    borderColor: '#6366F1',
  },
  presentationRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  presentationOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  presentationOptionNameSelected: {
    color: '#6366F1',
  },
  presentationOptionFactor: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 32,
  },
  // Source Area Selection Styles
  sourceAreaHint: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  sourceAreaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceAreaCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  sourceAreaCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#F8FAFC',
  },
  sourceAreaInfo: {
    flex: 1,
  },
  sourceAreaWarehouse: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  sourceAreaArea: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  sourceAreaStock: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  sourceAreaStockZero: {
    color: '#EF4444',
  },
  sourceAreaSelectedIcon: {
    fontSize: 24,
    color: '#6366F1',
    fontWeight: 'bold',
  },
  sourceAreaWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 12,
    marginTop: 8,
  },
  sourceAreaWarningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
});
