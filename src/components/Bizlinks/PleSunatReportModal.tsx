import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Alert from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';

import { DateRangePicker } from '@/components/DateRangePicker';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { config } from '@/utils/config';
import { downloadWithAuth } from '@/utils/downloadWithAuth';
import { saveAndShareFile } from '@/utils/fileDownload';
import logger from '@/utils/logger';
import {
  AVAILABLE_QUICK_FILTERS,
  getDateRangeByFilter,
  QUICK_DATE_FILTERS,
  QuickDateFilter,
  validateDateRange,
} from '@/utils/dateFilters';

export type PleLibroCode = '14.1' | '12.1' | '12.1-detallado';

interface PleLibroMeta {
  code: PleLibroCode;
  codigoLibro: string;
  title: string;
  subtitle: string;
  endpointPath: string;
  filePrefix: string;
}

const PLE_LIBRO_META: Record<PleLibroCode, PleLibroMeta> = {
  '14.1': {
    code: '14.1',
    codigoLibro: '14010000',
    title: 'Registro de Ventas 14.1',
    subtitle: 'PLE SUNAT · Libro Electrónico de Ventas e Ingresos (01/03/07/08)',
    endpointPath: '/admin/reports/registro-ventas/export',
    filePrefix: 'registro-ventas',
  },
  '12.1': {
    code: '12.1',
    codigoLibro: '12010000',
    title: 'Kardex 12.1 (Salidas)',
    subtitle: 'PLE SUNAT · Kardex Físico de Salidas (Guías de Remisión 09)',
    endpointPath: '/admin/reports/kardex/salidas/export',
    filePrefix: 'kardex-salidas',
  },
  '12.1-detallado': {
    code: '12.1-detallado',
    codigoLibro: '12010000',
    title: 'Kardex 12.1 Detallado (Salidas)',
    subtitle: 'Movimiento de almacén · Egresos (Guías 09 detalle)',
    endpointPath: '/admin/reports/kardex/salidas/export-detallado',
    filePrefix: 'movimiento-almacen-egresos',
  },
};

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const slugifyForFile = (value: string): string =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 40) || 'sede';

interface PleSunatReportModalProps {
  visible: boolean;
  onClose: () => void;
  libro: PleLibroCode;
}

const dateFromIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const formatIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplay = (iso: string): string => {
  if (!iso) return '—';
  return dateFromIso(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const periodoFromIso = (iso: string): string => iso.replace(/-/g, '').substring(0, 6);

const buildPleFileName = (
  meta: PleLibroMeta,
  fromIso: string,
  ruc: string,
  siteName: string
): string => {
  const periodo = periodoFromIso(fromIso);
  const rucPadded = (ruc || '00000000000').padStart(11, '0').slice(-11);
  const sede = slugifyForFile(siteName || 'sede');
  return `${meta.filePrefix}-${rucPadded}-${sede}-${periodo}.xlsx`;
};

export const PleSunatReportModal: React.FC<PleSunatReportModalProps> = ({
  visible,
  onClose,
  libro,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const meta = PLE_LIBRO_META[libro];
  const authStore = useAuthStore();
  const tenantStore = useTenantStore();

  const initialRange = useMemo(() => getDateRangeByFilter(QUICK_DATE_FILTERS.LAST_MONTH)!, []);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickDateFilter>(
    QUICK_DATE_FILTERS.LAST_MONTH
  );
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (visible) {
      const r = getDateRangeByFilter(QUICK_DATE_FILTERS.LAST_MONTH);
      if (r) {
        setFromDate(r.fromDate);
        setToDate(r.toDate);
      }
      setSelectedQuickFilter(QUICK_DATE_FILTERS.LAST_MONTH);
      setShowRangePicker(false);
    }
  }, [visible]);

  const handleQuickFilter = (filter: QuickDateFilter) => {
    setSelectedQuickFilter(filter);
    const r = getDateRangeByFilter(filter);
    if (r) {
      setFromDate(r.fromDate);
      setToDate(r.toDate);
    }
  };

  const rangeLabel = useMemo(
    () => `${formatDisplay(fromDate)} — ${formatDisplay(toDate)}`,
    [fromDate, toDate]
  );

  const periodoLabel = useMemo(() => {
    const p = periodoFromIso(fromDate);
    if (p.length !== 6) return '—';
    return `${p.substring(0, 4)}-${p.substring(4, 6)}`;
  }, [fromDate]);

  const handleDownload = async () => {
    const validation = validateDateRange(fromDate, toDate, 366);
    if (!validation.valid) {
      Alert.alert('Rango inválido', validation.message || 'Revisa el periodo seleccionado');
      return;
    }
    try {
      setDownloading(true);
      const ruc = tenantStore.selectedCompany?.ruc || authStore.currentCompany?.ruc || '';
      const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id || '';
      const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id || '';
      const siteName = tenantStore.selectedSite?.name || authStore.currentSite?.name || 'sede';
      if (!companyId || !siteId) {
        Alert.alert(
          'Contexto incompleto',
          'Selecciona empresa y sede antes de generar el reporte PLE'
        );
        setDownloading(false);
        return;
      }
      const url = `${config.API_URL}${meta.endpointPath}?t=${Date.now()}`;
      const blob = await downloadWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          siteId,
          fechaInicio: fromDate,
          fechaFin: toDate,
        }),
      });
      const fileName = buildPleFileName(meta, fromDate, ruc, siteName);
      await saveAndShareFile({
        blob,
        fileName,
        mimeType: XLSX_MIME_TYPE,
        dialogTitle: meta.title,
      });
      if (Platform.OS === 'web') {
        Alert.alert('Éxito', 'El archivo PLE se está descargando');
      }
      onClose();
    } catch (err: any) {
      logger.error('Error descargando reporte PLE', err);
      Alert.alert('Error', err?.message || 'No se pudo descargar el reporte PLE');
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
                <Ionicons name="close" size={24} color={theme.color.text.muted} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{meta.title}</Text>
              <View style={styles.headerButton} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Ionicons
                    name="document-text-outline"
                    size={28}
                    color={theme.color.brand.accent}
                  />
                </View>
                <View style={styles.heroTextContainer}>
                  <Text style={styles.heroTitle}>Reporte Excel (.xlsx)</Text>
                  <Text style={styles.heroSubtitle}>{meta.subtitle}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Periodo</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickFiltersContent}
                >
                  {AVAILABLE_QUICK_FILTERS.map((filter) => {
                    const isActive = selectedQuickFilter === filter.key;
                    return (
                      <TouchableOpacity
                        key={filter.key}
                        style={[styles.quickFilterChip, isActive && styles.quickFilterChipActive]}
                        onPress={() => handleQuickFilter(filter.key)}
                        disabled={downloading}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.quickFilterIcon}>{filter.icon}</Text>
                        <Text
                          style={[styles.quickFilterText, isActive && styles.quickFilterTextActive]}
                        >
                          {filter.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.quickFilterChip,
                      selectedQuickFilter === QUICK_DATE_FILTERS.CUSTOM &&
                        styles.quickFilterChipActive,
                    ]}
                    onPress={() => setShowRangePicker(true)}
                    disabled={downloading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickFilterIcon}>🗓️</Text>
                    <Text
                      style={[
                        styles.quickFilterText,
                        selectedQuickFilter === QUICK_DATE_FILTERS.CUSTOM &&
                          styles.quickFilterTextActive,
                      ]}
                    >
                      Personalizado
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => setShowRangePicker(true)}
                  activeOpacity={0.8}
                  disabled={downloading}
                >
                  <View style={styles.dateRangeLeft}>
                    <Ionicons name="calendar-outline" size={22} color={theme.color.brand.primary} />
                    <View>
                      <Text style={styles.dateRangeLabel}>Rango de fechas</Text>
                      <Text style={styles.dateRangeValue}>{rangeLabel}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.color.text.placeholder} />
                </TouchableOpacity>
              </View>

              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Libro</Text>
                  <Text style={styles.metaValue}>
                    {meta.code} · {meta.codigoLibro}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Periodo tributario</Text>
                  <Text style={styles.metaValue}>{periodoLabel}</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={theme.color.state.info.text}
                />
                <Text style={styles.infoText}>
                  El reporte se genera en formato Excel (.xlsx) con las columnas oficiales del libro
                  SUNAT para el periodo y sede seleccionados.
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
                  <ActivityIndicator size="small" color={theme.color.text.inverse} />
                ) : (
                  <Ionicons name="download-outline" size={20} color={theme.color.text.inverse} />
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
        visible={showRangePicker}
        startDate={dateFromIso(fromDate)}
        endDate={dateFromIso(toDate)}
        onConfirm={(start, end) => {
          setFromDate(formatIso(start));
          setToDate(formatIso(end));
          setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
          setShowRangePicker(false);
        }}
        onCancel={() => setShowRangePicker(false)}
        title={`Periodo para ${meta.title}`}
      />
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '88%',
      minHeight: 420,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    scrollView: { flex: 1 },
    scrollContent: { padding: theme.space[4], gap: theme.space[4] },
    heroCard: {
      flexDirection: 'row',
      gap: theme.space[3],
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.brand.accentSoft,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTextContainer: { flex: 1 },
    heroTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    heroSubtitle: { fontSize: 13, lineHeight: 19, color: theme.color.text.body },
    section: { gap: theme.space[2] },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.color.text.heading },
    quickFiltersContent: { gap: theme.space[2], paddingVertical: theme.space[1] },
    quickFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    quickFilterChipActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    quickFilterIcon: { fontSize: 14 },
    quickFilterText: { fontSize: 13, fontWeight: '600', color: theme.color.text.body },
    quickFilterTextActive: { color: theme.color.text.inverse },
    dateRangeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    dateRangeLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      flex: 1,
    },
    dateRangeLabel: { fontSize: 12, color: theme.color.text.muted, marginBottom: 2 },
    dateRangeValue: { fontSize: 15, fontWeight: '700', color: theme.color.text.heading },
    metaCard: {
      padding: theme.space[3],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metaLabel: { fontSize: 13, color: theme.color.text.muted },
    metaValue: { fontSize: 14, fontWeight: '700', color: theme.color.text.heading },
    infoBox: {
      flexDirection: 'row',
      gap: theme.space[2],
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.state.info.background,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: theme.color.state.info.text,
    },
    footer: {
      flexDirection: 'row',
      gap: theme.space[3],
      padding: theme.space[4],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: { fontSize: 14, fontWeight: '700', color: theme.color.text.body },
    downloadButton: {
      flex: 1.4,
      flexDirection: 'row',
      gap: theme.space[2],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    downloadButtonDisabled: { opacity: 0.7 },
    downloadButtonText: { fontSize: 14, fontWeight: '700', color: theme.color.text.inverse },
  });

export default PleSunatReportModal;
