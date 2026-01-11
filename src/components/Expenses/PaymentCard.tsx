import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ExpensePayment, PaymentStatusLabels, PaymentStatusColors, PaymentMethodLabels } from '@/types/expenses';
import { PaymentStatusBadge } from './PaymentStatusBadge';

interface PaymentCardProps {
  payment: ExpensePayment;
  onPress?: (payment: ExpensePayment) => void;
}

export const PaymentCard: React.FC<PaymentCardProps> = ({ payment, onPress }) => {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (cents: number) => {
    const amount = cents / 100;
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const CardWrapper = onPress ? TouchableOpacity : View;
  const cardProps = onPress ? { onPress: () => onPress(payment), activeOpacity: 0.7 } : {};

  return (
    <CardWrapper style={styles.card} {...cardProps}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.paymentCode}>{payment.code}</Text>
          <Text style={styles.paymentMethod}>{PaymentMethodLabels[payment.paymentMethod]}</Text>
        </View>
        <PaymentStatusBadge status={payment.status} size="small" />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Monto</Text>
          <Text style={styles.amountValue}>{formatAmount(payment.amountCents)}</Text>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fecha de pago:</Text>
            <Text style={styles.detailValue}>{formatDate(payment.paymentDate)}</Text>
          </View>

          {payment.bankName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Banco:</Text>
              <Text style={styles.detailValue}>{payment.bankName}</Text>
            </View>
          )}

          {payment.transactionReference && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Referencia:</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{payment.transactionReference}</Text>
            </View>
          )}

          {payment.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notas:</Text>
              <Text style={styles.notesText} numberOfLines={2}>{payment.notes}</Text>
            </View>
          )}
        </View>

        {payment.createdByUser && (
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Registrado por:</Text>
            <Text style={styles.footerValue}>{payment.createdByUser.name || payment.createdByUser.email}</Text>
          </View>
        )}
      </View>
    </CardWrapper>
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
  paymentCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 2,
  },
  paymentMethod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
  amountContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#166534',
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  notesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  footerValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
});

export default PaymentCard;
