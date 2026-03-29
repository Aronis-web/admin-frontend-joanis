/**
 * RepartoParticipantDetailScreen - Detalle de participante en reparto
 * Migrado al Design System unificado
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  Platform,
  Image,
  FlatList,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { campaignsService, repartosService, productsApi } from '@/services/api';
import { CampaignParticipant, ParticipantType } from '@/types/campaigns';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Product } from '@/services/api/products';
import {
  ValidacionSalidaModal,
  ValidacionDetailModal,
  CircularProgress,
  DiscrepanciasModal,
  NotasDiscrepanciaModal,
} from '@/components/Repartos';
import { ImageViewerModal } from '@/components/Expenses/ImageViewerModal';
import { TransportSelectionModal } from '@/components/Transport';
import { TransferReportDiscrepancy } from '@/types/consolidated-reports';
import { useAuthStore } from '@/store/auth';
import { usePermissions } from '@/hooks/usePermissions';
import logger from '@/utils/logger';
import { config } from '@/utils/config';
import { Driver, Vehicle, Transporter } from '@/types/transport';
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  Title,
  Body,
  Label,
  Caption,
  Button,
  IconButton,
} from '@/design-system';

interface RepartoParticipantDetailScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
      participantId: string;
    };
  };
}

interface PresentationInfo {
  hasPresentations: boolean;
  largestFactor: number;
  largestPresentation: {
    id: string;
    name: string;
    factorToBase: number;
    description?: string;
  } | null;
  totalPresentations: number;
  roundingApplied: boolean;
  roundingMethod: string;
}

interface ProductoReparto {
  id: string;
  productId: string;
  repartoId: string; // ✅ Necesario para subir archivos al servidor
  presentationId?: string;
  factorToBase?: number;
  presentationInfo?: PresentationInfo;
  warehouseId?: string;
  areaId?: string;
  quantityBase?: string;
  quantityAssigned?: number;
  quantityValidated?: number;
  validationStatus?: string;
  status?: string;
  product?: {
    id: string;
    title?: string;
    name?: string;
    sku: string;
    correlativeNumber?: number;
    presentations?: Array<{
      id: string;
      presentationId: string;
      factorToBase: number;
      isBase: boolean;
      presentation: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  };
  warehouse?: {
    id: string;
    name: string;
    code?: string;
  };
  area?: {
    id: string;
    name: string;
    code?: string;
  };
  stockItem?: {
    id: string;
    batchNumber?: string;
    quantityBase: number;
  };
  repartoCode?: string;
  repartoName?: string;
  repartoStatus?: string;
  validacion?: {
    presentationInfo?: PresentationInfo;
    validatedQuantityBase?: string;
    photoUrl?: string;
    signatureUrl?: string;
    validatedAt?: string;
    validatedByName?: string;
    notes?: string;
  };
}

export const RepartoParticipantDetailScreen: React.FC<RepartoParticipantDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId, participantId } = route.params;
  const [participant, setParticipant] = useState<CampaignParticipant | null>(null);
  const [productos, setProductos] = useState<ProductoReparto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [validationDetailModalVisible, setValidationDetailModalVisible] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<ProductoReparto | null>(null);
  const [productPhotos, setProductPhotos] = useState<Record<string, string[]>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [validationFilter, setValidationFilter] = useState<'all' | 'validated' | 'pending'>('all');
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [repartoId, setRepartoId] = useState<string | null>(null);
  const [generatingConsolidated, setGeneratingConsolidated] = useState(false);
  const [consolidatedTransferGenerated, setConsolidatedTransferGenerated] = useState(false);
  const [consolidatedTransferInfo, setConsolidatedTransferInfo] = useState<{
    exists: boolean;
    transferId: string | null;
    transferNumber: string | null;
    generatedAt: string | null;
  } | null>(null);
  const [transportModalVisible, setTransportModalVisible] = useState(false);
  const [remissionGuideInfo, setRemissionGuideInfo] = useState<{
    exists: boolean;
    remissionGuideId: string | null;
    remissionGuideNumber: string | null;
    generatedAt: string | null;
    documentType: string | null;
    status: string | null;
    statusSunat: string | null;
    fechaEmision: string | null;
    observations: string | null;
    pdfUrl: string | null;
    xmlUrl: string | null;
    cdrUrl: string | null;
    createdAt: string | null;
  } | null>(null);
  const [generatingRemissionGuide, setGeneratingRemissionGuide] = useState(false);
  const [downloadingRemissionGuide, setDownloadingRemissionGuide] = useState(false);
  const [discrepanciasModalVisible, setDiscrepanciasModalVisible] = useState(false);
  const [notasModalVisible, setNotasModalVisible] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<TransferReportDiscrepancy | null>(null);
  const [bultosModalVisible, setBultosModalVisible] = useState(false);
  const [numeroBultos, setNumeroBultos] = useState('1');
  const [pendingTransportData, setPendingTransportData] = useState<{
    vehicle: Vehicle | null;
    driver: Driver | null;
    transporter: Transporter | null;
  } | null>(null);

  // Usar ref para evitar re-renders innecesarios al controlar la apertura del modal de bultos
  const pendingBultosModalRef = useRef(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const { user, token } = useAuthStore();
  const { hasPermission } = usePermissions();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Cargar participante
      const participants = await campaignsService.getParticipants(campaignId);
      const foundParticipant = participants.find((p) => p.id === participantId);

      if (!foundParticipant) {
        Alert.alert('Error', 'Participante no encontrado');
        navigation.goBack();
        return;
      }

      setParticipant(foundParticipant);

      // Usar el nuevo endpoint para obtener productos del participante
      const participantProducts = await campaignsService.getParticipantProducts(
        campaignId,
        participantId
      );

      console.log('📦 Total productos recibidos:', participantProducts.length);

      // Log COMPLETO del primer producto usando JSON.stringify para ver TODO
      if (participantProducts[0]) {
        console.log('🔍 PRIMER PRODUCTO COMPLETO (JSON):');
        console.log(JSON.stringify(participantProducts[0], null, 2));
      }

      // Log específico del primer reparto
      if (participantProducts[0]?.repartos?.[0]) {
        console.log('🔍 PRIMER REPARTO COMPLETO (JSON):');
        console.log(JSON.stringify(participantProducts[0].repartos[0], null, 2));
      }

      // Transformar la respuesta del backend al formato esperado
      const productosAsignados: ProductoReparto[] = [];
      let firstRepartoId: string | null = null;

      participantProducts.forEach((productGroup: any) => {
        // Cada grupo representa un producto con sus repartos
        productGroup.repartos?.forEach((reparto: any) => {
          // Guardar el primer repartoId que encontremos
          if (!firstRepartoId && reparto.repartoId) {
            firstRepartoId = reparto.repartoId;
          }
          // WORKAROUND: Si el backend no envía presentationInfo, intentar construirlo
          // basándonos en los datos del reparto individual
          let presentationInfo = productGroup.presentationInfo;

          // Si no hay presentationInfo pero el reparto tiene presentationId/factorToBase,
          // construir un presentationInfo temporal
          if (!presentationInfo && reparto.presentationId && reparto.factorToBase) {
            console.log(
              '⚠️ WORKAROUND: Construyendo presentationInfo temporal para reparto:',
              reparto.repartoCode
            );
            presentationInfo = {
              hasPresentations: true,
              largestFactor: reparto.factorToBase,
              largestPresentation: {
                id: reparto.presentationId,
                name: reparto.presentationName || 'Presentación',
                factorToBase: reparto.factorToBase,
              },
              totalPresentations: 1,
              roundingApplied: true,
              roundingMethod: 'FLOOR_TO_LARGEST_PRESENTATION',
            };
          }

          // Construir array de presentations basado en presentationInfo
          let presentations: any[] | undefined;
          if (presentationInfo?.largestPresentation) {
            presentations = [
              {
                id: `${productGroup.productId}-${presentationInfo.largestPresentation.id}`,
                presentationId: presentationInfo.largestPresentation.id,
                factorToBase: presentationInfo.largestPresentation.factorToBase,
                isBase: false,
                presentation: {
                  id: presentationInfo.largestPresentation.id,
                  code: presentationInfo.largestPresentation.name.toUpperCase(),
                  name: presentationInfo.largestPresentation.name,
                },
              },
            ];
            console.log(
              '✅ Presentations construido para producto:',
              productGroup.productName,
              presentations
            );
          } else {
            console.log(
              '⚠️ No se pudo construir presentations para:',
              productGroup.productName,
              'presentationInfo:',
              presentationInfo
            );
          }

          productosAsignados.push({
            id: reparto.repartoProductoId,
            productId: productGroup.productId,
            repartoId: reparto.repartoId, // ✅ Necesario para subir archivos al servidor
            presentationId: reparto.presentationId, // Información de presentación
            factorToBase: reparto.factorToBase, // Factor de conversión
            presentationInfo: presentationInfo, // ✅ Info completa de presentación (del backend o construida)
            product: {
              id: productGroup.productId,
              name: productGroup.productName,
              title: productGroup.productName,
              sku: productGroup.productSku,
              correlativeNumber: productGroup.productCorrelativeNumber, // ✅ Agregar correlativo
              presentations: presentations, // ✅ Construido desde presentationInfo
            },
            quantityAssigned: reparto.quantityAssigned,
            quantityValidated: reparto.quantityValidated,
            validationStatus: reparto.status,
            status: reparto.status,
            repartoCode: reparto.repartoCode,
            repartoName: reparto.repartoName,
            repartoStatus: reparto.repartoStatus,
          });
        });
      });

      console.log('📊 Total productos asignados:', productosAsignados.length);

      // ✅ Ordenar productos por correlativo antes de setear
      const sortedProductos = productosAsignados.sort((a, b) => {
        const correlativeA = a.product?.correlativeNumber || 0;
        const correlativeB = b.product?.correlativeNumber || 0;
        return correlativeA - correlativeB;
      });

      setProductos(sortedProductos);

      // Guardar el repartoId para usar en el reporte
      if (firstRepartoId) {
        setRepartoId(firstRepartoId);
      }

      console.log('🚀 INICIANDO CARGA DE FOTOS DE PRODUCTOS...');
      console.log('🚀 productosAsignados.length:', productosAsignados.length);

      // ✅ Cargar fotos de productos usando batch endpoint
      try {
        const productIds = [...new Set(productosAsignados.map(p => p.productId))];
        console.log(`📸 Total productos únicos: ${productIds.length}`);
        console.log(`📸 Product IDs:`, productIds);
        if (productIds.length > 0) {
          console.log(`📸 Llamando a batch endpoint con includePhotos=true...`);
          const batchResponse = await productsApi.getProductsByIds(productIds, true);
          console.log(`📸 Batch response recibido:`, batchResponse);
          console.log(`📸 Total productos en respuesta: ${batchResponse.products?.length || 0}`);
          const photosMap: Record<string, string[]> = {};
          batchResponse.products.forEach((product: Product) => {
            // ✅ El backend puede devolver 'photos' o 'photoUrls'
            const productPhotos = (product as any).photos || (product as any).photoUrls || [];
            console.log(`📸 Procesando producto ${product.id}: ${productPhotos.length} fotos`);
            console.log(`📸   - product.photos:`, (product as any).photos);
            console.log(`📸   - product.photoUrls:`, (product as any).photoUrls);
            if (productPhotos.length > 0) {
              photosMap[product.id] = productPhotos;
              console.log(`📸 Fotos guardadas para ${product.id}:`, productPhotos);
            }
          });
          console.log(`✅ PhotosMap final:`, photosMap);
          console.log(`✅ Total productos con fotos: ${Object.keys(photosMap).length}`);
          console.log(`✅ Llamando a setProductPhotos con:`, photosMap);
          setProductPhotos(photosMap);
          console.log(`✅ setProductPhotos llamado (el estado se actualizará en el próximo render)`);
        } else {
          console.log('⚠️ No hay productos para cargar fotos');
        }
      } catch (error: any) {
        console.error('❌ Error cargando fotos de productos:', error);
        console.error('❌ Error stack:', error.stack);
        // No bloquear la carga si falla la obtención de fotos
      }

      // Verificar si ya existe un traslado consolidado
      try {
        logger.info('🔍 Verificando estado del traslado consolidado...');
        const transferStatus = await repartosService.checkConsolidatedTransferStatus(
          participantId,
          campaignId
        );
        logger.info('📊 Respuesta del servidor (traslado):', JSON.stringify(transferStatus, null, 2));
        setConsolidatedTransferInfo(transferStatus);
        // ✅ SIEMPRE actualizar el estado basado en la respuesta del servidor
        setConsolidatedTransferGenerated(transferStatus.exists);
        if (transferStatus.exists) {
          logger.info('✅ Traslado consolidado ya existe:', transferStatus);
        } else {
          logger.info('ℹ️ Traslado consolidado NO existe aún');
        }
      } catch (error: any) {
        logger.error('❌ Error verificando estado del traslado consolidado:', error);
        // En caso de error, asumir que no existe
        setConsolidatedTransferGenerated(false);
        setConsolidatedTransferInfo(null);
      }

      // Verificar si ya existe una guía de remisión
      try {
        logger.info('🔍 Verificando estado de la guía de remisión...');
        const guideInfo = await repartosService.getRemissionGuideInfo(
          participantId,
          campaignId
        );
        logger.info('📊 Respuesta del servidor (guía):', JSON.stringify(guideInfo, null, 2));
        setRemissionGuideInfo(guideInfo);
        if (guideInfo.exists) {
          logger.info('✅ Guía de remisión ya existe:', guideInfo);
        } else {
          logger.info('ℹ️ Guía de remisión NO existe aún');
        }
      } catch (error: any) {
        logger.error('❌ Error verificando estado de la guía de remisión:', error);
        // En caso de error, asumir que no existe
        setRemissionGuideInfo(null);
      }

      console.log('✅ LOADDATA COMPLETADO EXITOSAMENTE');
    } catch (error: any) {
      console.error('❌ ERROR EN LOADDATA:', error);
      console.error('Error loading participant data:', error);
      Alert.alert('Error', 'No se pudo cargar la información del participante');
      navigation.goBack();
    } finally {
      console.log('🏁 FINALLY BLOCK - Finalizando loadData');
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, participantId, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // 🔍 Monitor productPhotos state changes
  React.useEffect(() => {
    console.log('🔄 productPhotos state cambió:', {
      totalProductos: Object.keys(productPhotos).length,
      productIds: Object.keys(productPhotos),
      photosMap: productPhotos
    });
  }, [productPhotos]);

  // 📦 Abrir modal de bultos después de cerrar modal de transporte
  React.useEffect(() => {
    // Solo actuar cuando el modal de transporte se cierra Y hay datos pendientes
    if (!transportModalVisible && pendingBultosModalRef.current) {
      // Esperar a que el modal de transporte termine de cerrarse completamente
      const timer = setTimeout(() => {
        pendingBultosModalRef.current = false;
        setBultosModalVisible(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [transportModalVisible]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filtrar productos basado en la búsqueda y estado de validación
  const filteredProductos = useMemo(() => {
    let filtered = productos;

    // Filtrar por estado de validación
    if (validationFilter === 'validated') {
      filtered = filtered.filter((p) => p.validationStatus === 'VALIDATED');
    } else if (validationFilter === 'pending') {
      filtered = filtered.filter((p) => p.validationStatus === 'PENDING');
    }

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((producto) => {
        const productName = (producto.product?.title || producto.product?.name || '').toLowerCase();
        const productSku = (producto.product?.sku || '').toLowerCase();
        const repartoCode = (producto.repartoCode || '').toLowerCase();
        const repartoName = (producto.repartoName || '').toLowerCase();

        return (
          productName.includes(query) ||
          productSku.includes(query) ||
          repartoCode.includes(query) ||
          repartoName.includes(query)
        );
      });
    }

    return filtered;
  }, [productos, searchQuery, validationFilter]);

  const handleValidateProduct = (producto: ProductoReparto) => {
    setSelectedProducto(producto);
    setValidationModalVisible(true);
  };

  const handleViewValidation = (producto: ProductoReparto) => {
    setSelectedProducto(producto);
    setValidationDetailModalVisible(true);
  };

  const handleSaveValidation = async (data: {
    validatedQuantityBase: string;
    photoUrl: string;
    signatureUrl: string;
    notes?: string;
  }) => {
    if (!selectedProducto) {
      return;
    }

    setActionLoading(true);
    try {
      // ✅ El modal ya subió las fotos al servidor, aquí solo enviamos la validación
      logger.info('📤 Enviando validación al servidor con URLs ya subidas...');

      await repartosService.validarSalida(selectedProducto.id, {
        validatedQuantityBase: data.validatedQuantityBase,
        photoUrl: data.photoUrl, // ✅ Ya es URL del servidor
        signatureUrl: data.signatureUrl, // ✅ Ya es URL del servidor
        validatedByName: user?.name || user?.email || 'Usuario',
        notes: data.notes,
      });

      Alert.alert('Éxito', 'Salida validada exitosamente');
      setValidationModalVisible(false);
      setSelectedProducto(null);
      loadData();
    } catch (error: any) {
      logger.error('Error validando salida:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo validar la salida');
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadParticipantReport = async () => {
    if (!repartoId || !participant) {
      Alert.alert('Error', 'No se pudo obtener la información del reparto');
      return;
    }

    const participantName =
      participant.participantType === ParticipantType.EXTERNAL_COMPANY
        ? participant.company?.alias || participant.company?.name || 'Empresa'
        : participant.site?.name || 'Sede';

    try {
      setDownloadingReport(true);

      logger.info('🔄 Descargando reporte del participante:', participantName);
      const startTime = new Date().getTime();

      // Call the API to get the PDF blob for this participant
      const pdfBlob = await repartosService.exportRepartoTotalsReport(participantId, campaignId);

      const endTime = new Date().getTime();
      logger.info('✅ PDF descargado del servidor');
      logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
      logger.info('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `reporte-totales-${participantName.replace(/\s+/g, '-')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', `El reporte de ${participantName} se está descargando`);
      } else {
        // For mobile (iOS/Android), save to file system and share
        const timestamp = new Date().getTime();
        const fileName = `reporte-totales-${participantName.replace(/\s+/g, '-')}-${timestamp}.pdf`;
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
            dialogTitle: `Reporte de Totales - ${participantName}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${file.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('Error downloading participant report:', error);
      Alert.alert('Error', error.message || 'No se pudo descargar el reporte del participante');
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleGenerateConsolidatedTransfer = async () => {
    if (!participant) {
      Alert.alert('Error', 'No se pudo obtener la información del participante');
      return;
    }

    const participantName =
      participant.participantType === ParticipantType.EXTERNAL_COMPANY
        ? participant.company?.alias || participant.company?.name || 'Empresa'
        : participant.site?.name || 'Sede';

    // Confirmar acción
    Alert.alert(
      'Cerrar Consolidado de Repartos',
      `¿Estás seguro de que deseas cerrar el consolidado de repartos para ${participantName}?\n\n` +
        'Esta acción:\n' +
        '• Liberará TODAS las reservas de stock\n' +
        '• Descontará SOLO el stock validado\n' +
        '• Creará el traslado consolidado\n' +
        '• Generará un reporte de discrepancias si hay diferencias',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: async () => {
            try {
              setGeneratingConsolidated(true);
              logger.info('🔄 Generando traslado consolidado para:', participantName);

              const response = await repartosService.generateConsolidatedTransfer(
                participantId,
                campaignId,
                {
                  notes: `Traslado consolidado para ${participantName}`,
                }
              );

              logger.info('✅ Traslado consolidado generado:', response);

              // Mostrar resumen
              const hasDiscrepancies = response.summary.productsWithDiscrepancies > 0;

              let message = `Traslado consolidado generado exitosamente:\n\n`;
              message += `📦 Total productos: ${response.summary.totalProducts}\n`;
              message += `✅ Cantidad validada: ${response.summary.totalValidated} unidades\n`;
              message += `📤 Cantidad transferida: ${response.summary.totalTransferred} unidades\n`;

              if (hasDiscrepancies) {
                message += `\n⚠️ Discrepancias encontradas:\n`;
                message += `• ${response.summary.productsWithDiscrepancies} productos con diferencias\n`;
                message += `• ${response.summary.totalDifference} unidades de diferencia\n`;
                message += `\n📝 Se ha creado un reporte de discrepancias que puedes gestionar ahora.`;
              }

              Alert.alert(
                'Éxito',
                message,
                [
                  {
                    text: hasDiscrepancies ? 'Ver Discrepancias' : 'Aceptar',
                    onPress: () => {
                      setConsolidatedTransferGenerated(true);
                      if (hasDiscrepancies && response.report) {
                        // Abrir modal de discrepancias
                        setCurrentReportId(response.report.id);
                        setDiscrepanciasModalVisible(true);
                      }
                      loadData(); // Recargar datos
                    },
                  },
                ]
              );
            } catch (error: any) {
              logger.error('Error generando traslado consolidado:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo generar el traslado consolidado'
              );
            } finally {
              setGeneratingConsolidated(false);
            }
          },
        },
      ]
    );
  };

  const handleGenerateRemissionGuide = async () => {
    if (!participant) {
      Alert.alert('Error', 'No se pudo obtener la información del participante');
      return;
    }

    // Abrir modal de selección de transporte
    setTransportModalVisible(true);
  };

  const handleTransportModalClose = useCallback(() => {
    setTransportModalVisible(false);
    // Si el usuario cierra el modal sin confirmar, limpiar el flag pendiente
    pendingBultosModalRef.current = false;
  }, []);

  const handleTransportConfirm = useCallback((vehicle: Vehicle | null, driver: Driver | null, transporter: Transporter | null) => {
    // Guardar datos de transporte
    setPendingTransportData({ vehicle, driver, transporter });
    setNumeroBultos('1'); // Resetear a valor por defecto

    // Marcar que debe abrirse el modal de bultos (usando ref para evitar re-renders)
    pendingBultosModalRef.current = true;

    // Cerrar el modal de transporte - el useEffect se encargará de abrir el modal de bultos
    setTransportModalVisible(false);
  }, []);

  const handleBultosConfirm = async () => {
    if (!pendingTransportData) {
      Alert.alert('Error', 'No se encontraron los datos de transporte');
      return;
    }

    const { vehicle, driver, transporter } = pendingTransportData;
    const bultosNum = parseInt(numeroBultos, 10);

    if (isNaN(bultosNum) || bultosNum < 1) {
      Alert.alert('Error', 'La cantidad de bultos debe ser un número mayor a 0');
      return;
    }

    setBultosModalVisible(false);

    const participantName =
      participant?.participantType === ParticipantType.EXTERNAL_COMPANY
        ? participant.company?.alias || participant.company?.name || 'Empresa'
        : participant?.site?.name || 'Sede';

    // Determinar si es transporte público (tiene transportista pero no vehículo ni conductor)
    const isPublicTransport = transporter !== null && !vehicle && !driver;

    // Construir mensaje de confirmación
    let confirmMessage = `¿Estás seguro de que deseas generar la guía de remisión electrónica para ${participantName}?\n\n`;

    if (isPublicTransport) {
      confirmMessage +=
        `🚌 Transporte: Público\n` +
        `🏢 Transportista: ${transporter!.razonSocial}\n` +
        `📋 RUC: ${transporter!.numeroRuc}\n`;
    } else {
      confirmMessage +=
        `🚗 Transporte: Privado\n` +
        `🚗 Vehículo: ${vehicle!.numeroPlaca} (${vehicle!.marca} ${vehicle!.modelo})\n` +
        `👤 Conductor: ${driver!.nombre} ${driver!.apellido}\n` +
        `📋 Licencia: ${driver!.numeroLicencia}\n`;
    }

    confirmMessage +=
      `📦 Bultos: ${bultosNum}\n\n` +
      'Esta acción:\n' +
      '• Generará una guía de remisión tipo 09 (Traslado)\n' +
      '• Se enviará automáticamente a SUNAT\n' +
      '• Quedará anexada al participante de la campaña';

    // Confirmar acción con los datos seleccionados
    Alert.alert(
      'Generar Guía de Remisión',
      confirmMessage,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            setPendingTransportData(null);
          },
        },
        {
          text: 'Generar',
          style: 'default',
          onPress: async () => {
            try {
              setGeneratingRemissionGuide(true);
              logger.info('🔄 Generando guía de remisión para:', participantName);
              logger.info('📦 Número de bultos:', bultosNum);

              if (isPublicTransport) {
                logger.info('🚌 Tipo de transporte: Público');
                logger.info('🏢 Transportista:', transporter!.razonSocial);
              } else {
                logger.info('🚗 Tipo de transporte: Privado');
                logger.info('🚗 Vehículo:', vehicle!.numeroPlaca);
                logger.info('👤 Conductor:', `${driver!.nombre} ${driver!.apellido}`);
              }

              const response = await repartosService.generateRemissionGuide(
                participantId,
                campaignId,
                isPublicTransport ? {
                  transporterId: transporter!.id,
                  numeroBultos: bultosNum,
                } : {
                  vehicleId: vehicle!.id,
                  driverId: driver!.id,
                  numeroBultos: bultosNum,
                }
              );

              logger.info('✅ Guía de remisión generada:', response);

              let successMessage =
                `Guía de remisión generada exitosamente:\n\n` +
                `📄 Número: ${response.remissionGuide.serieNumero}\n` +
                `✅ Estado: ${response.remissionGuide.status}\n` +
                `📦 Traslado: ${response.transfer.transferNumber}\n` +
                `📦 Bultos: ${bultosNum}\n`;

              if (isPublicTransport) {
                successMessage +=
                  `🚌 Transporte: Público\n` +
                  `🏢 Transportista: ${transporter!.razonSocial}`;
              } else {
                successMessage +=
                  `🚗 Transporte: Privado\n` +
                  `🚗 Vehículo: ${vehicle!.numeroPlaca}\n` +
                  `👤 Conductor: ${driver!.nombre} ${driver!.apellido}`;
              }

              Alert.alert(
                'Éxito',
                successMessage,
                [
                  {
                    text: 'Aceptar',
                    onPress: () => {
                      loadData(); // Recargar datos para actualizar el estado
                    },
                  },
                ]
              );
            } catch (error: any) {
              logger.error('Error generando guía de remisión:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo generar la guía de remisión'
              );
            } finally {
              setGeneratingRemissionGuide(false);
              setPendingTransportData(null);
            }
          },
        },
      ]
    );
  };

  const handleDownloadRemissionGuide = async () => {
    if (!remissionGuideInfo?.exists) {
      Alert.alert('Error', 'No se encontró la guía de remisión');
      return;
    }

    if (!participant?.id) {
      Alert.alert('Error', 'No se encontró el ID del participante');
      return;
    }

    const participantName =
      participant?.participantType === ParticipantType.EXTERNAL_COMPANY
        ? participant.company?.alias || participant.company?.name || 'Empresa'
        : participant?.site?.name || 'Sede';

    try {
      setDownloadingRemissionGuide(true);
      logger.info('🔄 Descargando guía de remisión:', remissionGuideInfo.remissionGuideNumber);

      // Usar el nuevo endpoint para descargar el PDF
      const blob = await repartosService.downloadRemissionGuidePdf(
        participant.id,
        campaignId
      );

      if (Platform.OS === 'web') {
        // Para web, crear URL del blob y descargar
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `guia-remision-${remissionGuideInfo.remissionGuideNumber?.replace(/\s+/g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        Alert.alert('Éxito', 'La guía de remisión se ha descargado');
      } else {
        // Para móvil, descargar y compartir
        const timestamp = new Date().getTime();
        const fileName = `guia-remision-${remissionGuideInfo.remissionGuideNumber?.replace(/\s+/g, '-')}-${timestamp}.pdf`;
        const file = new FileSystem.File(FileSystem.Paths.document, fileName);

        // Convert blob to array buffer
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
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
            dialogTitle: `Guía de Remisión - ${remissionGuideInfo.remissionGuideNumber}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${file.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('Error descargando guía de remisión:', error);
      const errorMessage = error.message || 'No se pudo descargar la guía de remisión';
      Alert.alert('Error', errorMessage);
    } finally {
      setDownloadingRemissionGuide(false);
    }
  };

  const handleManageDiscrepancyNotes = (discrepancy: TransferReportDiscrepancy) => {
    setSelectedDiscrepancy(discrepancy);
    setNotasModalVisible(true);
  };

  const handleNotesUpdated = () => {
    // Recargar el modal de discrepancias si está abierto
    if (discrepanciasModalVisible) {
      // El modal de discrepancias se recargará automáticamente
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return '#F59E0B';
      case 'VALIDATED':
        return '#10B981';
      case 'CANCELLED':
        return '#EF4444';
      case 'PARTIAL':
        return '#3B82F6';
      case 'DISCREPANCY':
        return '#EF4444';
      case 'IN_PROGRESS':
        return '#3B82F6';
      case 'COMPLETED':
        return '#10B981';
      default:
        return '#64748B';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'VALIDATED':
        return 'Validado';
      case 'CANCELLED':
        return 'Cancelado';
      case 'PARTIAL':
        return 'Parcial';
      case 'DISCREPANCY':
        return 'Discrepancia';
      case 'IN_PROGRESS':
        return 'En Progreso';
      case 'COMPLETED':
        return 'Completado';
      default:
        return status;
    }
  };

  const renderProductCard = useCallback((producto: ProductoReparto) => {
    // Determinar la cantidad a mostrar (priorizar quantityBase, luego quantityAssigned)
    const quantity = producto.quantityBase
      ? parseInt(producto.quantityBase)
      : producto.quantityAssigned || 0;

    // Determinar el estado a mostrar
    const productStatus = producto.validationStatus || producto.status || 'PENDING';

    // ✅ SOLO mostrar por presentación si la VALIDACIÓN fue por presentación
    // Esto se determina verificando si existe validacion.presentationInfo con roundingApplied
    const wasValidatedByPresentation =
      productStatus === 'VALIDATED' &&
      producto.validacion?.presentationInfo?.roundingApplied === true;

    // Calcular cantidades en presentación SOLO si fue validado por presentación
    let quantityInPresentation = 0;
    let validatedInPresentation = 0;
    let presentationName = '';

    if (wasValidatedByPresentation && producto.validacion?.presentationInfo?.largestPresentation) {
      const factor = producto.validacion.presentationInfo.largestPresentation.factorToBase;
      presentationName = producto.validacion.presentationInfo.largestPresentation.name;
      quantityInPresentation = Math.floor(quantity / factor);
      if (producto.quantityValidated) {
        validatedInPresentation = Math.floor(producto.quantityValidated / factor);
      }
    }

    return (
      <View key={producto.id} style={[styles.card, isTablet && styles.cardTablet]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {/* Product Thumbnail */}
            {productPhotos[producto.productId]?.[0] && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedImageUrl(productPhotos[producto.productId][0]);
                  setImageViewerVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: productPhotos[producto.productId][0] }}
                  style={styles.productThumbnail}
                  resizeMode="cover"
                  // Optimizaciones de rendimiento
                  fadeDuration={0}
                  progressiveRenderingEnabled={true}
                />
              </TouchableOpacity>
            )}
            <Text style={[styles.productName, isTablet && styles.productNameTablet]}>
              {producto.product?.title || producto.product?.name || 'Producto'}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isTablet && styles.statusBadgeTablet,
              {
                backgroundColor: getStatusColor(productStatus) + '20',
                borderColor: getStatusColor(productStatus),
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isTablet && styles.statusTextTablet,
                { color: getStatusColor(productStatus) },
              ]}
            >
              {getStatusLabel(productStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>SKU:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {producto.product?.correlativeNumber && `#${producto.product.correlativeNumber} | `}
              {producto.product?.sku || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Cantidad Asignada:
            </Text>
            <Text style={[styles.quantityValue, isTablet && styles.quantityValueTablet]}>
              {wasValidatedByPresentation
                ? `${quantityInPresentation} ${presentationName} (${quantity} unidades)`
                : `${quantity} unidades`}
            </Text>
          </View>

          {producto.quantityValidated !== undefined && producto.quantityValidated > 0 && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Cantidad Validada:
              </Text>
              <Text
                style={[
                  styles.quantityValue,
                  isTablet && styles.quantityValueTablet,
                  { color: '#10B981' },
                ]}
              >
                {wasValidatedByPresentation
                  ? `${validatedInPresentation} ${presentationName} (${producto.quantityValidated} unidades)`
                  : `${producto.quantityValidated} unidades`}
              </Text>
            </View>
          )}

          {producto.warehouse && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Almacén:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {producto.warehouse.name}
              </Text>
            </View>
          )}

          {producto.area && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Área:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {producto.area.name}
              </Text>
            </View>
          )}

          {producto.stockItem && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Lote:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {producto.stockItem.batchNumber || 'N/A'}
              </Text>
            </View>
          )}

          <View style={styles.repartoInfo}>
            <Text style={[styles.repartoLabel, isTablet && styles.repartoLabelTablet]}>
              Reparto:
            </Text>
            <Text style={[styles.repartoValue, isTablet && styles.repartoValueTablet]}>
              {producto.repartoCode} - {producto.repartoName}
            </Text>
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.cardFooter}>
          {productStatus === 'PENDING' ? (
            <TouchableOpacity
              style={[styles.validateButton, actionLoading && styles.buttonDisabled]}
              onPress={() => handleValidateProduct(producto)}
              disabled={actionLoading}
            >
              <Text style={styles.validateButtonText}>📸 Validar Salida</Text>
            </TouchableOpacity>
          ) : productStatus === 'VALIDATED' ? (
            <TouchableOpacity
              style={[styles.detailButton, actionLoading && styles.buttonDisabled]}
              onPress={() => handleViewValidation(producto)}
              disabled={actionLoading}
            >
              <Text style={styles.detailButtonText}>👁️ Ver Detalles de Validación</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }, [isTablet, productPhotos, actionLoading, handleValidateProduct, handleViewValidation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!participant) {
    return null;
  }

  const participantName =
    participant.participantType === ParticipantType.EXTERNAL_COMPANY
      ? participant.company?.alias || participant.company?.name || 'Empresa'
      : participant.site?.name || 'Sede';

  const totalQuantity = productos.reduce((sum, p) => {
    const quantity = p.quantityBase ? parseInt(p.quantityBase) : p.quantityAssigned || 0;
    return sum + quantity;
  }, 0);

  // Calcular progreso de validación del participante (productos validados)
  const totalProductos = productos.length;
  const productosValidados = productos.filter((p) => p.validationStatus === 'VALIDATED').length;
  const progressPercentage =
    totalProductos > 0 ? Math.round((productosValidados / totalProductos) * 100) : 0;

  // Calcular estadísticas de productos filtrados
  const filteredCount = filteredProductos.length;

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
          <View style={styles.headerInfo}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>{participantName}</Text>
            <View style={styles.typeBadgeContainer}>
              <View
                style={[
                  styles.typeBadge,
                  isTablet && styles.typeBadgeTablet,
                  participant.participantType === ParticipantType.EXTERNAL_COMPANY
                    ? styles.typeBadgeCompany
                    : styles.typeBadgeSite,
                ]}
              >
                <Text style={[styles.typeText, isTablet && styles.typeTextTablet]}>
                  {participant.participantType === ParticipantType.EXTERNAL_COMPANY
                    ? '🏢 Empresa'
                    : '🏛️ Sede'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Participant Info */}
        <View style={[styles.infoSection, isTablet && styles.infoSectionTablet]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Total productos:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {productos.length}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Cantidad total:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {totalQuantity} unidades
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Productos Validados:
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[styles.infoValue, isTablet && styles.infoValueTablet, { marginRight: 12 }]}
              >
                {productosValidados} / {totalProductos}
              </Text>
              {/* Barra de progreso circular del participante */}
              <CircularProgress
                progress={progressPercentage}
                size={isTablet ? 50 : 40}
                strokeWidth={isTablet ? 5 : 4}
              />
            </View>
          </View>

          {/* Download Report Button */}
          {hasPermission('repartos.reports') && repartoId && productos.length > 0 && (
            <TouchableOpacity
              style={[
                styles.downloadReportButton,
                isTablet && styles.downloadReportButtonTablet,
                downloadingReport && styles.downloadButtonDisabled,
              ]}
              onPress={handleDownloadParticipantReport}
              disabled={downloadingReport}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.downloadReportButtonText,
                  isTablet && styles.downloadReportButtonTextTablet,
                ]}
              >
                {downloadingReport ? '📄 Generando Reporte...' : '📄 Descargar Reporte de Totales'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Generate Consolidated Transfer Button */}
          {hasPermission('repartos.validate') &&
           productos.length > 0 &&
           productosValidados === totalProductos &&
           !consolidatedTransferGenerated && (
            <TouchableOpacity
              style={[
                styles.consolidatedButton,
                isTablet && styles.consolidatedButtonTablet,
                generatingConsolidated && styles.downloadButtonDisabled,
              ]}
              onPress={handleGenerateConsolidatedTransfer}
              disabled={generatingConsolidated}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.consolidatedButtonText,
                  isTablet && styles.consolidatedButtonTextTablet,
                ]}
              >
                {generatingConsolidated ? '🔄 Generando Traslado...' : '✅ Cerrar Consolidado de Repartos'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Consolidated Transfer Generated Message */}
          {consolidatedTransferGenerated && (
            <View style={[styles.successMessage, isTablet && styles.successMessageTablet]}>
              <Text style={[styles.successMessageText, isTablet && styles.successMessageTextTablet]}>
                ✅ Traslado consolidado generado exitosamente
              </Text>
              {consolidatedTransferInfo?.exists && consolidatedTransferInfo.transferNumber && (
                <Text style={[styles.successMessageSubtext, isTablet && styles.successMessageSubtextTablet]}>
                  Traslado: {consolidatedTransferInfo.transferNumber}
                  {consolidatedTransferInfo.generatedAt && (
                    ` • ${new Date(consolidatedTransferInfo.generatedAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  )}
                </Text>
              )}
            </View>
          )}

          {/* Generate Remission Guide Button - Solo si existe traslado consolidado y NO existe guía */}
          {hasPermission('repartos.generate_transfer') &&
           consolidatedTransferGenerated &&
           !remissionGuideInfo?.exists && (
            <TouchableOpacity
              style={[
                styles.remissionGuideButton,
                isTablet && styles.remissionGuideButtonTablet,
                generatingRemissionGuide && styles.downloadButtonDisabled,
              ]}
              onPress={handleGenerateRemissionGuide}
              disabled={generatingRemissionGuide}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.remissionGuideButtonText,
                  isTablet && styles.remissionGuideButtonTextTablet,
                ]}
              >
                {generatingRemissionGuide ? '🔄 Generando Guía...' : '📋 Generar Guía de Remisión'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Download Remission Guide Button - Solo si existe la guía */}
          {remissionGuideInfo?.exists && (
            <View>
              {/* Remission Guide Info Card */}
              <View style={[styles.guideInfoCard, isTablet && styles.guideInfoCardTablet]}>
                <View style={styles.guideInfoHeader}>
                  <Ionicons name="document-text" size={24} color="#10B981" />
                  <Text style={[styles.guideInfoTitle, isTablet && styles.guideInfoTitleTablet]}>
                    Guía de Remisión Generada
                  </Text>
                </View>

                <View style={styles.guideInfoDetails}>
                  <View style={styles.guideInfoRow}>
                    <Text style={[styles.guideInfoLabel, isTablet && styles.guideInfoLabelTablet]}>
                      Número:
                    </Text>
                    <Text style={[styles.guideInfoValue, isTablet && styles.guideInfoValueTablet]}>
                      {remissionGuideInfo.remissionGuideNumber || 'N/A'}
                    </Text>
                  </View>

                  {remissionGuideInfo.status && (
                    <View style={styles.guideInfoRow}>
                      <Text style={[styles.guideInfoLabel, isTablet && styles.guideInfoLabelTablet]}>
                        Estado:
                      </Text>
                      <Text style={[styles.guideInfoValue, isTablet && styles.guideInfoValueTablet]}>
                        {remissionGuideInfo.status}
                      </Text>
                    </View>
                  )}

                  {remissionGuideInfo.statusSunat && (
                    <View style={styles.guideInfoRow}>
                      <Text style={[styles.guideInfoLabel, isTablet && styles.guideInfoLabelTablet]}>
                        Estado SUNAT:
                      </Text>
                      <Text style={[styles.guideInfoValue, isTablet && styles.guideInfoValueTablet]}>
                        {remissionGuideInfo.statusSunat}
                      </Text>
                    </View>
                  )}

                  {remissionGuideInfo.generatedAt && (
                    <View style={styles.guideInfoRow}>
                      <Text style={[styles.guideInfoLabel, isTablet && styles.guideInfoLabelTablet]}>
                        Generada:
                      </Text>
                      <Text style={[styles.guideInfoValue, isTablet && styles.guideInfoValueTablet]}>
                        {new Date(remissionGuideInfo.generatedAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Download Button */}
              <TouchableOpacity
                style={[
                  styles.downloadGuideButton,
                  isTablet && styles.downloadGuideButtonTablet,
                  downloadingRemissionGuide && styles.downloadButtonDisabled,
                ]}
                onPress={handleDownloadRemissionGuide}
                disabled={downloadingRemissionGuide}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="download-outline"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.downloadGuideButtonText,
                    isTablet && styles.downloadGuideButtonTextTablet,
                  ]}
                >
                  {downloadingRemissionGuide ? 'Descargando...' : 'Descargar Guía de Remisión'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Products List */}
        {productos.length === 0 ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay productos asignados
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Este participante aún no tiene productos en repartos
              </Text>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            data={filteredProductos}
            renderItem={({ item }) => renderProductCard(item)}
            keyExtractor={(item) => item.id}
            // Optimizaciones de rendimiento
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={5}
            ListHeaderComponent={
              <View style={styles.headerSection}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Productos de Reparto
                </Text>

            {/* Filtro de validación */}
            {productos.length > 0 && (
              <View style={[(styles as any).filterContainer, isTablet && (styles as any).filterContainerTablet]}>
                <TouchableOpacity
                  style={[
                    (styles as any).filterButton,
                    isTablet && (styles as any).filterButtonTablet,
                    validationFilter === 'all' && (styles as any).filterButtonActive,
                  ]}
                  onPress={() => setValidationFilter('all')}
                >
                  <Text
                    style={[
                      (styles as any).filterButtonText,
                      isTablet && (styles as any).filterButtonTextTablet,
                      validationFilter === 'all' && (styles as any).filterButtonTextActive,
                    ]}
                  >
                    Todos ({productos.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    (styles as any).filterButton,
                    isTablet && (styles as any).filterButtonTablet,
                    validationFilter === 'validated' && (styles as any).filterButtonActive,
                  ]}
                  onPress={() => setValidationFilter('validated')}
                >
                  <Text
                    style={[
                      (styles as any).filterButtonText,
                      isTablet && (styles as any).filterButtonTextTablet,
                      validationFilter === 'validated' && (styles as any).filterButtonTextActive,
                    ]}
                  >
                    ✅ Validados ({productos.filter((p) => p.validationStatus === 'VALIDATED').length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    (styles as any).filterButton,
                    isTablet && (styles as any).filterButtonTablet,
                    validationFilter === 'pending' && (styles as any).filterButtonActive,
                  ]}
                  onPress={() => setValidationFilter('pending')}
                >
                  <Text
                    style={[
                      (styles as any).filterButtonText,
                      isTablet && (styles as any).filterButtonTextTablet,
                      validationFilter === 'pending' && (styles as any).filterButtonTextActive,
                    ]}
                  >
                    ⏳ Pendientes ({productos.filter((p) => p.validationStatus === 'PENDING').length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Buscador de productos */}
            {productos.length > 0 && (
              <View style={[styles.searchContainer, isTablet && styles.searchContainerTablet]}>
                <Text style={[styles.searchIcon, isTablet && styles.searchIconTablet]}>🔍</Text>
                <TextInput
                  style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                  placeholder="Buscar por nombre, SKU o reparto..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <Text
                      style={[styles.clearButtonText, isTablet && styles.clearButtonTextTablet]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Contador de resultados */}
            {searchQuery.trim() && productos.length > 0 && (
              <Text style={[styles.searchResults, isTablet && styles.searchResultsTablet]}>
                {filteredCount === 0
                  ? 'No se encontraron productos'
                  : `Mostrando ${filteredCount} de ${totalProductos} producto${totalProductos !== 1 ? 's' : ''}`}
              </Text>
            )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                  No se encontraron productos
                </Text>
                <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                  Intenta con otros términos de búsqueda
                </Text>
              </View>
            }
          />
        )}

        {/* Validation Modal */}
        {selectedProducto &&
          (() => {
            console.log(
              '🔍 selectedProducto.product?.presentations:',
              selectedProducto.product?.presentations
            );
            console.log('🔍 selectedProducto completo:', JSON.stringify(selectedProducto, null, 2));
            console.log('🔍 productPhotos state:', JSON.stringify(productPhotos));
            console.log('🔍 selectedProducto.productId:', selectedProducto.productId);
            console.log('🔍 Fotos para este producto:', productPhotos[selectedProducto.productId]);
            return (
              <ValidacionSalidaModal
                visible={validationModalVisible}
                producto={
                  {
                    id: selectedProducto.id,
                    repartoId: selectedProducto.repartoId,
                    product: {
                      id: selectedProducto.product?.id || selectedProducto.productId || '',
                      title:
                        selectedProducto.product?.title ||
                        selectedProducto.product?.name ||
                        'Producto',
                      sku: `${selectedProducto.product?.correlativeNumber ? `#${selectedProducto.product.correlativeNumber} | ` : ''}${selectedProducto.product?.sku || 'N/A'}`,
                      presentations: selectedProducto.product?.presentations,
                      photos: productPhotos[selectedProducto.productId] || [],
                    },
                    quantityBase:
                      selectedProducto.quantityBase || String(selectedProducto.quantityAssigned || 0),
                    quantityAssigned: selectedProducto.quantityAssigned,
                    presentationInfo: selectedProducto.presentationInfo,
                    presentationId: selectedProducto.presentationId,
                    factorToBase: selectedProducto.factorToBase,
                  } as any
                }
                onClose={() => {
                  setValidationModalVisible(false);
                  setSelectedProducto(null);
                }}
                onValidate={handleSaveValidation}
              />
            );
          })()}

        {/* Validation Detail Modal */}
        <ValidacionDetailModal
          visible={validationDetailModalVisible}
          repartoProductoId={selectedProducto?.id}
          onClose={() => {
            setValidationDetailModalVisible(false);
            setSelectedProducto(null);
          }}
        />

        {/* Discrepancias Modal */}
        <DiscrepanciasModal
          visible={discrepanciasModalVisible}
          reportId={currentReportId}
          onClose={() => {
            setDiscrepanciasModalVisible(false);
            setCurrentReportId(null);
          }}
          onManageNotes={handleManageDiscrepancyNotes}
        />

        {/* Notas Discrepancia Modal */}
        <NotasDiscrepanciaModal
          visible={notasModalVisible}
          reportId={currentReportId}
          discrepancy={selectedDiscrepancy}
          onClose={() => {
            setNotasModalVisible(false);
            setSelectedDiscrepancy(null);
          }}
          onNotesUpdated={handleNotesUpdated}
        />

        {/* Transport Selection Modal */}
        <TransportSelectionModal
          visible={transportModalVisible}
          onClose={handleTransportModalClose}
          onConfirm={handleTransportConfirm}
        />

        {/* Bultos Modal */}
        <Modal
          visible={bultosModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setBultosModalVisible(false);
            setPendingTransportData(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.bultosModalOverlay}
          >
            <View style={[styles.bultosModalContainer, isTablet && styles.bultosModalContainerTablet]}>
              <View style={styles.bultosModalHeader}>
                <Ionicons name="cube-outline" size={32} color={colors.primary[500]} />
                <Text style={[styles.bultosModalTitle, isTablet && styles.bultosModalTitleTablet]}>
                  Cantidad de Bultos
                </Text>
                <Text style={[styles.bultosModalSubtitle, isTablet && styles.bultosModalSubtitleTablet]}>
                  Ingrese el número de bultos para la guía de remisión
                </Text>
              </View>

              <View style={styles.bultosInputContainer}>
                <TouchableOpacity
                  style={[styles.bultosButton, styles.bultosButtonMinus]}
                  onPress={() => {
                    const current = parseInt(numeroBultos, 10) || 1;
                    if (current > 1) {
                      setNumeroBultos(String(current - 1));
                    }
                  }}
                >
                  <Ionicons name="remove" size={24} color={colors.text.inverse} />
                </TouchableOpacity>

                <TextInput
                  style={[styles.bultosInput, isTablet && styles.bultosInputTablet]}
                  value={numeroBultos}
                  onChangeText={(text) => {
                    // Solo permitir números
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setNumeroBultos(numericValue);
                  }}
                  keyboardType="numeric"
                  maxLength={4}
                  selectTextOnFocus
                />

                <TouchableOpacity
                  style={[styles.bultosButton, styles.bultosButtonPlus]}
                  onPress={() => {
                    const current = parseInt(numeroBultos, 10) || 0;
                    setNumeroBultos(String(current + 1));
                  }}
                >
                  <Ionicons name="add" size={24} color={colors.text.inverse} />
                </TouchableOpacity>
              </View>

              <View style={styles.bultosModalActions}>
                <TouchableOpacity
                  style={[styles.bultosModalButton, styles.bultosModalButtonCancel]}
                  onPress={() => {
                    setBultosModalVisible(false);
                    setPendingTransportData(null);
                  }}
                >
                  <Text style={styles.bultosModalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bultosModalButton, styles.bultosModalButtonConfirm]}
                  onPress={handleBultosConfirm}
                >
                  <Text style={styles.bultosModalButtonConfirmText}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Image Viewer Modal */}
        <ImageViewerModal
          visible={imageViewerVisible}
          imageUrl={selectedImageUrl}
          onClose={() => {
            setImageViewerVisible(false);
            setSelectedImageUrl(null);
          }}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.text.secondary,
  },
  header: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTablet: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  backButton: {
    marginBottom: spacing[2],
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary[500],
    fontWeight: '600',
  },
  backButtonTextTablet: {
    fontSize: 18,
  },
  headerInfo: {
    marginTop: spacing[2],
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  titleTablet: {
    fontSize: 32,
  },
  typeBadgeContainer: {
    marginTop: spacing[2],
  },
  typeBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  typeBadgeTablet: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
  },
  typeBadgeCompany: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  typeBadgeSite: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[500],
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextTablet: {
    fontSize: 14,
  },
  infoSection: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  infoSectionTablet: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  downloadReportButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    marginTop: spacing[3],
    alignItems: 'center',
  },
  downloadReportButtonTablet: {
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  downloadReportButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  downloadReportButtonTextTablet: {
    fontSize: 16,
  },
  downloadButtonDisabled: {
    opacity: 0.5,
  },
  consolidatedButton: {
    backgroundColor: colors.success[500],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    marginTop: spacing[3],
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.success[600],
  },
  consolidatedButtonTablet: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  consolidatedButtonText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: '700',
  },
  consolidatedButtonTextTablet: {
    fontSize: 17,
  },
  successMessage: {
    backgroundColor: colors.success[100],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.success[500],
  },
  successMessageTablet: {
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  successMessageText: {
    color: colors.success[800],
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  successMessageTextTablet: {
    fontSize: 16,
  },
  successMessageSubtext: {
    color: colors.success[700],
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing[1],
  },
  successMessageSubtextTablet: {
    fontSize: 14,
    marginTop: spacing[1.5],
  },
  remissionGuideButton: {
    backgroundColor: colors.accent[500],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    marginTop: spacing[3],
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent[600],
  },
  remissionGuideButtonTablet: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  remissionGuideButtonText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: '700',
  },
  remissionGuideButtonTextTablet: {
    fontSize: 17,
  },
  downloadGuideButton: {
    backgroundColor: colors.info[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    marginTop: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: colors.info[600],
  },
  downloadGuideButtonTablet: {
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  downloadGuideButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  downloadGuideButtonTextTablet: {
    fontSize: 16,
  },
  guideInfoCard: {
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginTop: spacing[3],
    borderWidth: 2,
    borderColor: colors.success[500],
  },
  guideInfoCardTablet: {
    padding: spacing[5],
    marginTop: spacing[4],
  },
  guideInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.success[200],
  },
  guideInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success[800],
    marginLeft: spacing[2],
  },
  guideInfoTitleTablet: {
    fontSize: 18,
  },
  guideInfoDetails: {
    gap: spacing[2],
  },
  guideInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guideInfoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.success[700],
  },
  guideInfoLabelTablet: {
    fontSize: 15,
  },
  guideInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success[800],
    flex: 1,
    textAlign: 'right',
  },
  guideInfoValueTablet: {
    fontSize: 15,
  },
  guideInfoMessage: {
    backgroundColor: colors.info[50],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.info[500],
  },
  guideInfoMessageTablet: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    marginTop: spacing[2.5],
  },
  guideInfoText: {
    color: colors.info[700],
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  guideInfoTextTablet: {
    fontSize: 15,
  },
  guideInfoSubtext: {
    color: colors.info[800],
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing[1],
  },
  guideInfoSubtextTablet: {
    fontSize: 13,
    marginTop: spacing[1.5],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  scrollContentTablet: {
    padding: spacing[8],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  sectionTitleTablet: {
    fontSize: 22,
  },
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  cardTablet: {
    padding: spacing[6],
    marginBottom: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing[3],
    gap: spacing[3],
  },
  productThumbnail: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.secondary,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    flex: 1,
  },
  productNameTablet: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 14,
  },
  cardBody: {
    gap: spacing[2],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  infoLabelTablet: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  infoValueTablet: {
    fontSize: 16,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary[500],
  },
  quantityValueTablet: {
    fontSize: 18,
  },
  repartoInfo: {
    marginTop: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  repartoLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  repartoLabelTablet: {
    fontSize: 14,
  },
  repartoValue: {
    fontSize: 13,
    color: colors.primary[500],
    fontWeight: '500',
  },
  repartoValueTablet: {
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[14],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  emptyTextTablet: {
    fontSize: 22,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  cardFooter: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  validateButton: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  detailButton: {
    backgroundColor: colors.success[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  headerSection: {
    marginBottom: spacing[4],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.xs,
  },
  searchContainerTablet: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    marginTop: spacing[4],
  },
  searchIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  searchIconTablet: {
    fontSize: 22,
    marginRight: spacing[3],
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  searchInputTablet: {
    fontSize: 17,
  },
  clearButton: {
    padding: spacing[1],
    marginLeft: spacing[2],
  },
  clearButtonText: {
    fontSize: 18,
    color: colors.text.tertiary,
    fontWeight: 'bold',
  },
  clearButtonTextTablet: {
    fontSize: 22,
  },
  searchResults: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing[2],
    fontStyle: 'italic',
  },
  searchResultsTablet: {
    fontSize: 15,
    marginTop: spacing[3],
  },
  filterContainer: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  filterContainerTablet: {
    gap: spacing[3],
    marginTop: spacing[4],
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  filterButtonTablet: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  filterButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterButtonTextTablet: {
    fontSize: 15,
  },
  filterButtonTextActive: {
    color: colors.text.inverse,
  },
  // Bultos Modal Styles
  bultosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  bultosModalContainer: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    width: '100%',
    maxWidth: 340,
    ...shadows.lg,
  },
  bultosModalContainerTablet: {
    maxWidth: 400,
    padding: spacing[8],
  },
  bultosModalHeader: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  bultosModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: spacing[3],
    textAlign: 'center',
  },
  bultosModalTitleTablet: {
    fontSize: 24,
  },
  bultosModalSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing[2],
    textAlign: 'center',
  },
  bultosModalSubtitleTablet: {
    fontSize: 16,
  },
  bultosInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
    gap: spacing[3],
  },
  bultosButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  bultosButtonMinus: {
    backgroundColor: colors.danger[500],
  },
  bultosButtonPlus: {
    backgroundColor: colors.success[500],
  },
  bultosInput: {
    width: 100,
    height: 60,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary[500],
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
  },
  bultosInputTablet: {
    width: 120,
    height: 70,
    fontSize: 32,
  },
  bultosModalActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  bultosModalButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bultosModalButtonCancel: {
    backgroundColor: colors.neutral[200],
  },
  bultosModalButtonConfirm: {
    backgroundColor: colors.primary[500],
  },
  bultosModalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  bultosModalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
