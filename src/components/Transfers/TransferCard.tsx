import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Transfer, getTransferTypeLabel } from '@/types/transfers';
import { TransferStatusBadge } from './TransferStatusBadge';

interface TransferCardProps {
  transfer: Transfer;
  onPress: (transfer: Transfer) => void;
  onGuidePress?: (transfer: Transfer) => void;
  isGuideLoading?: boolean;
}

export const TransferCard: React.FC<TransferCardProps> = ({
  transfer,
  onPress,
  onGuidePress,
  isGuideLoading = false,
}) => {
  const styles = useThemedStyles(createStyles);
  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return '-';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const itemsCount = transfer.items?.length || 0;
  const guide = transfer.remissionGuide;

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

        {(guide || onGuidePress) && (
          <TouchableOpacity
            style={[
              styles.guideButton,
              guide ? styles.downloadGuideButton : styles.createGuideButton,
              isGuideLoading && styles.guideButtonDisabled,
            ]}
            onPress={(event) => {
              event.stopPropagation();
              if (!isGuideLoading) {
                onGuidePress?.(transfer);
              }
            }}
            disabled={isGuideLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.guideButtonText}>
              {isGuideLoading
                ? 'Descargando guía...'
                : guide
                  ? `Descargar guía ${guide.number || ''}`.trim()
                  : 'Crear guía de remisión'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.color.border.default,
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
    transferNumber: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    transferType: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.default,
      marginBottom: theme.space[3],
    },
    content: {
      gap: theme.space[3],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    locationContainer: {
      flex: 1,
    },
    label: {
      fontSize: 10,
      color: theme.color.text.placeholder,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    locationText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: theme.space[0.5],
    },
    siteText: {
      fontSize: 11,
      color: theme.color.text.muted,
    },
    arrow: {
      paddingHorizontal: 4,
    },
    arrowText: {
      fontSize: 20,
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    footerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
    },
    footerLabel: {
      fontSize: 11,
      color: theme.color.text.placeholder,
    },
    footerValue: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    guideButton: {
      marginTop: theme.space[2],
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      alignItems: 'center',
    },
    downloadGuideButton: {
      backgroundColor: theme.color.brand.accent,
    },
    createGuideButton: {
      backgroundColor: theme.color.state.warning.border,
    },
    guideButtonDisabled: {
      opacity: 0.7,
    },
    guideButtonText: {
      color: theme.color.text.onAction,
      fontSize: 12,
      fontWeight: '700',
    },
  });

export default TransferCard;
