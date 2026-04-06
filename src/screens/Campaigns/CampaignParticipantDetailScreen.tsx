import React, { useState, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { saveAndSharePdf } from '@/utils/fileDownload';
import { campaignsService } from '@/services/api';
import { CampaignParticipant } from '@/types/campaigns';
import { ParticipantTotalsDetail } from '@/types/participant-totals';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import logger from '@/utils/logger';

interface CampaignParticipantDetailScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
      participantId: string;
    };
  };
}

export const CampaignParticipantDetailScreen: React.FC<CampaignParticipantDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId, participantId } = route.params;
  const [participant, setParticipant] = useState<CampaignParticipant | null>(null);
  const [totalsData, setTotalsData] = useState<ParticipantTotalsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load participant details
      const participants = await campaignsService.getParticipants(campaignId);
      const foundParticipant = participants.find((p) => p.id === participantId);

      if (!foundParticipant) {
        Alert.alert('Error', 'Participante no encontrado');
        navigation.goBack();
        return;
      }

      setParticipant(foundParticipant);

      // Load participant totals
      try {
        const totalsResponse = await campaignsService.getParticipantTotals(campaignId);
        const participantTotals = totalsResponse.participants.find(
          (p) => p.participantId === participantId
        );

        if (participantTotals) {
          setTotalsData(participantTotals);
        }
      } catch (error) {
        logger.error('Error loading participant totals:', error);
      }
    } catch (error: any) {
      logger.error('Error loading participant data:', error);
      Alert.alert('Error', 'No se pudo cargar la información del participante');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, participantId, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDownloadReport = async () => {
    if (!totalsData) {
      return;
    }

    try {
      setDownloadingReport(true);

      logger.info('🔄 Descargando reporte de totales del participante...');
      const startTime = new Date().getTime();

      // Call the API to get the PDF blob
      const pdfBlob = await campaignsService.exportParticipantTotalsPdf(campaignId);

      const endTime = new Date().getTime();
      logger.info('✅ PDF descargado del servidor');
      logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
      logger.info('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

      const timestamp = new Date().getTime();
      const fileName = `reporte-totales-participante-${totalsData.participantName.replace(/\s+/g, '-')}-${timestamp}.pdf`;

      await saveAndSharePdf(pdfBlob, fileName, `Reporte de Totales - ${totalsData.participantName}`);

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

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando información...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!participant) {
    return null;
  }

  const participantName =
    participant.participantType === 'EXTERNAL_COMPANY'
      ? participant.company?.name || 'Empresa'
      : participant.site?.name || 'Sede';

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
                  participant.participantType === 'EXTERNAL_COMPANY'
                    ? styles.typeBadgeCompany
                    : styles.typeBadgeSite,
                ]}
              >
                <Text style={[styles.typeText, isTablet && styles.typeTextTablet]}>
                  {participant.participantType === 'EXTERNAL_COMPANY'
                    ? '🏢 Empresa Externa'
                    : '🏛️ Sede Interna'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {/* Totals Summary */}
          {totalsData && (
            <View style={[styles.section, isTablet && styles.sectionTablet]}>
              <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                Resumen de Totales
              </Text>

              <View style={styles.totalsGrid}>
                <View
                  style={[
                    styles.totalCard,
                    isTablet && styles.totalCardTablet,
                    styles.purchaseCard,
                  ]}
                >
                  <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
                    Total Compra
                  </Text>
                  <Text
                    style={[
                      styles.totalValue,
                      isTablet && styles.totalValueTablet,
                      styles.purchaseValue,
                    ]}
                  >
                    {formatCurrency(totalsData.totalPurchaseCents)}
                  </Text>
                </View>

                <View
                  style={[styles.totalCard, isTablet && styles.totalCardTablet, styles.saleCard]}
                >
                  <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
                    Total Venta
                  </Text>
                  <Text
                    style={[
                      styles.totalValue,
                      isTablet && styles.totalValueTablet,
                      styles.saleValue,
                    ]}
                  >
                    {formatCurrency(totalsData.totalSaleCents)}
                  </Text>
                </View>

                <View
                  style={[styles.totalCard, isTablet && styles.totalCardTablet, styles.marginCard]}
                >
                  <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
                    Margen
                  </Text>
                  <Text
                    style={[
                      styles.totalValue,
                      isTablet && styles.totalValueTablet,
                      styles.marginValue,
                    ]}
                  >
                    {formatCurrency(totalsData.marginCents)}
                  </Text>
                  <Text
                    style={[styles.marginPercentage, isTablet && styles.marginPercentageTablet]}
                  >
                    {totalsData.marginPercentage.toFixed(2)}%
                  </Text>
                </View>
              </View>

              {totalsData.priceProfileName && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                    Perfil de Precio:
                  </Text>
                  <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                    {totalsData.priceProfileName}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Products List */}
          {totalsData && totalsData.products.length > 0 && (
            <View style={[styles.section, isTablet && styles.sectionTablet]}>
              <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                Productos ({totalsData.products.length})
              </Text>

              {totalsData.products.map((product) => (
                <View
                  key={product.productId}
                  style={[styles.productCard, isTablet && styles.productCardTablet]}
                >
                  <View style={styles.productHeader}>
                    <Text style={[styles.productName, isTablet && styles.productNameTablet]}>
                      {product.productName}
                    </Text>
                    {product.isPreliminary && (
                      <View style={styles.preliminaryBadge}>
                        <Text style={styles.preliminaryText}>Preliminar</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.productSku, isTablet && styles.productSkuTablet]}>
                    SKU: {product.sku}
                  </Text>

                  <View style={styles.productDetails}>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, isTablet && styles.detailLabelTablet]}>
                        Cantidad:
                      </Text>
                      <Text style={[styles.detailValue, isTablet && styles.detailValueTablet]}>
                        {product.totalQuantityBase} unidades
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, isTablet && styles.detailLabelTablet]}>
                        Costo Unitario:
                      </Text>
                      <Text style={[styles.detailValue, isTablet && styles.detailValueTablet]}>
                        {formatCurrency(product.costCents)}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, isTablet && styles.detailLabelTablet]}>
                        Precio Venta:
                      </Text>
                      <Text style={[styles.detailValue, isTablet && styles.detailValueTablet]}>
                        {formatCurrency(product.salePriceCents)}
                      </Text>
                    </View>

                    <View style={[styles.detailRow, styles.totalRow]}>
                      <Text
                        style={[
                          styles.detailLabel,
                          isTablet && styles.detailLabelTablet,
                          styles.totalLabel,
                        ]}
                      >
                        Total Compra:
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          isTablet && styles.detailValueTablet,
                          styles.purchaseValue,
                        ]}
                      >
                        {formatCurrency(product.purchaseTotalCents)}
                      </Text>
                    </View>

                    <View style={[styles.detailRow, styles.totalRow]}>
                      <Text
                        style={[
                          styles.detailLabel,
                          isTablet && styles.detailLabelTablet,
                          styles.totalLabel,
                        ]}
                      >
                        Total Venta:
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          isTablet && styles.detailValueTablet,
                          styles.saleValue,
                        ]}
                      >
                        {formatCurrency(product.saleTotalCents)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Download Report Button */}
          {totalsData && (
            <TouchableOpacity
              style={[
                styles.downloadButton,
                isTablet && styles.downloadButtonTablet,
                downloadingReport && styles.downloadButtonDisabled,
              ]}
              onPress={handleDownloadReport}
              disabled={downloadingReport}
            >
              <Text
                style={[styles.downloadButtonText, isTablet && styles.downloadButtonTextTablet]}
              >
                {downloadingReport ? '📄 Generando reporte...' : '📄 Descargar Reporte de Totales'}
              </Text>
            </TouchableOpacity>
          )}

          {!totalsData && (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay información de totales disponible
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Los totales se calcularán cuando haya productos asignados
              </Text>
            </View>
          )}
        </ScrollView>
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
    color: '#1E293B',
  },
  typeTextTablet: {
    fontSize: 14,
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
    marginBottom: 24,
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
  totalsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  totalCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  totalCardTablet: {
    padding: 20,
  },
  purchaseCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  saleCard: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  marginCard: {
    backgroundColor: '#E0E7FF',
    borderColor: '#6366F1',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  totalLabelTablet: {
    fontSize: 16,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalValueTablet: {
    fontSize: 28,
  },
  purchaseValue: {
    color: '#F59E0B',
  },
  saleValue: {
    color: '#10B981',
  },
  marginValue: {
    color: '#6366F1',
  },
  marginPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    marginTop: 4,
  },
  marginPercentageTablet: {
    fontSize: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
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
  productCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productCardTablet: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  productNameTablet: {
    fontSize: 18,
  },
  preliminaryBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  preliminaryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
  },
  productSku: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  productSkuTablet: {
    fontSize: 14,
  },
  productDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailLabelTablet: {
    fontSize: 15,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
  },
  detailValueTablet: {
    fontSize: 15,
  },
  totalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: '600',
  },
  downloadButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  downloadButtonDisabled: {
    opacity: 0.5,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadButtonTextTablet: {
    fontSize: 16,
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
    textAlign: 'center',
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
});
