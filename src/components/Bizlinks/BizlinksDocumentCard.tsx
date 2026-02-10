import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BizlinksDocument } from '../../types/bizlinks';
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
        <View style={styles.row}>
          <Text style={styles.label}>Cliente:</Text>
          <Text style={styles.value} numberOfLines={1}>
            {document.razonSocialAdquiriente}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>RUC/DNI:</Text>
          <Text style={styles.value}>{document.numeroDocumentoAdquiriente}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Fecha:</Text>
          <Text style={styles.value}>
            {new Date(document.fechaEmision).toLocaleDateString('es-PE')}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Total:</Text>
          <Text style={styles.valueAmount}>
            {formatCurrency(document.totalVenta, document.tipoMoneda)}
          </Text>
        </View>

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
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  headerLeft: {
    flex: 1,
  },
  documentType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  serieNumero: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 16,
  },
  body: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  valueAmount: {
    fontSize: 16,
    color: '#28a745',
    fontWeight: 'bold',
  },
  messageContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  messageLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 12,
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#17a2b8',
    fontWeight: '600',
  },
});
