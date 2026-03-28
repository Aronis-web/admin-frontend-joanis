import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { Transfer, getTransferTypeLabel } from '@/types/transfers';
import { TransferStatusBadge } from './TransferStatusBadge';

interface TransferCardProps {
  transfer: Transfer;
  onPress: (transfer: Transfer) => void;
}

export const TransferCard: React.FC<TransferCardProps> = ({ transfer, onPress }) => {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return '-';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const itemsCount = transfer.items?.length || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(transfer)} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.transferNumber}>{transfer.transferNumber}</Text>
          <Text style={styles.transferType}>{getTransferTypeLabel(transfer.transferType)}</Text>
        </View>
        <TransferStatusBadge status={transfer.status} size="small" />
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.locationContainer}>
            <Text style={styles.label}>Origen</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {transfer.originWarehouse?.name || 'N/A'}
            </Text>
            <Text style={styles.siteText} numberOfLines={1}>
              {transfer.originSite?.name || 'N/A'}
            </Text>
          </View>

          <View style={styles.arrow}>
            <Text style={styles.arrowText}>→</Text>
          </View>

          <View style={styles.locationContainer}>
            <Text style={styles.label}>Destino</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {transfer.destinationWarehouse?.name || 'N/A'}
            </Text>
            <Text style={styles.siteText} numberOfLines={1}>
              {transfer.destinationSite?.name || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Items:</Text>
            <Text style={styles.footerValue}>{itemsCount}</Text>
          </View>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Solicitado:</Text>
            <Text style={styles.footerValue}>{formatDate(transfer.requestedAt)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
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
  transferNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[0.5],
  },
  transferType: {
    fontSize: 12,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginBottom: spacing[3],
  },
  content: {
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  locationContainer: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: colors.neutral[400],
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: spacing[0.5],
  },
  siteText: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  arrow: {
    paddingHorizontal: 4,
  },
  arrowText: {
    fontSize: 20,
    color: colors.accent[500],
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  footerLabel: {
    fontSize: 11,
    color: colors.neutral[400],
  },
  footerValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[600],
  },
});

export default TransferCard;
