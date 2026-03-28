import React from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupplierDebtTransaction, TransactionType } from '@/types/suppliers';
import filesApi from '@/services/api/files';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface DebtTransactionCardProps {
  transaction: SupplierDebtTransaction;
  onEdit: () => void;
  onDelete: () => void;
  onAssign?: () => void;
  formatCurrency: (cents: number) => string;
  getTypeLabel: (type: TransactionType) => string;
  getTypeColor: (type: TransactionType) => string;
}

export const DebtTransactionCard: React.FC<DebtTransactionCardProps> = ({
  transaction,
  onEdit,
  onDelete,
  onAssign,
  formatCurrency,
  getTypeLabel,
  getTypeColor,
}) => {
  const typeColor = getTypeColor(transaction.transactionType);
  const isDebit = transaction.amountCents > 0;

  const handleViewAttachment = async () => {
    if (!transaction.attachmentFileId) return;

    try {
      const signedUrl = await filesApi.getPrivateFileUrl(transaction.attachmentFileId);
      await Linking.openURL(signedUrl);
    } catch (error: any) {
      console.error('Error opening attachment:', error);
      Alert.alert('Error', 'No se pudo abrir el archivo adjunto');
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
            <Text style={styles.typeBadgeText}>{getTypeLabel(transaction.transactionType)}</Text>
          </View>
          <Text style={styles.transactionNumber}>{transaction.transactionNumber}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onEdit} style={styles.iconButton}>
            <Ionicons name="create-outline" size={20} color={colors.accent[500]} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={20} color={colors.danger[500]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Amount */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, isDebit ? styles.debitAmount : styles.creditAmount]}>
          {isDebit ? '+' : ''}{formatCurrency(transaction.amountCents)}
        </Text>
        {transaction.balanceAfterCents !== undefined && transaction.balanceAfterCents !== null && (
          <Text style={styles.balanceAfter}>
            Balance: {formatCurrency(transaction.balanceAfterCents)}
          </Text>
        )}
      </View>

      {/* Details */}
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.neutral[500]} />
          <Text style={styles.detailText}>
            {new Date(transaction.transactionDate).toLocaleDateString('es-PE')}
          </Text>
        </View>

        {transaction.referenceNumber && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={16} color={colors.neutral[500]} />
            <Text style={styles.detailText}>{transaction.referenceNumber}</Text>
          </View>
        )}

        {transaction.company && (
          <View style={styles.detailRow}>
            <Ionicons name="business-outline" size={16} color={colors.neutral[500]} />
            <Text style={styles.detailText}>{transaction.company.name}</Text>
          </View>
        )}

        {!transaction.companyId && (
          <View style={styles.detailRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning[500]} />
            <Text style={[styles.detailText, { color: colors.warning[500] }]}>Sin asignar</Text>
          </View>
        )}

        {transaction.legalEntity && (
          <View style={styles.detailRow}>
            <Ionicons name="document-outline" size={16} color={colors.neutral[500]} />
            <Text style={styles.detailText}>
              {transaction.legalEntity.legalName} - {transaction.legalEntity.ruc}
            </Text>
          </View>
        )}

        {transaction.bankName && (
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={16} color={colors.neutral[500]} />
            <Text style={styles.detailText}>
              {transaction.bankName}
              {transaction.bankAccountNumber && ` - ${transaction.bankAccountNumber}`}
            </Text>
          </View>
        )}

        {transaction.attachmentFileId && (
          <TouchableOpacity style={styles.detailRow} onPress={handleViewAttachment}>
            <Ionicons name="attach-outline" size={16} color={colors.accent[500]} />
            <Text style={[styles.detailText, { color: colors.accent[500] }]}>Ver archivo adjunto</Text>
          </TouchableOpacity>
        )}

        {transaction.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notas:</Text>
            <Text style={styles.notesText}>{transaction.notes}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      {onAssign && !transaction.companyId && (
        <TouchableOpacity style={styles.assignButton} onPress={onAssign}>
          <Ionicons name="business" size={16} color={colors.neutral[0]} />
          <Text style={styles.assignButtonText}>Asignar a Empresa</Text>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Creado: {new Date(transaction.createdAt).toLocaleDateString('es-PE')}
        </Text>
        {transaction.createdBy && (
          <Text style={styles.footerText}>Por: {transaction.createdBy.email}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  typeBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.xl,
    marginRight: spacing[2],
  },
  typeBadgeText: {
    color: colors.neutral[0],
    fontSize: 12,
    fontWeight: 'bold',
  },
  transactionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  iconButton: {
    padding: spacing[1],
  },
  amountContainer: {
    marginBottom: spacing[3],
  },
  amount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  debitAmount: {
    color: colors.danger[500],
  },
  creditAmount: {
    color: colors.success[600],
  },
  balanceAfter: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  details: {
    gap: spacing[2],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  detailText: {
    fontSize: 14,
    color: colors.neutral[800],
    flex: 1,
  },
  notesContainer: {
    marginTop: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  notesText: {
    fontSize: 14,
    color: colors.neutral[800],
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[3],
    gap: spacing[2],
  },
  assignButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerText: {
    fontSize: 12,
    color: colors.neutral[400],
  },
});

export default DebtTransactionCard;
