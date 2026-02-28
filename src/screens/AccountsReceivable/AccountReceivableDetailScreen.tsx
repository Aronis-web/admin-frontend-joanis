import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import { accountsReceivableService } from '@/services/api/accounts-receivable';
import { AccountReceivable } from '@/types/accounts-receivable';
import {
  ACCOUNT_RECEIVABLE_STATUS_LABELS,
  ACCOUNT_RECEIVABLE_STATUS_COLORS,
  ACCOUNT_RECEIVABLE_STATUS_ICONS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ICONS,
  CURRENCY_SYMBOLS,
} from '@/constants/accountsReceivable';

interface AccountReceivableDetailScreenProps {
  navigation: any;
  route: {
    params: {
      accountReceivableId: string;
    };
  };
}

export const AccountReceivableDetailScreen: React.FC<AccountReceivableDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { accountReceivableId } = route.params;
  const { hasPermission } = usePermissions();

  // Verificar permisos
  const canReadDetails = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.READ_DETAILS);
  const canViewCollections = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.COLLECTIONS.READ);
  const canViewSchedule = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.SCHEDULE.READ);
  const canViewHistory = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.HISTORY.READ);
  const canViewDocuments = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.DOCUMENTS.READ);

  const [accountReceivable, setAccountReceivable] = useState<AccountReceivable | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadAccountReceivable();
  }, [accountReceivableId]);

  const loadAccountReceivable = async () => {
    try {
      setLoading(true);
      const data = await accountsReceivableService.getAccountReceivable(accountReceivableId, true);
      setAccountReceivable(data);
    } catch (error: any) {
      console.error('❌ Error loading account receivable:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudo cargar la cuenta por cobrar';
      Alert.alert('Error', errorMessage);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAccountReceivable();
    setRefreshing(false);
  };

  const formatCurrency = (cents: number, currency: string = 'PEN') => {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol} ${(cents / 100).toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Cargando detalles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accountReceivable) {
    return null;
  }

  const statusColor = ACCOUNT_RECEIVABLE_STATUS_COLORS[accountReceivable.status];
  const statusIcon = ACCOUNT_RECEIVABLE_STATUS_ICONS[accountReceivable.status];
  const statusLabel = ACCOUNT_RECEIVABLE_STATUS_LABELS[accountReceivable.status];
  const isOverdue = accountReceivable.overdueDays > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backIcon, isTablet && styles.backIconTablet]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
            {accountReceivable.code}
          </Text>
          <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
            Cuenta por Cobrar
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { borderColor: statusColor }]}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusIcon}>{statusIcon}</Text>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          {isOverdue && (
            <View style={styles.overdueWarning}>
              <Text style={styles.overdueIcon}>⚠️</Text>
              <Text style={styles.overdueText}>
                Vencido hace {accountReceivable.overdueDays} días
              </Text>
            </View>
          )}
        </View>

        {/* Debtor Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deudor</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>👤</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Nombre</Text>
                <Text style={styles.infoValue}>{accountReceivable.debtorName}</Text>
              </View>
            </View>
            {accountReceivable.debtorTaxId && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🆔</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>RUC/DNI</Text>
                  <Text style={styles.infoValue}>{accountReceivable.debtorTaxId}</Text>
                </View>
              </View>
            )}
            {accountReceivable.debtorEmail && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📧</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{accountReceivable.debtorEmail}</Text>
                </View>
              </View>
            )}
            {accountReceivable.debtorPhone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📱</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Teléfono</Text>
                  <Text style={styles.infoValue}>{accountReceivable.debtorPhone}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Amounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Montos</Text>
          <View style={styles.card}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Monto Total</Text>
              <Text style={styles.amountTotal}>
                {formatCurrency(accountReceivable.totalAmountCents, accountReceivable.currency)}
              </Text>
            </View>
            {accountReceivable.collectedAmountCents > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Cobrado</Text>
                <Text style={styles.amountCollected}>
                  {formatCurrency(accountReceivable.collectedAmountCents, accountReceivable.currency)}
                </Text>
              </View>
            )}
            {accountReceivable.balanceCents > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Saldo Pendiente</Text>
                <Text style={[styles.amountBalance, isOverdue && styles.amountOverdue]}>
                  {formatCurrency(accountReceivable.balanceCents, accountReceivable.currency)}
                </Text>
              </View>
            )}
            {accountReceivable.collectionPercentage > 0 && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${accountReceivable.collectionPercentage}%`, backgroundColor: statusColor },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {accountReceivable.collectionPercentage.toFixed(0)}% cobrado
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fechas</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📅</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Emisión</Text>
                <Text style={styles.infoValue}>{formatDate(accountReceivable.issueDate)}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>⏰</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Vencimiento</Text>
                <Text style={[styles.infoValue, isOverdue && styles.infoValueOverdue]}>
                  {formatDate(accountReceivable.dueDate)}
                </Text>
              </View>
            </View>
            {accountReceivable.creditDays > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📆</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Días de Crédito</Text>
                  <Text style={styles.infoValue}>{accountReceivable.creditDays} días</Text>
                </View>
              </View>
            )}
            {accountReceivable.collectionDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>✅</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Fecha de Cobro</Text>
                  <Text style={styles.infoValue}>{formatDate(accountReceivable.collectionDate)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Document Info */}
        {(accountReceivable.documentType || accountReceivable.documentNumber) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documento</Text>
            <View style={styles.card}>
              {accountReceivable.documentType && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📄</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Tipo</Text>
                    <Text style={styles.infoValue}>{accountReceivable.documentType}</Text>
                  </View>
                </View>
              )}
              {accountReceivable.documentSeries && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>🔢</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Serie</Text>
                    <Text style={styles.infoValue}>{accountReceivable.documentSeries}</Text>
                  </View>
                </View>
              )}
              {accountReceivable.documentNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>🔢</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Número</Text>
                    <Text style={styles.infoValue}>{accountReceivable.documentNumber}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Source Info */}
        {accountReceivable.sourceType && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Origen</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>{SOURCE_TYPE_ICONS[accountReceivable.sourceType]}</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Tipo</Text>
                  <Text style={styles.infoValue}>
                    {SOURCE_TYPE_LABELS[accountReceivable.sourceType]}
                  </Text>
                </View>
              </View>
              {accountReceivable.sourceCode && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>🔗</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Código de Origen</Text>
                    <Text style={styles.infoValue}>{accountReceivable.sourceCode}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Description & Notes */}
        {(accountReceivable.description || accountReceivable.notes) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalles Adicionales</Text>
            <View style={styles.card}>
              {accountReceivable.description && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📝</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Descripción</Text>
                    <Text style={styles.infoValue}>{accountReceivable.description}</Text>
                  </View>
                </View>
              )}
              {accountReceivable.notes && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>💬</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Notas</Text>
                    <Text style={styles.infoValue}>{accountReceivable.notes}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Collection History */}
        {accountReceivable.collections && accountReceivable.collections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial de Cobros</Text>
            <View style={styles.card}>
              {accountReceivable.collections.map((collection, index) => (
                <View
                  key={collection.id}
                  style={[styles.collectionItem, index > 0 && styles.collectionItemBorder]}
                >
                  <View style={styles.collectionHeader}>
                    <Text style={styles.collectionAmount}>
                      {formatCurrency(collection.amountCents, accountReceivable.currency)}
                    </Text>
                    <Text style={styles.collectionDate}>{formatDate(collection.collectionDate)}</Text>
                  </View>
                  <View style={styles.collectionDetails}>
                    <Text style={styles.collectionMethod}>
                      Método: {collection.paymentMethodName || 'No especificado'}
                    </Text>
                    {collection.transactionReference && (
                      <Text style={styles.collectionReference}>Ref: {collection.transactionReference}</Text>
                    )}
                  </View>
                  {collection.notes && <Text style={styles.collectionNotes}>{collection.notes}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Collection Schedule */}
        {accountReceivable.schedule && accountReceivable.schedule.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cronograma de Cobros</Text>
            <View style={styles.card}>
              {accountReceivable.schedule.map((schedule, index) => (
                <View
                  key={schedule.id}
                  style={[styles.scheduleItem, index > 0 && styles.scheduleItemBorder]}
                >
                  <View style={styles.scheduleHeader}>
                    <Text style={styles.scheduleNumber}>Cuota {schedule.installmentNumber}</Text>
                    <View
                      style={[
                        styles.scheduleStatusBadge,
                        {
                          backgroundColor:
                            schedule.status === 'PAID'
                              ? '#10B981'
                              : schedule.status === 'OVERDUE'
                              ? '#EF4444'
                              : '#F59E0B',
                        },
                      ]}
                    >
                      <Text style={styles.scheduleStatusText}>
                        {schedule.status === 'PAID'
                          ? 'Cobrado'
                          : schedule.status === 'OVERDUE'
                          ? 'Vencido'
                          : 'Pendiente'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.scheduleDetails}>
                    <Text style={styles.scheduleAmount}>
                      {formatCurrency(schedule.amountCents, accountReceivable.currency)}
                    </Text>
                    <Text style={styles.scheduleDueDate}>
                      Vence: {formatDate(schedule.dueDate)}
                    </Text>
                  </View>
                  {schedule.paidDate && (
                    <Text style={styles.schedulePaidDate}>
                      Cobrado: {formatDate(schedule.paidDate)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Status History */}
        {accountReceivable.statusHistory && accountReceivable.statusHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial de Estados</Text>
            <View style={styles.card}>
              {accountReceivable.statusHistory.map((history, index) => (
                <View
                  key={history.id}
                  style={[styles.historyItem, index > 0 && styles.historyItemBorder]}
                >
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyStatus}>
                      {history.previousStatus
                        ? `${ACCOUNT_RECEIVABLE_STATUS_LABELS[history.previousStatus]} → `
                        : ''}
                      {ACCOUNT_RECEIVABLE_STATUS_LABELS[history.newStatus]}
                    </Text>
                    <Text style={styles.historyDate}>{formatDateTime(history.changedAt)}</Text>
                  </View>
                  {history.reason && <Text style={styles.historyReason}>{history.reason}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Sistema</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🆔</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>ID</Text>
                <Text style={styles.infoValueSmall}>{accountReceivable.id}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📅</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Creado</Text>
                <Text style={styles.infoValue}>{formatDateTime(accountReceivable.createdAt)}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🔄</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Actualizado</Text>
                <Text style={styles.infoValue}>{formatDateTime(accountReceivable.updatedAt)}</Text>
              </View>
            </View>
          </View>
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#475569',
  },
  backIconTablet: {
    fontSize: 28,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerTitleTablet: {
    fontSize: 22,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerSubtitleTablet: {
    fontSize: 15,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  contentContainerTablet: {
    paddingHorizontal: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  statusIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  overdueWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    gap: 8,
  },
  overdueIcon: {
    fontSize: 16,
  },
  overdueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  infoValueSmall: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '400',
  },
  infoValueOverdue: {
    color: '#EF4444',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  amountTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  amountCollected: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  amountBalance: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  amountOverdue: {
    color: '#EF4444',
  },
  progressSection: {
    marginTop: 8,
    gap: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'right',
  },
  collectionItem: {
    paddingVertical: 12,
  },
  collectionItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  collectionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  collectionDate: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  collectionDetails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  collectionMethod: {
    fontSize: 13,
    color: '#475569',
  },
  collectionReference: {
    fontSize: 13,
    color: '#475569',
  },
  collectionNotes: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  scheduleItem: {
    paddingVertical: 12,
  },
  scheduleItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  scheduleStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scheduleStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scheduleDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  scheduleDueDate: {
    fontSize: 13,
    color: '#64748B',
  },
  schedulePaidDate: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
  },
  historyItem: {
    paddingVertical: 12,
  },
  historyItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 12,
  },
  historyStatus: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  historyDate: {
    fontSize: 12,
    color: '#64748B',
  },
  historyReason: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
  },
});
