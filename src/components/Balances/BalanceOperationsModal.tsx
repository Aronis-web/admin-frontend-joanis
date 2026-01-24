import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { balancesApi } from '@/services/api';
import {
  Balance,
  BalanceOperation,
  OperationType,
  getOperationTypeLabel,
  getOperationTypeColor,
  formatCentsToCurrency,
} from '@/types/balances';

interface BalanceOperationsModalProps {
  visible: boolean;
  balance: Balance | null;
  onClose: () => void;
  preselectedOperationType?: OperationType;
}

export const BalanceOperationsModal: React.FC<BalanceOperationsModalProps> = ({
  visible,
  balance,
  onClose,
  preselectedOperationType,
}) => {
  const [operations, setOperations] = useState<BalanceOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<OperationType | ''>(preselectedOperationType || '');
  const [selectedOperation, setSelectedOperation] = useState<BalanceOperation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  console.log('🟢 BalanceOperationsModal render - visible:', visible, 'balance:', balance?.code);

  useEffect(() => {
    if (visible && balance?.id) {
      loadOperations();
    }
  }, [visible, balance?.id]);

  // Update filter when preselectedOperationType changes
  useEffect(() => {
    if (preselectedOperationType) {
      setFilterType(preselectedOperationType);
    }
  }, [preselectedOperationType]);

  const loadOperations = async () => {
    if (!balance?.id) {
      return;
    }

    try {
      setLoading(true);
      const response = await balancesApi.getBalanceOperations(balance.id, {
        page: 1,
        limit: 100,
        sortBy: 'operationDate',
        sortOrder: 'DESC',
      });
      setOperations(response.data || []);
    } catch (error: any) {
      console.error('Error loading operations:', error);
      Alert.alert('Error', 'No se pudieron cargar las operaciones');
      setOperations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOperations();
  };

  const openDetailModal = (operation: BalanceOperation) => {
    setSelectedOperation(operation);
    setShowDetailModal(true);
  };

  const filteredOperations = operations.filter((operation) => {
    const matchesSearch =
      operation.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      operation.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (operation.emitterCompany?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (operation.emitterSite?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = !filterType || operation.operationType === filterType;

    return matchesSearch && matchesType;
  });

  const renderOperationItem = ({ item }: { item: BalanceOperation }) => (
    <TouchableOpacity style={styles.operationItem} onPress={() => openDetailModal(item)}>
      <View style={styles.operationHeader}>
        <View style={styles.operationInfo}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: getOperationTypeColor(item.operationType) },
            ]}
          >
            <Text style={styles.typeBadgeText}>{getOperationTypeLabel(item.operationType)}</Text>
          </View>
          <Text style={styles.operationDate}>
            {new Date(item.operationDate).toLocaleDateString('es-ES')}
          </Text>
        </View>
        <Text style={styles.operationAmount}>{formatCentsToCurrency(item.amountCents)}</Text>
      </View>

      {item.emitterCompany && (
        <Text style={styles.operationEmitter}>Emisor: {item.emitterCompany.name}</Text>
      )}
      {item.emitterSite && (
        <Text style={styles.operationEmitter}>Emisor: {item.emitterSite.name}</Text>
      )}

      {item.description && <Text style={styles.operationDescription}>{item.description}</Text>}

      {item.reference && <Text style={styles.operationReference}>Ref: {item.reference}</Text>}
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedOperation) {
      return null;
    }

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const renderInfoRow = (label: string, value: string | undefined) => {
      if (!value) {
        return null;
      }

      return (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      );
    };

    const renderSection = (title: string, children: React.ReactNode) => (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>{children}</View>
      </View>
    );

    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContent}>
            {/* Header */}
            <View style={styles.detailModalHeader}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.operationBadge,
                    { backgroundColor: getOperationTypeColor(selectedOperation.operationType) },
                  ]}
                >
                  <Text style={styles.operationBadgeText}>
                    {getOperationTypeLabel(selectedOperation.operationType)}
                  </Text>
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.detailModalTitle}>Detalle de Operación</Text>
                  <Text style={styles.detailModalAmount}>
                    {formatCentsToCurrency(selectedOperation.amountCents)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Información General */}
              {renderSection(
                'Información General',
                <>
                  {renderInfoRow(
                    'Tipo de Operación',
                    getOperationTypeLabel(selectedOperation.operationType)
                  )}
                  {renderInfoRow('Monto', formatCentsToCurrency(selectedOperation.amountCents))}
                  {renderInfoRow('Moneda', selectedOperation.currency)}
                  {renderInfoRow('Fecha de Operación', formatDate(selectedOperation.operationDate))}
                </>
              )}

              {/* Emisor */}
              {(selectedOperation.emitterCompany || selectedOperation.emitterSite) &&
                renderSection(
                  'Emisor',
                  <>
                    {renderInfoRow('Empresa Emisora', selectedOperation.emitterCompany?.name)}
                    {renderInfoRow('Sede Emisora', selectedOperation.emitterSite?.name)}
                  </>
                )}

              {/* Detalles Adicionales */}
              {(selectedOperation.description ||
                selectedOperation.reference ||
                selectedOperation.notes) &&
                renderSection(
                  'Detalles Adicionales',
                  <>
                    {renderInfoRow('Descripción', selectedOperation.description)}
                    {renderInfoRow('Referencia', selectedOperation.reference)}
                    {renderInfoRow('Notas', selectedOperation.notes)}
                  </>
                )}

              {/* Información del Sistema */}
              {renderSection(
                'Información del Sistema',
                <>
                  {renderInfoRow('ID', selectedOperation.id)}
                  {renderInfoRow('Fecha de Creación', formatDate(selectedOperation.createdAt))}
                  {renderInfoRow('Última Actualización', formatDate(selectedOperation.updatedAt))}
                </>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.detailModalActions}>
              <TouchableOpacity
                style={[styles.button, styles.closeActionButton]}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={styles.closeActionButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (!balance) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Operaciones</Text>
            <Text style={styles.headerSubtitle}>{balance.code}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search and Filters */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por descripción, referencia o emisor..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterButton, !filterType && styles.filterButtonActive]}
              onPress={() => setFilterType('')}
            >
              <Text style={[styles.filterButtonText, !filterType && styles.filterButtonTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.DISTRIBUTED && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.DISTRIBUTED)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.DISTRIBUTED && styles.filterButtonTextActive,
                ]}
              >
                Repartido
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.SOLD && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.SOLD)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.SOLD && styles.filterButtonTextActive,
                ]}
              >
                Vendido
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.TO_PAY && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.TO_PAY)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.TO_PAY && styles.filterButtonTextActive,
                ]}
              >
                Por Pagar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.PAID && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.PAID)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.PAID && styles.filterButtonTextActive,
                ]}
              >
                Pagado
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterType === OperationType.RETURNED && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(OperationType.RETURNED)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === OperationType.RETURNED && styles.filterButtonTextActive,
                ]}
              >
                Devuelto
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Operations List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Cargando operaciones...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredOperations}
            renderItem={renderOperationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No hay operaciones registradas</Text>
              </View>
            }
          />
        )}

        {renderDetailModal()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    padding: 20,
  },
  operationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  operationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  operationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  operationDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  operationAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  operationEmitter: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  operationDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  operationReference: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  // Detail Modal Styles
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  operationBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  operationBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  detailModalAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
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
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '70%',
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
  sectionContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  detailModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
});

export default BalanceOperationsModal;
