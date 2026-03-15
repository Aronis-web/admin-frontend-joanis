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
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { campaignsService, repartosService } from '@/services/api';
import logger from '@/utils/logger';
import { Campaign, CampaignParticipant, ParticipantType } from '@/types/campaigns';
import { RepartoProducto } from '@/types/repartos';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProductSelectionModal, CircularProgress } from '@/components/Repartos';
import { usePermissions } from '@/hooks/usePermissions';
import * as downloadTracker from '@/utils/downloadTracker';

interface RepartoCampaignDetailScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
    };
  };
}

export const RepartoCampaignDetailScreen: React.FC<RepartoCampaignDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId } = route.params;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [participants, setParticipants] = useState<CampaignParticipant[]>([]);
  const [repartos, setRepartos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showProductSelectionModal, setShowProductSelectionModal] = useState(false);
  const [allProducts, setAllProducts] = useState<RepartoProducto[]>([]);
  const [downloadingParticipantId, setDownloadingParticipantId] = useState<string | null>(null);
  const [downloadingGeneralReport, setDownloadingGeneralReport] = useState(false);
  const [participantProgress, setParticipantProgress] = useState<Map<string, { validated: number; total: number; percentage: number }>>(new Map());
  const [formatModalVisible, setFormatModalVisible] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [distributionFormatModalVisible, setDistributionFormatModalVisible] = useState(false);
  const [selectedProductsForExport, setSelectedProductsForExport] = useState<string[]>([]);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const { hasPermission } = usePermissions();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Cargar campaña, participantes y progreso en paralelo
      const [campaignData, participantsData, campaignProgressData] = await Promise.all([
        campaignsService.getCampaign(campaignId),
        campaignsService.getParticipants(campaignId),
        repartosService.getCampaignProgress(campaignId),
      ]);

      setCampaign(campaignData);
      setParticipants(participantsData);

      // Mapear el progreso de cada participante
      const progressMap = new Map<string, { validated: number; total: number; percentage: number }>();

      campaignProgressData.participants.forEach((participantProgress) => {
        progressMap.set(participantProgress.participantId, {
          validated: participantProgress.progress.productsValidated,
          total: participantProgress.progress.productsAssigned,
          percentage: participantProgress.progress.productsPercentage,
        });
      });

      setParticipantProgress(progressMap);

      // Usar el conteo de repartos del progreso en lugar de cargar todos los repartos
      // Esto evita cargar 37 repartos completos con todos sus detalles
      setRepartos(
        Array(campaignProgressData.overallProgress.totalRepartos).fill({ id: 'placeholder' })
      );
    } catch (error: any) {
      logger.error('Error loading campaign data:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la campaña');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleParticipantPress = (participant: CampaignParticipant) => {
    navigation.navigate('RepartoParticipantDetail', {
      campaignId,
      participantId: participant.id,
    });
  };

  const handleOpenProductSelection = async () => {
    try {
      // Cargar repartos solo cuando se necesiten para el modal de productos
      const repartosData = await repartosService.getRepartosByCampaign(campaignId);

      // Collect all products from all repartos and group by product ID
      const productMap = new Map<string, RepartoProducto>();

      repartosData.forEach((reparto) => {
        reparto.participantes?.forEach((participante: any) => {
          participante.productos?.forEach((producto: RepartoProducto) => {
            // Use product ID as key to avoid duplicates
            const productKey = producto.productId;
            if (productKey && !productMap.has(productKey)) {
              productMap.set(productKey, producto);
            }
          });
        });
      });

      // Convert map to array
      const uniqueProducts = Array.from(productMap.values());

      // Cargar información de descargas desde el almacenamiento local
      const downloadInfo = await downloadTracker.getCampaignDownloads(campaignId);
      logger.info(`📊 Información de descargas cargada: ${downloadInfo.size} productos con historial`);

      // Combinar productos con información de descargas
      const productsWithDownloadInfo = uniqueProducts.map((producto) => {
        const downloadRecord = downloadInfo.get(producto.productId);
        if (downloadRecord) {
          logger.info(`✅ Producto ${producto.product?.title || producto.productId}: ${downloadRecord.downloadCount} descargas`);
        }
        return {
          ...producto,
          downloadCount: downloadRecord?.downloadCount || 0,
          lastDownloadedAt: downloadRecord?.lastDownloadedAt,
        };
      });

      logger.info(`📦 Total productos con info de descarga: ${productsWithDownloadInfo.length}`);

      // Sort products by area name (ascending)
      const sortedProducts = productsWithDownloadInfo.sort((a, b) => {
        const areaA = a.area?.name || a.areaId || '';
        const areaB = b.area?.name || b.areaId || '';
        return areaA.localeCompare(areaB, 'es', { sensitivity: 'base' });
      });

      setAllProducts(sortedProducts);
      setShowProductSelectionModal(true);
    } catch (error: any) {
      logger.error('Error loading repartos for product selection:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos');
    }
  };

  const handleExportAllDistributionSheets = async (selectedProductIds: string[]) => {
    // Store selected products and show format selection modal
    setSelectedProductsForExport(selectedProductIds);
    setShowProductSelectionModal(false);
    setDistributionFormatModalVisible(true);
  };

  const handleDownloadDistributionSheets = async (format: 'pdf' | 'excel') => {
    try {
      setExportingPdf(true);
      setDistributionFormatModalVisible(false);

      let blob: Blob;
      let extension: string;
      let mimeType: string;
      let uti: string;

      if (format === 'pdf') {
        // Call the API to get the PDF blob with selected products
        blob = await repartosService.exportCampaignDistributionSheets(
          campaignId,
          selectedProductsForExport
        );
        extension = 'pdf';
        mimeType = 'application/pdf';
        uti = 'com.adobe.pdf';
      } else {
        // Call the API to get the Excel blob with selected products
        blob = await repartosService.exportDistributionSummaryExcel(
          campaignId,
          selectedProductsForExport
        );
        extension = 'xlsx';
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        uti = 'org.openxmlformats.spreadsheetml.sheet';
      }

      // Register download for tracking purposes (local storage)
      try {
        logger.info(`📝 Registrando descarga de ${selectedProductsForExport.length} productos para campaña ${campaignId}`);
        logger.info(`📋 Productos: ${selectedProductsForExport.join(', ')}`);
        await downloadTracker.registerDownloads(campaignId, selectedProductsForExport);
        logger.info('✅ Descarga registrada localmente para seguimiento');

        // Verificar que se guardó correctamente
        const downloadInfo = await downloadTracker.getCampaignDownloads(campaignId);
        logger.info(`🔍 Verificación: ${downloadInfo.size} productos con historial después del registro`);
      } catch (error) {
        logger.warn('⚠️ No se pudo registrar la descarga:', error);
        // Don't fail the download if tracking fails
      }

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `hojas-reparto-${campaign?.code || campaignId}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', `Las hojas de reparto en ${format.toUpperCase()} se están descargando`);
      } else {
        // For mobile (iOS/Android), save to file system and share
        const fileName = `hojas-reparto-${campaign?.code || campaignId}.${extension}`;
        const file = new FileSystem.File(FileSystem.Paths.cache, fileName);

        // Delete file if it exists
        if (file.exists) {
          await file.delete();
        }

        // Convert blob to array buffer using FileReader
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
            mimeType,
            dialogTitle: 'Hojas de Reparto',
            UTI: uti,
          });
        } else {
          Alert.alert('Éxito', `Archivo guardado en: ${file.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('Error exporting distribution sheets:', error);
      Alert.alert('Error', error.message || 'No se pudieron exportar las hojas de reparto');
    } finally {
      setExportingPdf(false);
      setSelectedProductsForExport([]);
    }
  };

  const handleOpenValidationReportModal = (participantId: string, participantName: string) => {
    setSelectedParticipant({ id: participantId, name: participantName });
    setFormatModalVisible(true);
  };

  const handleDownloadValidationReport = async (format: 'pdf' | 'excel') => {
    if (!selectedParticipant) {
      Alert.alert('Error', 'No se encontró la información del participante');
      return;
    }

    setFormatModalVisible(false);
    setDownloadingParticipantId(selectedParticipant.id);

    try {
      logger.info(`📥 Descargando reporte de validación en formato ${format.toUpperCase()}...`);
      const blob = await repartosService.exportValidationReport(
        selectedParticipant.id,
        campaignId,
        format
      );

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        link.download = `Totales_Venta_${selectedParticipant.name.replace(/\s+/g, '_')}_${new Date().getTime()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', `Reporte ${format.toUpperCase()} descargado exitosamente`);
      } else {
        // For mobile (iOS/Android), save to file system and share
        const timestamp = new Date().getTime();
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        const fileName = `Totales_Venta_${selectedParticipant.name.replace(/\s+/g, '_')}_${timestamp}.${extension}`;
        const file = new FileSystem.File(FileSystem.Paths.document, fileName);

        // Convert blob to array buffer using FileReader
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
            mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Totales Venta',
            UTI: format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
          });
        } else {
          Alert.alert('Éxito', `Archivo guardado en: ${file.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('Error descargando reporte de validación:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo descargar el reporte de validación'
      );
    } finally {
      setDownloadingParticipantId(null);
      setSelectedParticipant(null);
    }
  };

  const handleDownloadGeneralReport = async () => {
    if (repartos.length === 0) {
      Alert.alert('Error', 'No hay repartos para generar el reporte');
      return;
    }

    try {
      setDownloadingGeneralReport(true);

      logger.info('🔄 Descargando reporte general de totales de la campaña');
      const startTime = new Date().getTime();

      // Call the API to get the PDF blob for all participants
      // Endpoint: GET /admin/campaigns/repartos/campaigns/:campaignId/all-participants/consolidated-totals/export-pdf
      const pdfBlob = await repartosService.exportAllParticipantsConsolidatedTotals(campaignId);

      const endTime = new Date().getTime();
      logger.info('✅ PDF descargado del servidor');
      logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
      logger.info('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `reporte-totales-general-${campaign?.code || campaignId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', 'El reporte general de totales se está descargando');
      } else {
        // For mobile (iOS/Android), save to file system and share
        const timestamp = new Date().getTime();
        const fileName = `reporte-totales-general-${campaign?.code || campaignId}-${timestamp}.pdf`;
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
            dialogTitle: 'Reporte General de Totales',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${file.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('Error downloading general report:', error);
      Alert.alert('Error', error.message || 'No se pudo descargar el reporte general');
    } finally {
      setDownloadingGeneralReport(false);
    }
  };

  const handleDownloadParticipantReport = async (participant: CampaignParticipant, event: any) => {
    // Prevent navigation to participant detail
    event.stopPropagation();

    const participantName =
      participant.participantType === ParticipantType.EXTERNAL_COMPANY
        ? participant.company?.alias || participant.company?.name || 'Empresa'
        : participant.site?.name || 'Sede';

    try {
      setDownloadingParticipantId(participant.id);

      logger.info('🔄 Descargando reporte del participante:', participantName);
      const startTime = new Date().getTime();

      // Get the participant's repartos to extract the first reparto ID
      const participantRepartos = repartos.filter((reparto) =>
        reparto.participantes?.some((p: any) => p.campaignParticipantId === participant.id)
      );

      if (participantRepartos.length === 0) {
        Alert.alert('Error', 'No se encontraron repartos para este participante');
        return;
      }

      // Call the API to get the PDF blob for this participant
      const pdfBlob = await repartosService.exportRepartoTotalsReport(
        participant.id,
        campaignId
      );

      const endTime = new Date().getTime();
      logger.info('✅ PDF descargado del servidor');
      logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
      logger.info('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `reparto-${participantName.replace(/\s+/g, '-')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', `El reporte de ${participantName} se está descargando`);
      } else {
        // For mobile (iOS/Android), save to file system and share
        const timestamp = new Date().getTime();
        const fileName = `reparto-${participantName.replace(/\s+/g, '-')}-${timestamp}.pdf`;
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
            dialogTitle: `Reporte de Reparto - ${participantName}`,
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
      setDownloadingParticipantId(null);
    }
  };

  const renderParticipantCard = useCallback(
    (participant: CampaignParticipant) => {
      const participantName =
        participant.participantType === ParticipantType.EXTERNAL_COMPANY
          ? participant.company?.alias || participant.company?.name || 'Empresa'
          : participant.site?.name || 'Sede';

      const participantCode =
        participant.participantType === ParticipantType.EXTERNAL_COMPANY
          ? participant.company?.ruc || ''
          : participant.site?.code || '';

      // Obtener progreso del participante desde el estado
      const progress = participantProgress.get(participant.id) || {
        validated: 0,
        total: 0,
        percentage: 0,
      };

      const totalProductos = progress.total;
      const productosValidados = progress.validated;
      const progressPercentage = progress.percentage;

      return (
        <TouchableOpacity
          key={participant.id}
          style={[styles.card, isTablet && styles.cardTablet]}
          onPress={() => handleParticipantPress(participant)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={[styles.participantName, isTablet && styles.participantNameTablet]}>
                {participantName}
              </Text>
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

          <View style={styles.cardBody}>
            {participantCode && (
              <Text style={[styles.participantCode, isTablet && styles.participantCodeTablet]}>
                {participantCode}
              </Text>
            )}

            {/* Progress Row */}
            {totalProductos > 0 && (
              <View style={styles.progressRow}>
                <View style={styles.progressInfo}>
                  <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                    Productos validados
                  </Text>
                  <Text style={[styles.progressText, isTablet && styles.progressTextTablet]}>
                    {productosValidados} / {totalProductos}
                  </Text>
                </View>
                <CircularProgress
                  progress={progressPercentage}
                  size={isTablet ? 60 : 50}
                  strokeWidth={isTablet ? 6 : 5}
                />
              </View>
            )}
          </View>

          <View style={styles.cardFooter}>
            <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
              Ver productos de reparto
            </Text>
            <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
          </View>

          {/* Download Report Button */}
          {totalProductos > 0 && (
            <TouchableOpacity
              style={[
                styles.downloadParticipantButton,
                isTablet && styles.downloadParticipantButtonTablet,
                downloadingParticipantId === participant.id && styles.downloadButtonDisabled,
              ]}
              onPress={(e) => handleDownloadParticipantReport(participant, e)}
              disabled={downloadingParticipantId === participant.id}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.downloadParticipantButtonText,
                  isTablet && styles.downloadParticipantButtonTextTablet,
                ]}
              >
                {downloadingParticipantId === participant.id
                  ? '📄 Generando...'
                  : '📄 Descargar Reporte de Reparto'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Validation Report Button - Only show when 100% validated */}
          {progressPercentage === 100 && (
            <TouchableOpacity
              style={[
                styles.validationReportButton,
                isTablet && styles.validationReportButtonTablet,
                downloadingParticipantId === participant.id && styles.downloadButtonDisabled,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenValidationReportModal(participant.id, participantName);
              }}
              disabled={downloadingParticipantId === participant.id}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.validationReportButtonText,
                  isTablet && styles.validationReportButtonTextTablet,
                ]}
              >
                📊 Totales venta
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    },
    [
      isTablet,
      participantProgress,
      handleParticipantPress,
      downloadingParticipantId,
      handleDownloadParticipantReport,
      handleOpenValidationReportModal,
    ]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando participantes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return null;
  }

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
            <Text style={[styles.title, isTablet && styles.titleTablet]}>{campaign.name}</Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              {campaign.code}
            </Text>
          </View>
        </View>

        {/* Campaign Info */}
        <View style={[styles.infoSection, isTablet && styles.infoSectionTablet]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Total de participantes:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {participants.length}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Repartos generados:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {repartos.length}
            </Text>
          </View>

          {/* Export All Distribution Sheets Button */}
          {repartos.length > 0 && (
            <TouchableOpacity
              style={[styles.exportButton, isTablet && styles.exportButtonTablet]}
              onPress={handleOpenProductSelection}
              disabled={exportingPdf}
              activeOpacity={0.7}
            >
              <Text style={[styles.exportButtonText, isTablet && styles.exportButtonTextTablet]}>
                {exportingPdf ? '📄 Generando PDF...' : '📄 Descargar Todas las Hojas de Reparto'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Download General Totals Report Button */}
          {hasPermission('repartos.reports') && repartos.length > 0 && (
            <TouchableOpacity
              style={[
                styles.generalReportButton,
                isTablet && styles.generalReportButtonTablet,
                downloadingGeneralReport && styles.downloadButtonDisabled,
              ]}
              onPress={handleDownloadGeneralReport}
              disabled={downloadingGeneralReport}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.generalReportButtonText,
                  isTablet && styles.generalReportButtonTextTablet,
                ]}
              >
                {downloadingGeneralReport
                  ? '📊 Generando Reporte...'
                  : '📊 Descargar Reporte General de Totales'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Participants List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Participantes
          </Text>

          {participants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay participantes en esta campaña
              </Text>
            </View>
          ) : (
            participants
              .slice()
              .sort((a, b) => {
                // Primero sedes (INTERNAL_SITE), luego empresas (EXTERNAL_COMPANY)
                if (
                  a.participantType === ParticipantType.INTERNAL_SITE &&
                  b.participantType !== ParticipantType.INTERNAL_SITE
                ) {
                  return -1;
                }
                if (
                  a.participantType !== ParticipantType.INTERNAL_SITE &&
                  b.participantType === ParticipantType.INTERNAL_SITE
                ) {
                  return 1;
                }

                // Ordenar alfabéticamente dentro de cada grupo
                const nameA =
                  a.participantType === ParticipantType.EXTERNAL_COMPANY
                    ? a.company?.alias || a.company?.name || ''
                    : a.site?.name || '';

                const nameB =
                  b.participantType === ParticipantType.EXTERNAL_COMPANY
                    ? b.company?.alias || b.company?.name || ''
                    : b.site?.name || '';

                return nameA.localeCompare(nameB);
              })
              .map((participant) => renderParticipantCard(participant))
          )}
        </ScrollView>

        {/* Product Selection Modal */}
        <ProductSelectionModal
          visible={showProductSelectionModal}
          onClose={() => setShowProductSelectionModal(false)}
          onConfirm={handleExportAllDistributionSheets}
          products={allProducts}
          loading={exportingPdf}
        />

        {/* Format Selection Modal - Validation Reports */}
        <Modal
          visible={formatModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setFormatModalVisible(false);
            setSelectedParticipant(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.formatModalContainer, isTablet && styles.formatModalContainerTablet]}>
              <Text style={[styles.formatModalTitle, isTablet && styles.formatModalTitleTablet]}>
                Seleccionar formato de descarga
              </Text>
              <Text style={[styles.formatModalSubtitle, isTablet && styles.formatModalSubtitleTablet]}>
                {selectedParticipant?.name}
              </Text>

              <View style={styles.formatButtonsContainer}>
                <TouchableOpacity
                  style={[styles.formatButton, styles.pdfButton]}
                  onPress={() => handleDownloadValidationReport('pdf')}
                  disabled={downloadingParticipantId !== null}
                >
                  <Text style={styles.formatButtonIcon}>📄</Text>
                  <Text style={styles.formatButtonTitle}>PDF</Text>
                  <Text style={styles.formatButtonDescription}>
                    Incluye fotos y firmas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formatButton, styles.excelButton]}
                  onPress={() => handleDownloadValidationReport('excel')}
                  disabled={downloadingParticipantId !== null}
                >
                  <Text style={styles.formatButtonIcon}>📊</Text>
                  <Text style={styles.formatButtonTitle}>Excel</Text>
                  <Text style={styles.formatButtonDescription}>
                    Datos tabulados
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.formatCancelButton}
                onPress={() => {
                  setFormatModalVisible(false);
                  setSelectedParticipant(null);
                }}
                disabled={downloadingParticipantId !== null}
              >
                <Text style={styles.formatCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Format Selection Modal - Distribution Sheets */}
        <Modal
          visible={distributionFormatModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setDistributionFormatModalVisible(false);
            setSelectedProductsForExport([]);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.formatModalContainer, isTablet && styles.formatModalContainerTablet]}>
              <Text style={[styles.formatModalTitle, isTablet && styles.formatModalTitleTablet]}>
                Seleccionar formato de descarga
              </Text>
              <Text style={[styles.formatModalSubtitle, isTablet && styles.formatModalSubtitleTablet]}>
                Hojas de Reparto
              </Text>

              <View style={styles.formatButtonsContainer}>
                <TouchableOpacity
                  style={[styles.formatButton, styles.pdfButton]}
                  onPress={() => handleDownloadDistributionSheets('pdf')}
                  disabled={exportingPdf}
                >
                  <Text style={styles.formatButtonIcon}>📄</Text>
                  <Text style={styles.formatButtonTitle}>PDF</Text>
                  <Text style={styles.formatButtonDescription}>
                    Hojas de reparto detalladas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formatButton, styles.excelButton]}
                  onPress={() => handleDownloadDistributionSheets('excel')}
                  disabled={exportingPdf}
                >
                  <Text style={styles.formatButtonIcon}>📊</Text>
                  <Text style={styles.formatButtonTitle}>Excel</Text>
                  <Text style={styles.formatButtonDescription}>
                    Resumen en tabla
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.formatCancelButton}
                onPress={() => {
                  setDistributionFormatModalVisible(false);
                  setSelectedProductsForExport([]);
                }}
                disabled={exportingPdf}
              >
                <Text style={styles.formatCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
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
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  subtitleTablet: {
    fontSize: 16,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    fontWeight: '600',
    color: '#1E293B',
  },
  infoValueTablet: {
    fontSize: 16,
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
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  participantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
  },
  participantNameTablet: {
    fontSize: 22,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
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
  cardBody: {
    marginBottom: 12,
  },
  participantCode: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  participantCodeTablet: {
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statLabelTablet: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  statValueTablet: {
    fontSize: 20,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginTop: 12,
  },
  progressInfo: {
    flex: 1,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6366F1',
    marginTop: 4,
  },
  progressTextTablet: {
    fontSize: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '500',
  },
  footerTextTablet: {
    fontSize: 14,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#CBD5E1',
    fontWeight: 'bold',
  },
  arrowIconTablet: {
    fontSize: 32,
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
  },
  emptyTextTablet: {
    fontSize: 22,
  },
  exportButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportButtonTablet: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 16,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  exportButtonTextTablet: {
    fontSize: 16,
  },
  downloadParticipantButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  downloadParticipantButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
  },
  downloadParticipantButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  downloadParticipantButtonTextTablet: {
    fontSize: 15,
  },
  downloadButtonDisabled: {
    opacity: 0.5,
  },
  generalReportButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  generalReportButtonTablet: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 16,
  },
  generalReportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  generalReportButtonTextTablet: {
    fontSize: 16,
  },
  validationReportButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  validationReportButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
  },
  validationReportButtonText: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '600',
  },
  validationReportButtonTextTablet: {
    fontSize: 15,
  },
  // Format Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formatModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  formatModalContainerTablet: {
    padding: 32,
    maxWidth: 500,
  },
  formatModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  formatModalTitleTablet: {
    fontSize: 24,
  },
  formatModalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    textAlign: 'center',
  },
  formatModalSubtitleTablet: {
    fontSize: 16,
  },
  formatButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formatButton: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  pdfButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  excelButton: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  formatButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  formatButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  formatButtonDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  formatCancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  formatCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
});
