import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Expense } from '@/types/expenses';
import { ExpenseStatusBadge } from './ExpenseStatusBadge';
import { CategoryBadge } from './CategoryBadge';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  iconSizes,
} from '@/design-system/tokens';
import {
  Title,
  Body,
  Caption,
  Label,
  Numeric,
  Card,
} from '@/design-system/components';

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
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (amountCents?: number, currency?: string) => {
    if (!amountCents) {
      return 'S/ 0.00';
    }
    const amount = amountCents / 100; // Convert cents to main currency unit
    const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'S/';
    return `${currencySymbol} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Helper function to get account payable status label
  const getAccountPayableStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      PARTIAL: 'Parcial',
      PAID: 'Pagado',
      CANCELLED: 'Cancelado',
    };
    return labels[status] || status;
  };

  // Helper function to get account payable status style
  const getAccountPayableStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID':
        return { backgroundColor: colors.success[100], borderColor: colors.success[500] };
      case 'PARTIAL':
        return { backgroundColor: colors.warning[100], borderColor: colors.warning[500] };
      case 'PENDING':
        return { backgroundColor: colors.neutral[100], borderColor: colors.neutral[400] };
      case 'CANCELLED':
        return { backgroundColor: colors.danger[100], borderColor: colors.danger[500] };
      default:
        return { backgroundColor: colors.neutral[100], borderColor: colors.neutral[400] };
    }
  };

  const canChangeStatus = expense.status !== 'PAID' && expense.status !== 'CANCELLED';

  // Calculate payment progress
  const getPaymentProgress = () => {
    const targetAmount =
      expense.actualAmountCents || expense.estimatedAmountCents || expense.amountCents || 0;
    const paidAmount = expense.totalPaidCents || 0;
    if (!targetAmount || targetAmount === 0) {
      return 0;
    }
    return (paidAmount / targetAmount) * 100;
  };

  const paymentProgress = getPaymentProgress();
  const remainingAmount = expense.remainingAmountCents || 0;
  const targetAmount =
    expense.actualAmountCents || expense.estimatedAmountCents || expense.amountCents || 0;
  const paidAmount = expense.totalPaidCents || 0;

  return (
    <Card variant="elevated" padding="medium" onPress={() => onPress(expense)} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Title size="small" numberOfLines={1}>{expense.name}</Title>
          {expense.template && (
            <View style={styles.templateBadge}>
              <Ionicons name="repeat-outline" size={12} color={colors.accent[600]} />
              <Caption color={colors.accent[600]}>Plantilla</Caption>
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
              <Caption color="secondary">Pagado:</Caption>
              <Label size="medium" color={colors.success[600]}>{formatAmount(paidAmount)}</Label>
            </View>
            {remainingAmount > 0 && (
              <View style={styles.paymentInfoRow}>
                <Caption color="secondary">Pendiente:</Caption>
                <Label size="medium" color={colors.warning[600]}>{formatAmount(remainingAmount)}</Label>
              </View>
            )}
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${Math.min(paymentProgress, 100)}%` }]}
              />
            </View>
            <Caption color="tertiary" style={styles.paymentPercentage}>{paymentProgress.toFixed(1)}% completado</Caption>
          </View>
        )}

        <View style={styles.amountContainer}>
          <View style={styles.amountRow}>
            <Label size="medium" color="secondary">
              {expense.actualAmountCents ? 'Monto Real:' : 'Monto:'}
            </Label>
            <Numeric size="medium" color="primary">
              {formatAmount(expense.actualAmountCents || expense.amountCents, expense.currency)}
            </Numeric>
          </View>
          <Caption color="tertiary">{expense.currency || 'PEN'}</Caption>
        </View>

        {/* Show estimated amount if actual amount exists */}
        {expense.actualAmountCents && expense.estimatedAmountCents && (
          <View style={styles.estimatedAmountContainer}>
            <Caption color={colors.warning[800]}>Monto Estimado:</Caption>
            <Label size="medium" color={colors.warning[800]}>
              {formatAmount(expense.estimatedAmountCents, expense.currency)}
            </Label>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.infoItem}>
            <Label size="small" color="tertiary" style={styles.label}>Categoría</Label>
            {expense.category && expense.subcategory ? (
              <CategoryBadge
                category={{
                  name: expense.category.name,
                  code: expense.category.code || '',
                  color: expense.category.color,
                  icon: expense.category.icon,
                }}
                subcategory={{
                  name: expense.subcategory.name,
                  code: expense.subcategory.code || '',
                }}
                size="small"
                showCode={false}
              />
            ) : (
              <Body size="small" color="primary" numberOfLines={1}>
                {expense.category?.name || 'Sin categoría'}
              </Body>
            )}
          </View>
          <View style={styles.infoItem}>
            <Label size="small" color="tertiary" style={styles.label}>Fecha</Label>
            <Body size="small" color="primary">{formatDate(expense.dueDate || expense.expenseDate)}</Body>
          </View>
        </View>

        {/* Site and Project Info */}
        <View style={styles.metaInfoContainer}>
          <View style={styles.metaInfoItem}>
            <Ionicons name="business" size={12} color={expense.site ? colors.accent[600] : colors.icon.disabled} />
            <RNText
              style={[styles.metaInfoText, !expense.site && styles.metaInfoTextMuted]}
              numberOfLines={1}
            >
              {expense.site ? expense.site.name : 'Sin sede asignada'}
            </RNText>
          </View>
          {expense.project && (
            <View style={styles.metaInfoItem}>
              <Ionicons name="folder-open" size={12} color={colors.success[500]} />
              <RNText style={styles.metaInfoText} numberOfLines={1}>
                {expense.project.name}
              </RNText>
            </View>
          )}

          {expense.supplier && (
            <View style={styles.metaInfoItem}>
              <Ionicons name="person-outline" size={12} color={colors.success[500]} />
              <RNText style={styles.metaInfoText} numberOfLines={1}>
                {expense.supplier.commercialName}
              </RNText>
            </View>
          )}

          {expense.supplierLegalEntity && (
            <View style={styles.metaInfoItem}>
              <Ionicons name="card-outline" size={12} color={colors.icon.secondary} />
              <RNText style={styles.metaInfoText} numberOfLines={1}>
                RUC: {expense.supplierLegalEntity.ruc}
              </RNText>
            </View>
          )}
        </View>

        {expense.purchase && (
          <View style={styles.purchaseContainer}>
            <Ionicons name="cart-outline" size={14} color={colors.icon.secondary} />
            <RNText style={styles.purchaseText} numberOfLines={1}>
              Compra: {expense.purchase.code}
            </RNText>
          </View>
        )}

        {expense.accountPayable && (
          <View style={styles.accountPayableContainer}>
            <View style={styles.accountPayableHeader}>
              <Ionicons name="document-text" size={14} color={colors.warning[500]} />
              <RNText style={styles.accountPayableCode}>{expense.accountPayable.code}</RNText>
              <View
                style={[
                  styles.accountPayableStatusBadge,
                  getAccountPayableStatusStyle(expense.accountPayable.status),
                ]}
              >
                <RNText style={styles.accountPayableStatusText}>
                  {getAccountPayableStatusLabel(expense.accountPayable.status)}
                </RNText>
              </View>
            </View>
            <View style={styles.accountPayableDetails}>
              <RNText style={styles.accountPayableLabel}>Saldo:</RNText>
              <RNText style={styles.accountPayableBalance}>
                {formatAmount(expense.accountPayable.balanceCents, expense.currency)}
              </RNText>
            </View>
            {expense.accountPayable.overdueDays && expense.accountPayable.overdueDays > 0 && (
              <View style={styles.overdueWarning}>
                <Ionicons name="warning" size={12} color={colors.danger[500]} />
                <RNText style={styles.overdueText}>
                  Vencido hace {expense.accountPayable.overdueDays} días
                </RNText>
              </View>
            )}
          </View>
        )}

        {expense.notes && (
          <View style={styles.notesContainer}>
            <RNText style={styles.notesText} numberOfLines={2}>
              {expense.notes}
            </RNText>
          </View>
        )}

        {(onEdit || onDelete || onAddPayment || onReconcileAmount || onViewPayments) && (
          <View style={styles.actionButtons}>
            {onAddPayment && remainingAmount > 0 && (
              <ProtectedTouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onAddPayment(expense);
                }}
                requiredPermissions={['expenses.payments.create']}
                hideIfNoPermission={true}
              >
                <Ionicons name="cash-outline" size={16} color={colors.success[500]} />
                <RNText style={[styles.actionButtonText, { color: colors.success[500] }]}>Pagar</RNText>
              </ProtectedTouchableOpacity>
            )}
            {onViewPayments &&
              ((expense.paymentsCount && expense.paymentsCount > 0) ||
                (expense.totalPaidCents && expense.totalPaidCents > 0) ||
                expense.status === 'PAID') && (
                <ProtectedTouchableOpacity
                  style={[styles.actionButton, styles.viewPaymentsButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onViewPayments(expense);
                  }}
                  requiredPermissions={['expenses.payments.read']}
                  hideIfNoPermission={true}
                >
                  <Ionicons name="list-outline" size={16} color={colors.accent[600]} />
                  <RNText style={[styles.actionButtonText, { color: colors.accent[600] }]}>
                    Ver Pagos {expense.paymentsCount ? `(${expense.paymentsCount})` : ''}
                  </RNText>
                </ProtectedTouchableOpacity>
              )}
            {onReconcileAmount && !expense.actualAmountCents && (
              <ProtectedTouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onReconcileAmount(expense);
                }}
                requiredPermissions={['expenses.update']}
                hideIfNoPermission={true}
              >
                <Ionicons name="receipt-outline" size={16} color={colors.accent[600]} />
                <RNText style={[styles.actionButtonText, { color: colors.accent[600] }]}>Monto Real</RNText>
              </ProtectedTouchableOpacity>
            )}
            {onEdit && (
              <ProtectedTouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onEdit(expense);
                }}
                requiredPermissions={['expenses.update']}
                hideIfNoPermission={true}
              >
                <Ionicons name="create-outline" size={16} color={colors.accent[600]} />
                <RNText style={styles.actionButtonText}>Editar</RNText>
              </ProtectedTouchableOpacity>
            )}
            {onDelete && (
              <ProtectedTouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(expense);
                }}
                requiredPermissions={['expenses.delete']}
                hideIfNoPermission={true}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger[500]} />
                <RNText style={[styles.actionButtonText, styles.deleteButtonText]}>Eliminar</RNText>
              </ProtectedTouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  headerLeft: {
    flex: 1,
  },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    gap: spacing[1],
    marginTop: spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginBottom: spacing[3],
  },
  content: {
    gap: spacing[3],
  },
  paymentProgressContainer: {
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border.light,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success[500],
    borderRadius: borderRadius.full,
  },
  paymentPercentage: {
    textAlign: 'right',
  },
  amountContainer: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estimatedAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    padding: spacing[2],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  infoItem: {
    flex: 1,
  },
  label: {
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  },
  purchaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.sm,
    gap: spacing[1.5],
  },
  purchaseText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success[800],
    flex: 1,
  },
  notesContainer: {
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    padding: spacing[2.5],
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  notesText: {
    fontSize: 12,
    color: colors.warning[900],
    lineHeight: 16,
  },
  metaInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metaInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    gap: spacing[1],
  },
  metaInfoText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    maxWidth: 150,
  },
  metaInfoTextMuted: {
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    gap: spacing[1],
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent[600],
  },
  deleteButton: {
    backgroundColor: colors.danger[50],
  },
  deleteButtonText: {
    color: colors.danger[600],
  },
  viewPaymentsButton: {
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[200],
  },
  accountPayableContainer: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderRadius: borderRadius.md,
    padding: spacing[2.5],
    marginTop: spacing[2],
  },
  accountPayableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1.5],
  },
  accountPayableCode: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning[800],
    marginLeft: spacing[1.5],
    flex: 1,
  },
  accountPayableStatusBadge: {
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
  },
  accountPayableStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  accountPayableDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountPayableLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  accountPayableBalance: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warning[600],
  },
  overdueWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1.5],
    paddingTop: spacing[1.5],
    borderTopWidth: 1,
    borderTopColor: colors.warning[200],
  },
  overdueText: {
    fontSize: 11,
    color: colors.danger[600],
    fontWeight: '600',
    marginLeft: spacing[1],
  },
});

export default ExpenseCard;
