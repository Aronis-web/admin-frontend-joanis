import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';

import { TransferStatusBadge } from '@/components/Transfers/TransferStatusBadge';
import { TransferItemsList } from '@/components/Transfers/TransferItemsList';
import { transfersApi } from '@/services/api/transfers';
import {
  Transfer,
  TransferStatus,
  TransferStatusHistory,
  getTransferTypeLabel,
} from '@/types/transfers';

export const TransferDetailScreen = ({ navigation, route }: any) => {
  const { logout } = useAuthStore();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [history, setHistory] = useState<TransferStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);

  const transferId = route?.params?.transferId || '';

  useEffect(() => {
    loadTransferDetail();
  }, [transferId]);

  const loadTransferDetail = async () => {
    try {
      setLoading(true);
      const [transferData, historyData] = await Promise.all([
        transfersApi.getTransferById(transferId),
        transfersApi.getTransferHistory(transferId),
      ]);

      // Debug: Log transfer detail data
      console.log('🔍 TransferDetail - Transfer data:', {
        id: transferData.id,
        transferNumber: transferData.transferNumber,
        hasOriginArea: !!transferData.originArea,
        hasDestinationArea: !!transferData.destinationArea,
        originAreaId: transferData.originAreaId,
        destinationAreaId: transferData.destinationAreaId,
        originArea: transferData.originArea,
        destinationArea: transferData.destinationArea,
      });

      setTransfer(transferData);
      setHistory(historyData || []);
    } catch (error: any) {
      console.error('Error loading transfer detail:', error);
      Alert.alert('Error', error.message || 'No se pudo cargar el detalle del traslado');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: TransferStatus): string => {
    const icons: Record<TransferStatus, string> = {
      [TransferStatus.DRAFT]: '📝',
      [TransferStatus.APPROVED]: '✅',
      [TransferStatus.IN_TRANSIT]: '🚚',
      [TransferStatus.RECEIVED]: '📥',
      [TransferStatus.COMPLETED]: '✓',
      [TransferStatus.CANCELLED]: '✕',
    };
    return icons[status] || '•';
  };

  const renderTimeline = () => {
    if (history.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Historial de Estados</Text>
        <View style={styles.timeline}>
          {history.map((item, index) => (
            <View key={item.id} style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, index === 0 && styles.timelineIconActive]}>
                  <Text style={styles.timelineIconText}>{getStatusIcon(item.toStatus)}</Text>
                </View>
                {index < history.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.timelineHeader}>
                  <TransferStatusBadge status={item.toStatus} size="small" />
                  <Text style={styles.timelineDate}>{formatDate(item.createdAt)}</Text>
                </View>
                {item.changedByUser && (
                  <Text style={styles.timelineUser}>
                    Por: {item.changedByUser.name || item.changedByUser.email}
                  </Text>
                )}
                {item.notes && <Text style={styles.timelineNotes}>{item.notes}</Text>}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando detalle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!transfer) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>Traslado no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{transfer.transferNumber}</Text>
          <Text style={styles.headerSubtitle}>{getTransferTypeLabel(transfer.transferType)}</Text>
        </View>
        <TransferStatusBadge status={transfer.status} size="medium" />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Información General</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tipo:</Text>
              <Text style={styles.infoValue}>{getTransferTypeLabel(transfer.transferType)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estado:</Text>
              <TransferStatusBadge status={transfer.status} size="small" />
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Solicitado:</Text>
              <Text style={styles.infoValue}>{formatDate(transfer.requestedAt)}</Text>
            </View>
            {transfer.requestedByUser && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Solicitado por:</Text>
                <Text style={styles.infoValue}>
                  {transfer.requestedByUser.name || transfer.requestedByUser.email}
                </Text>
              </View>
            )}
            {transfer.expectedArrivalDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Llegada estimada:</Text>
                <Text style={styles.infoValue}>{transfer.expectedArrivalDate}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Origin & Destination */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Origen y Destino</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationSection}>
              <Text style={styles.locationTitle}>📤 Origen</Text>
              <Text style={styles.locationWarehouse}>{transfer.originWarehouse?.name}</Text>
              <Text style={styles.locationSite}>{transfer.originSite?.name}</Text>
              {transfer.originArea && (
                <Text style={styles.locationArea}>Área: {transfer.originArea.name}</Text>
              )}
            </View>
            <View style={styles.locationDivider} />
            <View style={styles.locationSection}>
              <Text style={styles.locationTitle}>📥 Destino</Text>
              <Text style={styles.locationWarehouse}>{transfer.destinationWarehouse?.name}</Text>
              <Text style={styles.locationSite}>{transfer.destinationSite?.name}</Text>
              {transfer.destinationArea && (
                <Text style={styles.locationArea}>Área: {transfer.destinationArea.name}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Productos ({transfer.items?.length || 0})</Text>
          {transfer.items && transfer.items.length > 0 && (
            <TransferItemsList items={transfer.items} transfer={transfer} />
          )}
        </View>

        {/* Notes */}
        {transfer.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Notas</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{transfer.notes}</Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        {renderTimeline()}

        {/* Reception Info */}
        {transfer.reception && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📥 Información de Recepción</Text>
            <View style={styles.receptionCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Número:</Text>
                <Text style={styles.infoValue}>{transfer.reception.receptionNumber}</Text>
              </View>
              {transfer.reception.receivedAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Recibido:</Text>
                  <Text style={styles.infoValue}>{formatDate(transfer.reception.receivedAt)}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado:</Text>
                <Text style={styles.infoValue}>{transfer.reception.status}</Text>
              </View>
              {transfer.reception.hasDifferences && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>⚠️ Esta recepción tiene diferencias</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    color: '#334155',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationSection: {
    marginBottom: 16,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  locationWarehouse: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  locationSite: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  locationArea: {
    fontSize: 12,
    color: '#94A3B8',
  },
  locationDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  notesCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  notesText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  timeline: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  timelineIconActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  timelineIconText: {
    fontSize: 18,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineDate: {
    fontSize: 12,
    color: '#64748B',
  },
  timelineUser: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  timelineNotes: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  receptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
});

export default TransferDetailScreen;
