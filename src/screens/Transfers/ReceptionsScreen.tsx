import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';

import { TransferCard } from '@/components/Transfers/TransferCard';
import { TransferItemsList } from '@/components/Transfers/TransferItemsList';
import { transfersApi } from '@/services/api/transfers';
import {
  Transfer,
  TransferReception,
  TransferType,
  TransferStatus,
  ValidateItemsDto,
  CompleteReceptionDto,
} from '@/types/transfers';

interface ReceptionsScreenProps {
  navigation: any;
}

interface ItemValidation {
  transferItemId: string;
  quantityReceived: string;
  damageNotes: string;
}

export const ReceptionsScreen: React.FC<ReceptionsScreenProps> = ({ navigation }) => {
  const { user, currentSite, currentCompany, logout } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();
  const [pendingTransfers, setPendingTransfers] = useState<Transfer[]>([]);
  const [recentReceptions, setRecentReceptions] = useState<TransferReception[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);
  const [activeTab, setActiveTab] = useState<'pending' | 'recent'>('pending');

  // Reception workflow states
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [currentReception, setCurrentReception] = useState<TransferReception | null>(null);
  const [itemValidations, setItemValidations] = useState<ItemValidation[]>([]);
  const [receptionNotes, setReceptionNotes] = useState('');
  const [qualityCheckNotes, setQualityCheckNotes] = useState('');

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  // Auto-reload receptions when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 ReceptionsScreen focused - reloading data...');
      loadData();
    }, [effectiveSite?.id, effectiveCompany?.id])
  );

  useEffect(() => {
    if (effectiveSite?.id || effectiveCompany?.id) {
      loadData();
    }
  }, [effectiveSite?.id, effectiveCompany?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const currentSiteId = effectiveSite?.id;

      // Cargar recepciones pendientes usando el nuevo endpoint
      const pendingResponse = await transfersApi.getPendingReceptions({
        currentSiteId: currentSiteId,
        page: 1,
        limit: 100
      });

      // Extraer los transfers de las recepciones pendientes
      const pendingTransfersFromReceptions = pendingResponse.data
        .filter(reception => reception.transfer)
        .map(reception => reception.transfer!);

      setPendingTransfers(pendingTransfersFromReceptions);
      setRecentReceptions(pendingResponse.data || []);
    } catch (error: any) {
      console.error('Error loading receptions:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar las recepciones');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleReceiveTransfer = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setShowReceiveModal(true);
    setReceptionNotes('');
  };

  const handleInitiateReception = async () => {
    if (!selectedTransfer) return;

    try {
      const userId = user?.id;
      console.log('🔄 Initiating reception...');
      console.log('📋 Transfer ID:', selectedTransfer.id);
      console.log('👤 User ID:', userId);

      if (!userId) {
        Alert.alert('Error', 'No se pudo identificar el usuario. Por favor, inicia sesión nuevamente.');
        return;
      }

      const updatedTransfer = await transfersApi.receiveTransfer(selectedTransfer.id, userId);

      Alert.alert(
        'Recepción Iniciada',
        `Recepción creada exitosamente. Ahora puedes validar los items recibidos.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowReceiveModal(false);
              setSelectedTransfer(updatedTransfer);
              setCurrentReception(updatedTransfer.reception || null);

              // Initialize item validations with shipped quantities
              const validations = updatedTransfer.items?.map(item => ({
                transferItemId: item.id,
                quantityReceived: item.quantityShipped?.toString() || '0',
                damageNotes: '',
              })) || [];
              setItemValidations(validations);

              setShowValidateModal(true);
              loadData();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error initiating reception:', error);
      Alert.alert('Error', error.message || 'No se pudo iniciar la recepción');
    }
  };

  const handleReceptionDetail = (reception: TransferReception) => {
    Alert.alert('Detalle de Recepción', `Recepción: ${reception.receptionNumber}`);
  };

  const updateItemValidation = (index: number, field: keyof ItemValidation, value: string) => {
    const newValidations = [...itemValidations];
    newValidations[index][field] = value;
    setItemValidations(newValidations);
  };

  const handleValidateItems = async () => {
    if (!selectedTransfer || !currentReception) return;

    try {
      const validateDto: ValidateItemsDto = {
        receptionId: currentReception.id,
        items: itemValidations.map(validation => ({
          transferItemId: validation.transferItemId,
          quantityReceived: parseFloat(validation.quantityReceived) || 0,
          damageNotes: validation.damageNotes || undefined,
        })),
      };

      await transfersApi.validateItems(selectedTransfer.id, validateDto);

      Alert.alert(
        'Items Validados',
        'Las cantidades recibidas han sido registradas. Ahora puedes completar la recepción.',
        [
          {
            text: 'Completar Recepción',
            onPress: () => handleCompleteReception(),
          },
          {
            text: 'Revisar',
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      console.error('Error validating items:', error);
      Alert.alert('Error', error.message || 'No se pudieron validar los items');
    }
  };

  const handleCompleteReception = async () => {
    if (!selectedTransfer || !currentReception) return;

    Alert.alert(
      'Completar Recepción',
      '¿Estás seguro de completar esta recepción? El stock se actualizará en el almacén destino.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          onPress: async () => {
            try {
              const completeDto: CompleteReceptionDto = {
                receptionId: currentReception.id,
              };

              await transfersApi.completeReception(selectedTransfer.id, completeDto);

              Alert.alert(
                'Recepción Completada',
                'La recepción ha sido completada exitosamente. El stock ha sido actualizado.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      setShowValidateModal(false);
                      setSelectedTransfer(null);
                      setCurrentReception(null);
                      setItemValidations([]);
                      setQualityCheckNotes('');
                      loadData();
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error completing reception:', error);
              Alert.alert('Error', error.message || 'No se pudo completar la recepción');
            }
          },
        },
      ]
    );
  };

  const renderPendingTransfers = () => {
    if (pendingTransfers.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📥</Text>
          <Text style={styles.emptyText}>No hay traslados pendientes</Text>
          <Text style={styles.emptySubtext}>Los traslados en tránsito aparecerán aquí</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {pendingTransfers.map((transfer) => (
          <TransferCard key={transfer.id} transfer={transfer} onPress={handleReceiveTransfer} />
        ))}
      </ScrollView>
    );
  };

  const renderRecentReceptions = () => {
    if (recentReceptions.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No hay recepciones recientes</Text>
          <Text style={styles.emptySubtext}>Las recepciones completadas aparecerán aquí</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {recentReceptions.map((reception) => {
          // Mostrar información del transfer asociado
          const transfer = reception.transfer;
          const displayNumber = reception.receptionNumber || transfer?.transferNumber || 'N/A';
          const displayDate = reception.receivedAt || transfer?.shippedAt || new Date().toISOString();

          return (
            <TouchableOpacity
              key={reception.id}
              style={styles.receptionCard}
              onPress={() => handleReceptionDetail(reception)}
            >
              <View style={styles.receptionHeader}>
                <View style={styles.receptionInfo}>
                  <Text style={styles.receptionNumber}>{displayNumber}</Text>
                  {transfer && (
                    <Text style={styles.transferInfo}>
                      {transfer.originSite?.name} → {transfer.destinationSite?.name}
                    </Text>
                  )}
                  <Text style={styles.receptionDate}>
                    {new Date(displayDate).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: reception.status === 'PENDING' ? '#FEF3C7' : '#D1FAE5',
                      borderColor: reception.status === 'PENDING' ? '#F59E0B' : '#10B981',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: reception.status === 'PENDING' ? '#F59E0B' : '#10B981' },
                    ]}
                  >
                    {reception.status === 'PENDING' ? 'Pendiente' : 'Completo'}
                  </Text>
                </View>
              </View>

              <View style={styles.receptionStats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Esperados</Text>
                  <Text style={styles.statValue}>{reception.totalItemsExpected}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Recibidos</Text>
                  <Text style={styles.statValue}>{reception.totalItemsReceived}</Text>
                </View>
                {reception.hasDifferences && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Diferencias</Text>
                      <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                        {reception.totalItemsExpected - reception.totalItemsReceived}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {reception.notes && (
                <View style={styles.receptionNotes}>
                  <Text style={styles.notesLabel}>Notas:</Text>
                  <Text style={styles.notesText}>{reception.notes}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando recepciones...</Text>
        </View>
      );
    }

    return activeTab === 'pending' ? renderPendingTransfers() : renderRecentReceptions();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Recepciones</Text>
          <Text style={styles.headerSubtitle}>Validación de traslados externos</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pendientes ({pendingTransfers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recent' && styles.tabActive]}
          onPress={() => setActiveTab('recent')}
        >
          <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>
            Recientes ({recentReceptions.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {renderContent()}

      {/* Receive Transfer Modal */}
      <Modal visible={showReceiveModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Iniciar Recepción</Text>
            <Text style={styles.modalSubtitle}>
              Traslado: {selectedTransfer?.transferNumber}
            </Text>

            <View style={styles.transferInfo}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Origen:</Text>
                <Text style={styles.infoValue}>{selectedTransfer?.originWarehouse?.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Destino:</Text>
                <Text style={styles.infoValue}>{selectedTransfer?.destinationWarehouse?.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Items:</Text>
                <Text style={styles.infoValue}>{selectedTransfer?.items?.length || 0} productos</Text>
              </View>
            </View>

            <Text style={styles.label}>Notas de Recepción (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ej: Recibido en buen estado..."
              value={receptionNotes}
              onChangeText={setReceptionNotes}
              multiline
              numberOfLines={3}
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowReceiveModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleInitiateReception}
              >
                <Text style={styles.modalConfirmButtonText}>Iniciar Recepción</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Validate Items Modal */}
      <Modal visible={showValidateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.validateModalContainer} edges={['top']}>
          <View style={styles.validateHeader}>
            <Text style={styles.validateTitle}>Validar Items Recibidos</Text>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Cancelar Validación',
                  '¿Estás seguro de cancelar? Los cambios no se guardarán.',
                  [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Sí, Cancelar',
                      onPress: () => {
                        setShowValidateModal(false);
                        setItemValidations([]);
                      },
                    },
                  ]
                );
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.validateContent} contentContainerStyle={styles.validateScrollContent}>
            <View style={styles.validateInfo}>
              <Text style={styles.validateInfoText}>
                📦 Traslado: {selectedTransfer?.transferNumber}
              </Text>
              <Text style={styles.validateInfoText}>
                📥 Recepción: {currentReception?.receptionNumber}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Productos a Validar</Text>
            <Text style={styles.sectionSubtitle}>
              Ingresa la cantidad real recibida para cada producto
            </Text>

            {selectedTransfer?.items?.map((item, index) => (
              <View key={item.id} style={styles.validateItemCard}>
                <View style={styles.validateItemHeader}>
                  <Text style={styles.validateItemTitle}>{item.product?.title}</Text>
                  <Text style={styles.validateItemSku}>SKU: {item.product?.sku}</Text>
                </View>

                <View style={styles.quantityInfo}>
                  <View style={styles.quantityBox}>
                    <Text style={styles.quantityLabel}>Solicitado</Text>
                    <Text style={styles.quantityValue}>{item.quantityRequested}</Text>
                  </View>
                  <View style={styles.quantityBox}>
                    <Text style={styles.quantityLabel}>Despachado</Text>
                    <Text style={styles.quantityValue}>{item.quantityShipped || 0}</Text>
                  </View>
                </View>

                <Text style={styles.label}>Cantidad Recibida *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={itemValidations[index]?.quantityReceived || ''}
                  onChangeText={(value) => updateItemValidation(index, 'quantityReceived', value)}
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.label}>Notas de Daños (Opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ej: 2 unidades con empaque dañado..."
                  value={itemValidations[index]?.damageNotes || ''}
                  onChangeText={(value) => updateItemValidation(index, 'damageNotes', value)}
                  multiline
                  numberOfLines={2}
                  placeholderTextColor="#94A3B8"
                />

                {/* Show difference indicator */}
                {itemValidations[index]?.quantityReceived &&
                 parseFloat(itemValidations[index].quantityReceived) !== (item.quantityShipped || 0) && (
                  <View style={styles.differenceBox}>
                    <Text style={styles.differenceText}>
                      ⚠️ Diferencia: {
                        parseFloat(itemValidations[index].quantityReceived) - (item.quantityShipped || 0)
                      }
                    </Text>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.validateButton]}
                onPress={handleValidateItems}
              >
                <Text style={styles.actionButtonText}>✓ Validar Items</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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
  tabActive: {
    borderBottomColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#6366F1',
    fontWeight: '700',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  receptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  receptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  receptionInfo: {
    flex: 1,
  },
  receptionNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  receptionDate: {
    fontSize: 12,
    color: '#64748B',
  },
  transferInfo: {
    fontSize: 13,
    color: '#475569',
    marginVertical: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  receptionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  receptionNotes: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  transferInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F1F5F9',
  },
  modalCancelButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: '#8B5CF6',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Validate Modal Styles
  validateModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  validateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  validateTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 18,
    color: '#64748B',
    fontWeight: 'bold',
  },
  validateContent: {
    flex: 1,
  },
  validateScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  validateInfo: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  validateInfoText: {
    fontSize: 13,
    color: '#4338CA',
    fontWeight: '500',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  validateItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  validateItemHeader: {
    marginBottom: 12,
  },
  validateItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  validateItemSku: {
    fontSize: 12,
    color: '#64748B',
  },
  quantityInfo: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  quantityBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  differenceBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  differenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
  actionButtonsContainer: {
    marginTop: 20,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  validateButton: {
    backgroundColor: '#8B5CF6',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ReceptionsScreen;
