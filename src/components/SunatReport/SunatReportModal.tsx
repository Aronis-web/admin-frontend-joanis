/**
 * SunatReportModal
 *
 * Modal reutilizable para generar y descargar el reporte consolidado (Excel)
 * de los registros SIRE: compras/ventas mapeadas y compras/ventas declaradas.
 *
 * Permite elegir:
 *   - Rango de períodos (perIni → perFin, AAAAMM).
 *   - Conjuntos de datos a incluir (datasets).
 *   - Moneda y estado (opcionales).
 *   - Si se incluye el detalle línea a línea.
 *
 * Dispara `GET /sunat-reports/export` y guarda/comparte el .xlsx resultante.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { sunatReportsApi, type SunatReportDataset } from '@/services/api';
import {
  QuickDateRangeField,
  getDefaultQuickDateRange,
  type QuickDateRangeValue,
} from '@/components/common/QuickDateRangeField';
import { saveAndShareExcel } from '@/utils/fileDownload';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

// ============================================================================
// Constantes
// ============================================================================

const DATASET_OPTIONS: Array<{
  value: SunatReportDataset;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'compras-mapeadas', label: 'Compras mapeadas (RCE)', icon: 'cart-outline' },
  { value: 'ventas-mapeadas', label: 'Ventas mapeadas (RVIE)', icon: 'pricetags-outline' },
  { value: 'compras-declaradas', label: 'Compras declaradas', icon: 'cloud-done-outline' },
  { value: 'ventas-declaradas', label: 'Ventas declaradas', icon: 'cloud-done-outline' },
];

const MONEDA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'PEN', label: 'Soles (PEN)' },
  { value: 'USD', label: 'Dólares (USD)' },
];

// ============================================================================
// Utils
// ============================================================================

/** Deriva el período AAAAMM a partir de una fecha ISO (YYYY-MM-DD). */
const periodoFromIso = (iso: string): string => iso.slice(0, 4) + iso.slice(5, 7);

// ============================================================================
// Props
// ============================================================================

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Título del modal, ej. "Descargar reporte · Compras". */
  title: string;
  /** Datasets preseleccionados al abrir. */
  defaultDatasets: SunatReportDataset[];
  /** Nombre base del archivo (sin extensión), ej. "reporte-sire-compras". */
  fileBaseName: string;
}

// ============================================================================
// Component
// ============================================================================

