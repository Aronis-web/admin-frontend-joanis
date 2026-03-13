import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bizlinksApi } from '@/services/api/bizlinks';
import { Retencion } from '@/types/bizlinks';
import { formatDateToString } from '@/utils/dateHelpers';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

type Props = NativeStackScreenProps<any, 'RetencionDetail'>;

const STATUS_COLORS: Record<string, string> = {
  QUEUED: '#94A3B8',
  SENDING: '#F59E0B',
  SENT: '#3B82F6',
  ACCEPTED: '#10B981',
  REJECTED: '#EF4444',
  ERROR: '#DC2626',
};

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'En Cola',
  SENDING: 'Enviando',
  SENT: 'Enviado',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
  ERROR: 'Error',
};

const REGIMEN_LABELS: Record<string, string> = {
  '01': 'Tasa 3%',
  '02': 'Tasa 6%',
  '03': 'Otros',
};

export const RetencionDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { retencionId } = route.params as { retencionId: string };

  const [retencion, setRetencion] = useState<Retencion | null>(null);
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'xml' | 'cdr' | null>(null);

  // Helper para obtener valores numéricos seguros
  const getSafeNumber = (value: number | undefined, defaultValue: number = 0): number => {
    return typeof value === 'number' ? value : defaultValue;
  };

  // Helper para parsear datos del XML
  const parseXmlData = (xml: string, tag: string): string | null => {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  };

  const parseXmlNumber = (xml: string, tag: string): number => {
    const value = parseXmlData(xml, tag);
    return value ? parseFloat(value) : 0;
  };

  // Helper para enriquecer datos de la retención con datos del XML
  const enrichRetencionData = (retencion: Retencion): Retencion => {
    if (!retencion.payloadXml) return retencion;

    const xml = retencion.payloadXml;

    // Parsear datos del proveedor si no están presentes
    if (!retencion.razonSocialProveedor) {
      retencion.razonSocialProveedor = parseXmlData(xml, 'razonSocialProveedor') || undefined;
    }
    if (!retencion.numeroDocumentoProveedor) {
      retencion.numeroDocumentoProveedor = parseXmlData(xml, 'numeroDocumentoProveedor') || undefined;
    }
    if (!retencion.direccionProveedor) {
      retencion.direccionProveedor = parseXmlData(xml, 'direccionProveedor') || undefined;
    }

    // Parsear datos numéricos si no están presentes
    if (!retencion.tasaRetencion) {
      retencion.tasaRetencion = parseXmlNumber(xml, 'tasaRetencion');
    }
    if (!retencion.importeTotalRetenido) {
      retencion.importeTotalRetenido = parseXmlNumber(xml, 'importeTotalRetenido');
    }
    if (!retencion.importeTotalPagado) {
      retencion.importeTotalPagado = parseXmlNumber(xml, 'importeTotalPagado');
    }
    if (!retencion.tipoMoneda) {
      retencion.tipoMoneda = (parseXmlData(xml, 'tipoMonedaTotalPagado') as 'PEN' | 'USD') || 'PEN';
    }
    if (!retencion.regimenRetencion) {
      retencion.regimenRetencion = parseXmlData(xml, 'regimenRetencion') || undefined;
    }

    return retencion;
  };

  useEffect(() => {
    loadRetencion();
  }, [retencionId]);

  const loadRetencion = async () => {
    try {
      setLoading(true);
      const data = await bizlinksApi.getRetencionById(retencionId);
      console.log('📦 Retencion data received:', {
        id: data.id,
        serieNumero: data.serieNumero,
        hasPdfUrl: !!data.pdfUrl,
        pdfUrl: data.pdfUrl,
        hasXmlSignUrl: !!data.xmlSignUrl,
        xmlSignUrl: data.xmlSignUrl,
        hasPayloadXml: !!data.payloadXml,
      });
      const enrichedData = enrichRetencionData(data);
      console.log('✨ Enriched data:', {
        razonSocialProveedor: enrichedData.razonSocialProveedor,
        numeroDocumentoProveedor: enrichedData.numeroDocumentoProveedor,
        tasaRetencion: enrichedData.tasaRetencion,
        importeTotalRetenido: enrichedData.importeTotalRetenido,
        importeTotalPagado: enrichedData.importeTotalPagado,
        tipoMoneda: enrichedData.tipoMoneda,
      });
      setRetencion(enrichedData);
    } catch (error: any) {
      console.error('Error loading retencion:', error);
      Alert.alert('Error', error.message || 'Error al cargar retención');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const data = await bizlinksApi.refreshRetencionStatus(retencionId);
      setRetencion(data);
      Alert.alert('Éxito', 'Estado actualizado correctamente');
    } catch (error: any) {
      console.error('Error refreshing retencion:', error);
      Alert.alert('Error', error.message || 'Error al actualizar estado');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!retencion) return;

    console.log('📄 Attempting to download PDF:', {
      hasPdfUrl: !!retencion.pdfUrl,
      pdfUrl: retencion.pdfUrl,
      serieNumero: retencion.serieNumero,
    });

    // Si hay pdfUrl, abrir directamente
    if (retencion.pdfUrl) {
      try {
        setDownloading('pdf');
        console.log('🔗 Opening PDF URL:', retencion.pdfUrl);
        await Linking.openURL(retencion.pdfUrl);
        Alert.alert('Éxito', 'PDF abierto en el navegador');
      } catch (error: any) {
        console.error('Error opening PDF URL:', error);
        Alert.alert('Error', `No se pudo abrir el PDF: ${error.message}`);
      } finally {
        setDownloading(null);
      }
      return;
    }

    console.log('⚠️ No pdfUrl found, trying API download...');

    try {
      setDownloading('pdf');
      const blob = await bizlinksApi.downloadRetencionPDF(retencion.id);

      // Guardar archivo
      const fileName = `${retencion.serieNumero}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Convertir blob a base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];

        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Compartir archivo
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${fileUri}`);
        }
      };
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', error.message || 'Error al descargar PDF');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadXML = async () => {
    if (!retencion) return;

    console.log('📄 Attempting to download XML:', {
      hasXmlSignUrl: !!retencion.xmlSignUrl,
      xmlSignUrl: retencion.xmlSignUrl,
      serieNumero: retencion.serieNumero,
    });

    // Si hay xmlSignUrl, abrir directamente
    if (retencion.xmlSignUrl) {
      try {
        setDownloading('xml');
        console.log('🔗 Opening XML URL:', retencion.xmlSignUrl);
        await Linking.openURL(retencion.xmlSignUrl);
        Alert.alert('Éxito', 'XML abierto en el navegador');
      } catch (error: any) {
        console.error('Error opening XML URL:', error);
        Alert.alert('Error', `No se pudo abrir el XML: ${error.message}`);
      } finally {
        setDownloading(null);
      }
      return;
    }

    console.log('⚠️ No xmlSignUrl found, trying API download...');

    try {
      setDownloading('xml');
      const blob = await bizlinksApi.downloadRetencionXML(retencion.id);

      const fileName = `${retencion.serieNumero}.xml`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];

        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Éxito', `XML guardado en: ${fileUri}`);
        }
      };
    } catch (error: any) {
      console.error('Error downloading XML:', error);
      Alert.alert('Error', error.message || 'Error al descargar XML');
    } finally {
      setDownloading(null);
    }
  };

  const handleOpenPDF = () => {
    if (retencion?.pdfUrl) {
      Linking.openURL(retencion.pdfUrl);
    }
  };

  const handleAnularRetencion = () => {
    if (!retencion) return;

    // Validar que se puede revertir
    if (retencion.status === 'REJECTED') {
      Alert.alert(
        'No se puede anular',
        'No se pueden anular retenciones que han sido rechazadas por SUNAT.'
      );
      return;
    }

    if (retencion.isReversed) {
      Alert.alert(
        'Retención ya anulada',
        `Esta retención ya fue anulada el ${formatDateToString(new Date(retencion.reversedAt!))}.\n\nDocumento de reversión: ${retencion.reversedBySerieNumero}`
      );
      return;
    }

    // Mostrar modal para ingresar motivo
    setMotivoAnulacion('');
    setShowAnularModal(true);
  };

  const confirmarAnulacion = async () => {
    if (!retencion) return;

    if (!motivoAnulacion || motivoAnulacion.trim().length < 5) {
      Alert.alert('Error', 'El motivo debe tener al menos 5 caracteres');
      return;
    }

    try {
      setLoading(true);
      setShowAnularModal(false);

      const result = await bizlinksApi.revertirRetencion(retencion.id, {
        motivoReversion: motivoAnulacion.trim(),
      });

      Alert.alert(
        'Retención Anulada',
        `La retención ${retencion.serieNumero} ha sido anulada exitosamente.\n\nDocumento de reversión: ${result.reversedBySerieNumero}\n\nMotivo: ${motivoAnulacion}`,
        [
          {
            text: 'OK',
            onPress: () => {
              loadRetencion();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error al anular retención:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo anular la retención'
      );
    } finally {
      setLoading(false);
      setMotivoAnulacion('');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Cargando retención...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!retencion) {
    return null;
  }

  const statusColor = STATUS_COLORS[retencion.status] || '#6B7280';
  const statusLabel = STATUS_LABELS[retencion.status] || retencion.status;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Retención</Text>
        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={refreshing}
        >
          <Ionicons
            name="refresh"
            size={24}
            color={refreshing ? '#9CA3AF' : '#8B5CF6'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: retencion.isReversed ? '#EF4444' : statusColor }]}>
              <Text style={styles.statusText}>{retencion.isReversed ? 'ANULADA' : statusLabel}</Text>
            </View>
            <Text style={styles.serieNumero}>{retencion.serieNumero}</Text>
          </View>
          {retencion.messageSunat && (
            <View style={styles.sunatMessage}>
              <Text style={styles.sunatMessageText}>
                {retencion.messageSunat.codigo}: {retencion.messageSunat.mensaje}
              </Text>
            </View>
          )}
          {retencion.isReversed && (
            <View style={styles.reversedAlert}>
              <Ionicons name="warning" size={24} color="#EF4444" />
              <View style={styles.reversedAlertContent}>
                <Text style={styles.reversedAlertTitle}>⚠️ RETENCIÓN ANULADA</Text>
                <Text style={styles.reversedAlertText}>
                  Revertida por: {retencion.reversedBySerieNumero}
                </Text>
                <Text style={styles.reversedAlertText}>
                  Motivo: {retencion.reversalReason}
                </Text>
                <Text style={styles.reversedAlertText}>
                  Fecha de anulación: {formatDateToString(new Date(retencion.reversedAt!))}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Información General */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Información General</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha de Emisión</Text>
              <Text style={styles.infoValue}>
                {formatDateToString(new Date(retencion.fechaEmision))}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Régimen</Text>
              <Text style={styles.infoValue}>
                {REGIMEN_LABELS[retencion.regimenRetencion] || retencion.regimenRetencion}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tasa de Retención</Text>
              <Text style={styles.infoValue}>{getSafeNumber(retencion.tasaRetencion).toFixed(2)}%</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Moneda</Text>
              <Text style={styles.infoValue}>{retencion.tipoMoneda || 'PEN'}</Text>
            </View>
          </View>
        </View>

        {/* Proveedor */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Proveedor</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Razón Social</Text>
              <Text style={styles.infoValue}>
                {retencion.proveedor?.razonSocialProveedor || retencion.razonSocialProveedor || '-'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>RUC</Text>
              <Text style={styles.infoValue}>
                {retencion.proveedor?.numeroDocumentoProveedor || retencion.numeroDocumentoProveedor || '-'}
              </Text>
            </View>
            {(retencion.proveedor?.direccionProveedor || retencion.direccionProveedor) && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Dirección</Text>
                <Text style={styles.infoValue}>
                  {retencion.proveedor?.direccionProveedor || retencion.direccionProveedor}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Totales */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Totales</Text>
          <View style={styles.totalesContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Pagado:</Text>
              <Text style={styles.totalValue}>
                {retencion.tipoMoneda || 'PEN'} {getSafeNumber(retencion.importeTotalPagado).toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Retenido:</Text>
              <Text style={[styles.totalValue, { color: '#EF4444' }]}>
                {retencion.tipoMoneda || 'PEN'} {getSafeNumber(retencion.importeTotalRetenido).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalLabelFinal}>Neto Pagado:</Text>
              <Text style={styles.totalValueFinal}>
                {retencion.tipoMoneda || 'PEN'}{' '}
                {(getSafeNumber(retencion.importeTotalPagado) - getSafeNumber(retencion.importeTotalRetenido)).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Documentos Relacionados */}
        {retencion.items && retencion.items.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Documentos Relacionados ({retencion.items.length})
            </Text>
            {retencion.items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNumero}>{item.numeroDocumentoRelacionado}</Text>
                  <Text style={styles.itemFecha}>
                    {formatDateToString(new Date(item.fechaEmisionDocumentoRelacionado))}
                  </Text>
                </View>
                <View style={styles.itemBody}>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemLabel}>Importe Total:</Text>
                    <Text style={styles.itemValue}>
                      {item.tipoMonedaDocumentoRelacionado}{' '}
                      {getSafeNumber(item.importeTotalDocumentoRelacionado).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemLabel}>Pago sin Retención:</Text>
                    <Text style={styles.itemValue}>
                      {item.monedaPago} {getSafeNumber(item.importePagoSinRetencion).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemLabel}>Importe Retenido:</Text>
                    <Text style={[styles.itemValue, { color: '#EF4444' }]}>
                      {item.monedaImporteRetenido} {getSafeNumber(item.importeRetenido).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.itemRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                    <Text style={styles.itemLabelBold}>Neto Pagado:</Text>
                    <Text style={styles.itemValueBold}>
                      {item.monedaMontoNetoPagado} {getSafeNumber(item.importeTotalPagarNeto).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Observaciones */}
        {retencion.observaciones && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <Text style={styles.observaciones}>{retencion.observaciones}</Text>
          </View>
        )}

        {/* Acciones */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Descargar Archivos</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionButton, downloading === 'pdf' && styles.actionButtonDisabled]}
              onPress={handleDownloadPDF}
              disabled={downloading === 'pdf'}
            >
              <Ionicons
                name="document-text"
                size={24}
                color={downloading === 'pdf' ? '#9CA3AF' : '#EF4444'}
              />
              <Text style={styles.actionButtonText}>
                {downloading === 'pdf' ? 'Descargando...' : 'PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, downloading === 'xml' && styles.actionButtonDisabled]}
              onPress={handleDownloadXML}
              disabled={downloading === 'xml'}
            >
              <Ionicons
                name="code-slash"
                size={24}
                color={downloading === 'xml' ? '#9CA3AF' : '#3B82F6'}
              />
              <Text style={styles.actionButtonText}>
                {downloading === 'xml' ? 'Descargando...' : 'XML'}
              </Text>
            </TouchableOpacity>

            {retencion.pdfUrl && (
              <TouchableOpacity style={styles.actionButton} onPress={handleOpenPDF}>
                <Ionicons name="open-outline" size={24} color="#10B981" />
                <Text style={styles.actionButtonText}>Abrir PDF</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Botón de Anular */}
        {!retencion.isReversed && (
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Acciones</Text>
            <TouchableOpacity
              style={styles.anularButton}
              onPress={handleAnularRetencion}
              disabled={loading}
            >
              <Ionicons name="ban" size={24} color="#FFFFFF" />
              <Text style={styles.anularButtonText}>
                {loading ? 'Procesando...' : 'Anular Retención'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.anularWarning}>
              ⚠️ Esta acción generará un documento de reversión y no se puede deshacer
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal de Anulación */}
      <Modal
        visible={showAnularModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAnularModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Anular Retención</Text>
            <Text style={styles.modalSubtitle}>
              {retencion?.serieNumero}
            </Text>
            <Text style={styles.modalWarning}>
              ⚠️ Esta acción generará un documento de reversión y no se puede deshacer.
            </Text>

            <Text style={styles.modalLabel}>Motivo de anulación *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ingrese el motivo (mínimo 5 caracteres)"
              value={motivoAnulacion}
              onChangeText={setMotivoAnulacion}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  setShowAnularModal(false);
                  setMotivoAnulacion('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={confirmarAnulacion}
              >
                <Text style={styles.modalButtonConfirmText}>Anular</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  serieNumero: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  sunatMessage: {
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  sunatMessageText: {
    fontSize: 12,
    color: '#92400E',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  totalesContainer: {
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalRowFinal: {
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  totalLabelFinal: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '700',
  },
  totalValueFinal: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNumero: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  itemFecha: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemBody: {
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },
  itemLabelBold: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '700',
  },
  itemValueBold: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
  },
  observaciones: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  reversedAlert: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    gap: 12,
  },
  reversedAlertContent: {
    flex: 1,
    gap: 4,
  },
  reversedAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  reversedAlertText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
  },
  anularButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  anularButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  anularWarning: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalWarning: {
    fontSize: 13,
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
