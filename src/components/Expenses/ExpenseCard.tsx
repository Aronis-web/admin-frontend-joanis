import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Expense } from '@/types/expenses';
import { ExpenseStatusBadge } from './ExpenseStatusBadge';

interface ExpenseCardProps {
  expense: Expense;
  onPress: (expense: Expense) => void;
  onChangeStatus?: (expense: Expense) => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  onAddPayment?: (expense: Expense) => void;
  onReconcileAmount?: (expense: Expense) => void;
  onViewPayments?: (expense: Expense) => void;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  expense,
  onPress,
  onChangeStatus,
  onEdit,
  onDelete,
  onAddPayment,
  onReconcileAmount,
  onViewPayments,
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (amountCents?: number, currency?: string) => {
    if (!amountCents) return 'S/ 0.00';
    const amount = amountCents / 100; // Convert cents to main currency unit
    const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'S/';
    return `${currencySymbol} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const canChangeStatus = expense.status !== 'PAID' && expense.status !== 'CANCELLED';

  // Calculate payment progress
  const getPaymentProgress = () => {
    const targetAmount = expense.actualAmountCents || expense.estimatedAmountCents || expense.amountCents || 0;
    const paidAmount = expense.totalPaidCents || 0;
    if (!targetAmount || targetAmount === 0) return 0;
    return (paidAmount / targetAmount) * 100;
  };

  const paymentProgress = getPaymentProgress();
  const remainingAmount = expense.remainingAmountCents || 0;
  const targetAmount = expense.actualAmountCents || expense.estimatedAmountCents || expense.amountCents || 0;
  const paidAmount = expense.totalPaidCents || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(expense)} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.expenseName} numberOfLines={1}>{expense.name}</Text>
          {expense.template && (
            <View style={styles.templateBadge}>
              <Ionicons name="repeat-outline" size={12} color="#6366F1" />
              <Text style={styles.templateBadgeText}>Plantilla</Text>
            </View>
          )}
        </View>
        {/* @ts-ignore - TypeScript cache issue with ExpenseStatus enum */}
        <ExpenseStatusBadge status={expense.status || 'ACTIVE'} size="small" />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        {/* Payment Progress */}
        {targetAmount > 0 && (
          <View style={styles.paymentProgressContainer}>
            <View style={styles.paymentInfoRow}>
              <Text style={styles.paymentLabel}>Pagado:</Text>
              <Text style={styles.paymentValue}>{formatAmount(paidAmount)}</Text>
            </View>
            {remainingAmount > 0 && (
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentLabel}>Pendiente:</Text>
                <Text style={styles.paymentValuePending}>{formatAmount(remainingAmount)}</Text>
              </View>
            )}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(paymentProgress, 100)}%` }]} />
            </View>
            <Text style={styles.paymentPercentage}>{paymentProgress.toFixed(1)}% completado</Text>
          </View>
        )}

        <View style={styles.amountContainer}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>
              {expense.actualAmountCents ? 'Monto Real:' : 'Monto:'}
            </Text>
            <Text style={styles.amountValue}>
              {formatAmount(expense.actualAmountCents || expense.amountCents, expense.currency)}
            </Text>
          </View>
          <Text style={styles.currencyText}>{expense.currency || 'PEN'}</Text>
        </View>

        {/* Show estimated amount if actual amount exists */}
        {expense.actualAmountCents && expense.estimatedAmountCents && (
          <View style={styles.estimatedAmountContainer}>
            <Text style={styles.estimatedAmountLabel}>Monto Estimado:</Text>
            <Text style={styles.estimatedAmountValue}>
              {formatAmount(expense.estimatedAmountCents, expense.currency)}
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Categoría</Text>
            <Text style={styles.value} numberOfLines={1}>
              {expense.category?.name || 'Sin categoría'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Fecha</Text>
            <Text style={styles.value}>{formatDate(expense.dueDate || expense.expenseDate)}</Text>
          </View>
        </View>

        {/* Site and Project Info */}
        <View style={styles.metaInfoContainer}>
          <View style={styles.metaInfoItem}>
            <Ionicons name="business" size={12} color={expense.site ? "#6366F1" : "#94A3B8"} />
            <Text style={[styles.metaInfoText, !expense.site && styles.metaInfoTextMuted]} numberOfLines={1}>
              {expense.site ? expense.site.name : 'Sin sede asignada'}
            </Text>
          </View>
          {expense.project && (
            <View style={styles.metaInfoItem}>
              <Ionicons name="folder-open" size={12} color="#10B981" />
              <Text style={styles.metaInfoText} numberOfLines={1}>{expense.project.name}</Text>
            </View>
          )}
        </View>

        {expense.purchase && (
          <View style={styles.purchaseContainer}>
            <Ionicons name="cart-outline" size={14} color="#64748B" />
            <Text style={styles.purchaseText} numberOfLines={1}>
              Compra: {expense.purchase.code}
            </Text>
          </View>
        )}

        {expense.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText} numberOfLines={2}>{expense.notes}</Text>
          </View>
        )}

        {(onEdit || onDelete || onAddPayment || onReconcileAmount || onViewPayments) && (
          <View style={styles.actionButtons}>
            {onAddPayment && remainingAmount > 0 && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onAddPayment(expense);
                }}
              >
                <Ionicons name="cash-outline" size={16} color="#10B981" />
                <Text style={[styles.actionButtonText, { color: '#10B981' }]}>Pagar</Text>
              </TouchableOpacity>
            )}
            {onViewPayments && (expense.paymentsCount && expense.paymentsCount > 0 || expense.totalPaidCents && expense.totalPaidCents > 0 || expense.status === 'PAID') && (
              <TouchableOpacity
                style={[styles.actionButton, styles.viewPaymentsButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  onViewPayments(expense);
                }}
              >
                <Ionicons name="list-outline" size={16} color="#6366F1" />
                <Text style={[styles.actionButtonText, { color: '#6366F1' }]}>
                  Ver Pagos {expense.paymentsCount ? `(${expense.paymentsCount})` : ''}
                </Text>
              </TouchableOpacity>
            )}
            {onReconcileAmount && !expense.actualAmountCents && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onReconcileAmount(expense);
                }}
              >
                <Ionicons name="receipt-outline" size={16} color="#6366F1" />
                <Text style={[styles.actionButtonText, { color: '#6366F1' }]}>Monto Real</Text>
              </TouchableOpacity>
            )}
            {onEdit && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onEdit(expense);
                }}
              >
                <Ionicons name="create-outline" size={16} color="#6366F1" />
                <Text style={styles.actionButtonText}>Editar</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(expense);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  templateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
  paymentProgressContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  paymentValuePending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  paymentPercentage: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
  },
  amountContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  currencyText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  estimatedAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
  },
  estimatedAmountLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  estimatedAmountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  infoItem: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  purchaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  purchaseText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    flex: 1,
  },
  notesContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  notesText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 16,
  },
  metaInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  metaInfoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    maxWidth: 150,
  },
  metaInfoTextMuted: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  viewPaymentsButton: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
});

export default ExpenseCard;