export const SunatReportModal: React.FC<Props> = ({
  visible,
  onClose,
  title,
  defaultDatasets,
  fileBaseName,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [dateRange, setDateRange] = useState<QuickDateRangeValue>(getDefaultQuickDateRange);
  const [moneda, setMoneda] = useState('');
  const [estado, setEstado] = useState('');
  const [datasets, setDatasets] = useState<SunatReportDataset[]>(defaultDatasets);
  const [incluirDetalle, setIncluirDetalle] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Reinicia datasets y rango (por defecto "este mes") cada vez que se abre.
  const defaultKey = useMemo(() => defaultDatasets.join(','), [defaultDatasets]);
  React.useEffect(() => {
    if (visible) {
      setDatasets(defaultDatasets);
      setDateRange(getDefaultQuickDateRange());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, defaultKey]);

  const toggleDataset = useCallback((value: SunatReportDataset) => {
    setDatasets((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  }, []);

  const handleDownload = useCallback(async () => {
    if (downloading) return;

    if (datasets.length === 0) {
      Alert.alert('Datos incompletos', 'Selecciona al menos un conjunto de datos a exportar.');
      return;
    }

    setDownloading(true);
    try {
      const blob = await sunatReportsApi.exportReport({
        perIni: periodoFromIso(dateRange.fromDate),
        perFin: periodoFromIso(dateRange.toDate),
        moneda: moneda || undefined,
        estado: estado.trim() || undefined,
        datasets,
        incluirDetalle,
      });

      const ts = new Date().getTime();
      const fileName = `${fileBaseName}-${ts}.xlsx`;
      await saveAndShareExcel(blob, fileName, title);

      if (Platform.OS === 'web') {
        Alert.alert('Éxito', 'El reporte se está descargando.');
      }
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo generar el reporte';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
      logger.error('Error al exportar reporte SUNAT', e);
    } finally {
      setDownloading(false);
    }
  }, [
    downloading,
    datasets,
    dateRange,
    moneda,
    estado,
    incluirDetalle,
    fileBaseName,
    title,
    onClose,
  ]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="download-outline" size={20} color={theme.color.brand.accent} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={theme.color.icon.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* Datasets */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Conjuntos de datos</Text>
              {DATASET_OPTIONS.map((opt) => {
                const selected = datasets.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.datasetRow, selected && styles.datasetRowSelected]}
                    onPress={() => toggleDataset(opt.value)}
                    disabled={downloading}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={18}
                      color={selected ? theme.color.brand.accent : theme.color.text.muted}
                    />
                    <Text style={[styles.datasetText, selected && styles.datasetTextSelected]}>
                      {opt.label}
                    </Text>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={selected ? theme.color.brand.accent : theme.color.icon.muted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Rango de fechas (estilo dashboard) */}
            <View style={styles.section}>
              <QuickDateRangeField
                label="Rango de fechas"
                value={dateRange}
                onChange={setDateRange}
                disabled={downloading}
                maximumDate={new Date()}
              />
              <Text style={styles.hintText}>
                El reporte agrupa por período (AAAAMM) según el rango elegido.
              </Text>
            </View>

            {/* Moneda */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Moneda</Text>
              <View style={styles.chipRow}>
                {MONEDA_OPTIONS.map((opt) => {
                  const selected = moneda === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value || 'ALL'}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setMoneda(opt.value)}
                      disabled={downloading}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Estado */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Estado · opcional</Text>
              <TextInput
                style={styles.textInput}
                value={estado}
                onChangeText={(v) => setEstado(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                placeholder="Ej. 1 anotado, 2 anulado…"
                placeholderTextColor={theme.color.text.placeholder}
                editable={!downloading}
                maxLength={2}
              />
            </View>

            {/* Incluir detalle */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setIncluirDetalle((v) => !v)}
              disabled={downloading}
            >
              <Ionicons
                name={incluirDetalle ? 'checkbox' : 'square-outline'}
                size={22}
                color={incluirDetalle ? theme.color.brand.accent : theme.color.icon.muted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Incluir detalle</Text>
                <Text style={styles.toggleHint}>
                  Agrega el desglose línea a línea de cada comprobante.
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Botón descargar */}
          <TouchableOpacity
            style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color={theme.color.action.primary.text} />
            ) : (
              <>
                <Ionicons name="download" size={20} color={theme.color.action.primary.text} />
                <Text style={styles.downloadButtonText}>Descargar Excel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '88%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[3],
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    headerTitleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    content: {
      padding: theme.space[4],
      gap: theme.space[4],
    },
    section: {
      gap: theme.space[2],
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    datasetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    datasetRowSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: `${theme.color.brand.accent}10`,
    },
    datasetText: {
      flex: 1,
      fontSize: 14,
      color: theme.color.text.body,
    },
    datasetTextSelected: {
      color: theme.color.text.heading,
      fontWeight: '600',
    },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.space[2],
    },
    periodoField: {
      flex: 1,
      gap: theme.space[1],
    },
    rangeArrow: {
      paddingBottom: theme.space[3],
    },
    fieldLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
      paddingVertical: Platform.OS === 'ios' ? theme.space[3] : theme.space[2],
      fontSize: 15,
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
    },
    hintText: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    chip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    chipSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: `${theme.color.brand.accent}10`,
    },
    chipText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    chipTextSelected: {
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    toggleTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    toggleHint: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    downloadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      margin: theme.space[4],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.action.primary.background,
    },
    downloadButtonDisabled: {
      opacity: 0.6,
    },
    downloadButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.action.primary.text,
    },
  });

export default SunatReportModal;
