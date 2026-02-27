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
import { accountsPayableService } from '@/services/api/accounts-payable';
import { AccountPayable } from '@/types/accounts-payable';
import {
  ACCOUNT_PAYABLE_STATUS_LABELS,
  ACCOUNT_PAYABLE_STATUS_COLORS,
  ACCOUNT_PAYABLE_STATUS_ICONS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ICONS,
  CURRENCY_SYMBOLS,
} from '@/constants/accountsPayable';

interface AccountPayableDetailScreenProps {
  navigation: any;
  route: {
    params: {
      accountPayableId: string;
    };
  };
}

export const AccountPayableDetailScreen: React.FC<AccountPayableDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { accountPayableId } = route.params;
  const { hasPermission } = usePermissions();

  // Verificar permisos
  const canReadDetails = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.READ_DETAILS);
  const canViewPayments = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.READ);
  const canViewSchedule = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.READ);
  const canViewHistory = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.HISTORY.READ);
  const canViewDocuments = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.READ);

  const [accountPayable, setAccountPayable] = useState<AccountPayable | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadAccountPayable();
  }, [accountPayableId]);

  const loadAccountPayable = async () => {
    try {
      setLoading(true);
      const data = await accountsPayableService.getAccountPayable(accountPayableId, true);
      setAccountPayable(data);
    } catch (error: any) {
      console.error('❌ Error loading account payable:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudo cargar la cuenta por pagar';
      Alert.alert('Error', errorMessage);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAccountPayable();
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

  if (!accountPayable) {
    return null;
  }

  const statusColor = ACCOUNT_PAYABLE_STATUS_COLORS[accountPayable.status];
  const statusIcon = ACCOUNT_PAYABLE_STATUS_ICONS[accountPayable.status];
  const statusLabel = ACCOUNT_PAYABLE_STATUS_LABELS[accountPayable.status];
  const isOverdue = accountPayable.overdueDays > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backIcon, isTablet && styles.backIconTablet]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
            {accountPayable.code}
          </Text>
          <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
            Cuenta por Pagar
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
                Vencido hace {accountPayable.overdueDays} días
              </Text>
            </View>
          )}
        </View>

        {/* Supplier Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proveedor</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🏢</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Nombre Comercial</Text>
                <Text style={styles.infoValue}>{accountPayable.supplierName}</Text>
              </View>
            </View>
            {accountPayable.legalEntityName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📋</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Razón Social</Text>
                  <Text style={styles.infoValue}>{accountPayable.legalEntityName}</Text>
                </View>
              </View>
            )}
            {accountPayable.taxId && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🆔</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>RUC</Text>
                  <Text style={styles.infoValue}>{accountPayable.taxId}</Text>
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
                {formatCurrency(accountPayable.totalAmountCents, accountPayable.currency)}
              </Text>
            </View>
            {accountPayable.taxAmountCents && accountPayable.taxAmountCents > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>IGV</Text>
                <Text style={styles.amountValue}>
                  {formatCurrency(accountPayable.taxAmountCents, accountPayable.currency)}
                </Text>
              </View>
            )}
            {accountPayable.paidAmountCents > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Pagado</Text>
                <Text style={styles.amountPaid}>
                  {formatCurrency(accountPayable.paidAmountCents, accountPayable.currency)}
                </Text>
              </View>
            )}
            {accountPayable.remainingAmountCents > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Saldo Pendiente</Text>
                <Text style={[styles.amountRemaining, isOverdue && styles.amountOverdue]}>
                  {formatCurrency(accountPayable.remainingAmountCents, accountPayable.currency)}
                </Text>
              </View>
            )}
            {accountPayable.paymentPercentage > 0 && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${accountPayable.paymentPercentage}%`, backgroundColor: statusColor },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {accountPayable.paymentPercentage.toFixed(0)}% pagado
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
                <Text style={styles.infoValue}>{formatDate(accountPayable.issueDate)}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>⏰</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Vencimiento</Text>
                <Text style={[styles.infoValue, isOverdue && styles.infoValueOverdue]}>
                  {formatDate(accountPayable.dueDate)}
                </Text>
              </View>
            </View>
            {accountPayable.paymentDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>✅</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Fecha de Pago</Text>
                  <Text style={styles.infoValue}>{formatDate(accountPayable.paymentDate)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Document Info */}
        {(accountPayable.documentType || accountPayable.documentNumber) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documento</Text>
            <View style={styles.card}>
              {accountPayable.documentType && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📄</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Tipo</Text>
                    <Text style={styles.infoValue}>{accountPayable.documentType}</Text>
                  </View>
                </View>
              )}
              {accountPayable.documentNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>🔢</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Número</Text>
                    <Text style={styles.infoValue}>{accountPayable.documentNumber}</Text>
                  </View>
                </View>
              )}
              {accountPayable.documentDate && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📆</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Fecha del Documento</Text>
                    <Text style={styles.infoValue}>{formatDate(accountPayable.documentDate)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Source Info */}
        {accountPayable.sourceType && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Origen</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>{SOURCE_TYPE_ICONS[accountPayable.sourceType]}</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Tipo</Text>
                  <Text style={styles.infoValue}>
                    {SOURCE_TYPE_LABELS[accountPayable.sourceType]}
                  </Text>
                </View>
              </View>
              {accountPayable.sourceCode && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>🔗</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Código de Origen</Text>
                    <Text style={styles.infoValue}>{accountPayable.sourceCode}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Description & Notes */}
        {(accountPayable.description || accountPayable.notes) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalles Adicionales</Text>
            <View style={styles.card}>
              {accountPayable.description && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📝</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Descripción</Text>
                    <Text style={styles.infoValue}>{accountPayable.description}</Text>
                  </View>
                </View>
              )}
              {accountPayable.notes && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>💬</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Notas</Text>
                    <Text style={styles.infoValue}>{accountPayable.notes}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Payment History */}
        {accountPayable.payments && accountPayable.payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial de Pagos</Text>
            <View style={styles.card}>
              {accountPayable.payments.map((payment, index) => (
                <View
                  key={payment.id}
                  style={[styles.paymentItem, index > 0 && styles.paymentItemBorder]}
                >
                  <View style={styles.paymentHeader}>
                    <Text style={styles.paymentAmount}>
                      {formatCurrency(payment.amountCents, accountPayable.currency)}
                    </Text>
                    <Text style={styles.paymentDate}>{formatDate(payment.paymentDate)}</Text>
                  </View>
                  <View style={styles.paymentDetails}>
                    <Text style={styles.paymentMethod}>
                      Método: {payment.paymentMethod || 'No especificado'}
                    </Text>
                    {payment.reference && (
                      <Text style={styles.paymentReference}>Ref: {payment.reference}</Text>
                    )}
                  </View>
                  {payment.notes && <Text style={styles.paymentNotes}>{payment.notes}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payment Schedule */}
        {accountPayable.paymentSchedule && accountPayable.paymentSchedule.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cronograma de Pagos</Text>
            <View style={styles.card}>
              {accountPayable.paymentSchedule.map((schedule, index) => (
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
                          ? 'Pagado'
                          : schedule.status === 'OVERDUE'
                          ? 'Vencido'
                          : 'Pendiente'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.scheduleDetails}>
                    <Text style={styles.scheduleAmount}>
                      {formatCurrency(schedule.amountCents, accountPayable.currency)}
                    </Text>
                    <Text style={styles.scheduleDueDate}>
                      Vence: {formatDate(schedule.dueDate)}
                    </Text>
                  </View>
                  {schedule.paidDate && (
                    <Text style={styles.schedulePaidDate}>
                      Pagado: {formatDate(schedule.paidDate)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Status History */}
        {accountPayable.statusHistory && accountPayable.statusHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial de Estados</Text>
            <View style={styles.card}>
              {accountPayable.statusHistory.map((history, index) => (
                <View
                  key={history.id}
                  style={[styles.historyItem, index > 0 && styles.historyItemBorder]}
                >
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyStatus}>
                      {history.previousStatus
                        ? `${ACCOUNT_PAYABLE_STATUS_LABELS[history.previousStatus]} → `
                        : ''}
                      {ACCOUNT_PAYABLE_STATUS_LABELS[history.newStatus]}
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
                <Text style={styles.infoValueSmall}>{accountPayable.id}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📅</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Creado</Text>
                <Text style={styles.infoValue}>{formatDateTime(accountPayable.createdAt)}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🔄</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Actualizado</Text>
                <Text style={styles.infoValue}>{formatDateTime(accountPayable.updatedAt)}</Text>
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
  amountValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  amountPaid: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  amountRemaining: {
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
  paymentItem: {
    paddingVertical: 12,
  },
  paymentItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  paymentDate: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  paymentDetails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 13,
    color: '#475569',
  },
  paymentReference: {
    fontSize: 13,
    color: '#475569',
  },
  paymentNotes: {
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
