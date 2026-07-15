import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import { Expense } from '@/types/expenses';
import { MAIN_ROUTES } from '@/constants/routes';
import { ExpenseStatusBadge } from '@/components/Expenses/ExpenseStatusBadge';
import { PaymentCard } from '@/components/Expenses/PaymentCard';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface ExpenseDetailScreenProps {
  navigation: any;
  route: {
    params: {
      expenseId: string;
      action?: 'register_payment' | 'view_payments';
    };
  };
}

export const ExpenseDetailScreen: React.FC<ExpenseDetailScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { expenseId, action } = route.params;
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'payments'>('details');
  const scrollViewRef = React.useRef<ScrollView>(null);
  const paymentsRef = React.useRef<View>(null);

  const loadExpense = useCallback(async () => {
    try {
      setLoading(true);
      const data = await expensesService.getExpense(expenseId);
      console.log('📊 Expense loaded:', {
        id: data.id,
        code: data.code,
        hasPayments: !!(data as any).payments,
        paymentsArray: (data as any).payments,
        paymentsCount: data.paymentsCount,
        totalPaidCents: data.totalPaidCents,
      });
      setExpense(data);

      // If expense has payments but they're not in the response, fetch them separately
      if (data.paymentsCount && data.paymentsCount > 0 && !(data as any).payments) {
        console.log('🔄 Payments exist but not loaded, fetching separately...');
        loadPayments();
      } else if ((data as any).payments && Array.isArray((data as any).payments)) {
        // If payments are included in the response, use them
        setPayments((data as any).payments);
      }
    } catch (error: any) {
      console.error('Error loading expense:', error);
      Alert.alert('Error', 'No se pudo cargar el gasto');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  const loadPayments = useCallback(async () => {
    try {
      setLoadingPayments(true);
      console.log('📥 Fetching payments for expense:', expenseId);
      const paymentsData = await expensesService.getPayments(expenseId);
      console.log('✅ Payments loaded:', paymentsData.length);
      setPayments(paymentsData);
    } catch (error: any) {
      console.error('❌ Error loading payments:', error);
      Alert.alert('Error', 'No se pudieron cargar los pagos');
    } finally {
      setLoadingPayments(false);
    }
  }, [expenseId]);

  useFocusEffect(
    useCallback(() => {
      loadExpense();
    }, [loadExpense])
  );

  // Handle action parameter
  React.useEffect(() => {
    if (action === 'register_payment' && expense?.status === 'ACTIVE') {
      // Show payment registration dialog
      setTimeout(() => {
        handleAddPayment();
      }, 500);
    } else if (action === 'view_payments' && expense) {
      // Load payments if not already loaded, then scroll
      console.log('🔍 View payments action triggered');
      console.log('📊 Expense has payments:', {
        hasPaymentsArray: payments.length > 0,
        paymentsLength: payments.length,
        paymentsCount: expense.paymentsCount,
        totalPaidCents: expense.totalPaidCents,
        status: expense.status,
      });

      // If payments aren't loaded yet but should exist, load them
      if (payments.length === 0 && expense.paymentsCount && expense.paymentsCount > 0) {
        console.log('🔄 Loading payments before scrolling...');
        loadPayments().then(() => {
          setTimeout(() => {
            scrollToPayments();
          }, 500);
        });
      } else {
        // Payments already loaded or don't exist, just scroll
        setTimeout(() => {
          scrollToPayments();
        }, 800);
      }
    }
  }, [action, expense, payments]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return '-';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatAmount = (cents: number | undefined) => {
    const amount = (cents || 0) / 100;
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleAddPayment = () => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE_PAYMENT as never, { expenseId });
  };

  const handleCancel = async () => {
    Alert.alert('Cancelar Gasto', '¿Estás seguro de que deseas cancelar este gasto?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            // TODO: Implement cancelExpense in service
            console.log('Cancel expense:', expenseId);
            Alert.alert('Éxito', 'Gasto cancelado correctamente');
            navigation.goBack();
          } catch (error: any) {
            Alert.alert('Error', 'No se pudo cancelar el gasto');
          }
        },
      },
    ]);
  };

  const handleConfigureRecurrence = () => {
    navigation.navigate('ConfigureRecurrence', { expenseId });
  };

  const handleConfigureAlerts = () => {
    navigation.navigate('ConfigureAlerts', { expenseId });
  };

  const handleAddPaymentInfo = () => {
    navigation.navigate('AddPaymentInfo', { expenseId });
  };

  const scrollToPayments = () => {
    console.log('📜 Attempting to scroll to payments section');
    if (paymentsRef.current && scrollViewRef.current) {
      console.log('✅ Refs are available, measuring layout...');
      paymentsRef.current.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          console.log('📍 Payments section position:', { x, y });
          scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
        },
        () => {
          console.log('❌ Failed to measure layout');
          // Fallback: scroll to bottom
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      );
    } else {
      console.log('⚠️ Refs not available:', {
        hasPaymentsRef: !!paymentsRef.current,
        hasScrollViewRef: !!scrollViewRef.current,
      });
      // Fallback: try to scroll to end
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.color.icon.default} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de Gasto</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.color.icon.default} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de Gasto</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No se encontró el gasto</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getPaymentProgress = () => {
    const paidAmount =
      typeof (expense as any).paidAmountCents === 'string'
        ? parseInt((expense as any).paidAmountCents) || 0
        : (expense as any).paidAmountCents || 0;
    if (!expense.amountCents || expense.amountCents === 0) {
      return 0;
    }
    return (paidAmount / expense.amountCents) * 100;
  };

  const paymentProgress = getPaymentProgress();
  const paidAmount =
    typeof (expense as any).paidAmountCents === 'string'
      ? parseInt((expense as any).paidAmountCents) || 0
      : (expense as any).paidAmountCents || 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.color.icon.default} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{expense.code}</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Header Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.expenseName}>{expense.name}</Text>
            {/* @ts-ignore - TypeScript cache issue with ExpenseStatus enum */}
            <ExpenseStatusBadge status={expense.status || 'ACTIVE'} size="medium" />
          </View>
          {expense.description && <Text style={styles.description}>{expense.description}</Text>}
        </View>

        {/* Amount Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Monto</Text>
          <View style={styles.amountContainer}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total:</Text>
              {/* @ts-ignore - amountCents can be string or number */}
              <Text style={styles.amountValue}>
                {formatAmount(expense.amountCents ? Number(expense.amountCents) : 0)}
              </Text>
            </View>
            {paidAmount > 0 && (
              <>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabelSecondary}>Pagado:</Text>
                  <Text style={styles.amountValuePaid}>{formatAmount(paidAmount)}</Text>
                </View>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabelSecondary}>Pendiente:</Text>
                  <Text style={styles.amountValuePending}>
                    {formatAmount(
                      (expense.amountCents ? Number(expense.amountCents) : 0) - paidAmount
                    )}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${paymentProgress}%` }]} />
                </View>
              </>
            )}
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Detalles</Text>
          <View style={styles.detailsGrid}>
            {expense.site && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Sede</Text>
                <View style={styles.detailValueRow}>
                  <Ionicons name="business" size={16} color={theme.color.brand.accent} />
                  <Text style={styles.detailValue}>{expense.site.name}</Text>
                </View>
              </View>
            )}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Categoría</Text>
              <Text style={styles.detailValue}>{expense.category?.name || '-'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Tipo</Text>
              <Text style={styles.detailValue}>{expense.expenseType || '-'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Tipo de Costo</Text>
              <Text style={styles.detailValue}>{expense.costType || '-'}</Text>
            </View>
            {/* Payment method is now registered in payments, not in expenses */}
            {expense.dueDate && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Fecha de Vencimiento</Text>
                <Text style={styles.detailValue}>{formatDate(expense.dueDate)}</Text>
              </View>
            )}
            {expense.project && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Proyecto</Text>
                <View style={styles.detailValueRow}>
                  <Ionicons name="folder-open" size={16} color={theme.color.state.success.border} />
                  <Text style={styles.detailValue}>{expense.project.name}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Payment Info Card */}
        {(expense as any).paymentInfo && typeof (expense as any).paymentInfo === 'object' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Información de Pago</Text>
            <View style={styles.paymentInfoContainer}>
              {(expense as any).paymentInfo.beneficiaryName && (
                <View style={styles.paymentInfoRow}>
                  <Text style={styles.paymentInfoLabel}>Beneficiario:</Text>
                  <Text style={styles.paymentInfoValue}>
                    {(expense as any).paymentInfo.beneficiaryName}
                  </Text>
                </View>
              )}
              {(expense as any).paymentInfo.beneficiaryRuc && (
                <View style={styles.paymentInfoRow}>
                  <Text style={styles.paymentInfoLabel}>RUC:</Text>
                  <Text style={styles.paymentInfoValue}>
                    {(expense as any).paymentInfo.beneficiaryRuc}
                  </Text>
                </View>
              )}
              {(expense as any).paymentInfo.bankName && (
                <View style={styles.paymentInfoRow}>
                  <Text style={styles.paymentInfoLabel}>Banco:</Text>
                  <Text style={styles.paymentInfoValue}>
                    {(expense as any).paymentInfo.bankName}
                  </Text>
                </View>
              )}
              {(expense as any).paymentInfo.accountNumber && (
                <View style={styles.paymentInfoRow}>
                  <Text style={styles.paymentInfoLabel}>Cuenta:</Text>
                  <Text style={styles.paymentInfoValue}>
                    {(expense as any).paymentInfo.accountNumber}
                  </Text>
                </View>
              )}
              {(expense as any).paymentInfo.cci && (
                <View style={styles.paymentInfoRow}>
                  <Text style={styles.paymentInfoLabel}>CCI:</Text>
                  <Text style={styles.paymentInfoValue}>{(expense as any).paymentInfo.cci}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Payments Section - Show if there are payments OR if expense is PAID or has payment indicators */}
        {(() => {
          const hasPaymentsArray = payments && Array.isArray(payments) && payments.length > 0;
          const hasPaymentIndicators = expense.paymentsCount && expense.paymentsCount > 0;
          const isPaid = expense.status === 'PAID';
          const hasTotalPaid = expense.totalPaidCents && expense.totalPaidCents > 0;

          const shouldShowPayments =
            hasPaymentsArray || hasPaymentIndicators || isPaid || hasTotalPaid;

          if (!shouldShowPayments) {
            return null;
          }

          // Case 1: Payments loaded successfully
          if (hasPaymentsArray) {
            return (
              <View ref={paymentsRef} style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Pagos Registrados ({payments.length})</Text>
                  <TouchableOpacity
                    style={styles.viewAllPaymentsButton}
                    onPress={() => {
                      Alert.alert(
                        'Historial de Pagos',
                        `Este gasto tiene ${payments.length} pago(s) registrado(s).`,
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="eye-outline" size={18} color={theme.color.brand.accent} />
                    <Text style={styles.viewAllPaymentsText}>Ver Todo</Text>
                  </TouchableOpacity>
                </View>
                {payments.map((payment: any) => (
                  <PaymentCard key={payment.id} payment={payment} />
                ))}
              </View>
            );
          }

          // Case 2: Payments exist but not loaded - show reload option
          const paymentCount = expense.paymentsCount || '?';
          const totalPaid = expense.totalPaidCents
            ? (expense.totalPaidCents / 100).toFixed(2)
            : '0.00';

          return (
            <View ref={paymentsRef} style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pagos Registrados ({paymentCount})</Text>
                <TouchableOpacity
                  style={styles.viewAllPaymentsButton}
                  onPress={() => loadPayments()}
                  disabled={loadingPayments}
                >
                  <Ionicons
                    name={loadingPayments ? 'hourglass-outline' : 'refresh-outline'}
                    size={18}
                    color={theme.color.brand.accent}
                  />
                  <Text style={styles.viewAllPaymentsText}>
                    {loadingPayments ? 'Cargando...' : 'Cargar Pagos'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.paymentSummaryBox}>
                <Ionicons name="information-circle" size={24} color={theme.color.brand.accent} />
                <View style={styles.paymentSummaryContent}>
                  <Text style={styles.paymentSummaryTitle}>
                    {isPaid ? 'Gasto Pagado' : 'Pagos Registrados'}
                  </Text>
                  <Text style={styles.paymentSummaryText}>Total pagado: S/ {totalPaid}</Text>
                  {hasPaymentIndicators && (
                    <Text style={styles.paymentSummaryText}>
                      Número de pagos: {expense.paymentsCount}
                    </Text>
                  )}
                  <Text style={styles.paymentSummaryHint}>
                    Toca "Cargar Pagos" para ver los detalles
                  </Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {expense.status === 'ACTIVE' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleAddPayment}>
              <Ionicons name="cash" size={20} color={theme.color.text.inverse} style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Registrar Pago</Text>
            </TouchableOpacity>
          )}

          {!(expense as any).paymentInfo && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleAddPaymentInfo}>
              <Text style={styles.secondaryButtonText}>Agregar Info de Pago</Text>
            </TouchableOpacity>
          )}

          {/* @ts-ignore - expenseType can be RECURRENT or ONE_TIME */}
          {expense.expenseType === 'RECURRENT' && !(expense as any).recurrence && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleConfigureRecurrence}>
              <Text style={styles.secondaryButtonText}>Configurar Recurrencia</Text>
            </TouchableOpacity>
          )}

          {!(expense as any).alertConfig && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleConfigureAlerts}>
              <Text style={styles.secondaryButtonText}>Configurar Alertas</Text>
            </TouchableOpacity>
          )}

          {expense.status !== 'CANCELLED' && expense.status !== 'PAID' && (
            <TouchableOpacity style={styles.dangerButton} onPress={handleCancel}>
              <Text style={styles.dangerButtonText}>Cancelar Gasto</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.surface.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  content: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.color.text.muted,
  },
  errorText: {
    fontSize: 16,
    color: theme.color.text.danger,
  },
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  expenseName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginRight: 12,
  },
  description: {
    fontSize: 14,
    color: theme.color.text.muted,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllPaymentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.color.brand.primarySoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  viewAllPaymentsText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.brand.accent,
  },
  emptyPaymentsText: {
    fontSize: 14,
    color: theme.color.text.muted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  paymentSummaryBox: {
    flexDirection: 'row',
    backgroundColor: theme.color.brand.primarySoft,
    borderRadius: 8,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  paymentSummaryContent: {
    flex: 1,
    gap: 4,
  },
  paymentSummaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  paymentSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  paymentSummaryHint: {
    fontSize: 12,
    color: theme.color.brand.accent,
    marginTop: 4,
    fontStyle: 'italic',
  },
  amountContainer: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  amountLabelSecondary: {
    fontSize: 12,
    color: theme.color.text.muted,
  },
  amountValuePaid: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.success,
  },
  amountValuePending: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.warning,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.color.border.subtle,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.color.state.success.border,
    borderRadius: 4,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    paddingBottom: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: theme.color.text.placeholder,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentInfoContainer: {
    gap: 8,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  paymentInfoLabel: {
    fontSize: 13,
    color: theme.color.text.muted,
  },
  paymentInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.body,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: theme.color.brand.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.inverse,
  },
  secondaryButton: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  dangerButton: {
    backgroundColor: theme.color.state.danger.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.state.danger.text,
  },
});

export default ExpenseDetailScreen;
