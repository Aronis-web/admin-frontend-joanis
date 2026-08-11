import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BizlinksDocument } from '../../types/bizlinks';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  getBizlinksStatusSunatLabel,
  getBizlinksStatusSunatColor,
  getDocumentTypeLabel,
  formatCurrency,
} from '../../utils/bizlinksHelpers';

interface BizlinksDocumentCardProps {
  document: BizlinksDocument;
  onPress?: (document: BizlinksDocument) => void;
  onRefresh?: (document: BizlinksDocument) => void;
  onDownload?: (document: BizlinksDocument) => void;
  refreshing?: boolean;
}

export const BizlinksDocumentCard: React.FC<BizlinksDocumentCardProps> = ({
  document,
  onPress,
  onRefresh,
  onDownload,
  refreshing = false,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const statusColor = getBizlinksStatusSunatColor(document.statusSunat);
  const statusLabel = getBizlinksStatusSunatLabel(document.statusSunat);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(document)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.documentType}>
            {getDocumentTypeLabel(document.documentType)}
          </Text>
          <Text style={styles.serieNumero}>{document.serieNumero}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.body}>
        {document.razonSocialAdquiriente && (
          <View style={styles.row}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value} numberOfLines={1}>
              {document.razonSocialAdquiriente}
            </Text>
          </View>
        )}

        {document.numeroDocumentoAdquiriente && (
          <View style={styles.row}>
            <Text style={styles.label}>RUC/DNI:</Text>
            <Text style={styles.value}>{document.numeroDocumentoAdquiriente}</Text>
          </View>
        )}

        {document.fechaEmision && (
          <View style={styles.row}>
            <Text style={styles.label}>Fecha:</Text>
            <Text style={styles.value}>
              {new Date(document.fechaEmision).toLocaleDateString('es-PE')}
            </Text>
          </View>
        )}

        {document.totalVenta !== undefined && (
          <View style={styles.row}>
            <Text style={styles.label}>Total:</Text>
            <Text style={styles.valueAmount}>
              {formatCurrency(document.totalVenta, document.tipoMoneda)}
            </Text>
          </View>
        )}

        {document.messageSunat && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Mensaje SUNAT:</Text>
            <Text style={styles.messageText}>{document.messageSunat.mensaje}</Text>
          </View>
        )}
      </View>

      {(onRefresh || onDownload) && (
        <>
          <View style={styles.divider} />
          <View style={styles.actions}>
            {onRefresh && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onRefresh(document)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={theme.color.text.link} />
                ) : (
                  <Text style={styles.actionButtonText}>Actualizar</Text>
                )}
              </TouchableOpacity>
            )}

            {onDownload && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onDownload(document)}
              >
                <Text style={styles.actionButtonText}>Descargar</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      marginHorizontal: theme.space[4],
      marginVertical: theme.space[2],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: theme.space[4],
    },
    headerLeft: {
      flex: 1,
    },
    documentType: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    serieNumero: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.body,
    },
    statusBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.xl,
    },
    statusText: {
      color: theme.color.text.inverse,
      fontSize: 12,
      fontWeight: 'bold',
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.subtle,
      marginHorizontal: theme.space[4],
    },
    body: {
      padding: theme.space[4],
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
    },
    label: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    value: {
      fontSize: 14,
      color: theme.color.text.body,
      flex: 1,
      textAlign: 'right',
    },
    valueAmount: {
      fontSize: 16,
      color: theme.color.text.success,
      fontWeight: 'bold',
    },
    messageContainer: {
      marginTop: theme.space[3],
      padding: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
    },
    messageLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '600',
      marginBottom: theme.space[1],
    },
    messageText: {
      fontSize: 12,
      color: theme.color.text.body,
    },
    actions: {
      flexDirection: 'row',
      padding: theme.space[3],
      gap: theme.space[2],
    },
    actionButton: {
      flex: 1,
      padding: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 14,
      color: theme.color.text.link,
      fontWeight: '600',
    },
  });
