import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupplierDebtTransaction, TransactionType } from '@/types/suppliers';
import filesApi from '@/services/api/files';

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
            <Ionicons name="create-outline" size={20} color="#3498db" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={20} color="#e74c3c" />
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
          <Ionicons name="calendar-outline" size={16} color="#7f8c8d" />
          <Text style={styles.detailText}>
            {new Date(transaction.transactionDate).toLocaleDateString('es-PE')}
          </Text>
        </View>

        {transaction.referenceNumber && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={16} color="#7f8c8d" />
            <Text style={styles.detailText}>{transaction.referenceNumber}</Text>
          </View>
        )}

        {transaction.company && (
          <View style={styles.detailRow}>
            <Ionicons name="business-outline" size={16} color="#7f8c8d" />
            <Text style={styles.detailText}>{transaction.company.name}</Text>
          </View>
        )}

        {!transaction.companyId && (
          <View style={styles.detailRow}>
            <Ionicons name="alert-circle-outline" size={16} color="#f39c12" />
            <Text style={[styles.detailText, { color: '#f39c12' }]}>Sin asignar</Text>
          </View>
        )}

        {transaction.legalEntity && (
          <View style={styles.detailRow}>
            <Ionicons name="document-outline" size={16} color="#7f8c8d" />
            <Text style={styles.detailText}>
              {transaction.legalEntity.legalName} - {transaction.legalEntity.ruc}
            </Text>
          </View>
        )}

        {transaction.bankName && (
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={16} color="#7f8c8d" />
            <Text style={styles.detailText}>
              {transaction.bankName}
              {transaction.bankAccountNumber && ` - ${transaction.bankAccountNumber}`}
            </Text>
          </View>
        )}

        {transaction.attachmentFileId && (
          <TouchableOpacity style={styles.detailRow} onPress={handleViewAttachment}>
            <Ionicons name="attach-outline" size={16} color="#3498db" />
            <Text style={[styles.detailText, { color: '#3498db' }]}>Ver archivo adjunto</Text>
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
          <Ionicons name="business" size={16} color="#fff" />
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
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  transactionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  iconButton: {
    padding: 4,
  },
  amountContainer: {
    marginBottom: 12,
  },
  amount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  debitAmount: {
    color: '#e74c3c',
  },
  creditAmount: {
    color: '#27ae60',
  },
  balanceAfter: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  details: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  notesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  footerText: {
    fontSize: 12,
    color: '#95a5a6',
  },
});

export default DebtTransactionCard;
