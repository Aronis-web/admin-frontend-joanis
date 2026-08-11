import React from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupplierDebtTransaction, TransactionType } from '@/types/suppliers';
import filesApi from '@/services/api/files';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
            <Ionicons name="create-outline" size={20} color={theme.color.brand.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={20} color={theme.color.icon.danger} />
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
          <Ionicons name="calendar-outline" size={16} color={theme.color.icon.subtle} />
          <Text style={styles.detailText}>
            {new Date(transaction.transactionDate).toLocaleDateString('es-PE')}
          </Text>
        </View>

        {transaction.referenceNumber && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={16} color={theme.color.icon.subtle} />
            <Text style={styles.detailText}>{transaction.referenceNumber}</Text>
          </View>
        )}

        {transaction.company && (
          <View style={styles.detailRow}>
            <Ionicons name="business-outline" size={16} color={theme.color.icon.subtle} />
            <Text style={styles.detailText}>{transaction.company.name}</Text>
          </View>
        )}

        {!transaction.companyId && (
          <View style={styles.detailRow}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.color.icon.warning} />
            <Text style={[styles.detailText, { color: theme.color.icon.warning }]}>Sin asignar</Text>
          </View>
        )}

        {transaction.legalEntity && (
          <View style={styles.detailRow}>
            <Ionicons name="document-outline" size={16} color={theme.color.icon.subtle} />
            <Text style={styles.detailText}>
              {transaction.legalEntity.legalName} - {transaction.legalEntity.ruc}
            </Text>
          </View>
        )}

        {transaction.bankName && (
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={16} color={theme.color.icon.subtle} />
            <Text style={styles.detailText}>
              {transaction.bankName}
              {transaction.bankAccountNumber && ` - ${transaction.bankAccountNumber}`}
            </Text>
          </View>
        )}

        {transaction.attachmentFileId && (
          <TouchableOpacity style={styles.detailRow} onPress={handleViewAttachment}>
            <Ionicons name="attach-outline" size={16} color={theme.color.brand.accent} />
            <Text style={[styles.detailText, { color: theme.color.brand.accent }]}>Ver archivo adjunto</Text>
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
          <Ionicons name="business" size={16} color={theme.color.text.inverse} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface.base,
      marginHorizontal: theme.space[4],
      marginVertical: theme.space[2],
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerRight: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    typeBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.xl,
      marginRight: theme.space[2],
    },
    typeBadgeText: {
      color: theme.color.text.inverse,
      fontSize: 12,
      fontWeight: 'bold',
    },
    transactionNumber: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    iconButton: {
      padding: theme.space[1],
    },
    amountContainer: {
      marginBottom: theme.space[3],
    },
    amount: {
      fontSize: 28,
      fontWeight: 'bold',
    },
    debitAmount: {
      color: theme.color.text.danger,
    },
    creditAmount: {
      color: theme.color.text.success,
    },
    balanceAfter: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
    },
    details: {
      gap: theme.space[2],
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    detailText: {
      fontSize: 14,
      color: theme.color.text.heading,
      flex: 1,
    },
    notesContainer: {
      marginTop: theme.space[2],
      padding: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
    },
    notesLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      color: theme.color.text.subtle,
      marginBottom: theme.space[1],
    },
    notesText: {
      fontSize: 14,
      color: theme.color.text.heading,
    },
    assignButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.lg,
      marginTop: theme.space[3],
      gap: theme.space[2],
    },
    assignButtonText: {
      color: theme.color.text.inverse,
      fontSize: 14,
      fontWeight: 'bold',
    },
    footer: {
      marginTop: theme.space[3],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    footerText: {
      fontSize: 12,
      color: theme.color.text.placeholder,
    },
  });

export default DebtTransactionCard;
