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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useBizlinksDocuments } from '../../hooks/useBizlinks';
import { BizlinksDocument } from '../../types/bizlinks';
import {
  getBizlinksStatusSunatLabel,
  getBizlinksStatusSunatColor,
  getBizlinksStatusWsLabel,
  getDocumentTypeLabel,
  formatCurrency,
} from '../../utils/bizlinksHelpers';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';

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
      <ScreenLayout navigation={navigation as any}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Cargando documento...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  const statusColor = getBizlinksStatusSunatColor(document.statusSunat);

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[colors.primary[900], colors.primary[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="document-text" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={styles.headerTitle}>{document.serieNumero}</Text>
              </View>
              <Text style={styles.headerSubtitle}>{getDocumentTypeLabel(document.documentType)}</Text>
            </View>
            <View style={[styles.statusBadgeHeader, { backgroundColor: statusColor }]}>
              <Text style={styles.statusTextHeader}>
                {getBizlinksStatusSunatLabel(document.statusSunat)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>

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
              <Ionicons name="refresh" size={20} color={colors.neutral[0]} />
              <Text style={styles.buttonText}>
                {refreshing ? 'Actualizando...' : 'Actualizar Estado'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.downloadButton]}
              onPress={handleDownload}
            >
              <Ionicons name="download" size={20} color={colors.neutral[0]} />
              <Text style={styles.buttonText}>Descargar Archivos</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  statusBadgeHeader: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  statusTextHeader: {
    color: colors.neutral[0],
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[4],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  label: {
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  valueSmall: {
    fontSize: 12,
    color: colors.neutral[700],
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: 2,
    borderTopColor: colors.neutral[200],
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success[600],
  },
  messageContainer: {
    backgroundColor: colors.warning[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  messageLabel: {
    fontSize: 12,
    color: colors.warning[700],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  messageText: {
    fontSize: 14,
    color: colors.warning[800],
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    backgroundColor: colors.neutral[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
  },
  fileIcon: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  fileName: {
    fontSize: 14,
    color: colors.neutral[700],
    fontWeight: '500',
  },
  actions: {
    gap: spacing[3],
    marginTop: spacing[2],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
    ...shadows.sm,
  },
  refreshButton: {
    backgroundColor: colors.primary[600],
  },
  downloadButton: {
    backgroundColor: colors.success[600],
  },
  buttonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
});
