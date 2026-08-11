import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bizlinksApi } from '@/services/api/bizlinks';
import { Retencion } from '@/types/bizlinks';
import { formatDateToString } from '@/utils/dateHelpers';
import Alert from '@/utils/alert';
import { saveAndSharePdf, saveAndShareFile } from '@/utils/fileDownload';
import { isWeb } from '@/utils/platform';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

type Props = NativeStackScreenProps<any, 'RetencionDetail'>;

const buildStatusColors = (theme: Theme): Record<string, string> => ({
  QUEUED: theme.color.text.placeholder,
  SENDING: theme.color.icon.warning,
  SENT: theme.color.icon.accent,
  ACCEPTED: theme.color.icon.success,
  REJECTED: theme.color.icon.danger,
  ERROR: theme.color.text.danger,
});

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const STATUS_COLORS = buildStatusColors(theme);
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
      retencion.numeroDocumentoProveedor =
        parseXmlData(xml, 'numeroDocumentoProveedor') || undefined;
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

  const loadRetencion = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 [RETENCION DETAIL] Loading retencion:', retencionId);
      const data = await bizlinksApi.getRetencionById(retencionId);
      console.log('📦 [RETENCION DETAIL] Retencion data received:', {
        id: data.id,
        serieNumero: data.serieNumero,
        hasPdfUrl: !!data.pdfUrl,
        pdfUrl: data.pdfUrl,
        hasXmlSignUrl: !!data.xmlSignUrl,
        xmlSignUrl: data.xmlSignUrl,
        hasPayloadXml: !!data.payloadXml,
      });
      const enrichedData = enrichRetencionData(data);
      console.log('✨ [RETENCION DETAIL] Enriched data:', {
        razonSocialProveedor: enrichedData.razonSocialProveedor,
        numeroDocumentoProveedor: enrichedData.numeroDocumentoProveedor,
        tasaRetencion: enrichedData.tasaRetencion,
        importeTotalRetenido: enrichedData.importeTotalRetenido,
        importeTotalPagado: enrichedData.importeTotalPagado,
        tipoMoneda: enrichedData.tipoMoneda,
      });
      setRetencion(enrichedData);
    } catch (error: any) {
      console.error('❌ [RETENCION DETAIL] Error loading retencion:', error);
      Alert.alert('Error', error.message || 'Error al cargar retención');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [retencionId]);

  // Cargar solo cuando la pantalla recibe el foco
  useFocusEffect(
    useCallback(() => {
      console.log('👁️ [RETENCION DETAIL] Screen focused - loading retencion');
      loadRetencion();
    }, [loadRetencion])
  );

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

    // En móvil, si hay pdfUrl pública, abrir en navegador
    if (retencion.pdfUrl && !isWeb()) {
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

    try {
      setDownloading('pdf');
      const blob = await bizlinksApi.downloadRetencionPDF(retencion.id);
      const fileName = `${retencion.serieNumero}.pdf`;

      await saveAndSharePdf(blob, fileName, `Retención ${retencion.serieNumero}`);
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

    // En móvil, si hay xmlSignUrl pública, abrir en navegador
    if (retencion.xmlSignUrl && !isWeb()) {
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

    try {
      setDownloading('xml');
      const blob = await bizlinksApi.downloadRetencionXML(retencion.id);
      const fileName = `${retencion.serieNumero}.xml`;

      await saveAndShareFile({
        blob,
        fileName,
        mimeType: 'application/xml',
        dialogTitle: `Retención ${retencion.serieNumero}`,
      });
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
      Alert.alert('Error', error.message || 'No se pudo anular la retención');
    } finally {
      setLoading(false);
      setMotivoAnulacion('');
    }
  };

  if (loading) {
    return (
      <ScreenLayout navigation={navigation as any}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={styles.loadingText}>Cargando retención...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  if (!retencion) {
    return null;
  }

  const statusColor = STATUS_COLORS[retencion.status] || theme.color.text.muted;
  const statusLabel = STATUS_LABELS[retencion.status] || retencion.status;

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={theme.color.brand.onHeader} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="receipt" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={styles.headerTitle}>{retencion.serieNumero}</Text>
              </View>
              <Text style={styles.headerSubtitle}>Detalle de Retención</Text>
            </View>
            <View style={styles.headerActions}>
              <View
                style={[
                  styles.statusBadgeHeader,
                  { backgroundColor: retencion.isReversed ? theme.color.icon.danger : statusColor },
                ]}
              >
                <Text style={styles.statusTextHeader}>
                  {retencion.isReversed ? 'ANULADA' : statusLabel}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleRefresh}
                style={styles.refreshButtonHeader}
                disabled={refreshing}
              >
                <Ionicons name="refresh" size={20} color={theme.color.brand.onHeader} />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Status Card - Mensaje SUNAT */}
          {(retencion.messageSunat || retencion.isReversed) && (
            <View style={styles.card}>
              {retencion.messageSunat && (
                <View style={styles.sunatMessage}>
                  <Text style={styles.sunatMessageText}>
                    {retencion.messageSunat.codigo}: {retencion.messageSunat.mensaje}
                  </Text>
                </View>
              )}
              {retencion.isReversed && (
                <View style={styles.reversedAlert}>
                  <Ionicons name="warning" size={24} color={theme.color.icon.danger} />
                  <View style={styles.reversedAlertContent}>
                    <Text style={styles.reversedAlertTitle}>⚠️ RETENCIÓN ANULADA</Text>
                    <Text style={styles.reversedAlertText}>
                      Revertida por: {retencion.reversedBySerieNumero}
                    </Text>
                    <Text style={styles.reversedAlertText}>Motivo: {retencion.reversalReason}</Text>
                    <Text style={styles.reversedAlertText}>
                      Fecha de anulación: {formatDateToString(new Date(retencion.reversedAt!))}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

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
                  {retencion.regimenRetencion
                    ? REGIMEN_LABELS[retencion.regimenRetencion] || retencion.regimenRetencion
                    : '-'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Tasa de Retención</Text>
                <Text style={styles.infoValue}>
                  {getSafeNumber(retencion.tasaRetencion).toFixed(2)}%
                </Text>
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
                  {retencion.proveedor?.razonSocialProveedor ||
                    retencion.razonSocialProveedor ||
                    '-'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>RUC</Text>
                <Text style={styles.infoValue}>
                  {retencion.proveedor?.numeroDocumentoProveedor ||
                    retencion.numeroDocumentoProveedor ||
                    '-'}
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
                  {retencion.tipoMoneda || 'PEN'}{' '}
                  {getSafeNumber(retencion.importeTotalPagado).toFixed(2)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Retenido:</Text>
                <Text style={[styles.totalValue, { color: theme.color.text.danger }]}>
                  {retencion.tipoMoneda || 'PEN'}{' '}
                  {getSafeNumber(retencion.importeTotalRetenido).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.totalRow, styles.totalRowFinal]}>
                <Text style={styles.totalLabelFinal}>Neto Pagado:</Text>
                <Text style={styles.totalValueFinal}>
                  {retencion.tipoMoneda || 'PEN'}{' '}
                  {(
                    getSafeNumber(retencion.importeTotalPagado) -
                    getSafeNumber(retencion.importeTotalRetenido)
                  ).toFixed(2)}
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
                      <Text style={[styles.itemValue, { color: theme.color.text.danger }]}>
                        {item.monedaImporteRetenido}{' '}
                        {getSafeNumber(item.importeRetenido).toFixed(2)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.itemRow,
                        {
                          marginTop: 8,
                          paddingTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: theme.color.border.subtle,
                        },
                      ]}
                    >
                      <Text style={styles.itemLabelBold}>Neto Pagado:</Text>
                      <Text style={styles.itemValueBold}>
                        {item.monedaMontoNetoPagado}{' '}
                        {getSafeNumber(item.importeTotalPagarNeto).toFixed(2)}
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
                  color={downloading === 'pdf' ? theme.color.icon.disabled : theme.color.icon.danger}
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
                  color={downloading === 'xml' ? theme.color.icon.disabled : theme.color.icon.accent}
                />
                <Text style={styles.actionButtonText}>
                  {downloading === 'xml' ? 'Descargando...' : 'XML'}
                </Text>
              </TouchableOpacity>

              {retencion.pdfUrl && (
                <TouchableOpacity style={styles.actionButton} onPress={handleOpenPDF}>
                  <Ionicons name="open-outline" size={24} color={theme.color.icon.success} />
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
                <Ionicons name="ban" size={24} color={theme.color.text.inverse} />
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
              <Text style={styles.modalSubtitle}>{retencion?.serieNumero}</Text>
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

                <TouchableOpacity style={styles.modalButtonConfirm} onPress={confirmarAnulacion}>
                  <Text style={styles.modalButtonConfirmText}>Anular</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.space[3],
    fontSize: 14,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[5],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: theme.space[2],
  },
  statusBadgeHeader: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1.5],
    borderRadius: theme.radii.full,
  },
  statusTextHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    textTransform: 'uppercase',
  },
  refreshButtonHeader: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.space[4],
    paddingBottom: theme.space[10],
  },
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space[3],
  },
  statusBadge: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1.5],
    borderRadius: theme.radii.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
  serieNumero: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  sunatMessage: {
    padding: theme.space[3],
    backgroundColor: theme.color.state.warning.background,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },
  sunatMessageText: {
    fontSize: 12,
    color: theme.color.state.warning.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[3],
  },
  infoGrid: {
    gap: theme.space[3],
  },
  infoItem: {
    gap: theme.space[1],
  },
  infoLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: theme.color.text.body,
    fontWeight: '600',
  },
  totalesContainer: {
    gap: theme.space[2],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space[2],
  },
  totalRowFinal: {
    borderTopWidth: 2,
    borderTopColor: theme.color.border.subtle,
    marginTop: theme.space[2],
    paddingTop: theme.space[3],
  },
  totalLabel: {
    fontSize: 14,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 14,
    color: theme.color.text.body,
    fontWeight: '600',
  },
  totalLabelFinal: {
    fontSize: 16,
    color: theme.color.text.heading,
    fontWeight: '700',
  },
  totalValueFinal: {
    fontSize: 18,
    color: theme.color.text.success,
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: theme.radii.lg,
    padding: theme.space[3],
    marginBottom: theme.space[2],
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[2],
  },
  itemNumero: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  itemFecha: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  itemBody: {
    gap: theme.space[1],
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  itemValue: {
    fontSize: 12,
    color: theme.color.text.body,
    fontWeight: '600',
  },
  itemLabelBold: {
    fontSize: 13,
    color: theme.color.text.heading,
    fontWeight: '700',
  },
  itemValueBold: {
    fontSize: 13,
    color: theme.color.text.success,
    fontWeight: '700',
  },
  observaciones: {
    fontSize: 14,
    color: theme.color.text.muted,
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: theme.space[3],
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space[4],
    backgroundColor: theme.color.surface.subtle,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    gap: theme.space[2],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  reversedAlert: {
    flexDirection: 'row',
    backgroundColor: theme.color.state.danger.background,
    borderRadius: theme.radii.lg,
    padding: theme.space[3],
    marginTop: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
    gap: theme.space[3],
  },
  reversedAlertContent: {
    flex: 1,
    gap: theme.space[1],
  },
  reversedAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text.danger,
    marginBottom: theme.space[1],
  },
  reversedAlertText: {
    fontSize: 12,
    color: theme.color.state.danger.text,
    lineHeight: 16,
  },
  anularButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.action.danger.background,
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    gap: theme.space[2],
    marginTop: theme.space[2],
  },
  anularButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.action.danger.text,
  },
  anularWarning: {
    fontSize: 12,
    color: theme.color.text.danger,
    textAlign: 'center',
    marginTop: theme.space[2],
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space[4],
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    padding: theme.space[6],
    width: '100%',
    maxWidth: 500,
    ...theme.shadow.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[2],
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.brand.accent,
    marginBottom: theme.space[4],
    textAlign: 'center',
  },
  modalWarning: {
    fontSize: 13,
    color: theme.color.text.danger,
    backgroundColor: theme.color.state.danger.background,
    padding: theme.space[3],
    borderRadius: theme.radii.lg,
    marginBottom: theme.space[4],
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.lg,
    padding: theme.space[3],
    fontSize: 14,
    color: theme.color.text.body,
    minHeight: 100,
    marginBottom: theme.space[5],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: theme.color.action.secondary.background,
    borderRadius: theme.radii.lg,
    padding: theme.space[3.5],
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.action.secondary.text,
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: theme.color.action.danger.background,
    borderRadius: theme.radii.lg,
    padding: theme.space[3.5],
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.action.danger.text,
  },
});
