import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { DateRangePicker } from '@/components/DateRangePicker';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { config } from '@/utils/config';

interface TaxDocumentsReportModalProps {
  visible: boolean;
  onClose: () => void;
}

const getDefaultStartDate = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
};

const getDefaultEndDate = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
};

const formatDateForApi = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (date: Date) => {
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const TaxDocumentsReportModal: React.FC<TaxDocumentsReportModalProps> = ({ visible, onClose }) => {
  const authStore = useAuthStore();
  const tenantStore = useTenantStore();

  const [startDate, setStartDate] = useState<Date>(getDefaultStartDate);
  const [endDate, setEndDate] = useState<Date>(getDefaultEndDate);
  const [correlative, setCorrelative] = useState('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (visible) {
      setStartDate(getDefaultStartDate());
      setEndDate(getDefaultEndDate());
      setCorrelative('');
      setShowDateRangePicker(false);
    }
  }, [visible]);

  const formattedStartDate = useMemo(() => formatDateForApi(startDate), [startDate]);
  const formattedEndDate = useMemo(() => formatDateForApi(endDate), [endDate]);

  const selectedRangeLabel = useMemo(() => {
    return `${formatDateForDisplay(startDate)} — ${formatDateForDisplay(endDate)}`;
  }, [endDate, startDate]);

  const buildHeaders = () => {
    const token = authStore.token;
    const userId = authStore.user?.id;
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

    if (!token) {
      throw new Error('No hay token de autenticación disponible');
    }

    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      'X-App-Version': config.APP_VERSION,
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };

    if (userId) {
      headers['X-User-Id'] = userId;
    }
    if (companyId) {
      headers['X-Company-Id'] = companyId;
    }
    if (siteId) {
      headers['X-Site-Id'] = siteId;
    }

    return headers;
  };

  const buildReportUrl = () => {
    const params = new URLSearchParams({
      startDate: formattedStartDate,
      endDate: formattedEndDate,
    });

    const cleanCorrelative = correlative.trim();
    if (cleanCorrelative) {
      params.append('correlative', cleanCorrelative);
    }

    params.append('t', Date.now().toString());

    return `/sales/reports/tax-sales?${params.toString()}`;
  };

  const downloadBlobOnWeb = (blob: Blob, fileName: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  };

  const shareBlobOnMobile = async (blob: Blob, fileName: string) => {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Reporte de Documentos Tributarios',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
    } else {
      Alert.alert('Éxito', `Reporte guardado en: ${fileUri}`);
    }
  };

  const handleDownload = async () => {
    if (startDate > endDate) {
      Alert.alert('Rango inválido', 'La fecha inicial no puede ser mayor que la fecha final.');
      return;
    }

    try {
      setDownloading(true);
      const reportPath = buildReportUrl();
      const response = await fetch(`${config.API_URL}${reportPath}`, {
        method: 'GET',
        headers: buildHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        Alert.alert('Error', errorText || `No se pudo descargar el reporte (${response.status})`);
        return;
      }

      const excelBlob = await response.blob();
      const fileName = `reporte-documentos-tributarios-${formattedStartDate}-${formattedEndDate}.xlsx`;

      if (Platform.OS === 'web') {
        downloadBlobOnWeb(excelBlob, fileName);
        Alert.alert('Éxito', 'El reporte se está descargando');
      } else {
        await shareBlobOnMobile(excelBlob, fileName);
      }

      onClose();
    } catch (error: any) {
      console.error('Error downloading tax documents report:', error);
      Alert.alert('Error', error.message || 'No se pudo descargar el reporte de documentos tributarios');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerButton} disabled={downloading}>
                <Ionicons name="close" size={24} color={colors.neutral[500]} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Reporte de Documentos Tributarios</Text>
              <View style={styles.headerButton} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Ionicons name="document-text-outline" size={28} color={colors.accent[600]} />
                </View>
                <View style={styles.heroTextContainer}>
                  <Text style={styles.heroTitle}>Reporte tributario en Excel</Text>
                  <Text style={styles.heroSubtitle}>
                    Incluye Facturas, Boletas y Notas de Crédito con hojas de resumen y detalle.
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rango de fechas</Text>
                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => setShowDateRangePicker(true)}
                  activeOpacity={0.8}
                  disabled={downloading}
                >
                  <View style={styles.dateRangeLeft}>
                    <Ionicons name="calendar-outline" size={22} color={colors.primary[600]} />
                    <View>
                      <Text style={styles.dateRangeLabel}>Periodo del reporte</Text>
                      <Text style={styles.dateRangeValue}>{selectedRangeLabel}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Comprobante específico (opcional)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="receipt-outline" size={20} color={colors.neutral[400]} />
                  <TextInput
                    style={styles.input}
                    value={correlative}
                    onChangeText={setCorrelative}
                    placeholder="Ej: F001-00000001"
                    placeholderTextColor={colors.neutral[400]}
                    autoCapitalize="characters"
                    editable={!downloading}
                  />
                  {correlative.length > 0 && (
                    <TouchableOpacity onPress={() => setCorrelative('')} disabled={downloading}>
                      <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.info[600]} />
                <Text style={styles.infoText}>
                  Si tu sesión tiene sede seleccionada, el reporte se restringirá a esa sede automáticamente.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={downloading}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
                onPress={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <Ionicons name="download-outline" size={20} color={colors.neutral[0]} />
                )}
                <Text style={styles.downloadButtonText}>
                  {downloading ? 'Descargando...' : 'Descargar Excel'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DateRangePicker
        visible={showDateRangePicker}
        startDate={startDate}
        endDate={endDate}
        onConfirm={(start, end) => {
          setStartDate(start);
          setEndDate(end);
          setShowDateRangePicker(false);
        }}
        onCancel={() => setShowDateRangePicker(false)}
        title="Seleccionar rango del reporte"
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '88%',
    minHeight: 420,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[4],
  },
  heroCard: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: spacing[1],
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.neutral[600],
  },
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  dateRangeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing[0.5],
  },
  dateRangeValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  input: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.info[50],
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.info[700],
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    backgroundColor: colors.surface.primary,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  downloadButton: {
    flex: 1.4,
    flexDirection: 'row',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[0],
  },
});

export default TaxDocumentsReportModal;
