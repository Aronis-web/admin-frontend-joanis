import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { campaignsService } from '@/services/api';
import { Campaign } from '@/types/campaigns';
import { ParticipantTotalsResponse } from '@/types/participant-totals';
import { logger } from '@/utils/logger';

interface CopyParticipantsModalProps {
  visible: boolean;
  currentCampaignId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CopyParticipantsModal: React.FC<CopyParticipantsModalProps> = ({
  visible,
  currentCampaignId,
  onClose,
  onSuccess,
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignTotals, setCampaignTotals] = useState<Record<string, ParticipantTotalsResponse>>({});
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  useEffect(() => {
    logger.info(`🔔 Modal visibility changed: ${visible}, currentCampaignId: ${currentCampaignId}`);
    if (visible && currentCampaignId) {
      logger.info('🚀 Modal opened, loading campaigns...');
      // Reset state first
      setCampaigns([]);
      setCampaignTotals({});
      setSelectedCampaignId(null);
      // Load campaigns
      loadCampaigns();
    } else if (!visible) {
      logger.info('🚪 Modal closed, resetting state...');
      setCampaigns([]);
      setCampaignTotals({});
      setSelectedCampaignId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentCampaignId]);

  const loadCampaigns = async () => {
    try {
      logger.info('📥 [START] Iniciando carga de campañas...');
      setLoading(true);
      logger.info('📥 [LOADING] Estado de loading establecido a true');

      // Get last 10 campaigns excluding the current one
      logger.info('📥 [API] Llamando a getCampaigns...');
      const response = await campaignsService.getCampaigns({
        limit: 10, // Get 10 to ensure we have 5 after filtering current
        orderBy: 'createdAt',
        orderDir: 'DESC',
      });

      logger.info(`📥 [API] Respuesta recibida: ${response.data.length} campañas totales`);

      // Filter out current campaign
      const filteredCampaigns = response.data.filter(
        (campaign) => campaign.id !== currentCampaignId
      ).slice(0, 5); // Take only 5

      logger.info(`✅ [FILTER] Campañas filtradas: ${filteredCampaigns.length}`);
      logger.info(`📋 [FILTER] IDs: ${filteredCampaigns.map(c => c.id).join(', ')}`);

      // Load participant totals for each campaign
      const totalsMap: Record<string, ParticipantTotalsResponse> = {};
      logger.info(`📊 [TOTALS] Cargando totales para ${filteredCampaigns.length} campañas...`);

      for (const campaign of filteredCampaigns) {
        try {
          logger.info(`📊 [TOTALS] Cargando totales para campaña ${campaign.code}...`);
          const totals = await campaignsService.getParticipantTotals(campaign.id);
          totalsMap[campaign.id] = totals;
          logger.info(`📊 [TOTALS] ✅ Totales cargados para ${campaign.code}`);
        } catch (error) {
          logger.warn(`⚠️ [TOTALS] No se pudieron cargar totales para campaña ${campaign.code}`, error);
        }
      }

      logger.info(`📊 [TOTALS] Totales cargados: ${Object.keys(totalsMap).length}`);

      // Set both campaigns and totals together to ensure they render at the same time
      logger.info(`🔄 [STATE] Actualizando estado con ${filteredCampaigns.length} campañas...`);
      setCampaigns(filteredCampaigns);
      setCampaignTotals(totalsMap);
      logger.info(`✅ [STATE] Estado actualizado exitosamente`);
    } catch (error: any) {
      logger.error('❌ [ERROR] Error al cargar campañas:', error);
      Alert.alert('Error', 'No se pudieron cargar las campañas');
    } finally {
      logger.info('🏁 [FINALLY] Estableciendo loading a false');
      setLoading(false);
    }
  };

  const handleCopyCampaign = async (sourceCampaignId: string) => {
    try {
      setCopying(true);
      setSelectedCampaignId(sourceCampaignId);
      logger.info('📋 Copiando participantes de campaña:', sourceCampaignId);

      // Load full campaign with participants
      const sourceCampaign = await campaignsService.getCampaign(sourceCampaignId);

      if (!sourceCampaign.participants || sourceCampaign.participants.length === 0) {
        Alert.alert('Sin participantes', 'La campaña seleccionada no tiene participantes para copiar');
        return;
      }

      logger.info(`📋 Copiando ${sourceCampaign.participants.length} participantes...`);

      // Add each participant to the current campaign
      let successCount = 0;
      let errorCount = 0;

      for (const participant of sourceCampaign.participants) {
        try {
          // Convert assignedAmountCents to assignedAmount (cents to normal units)
          const assignedAmount = participant.assignedAmountCents / 100;

          const data: any = {
            participantType: participant.participantType,
            companyId: participant.companyId,
            siteId: participant.siteId,
            priceProfileId: participant.priceProfileId,
            assignedAmount: assignedAmount,
            currency: participant.currency || 'PEN',
          };

          logger.info(`📋 Copiando participante: ${participant.site?.name || participant.company?.name || 'N/A'} - Monto: ${assignedAmount}`);
          await campaignsService.addParticipant(currentCampaignId, data);
          successCount++;
        } catch (error: any) {
          logger.error('❌ Error al copiar participante:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        Alert.alert(
          'Éxito',
          `Se copiaron ${successCount} participante(s) exitosamente${errorCount > 0 ? `. ${errorCount} fallaron.` : ''}`,
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
      } else {
        Alert.alert('Error', 'No se pudo copiar ningún participante');
      }
    } catch (error: any) {
      logger.error('❌ Error al copiar participantes:', error);
      Alert.alert('Error', error.message || 'No se pudieron copiar los participantes');
    } finally {
      setCopying(false);
      setSelectedCampaignId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return '#94A3B8';
      case 'ACTIVE':
        return '#10B981';
      case 'CLOSED':
        return '#6366F1';
      case 'CANCELLED':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Borrador';
      case 'ACTIVE':
        return 'Activa';
      case 'CLOSED':
        return 'Cerrada';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  // Log render state
  logger.info(`🎨 [RENDER] Modal rendering - visible: ${visible}, loading: ${loading}, campaigns: ${campaigns.length}`);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📋 Copiar Participantes</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Selecciona una campaña para copiar sus participantes a la campaña actual.
          </Text>

          {/* Campaigns List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {(() => {
              logger.info(`🎨 [RENDER-CONDITION] Evaluando: loading=${loading}, campaigns.length=${campaigns.length}`);

              if (loading) {
                logger.info('🎨 [RENDER-CONDITION] Mostrando loading...');
                return (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.loadingText}>Cargando campañas...</Text>
                  </View>
                );
              }

              if (campaigns.length === 0) {
                logger.info('🎨 [RENDER-CONDITION] Mostrando empty state...');
                return (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>📭 No hay campañas disponibles para copiar</Text>
                  </View>
                );
              }

              logger.info(`🎨 [RENDER-CONDITION] Mostrando ${campaigns.length} campañas...`);
              return (
              <>
                <Text style={styles.campaignsCount}>
                  Mostrando {campaigns.length} campañas
                </Text>
                {campaigns.map((campaign) => {
                  const totals = campaignTotals[campaign.id];

                  return (
                    <TouchableOpacity
                      key={campaign.id}
                      style={[
                        styles.campaignCard,
                        copying && selectedCampaignId === campaign.id && styles.campaignCardDisabled,
                      ]}
                      onPress={() => handleCopyCampaign(campaign.id)}
                      disabled={copying}
                    >
                      <View style={styles.campaignHeader}>
                        <View style={styles.campaignHeaderLeft}>
                          <Text style={styles.campaignCode}>{campaign.code}</Text>
                          <Text style={styles.campaignName}>{campaign.name}</Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(campaign.status) + '20' },
                            { borderColor: getStatusColor(campaign.status) },
                          ]}
                        >
                          <Text
                            style={[styles.statusText, { color: getStatusColor(campaign.status) }]}
                          >
                            {getStatusLabel(campaign.status)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.campaignInfo}>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Inicio:</Text>
                          <Text style={styles.infoValue}>{formatDate(campaign.startDate)}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Fin:</Text>
                          <Text style={styles.infoValue}>{formatDate(campaign.endDate)}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Creada:</Text>
                          <Text style={styles.infoValue}>{formatDate(campaign.createdAt)}</Text>
                        </View>
                      </View>

                      {/* Totals Section */}
                      {totals && (
                        <View style={styles.totalsSection}>
                          <Text style={styles.totalsSectionTitle}>💰 Totales de la Campaña</Text>
                          <View style={styles.totalsGrid}>
                            <View style={styles.totalItem}>
                              <Text style={styles.totalLabel}>Compra:</Text>
                              <Text style={styles.totalValuePurchase}>
                                {formatCurrency(totals.totalPurchaseCents)}
                              </Text>
                            </View>
                            <View style={styles.totalItem}>
                              <Text style={styles.totalLabel}>Venta:</Text>
                              <Text style={styles.totalValueSale}>
                                {formatCurrency(totals.totalSaleCents)}
                              </Text>
                            </View>
                            <View style={styles.totalItem}>
                              <Text style={styles.totalLabel}>Margen:</Text>
                              <Text style={styles.totalValueMargin}>
                                {formatCurrency(totals.totalMarginCents)}
                              </Text>
                            </View>
                            <View style={styles.totalItem}>
                              <Text style={styles.totalLabel}>% Margen:</Text>
                              <Text style={styles.totalValueMargin}>
                                {totals.totalMarginPercentage.toFixed(2)}%
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}

                      {copying && selectedCampaignId === campaign.id && (
                        <View style={styles.copyingOverlay}>
                          <ActivityIndicator size="small" color="#6366F1" />
                          <Text style={styles.copyingText}>Copiando...</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
              );
            })()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  campaignCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  campaignCardDisabled: {
    opacity: 0.6,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  campaignHeaderLeft: {
    flex: 1,
  },
  campaignCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  campaignName: {
    fontSize: 14,
    color: '#64748B',
  },
  campaignsCount: {
    padding: 10,
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  campaignInfo: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
  },
  copyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  copyingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  totalsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  totalsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  totalItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  totalLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  totalValuePurchase: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  totalValueSale: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  totalValueMargin: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
});
