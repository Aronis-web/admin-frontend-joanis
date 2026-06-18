import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Expense } from '@/types/expenses';
import { ExpenseStatusBadge } from './ExpenseStatusBadge';
import { CategoryBadge } from './CategoryBadge';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';

// Design System
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
        return {
          backgroundColor: theme.color.state.success.background,
          borderColor: theme.color.state.success.border,
        };
      case 'PARTIAL':
        return {
          backgroundColor: theme.color.state.warning.background,
          borderColor: theme.color.state.warning.border,
        };
      case 'PENDING':
        return {
          backgroundColor: theme.color.surface.muted,
          borderColor: theme.color.border.strong,
        };
      case 'CANCELLED':
        return {
          backgroundColor: theme.color.state.danger.background,
          borderColor: theme.color.state.danger.border,
        };
      default:
        return {
          backgroundColor: theme.color.surface.muted,
          borderColor: theme.color.border.strong,
        };
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
              <Ionicons name="repeat-outline" size={12} color={theme.color.icon.accent} />
              <Caption color={theme.color.icon.accent}>Plantilla</Caption>
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
              <Label size="medium" color={theme.color.text.success}>{formatAmount(paidAmount)}</Label>
            </View>
            {remainingAmount > 0 && (
              <View style={styles.paymentInfoRow}>
                <Caption color="secondary">Pendiente:</Caption>
                <Label size="medium" color={theme.color.text.warning}>{formatAmount(remainingAmount)}</Label>
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
            <Caption color={theme.color.state.warning.text}>Monto Estimado:</Caption>
            <Label size="medium" color={theme.color.state.warning.text}>
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
            <Ionicons name="business" size={12} color={expense.site ? theme.color.icon.accent : theme.color.icon.disabled} />
            <RNText
              style={[styles.metaInfoText, !expense.site && styles.metaInfoTextMuted]}
              numberOfLines={1}
            >
              {expense.site ? expense.site.name : 'Sin sede asignada'}
            </RNText>
          </View>
          {expense.project && (
            <View style={styles.metaInfoItem}>
              <Ionicons name="folder-open" size={12} color={theme.color.icon.success} />
              <RNText style={styles.metaInfoText} numberOfLines={1}>
                {expense.project.name}
              </RNText>
            </View>
          )}

          {expense.supplier && (
            <View style={styles.metaInfoItem}>
              <Ionicons name="person-outline" size={12} color={theme.color.icon.success} />
              <RNText style={styles.metaInfoText} numberOfLines={1}>
                {expense.supplier.commercialName}
              </RNText>
            </View>
          )}

          {expense.supplierLegalEntity && (
            <View style={styles.metaInfoItem}>
              <Ionicons name="card-outline" size={12} color={theme.color.icon.muted} />
              <RNText style={styles.metaInfoText} numberOfLines={1}>
                RUC: {expense.supplierLegalEntity.ruc}
              </RNText>
            </View>
          )}
        </View>

        {expense.purchase && (
          <View style={styles.purchaseContainer}>
            <Ionicons name="cart-outline" size={14} color={theme.color.icon.muted} />
            <RNText style={styles.purchaseText} numberOfLines={1}>
              Compra: {expense.purchase.code}
            </RNText>
          </View>
        )}

        {expense.accountPayable && (
          <View style={styles.accountPayableContainer}>
            <View style={styles.accountPayableHeader}>
              <Ionicons name="document-text" size={14} color={theme.color.icon.warning} />
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
                <Ionicons name="warning" size={12} color={theme.color.icon.danger} />
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
                <Ionicons name="cash-outline" size={16} color={theme.color.icon.success} />
                <RNText style={[styles.actionButtonText, { color: theme.color.text.success }]}>Pagar</RNText>
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
                  <Ionicons name="list-outline" size={16} color={theme.color.icon.accent} />
                  <RNText style={[styles.actionButtonText, { color: theme.color.icon.accent }]}>
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
                <Ionicons name="receipt-outline" size={16} color={theme.color.icon.accent} />
                <RNText style={[styles.actionButtonText, { color: theme.color.icon.accent }]}>Monto Real</RNText>
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
                <Ionicons name="create-outline" size={16} color={theme.color.icon.accent} />
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
                <Ionicons name="trash-outline" size={16} color={theme.color.icon.danger} />
                <RNText style={[styles.actionButtonText, styles.deleteButtonText]}>Eliminar</RNText>
              </ProtectedTouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Card>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      marginBottom: theme.space[3],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    headerLeft: {
      flex: 1,
    },
    templateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.color.brand.accentSoft,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.sm,
      gap: theme.space[1],
      marginTop: theme.space[1],
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.subtle,
      marginBottom: theme.space[3],
    },
    content: {
      gap: theme.space[3],
    },
    paymentProgressContainer: {
      backgroundColor: theme.color.state.success.background,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[3],
    },
    paymentInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[1],
    },
    progressBar: {
      height: 6,
      backgroundColor: theme.color.border.subtle,
      borderRadius: theme.radii.full,
      overflow: 'hidden',
      marginTop: theme.space[2],
      marginBottom: theme.space[1],
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.color.icon.success,
      borderRadius: theme.radii.full,
    },
    paymentPercentage: {
      textAlign: 'right',
    },
    amountContainer: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
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
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.md,
      padding: theme.space[2],
    },
    row: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    infoItem: {
      flex: 1,
    },
    label: {
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    purchaseContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.state.success.background,
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.sm,
      gap: theme.space[1.5],
    },
    purchaseText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.state.success.text,
      flex: 1,
    },
    notesContainer: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.md,
      padding: theme.space[2.5],
      borderLeftWidth: 3,
      borderLeftColor: theme.color.state.warning.border,
    },
    notesText: {
      fontSize: 12,
      color: theme.color.state.warning.text,
      lineHeight: 16,
    },
    metaInfoContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    metaInfoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.sm,
      gap: theme.space[1],
    },
    metaInfoText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.muted,
      maxWidth: 150,
    },
    metaInfoTextMuted: {
      color: theme.color.text.disabled,
      fontStyle: 'italic',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: theme.space[2],
      marginTop: theme.space[1],
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[2],
      gap: theme.space[1],
    },
    actionButtonText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.icon.accent,
    },
    deleteButton: {
      backgroundColor: theme.color.state.danger.background,
    },
    deleteButtonText: {
      color: theme.color.text.danger,
    },
    viewPaymentsButton: {
      backgroundColor: theme.color.brand.accentSoft,
      borderWidth: 1,
      borderColor: theme.color.brand.accent,
    },
    accountPayableContainer: {
      backgroundColor: theme.color.state.warning.background,
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
      borderRadius: theme.radii.md,
      padding: theme.space[2.5],
      marginTop: theme.space[2],
    },
    accountPayableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[1.5],
    },
    accountPayableCode: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.state.warning.text,
      marginLeft: theme.space[1.5],
      flex: 1,
    },
    accountPayableStatusBadge: {
      borderRadius: theme.radii.xs,
      borderWidth: 1,
      paddingHorizontal: theme.space[1.5],
      paddingVertical: theme.space[0.5],
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
      color: theme.color.text.subtle,
    },
    accountPayableBalance: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.warning,
    },
    overdueWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.space[1.5],
      paddingTop: theme.space[1.5],
      borderTopWidth: 1,
      borderTopColor: theme.color.state.warning.border,
    },
    overdueText: {
      fontSize: 11,
      color: theme.color.text.danger,
      fontWeight: '600',
      marginLeft: theme.space[1],
    },
  });

export default ExpenseCard;
