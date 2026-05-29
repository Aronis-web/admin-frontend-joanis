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
import { apiClient } from '@/services/api/client';
import logger from '@/utils/logger';

interface TaxSeriesItem {
  series: string;
  documentTypeCode: string;
  documentTypeName: string;
  count: number;
}

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

export const TaxDocumentsReportModal: React.FC<TaxDocumentsReportModalProps> = ({
  visible,
  onClose,
}) => {
  const authStore = useAuthStore();
  const tenantStore = useTenantStore();

  const [startDate, setStartDate] = useState<Date>(getDefaultStartDate);
  const [endDate, setEndDate] = useState<Date>(getDefaultEndDate);
  const [correlative, setCorrelative] = useState('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [seriesExpanded, setSeriesExpanded] = useState(false);
  const [seriesList, setSeriesList] = useState<TaxSeriesItem[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStartDate(getDefaultStartDate());
      setEndDate(getDefaultEndDate());
      setCorrelative('');
      setShowDateRangePicker(false);
      setSeriesExpanded(false);
      setSelectedSeries([]);
      setSeriesError(null);
      loadSeries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadSeries = async () => {
    try {
      setLoadingSeries(true);
      setSeriesError(null);
      const response = await apiClient.get<{ data: TaxSeriesItem[] } | TaxSeriesItem[]>(
        '/sales/reports/tax-sales/series'
      );
      const data = Array.isArray(response) ? response : response?.data || [];
      setSeriesList(Array.isArray(data) ? data : []);
    } catch (error: any) {
      logger.error('Error loading tax series', error);
      setSeriesError('No se pudieron cargar las series disponibles');
      setSeriesList([]);
    } finally {
      setLoadingSeries(false);
    }
  };

  const toggleSeries = (series: string) => {
    setSelectedSeries((prev) =>
      prev.includes(series) ? prev.filter((s) => s !== series) : [...prev, series]
    );
  };

  const selectAllSeries = () => {
    setSelectedSeries(seriesList.map((s) => s.series));
  };

  const clearAllSeries = () => {
    setSelectedSeries([]);
  };

  const seriesByType = useMemo(() => {
    const groups: Record<string, { name: string; items: TaxSeriesItem[] }> = {};
    seriesList.forEach((item) => {
      const key = item.documentTypeCode;
      if (!groups[key]) {
        groups[key] = { name: item.documentTypeName, items: [] };
      }
      groups[key].items.push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [seriesList]);

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

    if (selectedSeries.length > 0) {
      params.append('series', selectedSeries.join(','));
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
      Alert.alert(
        'Error',
        error.message || 'No se pudo descargar el reporte de documentos tributarios'
      );
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
              <TouchableOpacity
                onPress={onClose}
                style={styles.headerButton}
                disabled={downloading}
              >
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

              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setSeriesExpanded((v) => !v)}
                  activeOpacity={0.8}
                  disabled={downloading}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <Ionicons name="layers-outline" size={20} color={colors.primary[600]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitle}>Filtrar por series (opcional)</Text>
                      <Text style={styles.collapsibleSubtitle}>
                        {selectedSeries.length === 0
                          ? 'Todas las series del tenant'
                          : `${selectedSeries.length} serie${selectedSeries.length === 1 ? '' : 's'} seleccionada${selectedSeries.length === 1 ? '' : 's'}`}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={seriesExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.neutral[400]}
                  />
                </TouchableOpacity>

                {seriesExpanded && (
                  <View style={styles.seriesPanel}>
                    {loadingSeries ? (
                      <View style={styles.seriesLoading}>
                        <ActivityIndicator size="small" color={colors.primary[600]} />
                        <Text style={styles.seriesLoadingText}>Cargando series...</Text>
                      </View>
                    ) : seriesError ? (
                      <View style={styles.seriesEmpty}>
                        <Text style={styles.seriesEmptyText}>{seriesError}</Text>
                        <TouchableOpacity onPress={loadSeries} style={styles.retryButton}>
                          <Text style={styles.retryButtonText}>Reintentar</Text>
                        </TouchableOpacity>
                      </View>
                    ) : seriesList.length === 0 ? (
                      <View style={styles.seriesEmpty}>
                        <Text style={styles.seriesEmptyText}>No hay series disponibles</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.seriesActions}>
                          <TouchableOpacity onPress={selectAllSeries} disabled={downloading}>
                            <Text style={styles.seriesActionText}>Seleccionar todas</Text>
                          </TouchableOpacity>
                          <Text style={styles.seriesActionSeparator}>·</Text>
                          <TouchableOpacity onPress={clearAllSeries} disabled={downloading}>
                            <Text style={styles.seriesActionText}>Limpiar</Text>
                          </TouchableOpacity>
                        </View>

                        {seriesByType.map(([code, group]) => (
                          <View key={code} style={styles.seriesGroup}>
                            <Text style={styles.seriesGroupTitle}>
                              {group.name} ({code})
                            </Text>
                            {group.items.map((item) => {
                              const isSelected = selectedSeries.includes(item.series);
                              return (
                                <TouchableOpacity
                                  key={item.series}
                                  style={styles.seriesRow}
                                  onPress={() => toggleSeries(item.series)}
                                  disabled={downloading}
                                  activeOpacity={0.7}
                                >
                                  <View
                                    style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                                  >
                                    {isSelected && (
                                      <Ionicons
                                        name="checkmark"
                                        size={14}
                                        color={colors.neutral[0]}
                                      />
                                    )}
                                  </View>
                                  <Text style={styles.seriesRowLabel}>{item.series}</Text>
                                  <Text style={styles.seriesRowCount}>
                                    {item.count.toLocaleString('es-PE')} docs
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.info[600]} />
                <Text style={styles.infoText}>
                  Si tu sesión tiene sede seleccionada, el reporte se restringirá a esa sede
                  automáticamente.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={downloading}
              >
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
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  collapsibleHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  collapsibleSubtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  seriesPanel: {
    marginTop: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing[2],
  },
  seriesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    justifyContent: 'center',
  },
  seriesLoadingText: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  seriesEmpty: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  seriesEmptyText: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  retryButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary[700],
  },
  seriesActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  seriesActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[600],
  },
  seriesActionSeparator: {
    fontSize: 12,
    color: colors.neutral[300],
  },
  seriesGroup: {
    gap: spacing[1],
  },
  seriesGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[600],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing[1],
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
  },
  checkboxSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  seriesRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  seriesRowCount: {
    fontSize: 12,
    color: colors.neutral[500],
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
