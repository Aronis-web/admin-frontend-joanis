import React, { useState, useEffect, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bizlinksApi } from '@/services/api/bizlinks';
import { Retencion } from '@/types/bizlinks';
import { formatDateToString } from '@/utils/dateHelpers';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';

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
      <ScreenLayout navigation={navigation as any}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Cargando retención...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  if (!retencion) {
    return null;
  }

  const statusColor = STATUS_COLORS[retencion.status] || '#6B7280';
  const statusLabel = STATUS_LABELS[retencion.status] || retencion.status;

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
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="receipt" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={styles.headerTitle}>{retencion.serieNumero}</Text>
              </View>
              <Text style={styles.headerSubtitle}>Detalle de Retención</Text>
            </View>
            <View style={styles.headerActions}>
              <View style={[styles.statusBadgeHeader, { backgroundColor: retencion.isReversed ? colors.danger[500] : statusColor }]}>
                <Text style={styles.statusTextHeader}>{retencion.isReversed ? 'ANULADA' : statusLabel}</Text>
              </View>
              <TouchableOpacity
                onPress={handleRefresh}
                style={styles.refreshButtonHeader}
                disabled={refreshing}
              >
                <Ionicons
                  name="refresh"
                  size={20}
                  color={colors.neutral[0]}
                />
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
                  <Ionicons name="warning" size={24} color={colors.danger[500]} />
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
                {retencion.regimenRetencion ? (REGIMEN_LABELS[retencion.regimenRetencion] || retencion.regimenRetencion) : '-'}
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
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 14,
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
  backButtonGradient: {
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
    fontSize: 20,
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
  headerActions: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  statusBadgeHeader: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  statusTextHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[0],
    textTransform: 'uppercase',
  },
  refreshButtonHeader: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  serieNumero: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  sunatMessage: {
    padding: spacing[3],
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  sunatMessageText: {
    fontSize: 12,
    color: colors.warning[700],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  infoGrid: {
    gap: spacing[3],
  },
  infoItem: {
    gap: spacing[1],
  },
  infoLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  totalesContainer: {
    gap: spacing[2],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  totalRowFinal: {
    borderTopWidth: 2,
    borderTopColor: colors.neutral[200],
    marginTop: spacing[2],
    paddingTop: spacing[3],
  },
  totalLabel: {
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  totalLabelFinal: {
    fontSize: 16,
    color: colors.neutral[800],
    fontWeight: '700',
  },
  totalValueFinal: {
    fontSize: 18,
    color: colors.success[600],
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  itemNumero: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  itemFecha: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  itemBody: {
    gap: spacing[1],
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  itemValue: {
    fontSize: 12,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  itemLabelBold: {
    fontSize: 13,
    color: colors.neutral[800],
    fontWeight: '700',
  },
  itemValueBold: {
    fontSize: 13,
    color: colors.success[600],
    fontWeight: '700',
  },
  observaciones: {
    fontSize: 14,
    color: colors.neutral[600],
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing[3],
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing[2],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  reversedAlert: {
    flexDirection: 'row',
    backgroundColor: colors.danger[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.danger[200],
    gap: spacing[3],
  },
  reversedAlertContent: {
    flex: 1,
    gap: spacing[1],
  },
  reversedAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger[600],
    marginBottom: spacing[1],
  },
  reversedAlertText: {
    fontSize: 12,
    color: colors.danger[700],
    lineHeight: 16,
  },
  anularButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger[500],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[2],
    marginTop: spacing[2],
  },
  anularButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  anularWarning: {
    fontSize: 12,
    color: colors.danger[600],
    textAlign: 'center',
    marginTop: spacing[2],
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    width: '100%',
    maxWidth: 500,
    ...shadows.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[600],
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  modalWarning: {
    fontSize: 13,
    color: colors.danger[600],
    backgroundColor: colors.danger[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.danger[200],
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    fontSize: 14,
    color: colors.neutral[800],
    minHeight: 100,
    marginBottom: spacing[5],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    padding: spacing[3.5],
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: colors.danger[500],
    borderRadius: borderRadius.lg,
    padding: spacing[3.5],
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[0],
  },
});
