import React, { useState, useCallback, useMemo } from 'react';
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

  const handleTransportConfirm = async (vehicle: Vehicle | null, driver: Driver | null, transporter: Transporter | null) => {
    setTransportModalVisible(false);

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
        `📋 RUC: ${transporter!.numeroRuc}\n\n`;
    } else {
      confirmMessage +=
        `🚗 Transporte: Privado\n` +
        `🚗 Vehículo: ${vehicle!.numeroPlaca} (${vehicle!.marca} ${vehicle!.modelo})\n` +
        `👤 Conductor: ${driver!.nombre} ${driver!.apellido}\n` +
        `📋 Licencia: ${driver!.numeroLicencia}\n\n`;
    }

    confirmMessage +=
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
        },
        {
          text: 'Generar',
          style: 'default',
          onPress: async () => {
            try {
              setGeneratingRemissionGuide(true);
              logger.info('🔄 Generando guía de remisión para:', participantName);

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
                } : {
                  vehicleId: vehicle!.id,
                  driverId: driver!.id,
                }
              );

              logger.info('✅ Guía de remisión generada:', response);

              let successMessage =
                `Guía de remisión generada exitosamente:\n\n` +
                `📄 Número: ${response.remissionGuide.serieNumero}\n` +
                `✅ Estado: ${response.remissionGuide.status}\n` +
                `📦 Traslado: ${response.transfer.transferNumber}\n`;

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

  const renderProductCard = (producto: ProductoReparto) => {
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
  };

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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
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

          {productos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay productos asignados
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Este participante aún no tiene productos en repartos
              </Text>
            </View>
          ) : filteredProductos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No se encontraron productos
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Intenta con otros términos de búsqueda
              </Text>
            </View>
          ) : (
            filteredProductos.map((producto) => renderProductCard(producto))
          )}
        </ScrollView>

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
          onClose={() => setTransportModalVisible(false)}
          onConfirm={handleTransportConfirm}
        />

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
  headerInfo: {
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 32,
  },
  typeBadgeContainer: {
    marginTop: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  typeBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  typeBadgeCompany: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  typeBadgeSite: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextTablet: {
    fontSize: 14,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoSectionTablet: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  downloadReportButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  downloadReportButtonTablet: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  downloadReportButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#059669',
  },
  consolidatedButtonTablet: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  consolidatedButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  consolidatedButtonTextTablet: {
    fontSize: 17,
  },
  successMessage: {
    backgroundColor: '#D1FAE5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  successMessageTablet: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  successMessageText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  successMessageTextTablet: {
    fontSize: 16,
  },
  successMessageSubtext: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  successMessageSubtextTablet: {
    fontSize: 14,
    marginTop: 6,
  },
  remissionGuideButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  remissionGuideButtonTablet: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  remissionGuideButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  remissionGuideButtonTextTablet: {
    fontSize: 17,
  },
  downloadGuideButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#0284C7',
  },
  downloadGuideButtonTablet: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  downloadGuideButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadGuideButtonTextTablet: {
    fontSize: 16,
  },
  guideInfoCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  guideInfoCardTablet: {
    padding: 20,
    marginTop: 16,
  },
  guideInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  guideInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#065F46',
    marginLeft: 8,
  },
  guideInfoTitleTablet: {
    fontSize: 18,
  },
  guideInfoDetails: {
    gap: 8,
  },
  guideInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guideInfoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#047857',
  },
  guideInfoLabelTablet: {
    fontSize: 15,
  },
  guideInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
    textAlign: 'right',
  },
  guideInfoValueTablet: {
    fontSize: 15,
  },
  guideInfoMessage: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  guideInfoMessageTablet: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  guideInfoText: {
    color: '#075985',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  guideInfoTextTablet: {
    fontSize: 15,
  },
  guideInfoSubtext: {
    color: '#0C4A6E',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  guideInfoSubtextTablet: {
    fontSize: 13,
    marginTop: 5,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTablet: {
    padding: 24,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
    gap: 12,
  },
  productThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
  },
  productNameTablet: {
    fontSize: 20,
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
  cardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoLabelTablet: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  quantityValueTablet: {
    fontSize: 18,
  },
  repartoInfo: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  repartoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  repartoLabelTablet: {
    fontSize: 14,
  },
  repartoValue: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
  },
  repartoValueTablet: {
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  emptyTextTablet: {
    fontSize: 22,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  validateButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detailButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  headerSection: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchContainerTablet: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchIconTablet: {
    fontSize: 22,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingVertical: 0,
  },
  searchInputTablet: {
    fontSize: 17,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  clearButtonTextTablet: {
    fontSize: 22,
  },
  searchResults: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  searchResultsTablet: {
    fontSize: 15,
    marginTop: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  filterContainerTablet: {
    gap: 12,
    marginTop: 16,
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
  filterButtonTablet: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterButtonTextTablet: {
    fontSize: 15,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
});
