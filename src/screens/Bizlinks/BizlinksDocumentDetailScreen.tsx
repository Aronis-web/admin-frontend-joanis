import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBizlinksDocuments } from '../../hooks/useBizlinks';
import { BizlinksDocument } from '../../types/bizlinks';
import {
  getBizlinksStatusSunatLabel,
  getBizlinksStatusSunatColor,
  getBizlinksStatusWsLabel,
  getDocumentTypeLabel,
  formatCurrency,
} from '../../utils/bizlinksHelpers';

type Props = NativeStackScreenProps<any, 'BizlinksDocumentDetail'>;

export const BizlinksDocumentDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { documentId } = route.params as { documentId: string };
  const { getDocumentById, refreshDocumentStatus, downloadArtifacts, loading } = useBizlinksDocuments();
  const [document, setDocument] = useState<BizlinksDocument | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      const data = await getDocumentById(documentId);
      setDocument(data);
    } catch (error) {
      console.error('Error loading document:', error);
      Alert.alert('Error', 'No se pudo cargar el documento');
    }
  };

  const handleRefresh = async () => {
    if (!document) return;

    setRefreshing(true);
    try {
      const updated = await refreshDocumentStatus(document.id);
      setDocument(updated);
      Alert.alert('Éxito', 'Estado actualizado correctamente');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;

    try {
      await downloadArtifacts(document.id, {
        downloadPdf: true,
        downloadXml: true,
        downloadCdr: true,
      });
      Alert.alert('Éxito', 'Archivos descargados correctamente');
      loadDocument();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading || !document) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Cargando documento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = getBizlinksStatusSunatColor(document.statusSunat);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.documentType}>{getDocumentTypeLabel(document.documentType)}</Text>
          <Text style={styles.serieNumero}>{document.serieNumero}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {getBizlinksStatusSunatLabel(document.statusSunat)}
            </Text>
          </View>
        </View>

        {(document.fechaEmision || document.horaEmision || document.tipoMoneda) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información General</Text>
            {document.fechaEmision && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Fecha de Emisión:</Text>
                <Text style={styles.value}>
                  {new Date(document.fechaEmision).toLocaleDateString('es-PE')}
                </Text>
              </View>
            )}
            {document.horaEmision && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Hora:</Text>
                <Text style={styles.value}>{document.horaEmision}</Text>
              </View>
            )}
            {document.tipoMoneda && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Moneda:</Text>
                <Text style={styles.value}>{document.tipoMoneda}</Text>
              </View>
            )}
          </View>
        )}

        {(document.razonSocialAdquiriente || document.numeroDocumentoAdquiriente) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            {document.razonSocialAdquiriente && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Razón Social:</Text>
                <Text style={styles.value}>{document.razonSocialAdquiriente}</Text>
              </View>
            )}
            {document.numeroDocumentoAdquiriente && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Documento:</Text>
                <Text style={styles.value}>
                  {document.tipoDocumentoAdquiriente} - {document.numeroDocumentoAdquiriente}
                </Text>
              </View>
            )}
          </View>
        )}

        {(document.totalValorVenta !== undefined || document.totalIgv !== undefined || document.totalVenta !== undefined) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Totales</Text>
            {document.totalValorVenta !== undefined && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Subtotal:</Text>
                <Text style={styles.value}>
                  {formatCurrency(document.totalValorVenta, document.tipoMoneda)}
                </Text>
              </View>
            )}
            {document.totalIgv !== undefined && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>IGV:</Text>
                <Text style={styles.value}>
                  {formatCurrency(document.totalIgv, document.tipoMoneda)}
                </Text>
              </View>
            )}
            {document.totalVenta !== undefined && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL:</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(document.totalVenta, document.tipoMoneda)}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado SUNAT</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Estado WS:</Text>
            <Text style={styles.value}>{getBizlinksStatusWsLabel(document.statusWs)}</Text>
          </View>
          {document.messageSunat && (
            <View style={styles.messageContainer}>
              <Text style={styles.messageLabel}>Mensaje SUNAT:</Text>
              <Text style={styles.messageText}>{document.messageSunat.mensaje}</Text>
            </View>
          )}
          {document.hashCode && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Hash:</Text>
              <Text style={styles.valueSmall}>{document.hashCode}</Text>
            </View>
          )}
        </View>

        {(document.pdfPath || document.xmlSignPath || document.xmlSunatPath) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Archivos</Text>
            {document.pdfPath && (
              <View style={styles.fileRow}>
                <Text style={styles.fileIcon}>📄</Text>
                <Text style={styles.fileName}>PDF disponible</Text>
              </View>
            )}
            {document.xmlSignPath && (
              <View style={styles.fileRow}>
                <Text style={styles.fileIcon}>📝</Text>
                <Text style={styles.fileName}>XML firmado disponible</Text>
              </View>
            )}
            {document.xmlSunatPath && (
              <View style={styles.fileRow}>
                <Text style={styles.fileIcon}>✅</Text>
                <Text style={styles.fileName}>CDR disponible</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.refreshButton]}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Actualizar Estado</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.downloadButton]}
            onPress={handleDownload}
          >
            <Text style={styles.buttonText}>Descargar Archivos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  documentType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  serieNumero: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  valueSmall: {
    fontSize: 12,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
  },
  messageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  messageLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#333',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#17a2b8',
  },
  downloadButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
