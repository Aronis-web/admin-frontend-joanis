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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
  },
  searchInput: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.neutral[800],
  },
  filtersContainer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  filterButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
    marginRight: spacing[2],
  },
  filterButtonActive: {
    backgroundColor: colors.info[400],
    borderColor: colors.info[400],
  },
  filterButtonText: {
    fontSize: 12,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: colors.neutral[0],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.neutral[500],
  },
  listContent: {
    padding: spacing[5],
  },
  operationItem: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  operationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  operationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
    marginRight: spacing[2],
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  operationDate: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  operationAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  operationEmitter: {
    fontSize: 14,
    color: colors.neutral[700],
    marginBottom: spacing[1],
  },
  operationDescription: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  operationReference: {
    fontSize: 13,
    color: colors.neutral[400],
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[10],
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[500],
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
    paddingBottom: spacing[5],
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  operationBadge: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  operationBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[0],
    textAlign: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1.5],
  },
  detailModalAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.success[500],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    maxHeight: '70%',
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  sectionContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  infoRow: {
    marginBottom: spacing[3],
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  detailModalActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[2],
  },
  button: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionButton: {
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  closeActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[500],
  },
});

export default BalanceOperationsModal;
