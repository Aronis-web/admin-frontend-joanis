import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BizlinksDocument } from '../../types/bizlinks';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
                  <ActivityIndicator size="small" color="#17a2b8" />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing[4],
  },
  headerLeft: {
    flex: 1,
  },
  documentType: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  serieNumero: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[700],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.xl,
  },
  statusText: {
    color: colors.neutral[0],
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing[4],
  },
  body: {
    padding: spacing[4],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  label: {
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: colors.neutral[700],
    flex: 1,
    textAlign: 'right',
  },
  valueAmount: {
    fontSize: 16,
    color: colors.success[500],
    fontWeight: 'bold',
  },
  messageContainer: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
  },
  messageLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  messageText: {
    fontSize: 12,
    color: colors.neutral[700],
  },
  actions: {
    flexDirection: 'row',
    padding: spacing[3],
    gap: spacing[2],
  },
  actionButton: {
    flex: 1,
    padding: spacing[3],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.info[500],
    fontWeight: '600',
  },
});
