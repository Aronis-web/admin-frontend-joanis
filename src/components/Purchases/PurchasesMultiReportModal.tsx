/**
 * PurchasesMultiReportModal
 *
 * Modal para configurar y descargar el reporte multi-compra (XLSX).
 * Endpoint: POST /admin/purchases/report/multi/xlsx
 * Permiso: purchases.reports.multi.download
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { SupplierSearchInput } from '@/components/Suppliers/SupplierSearchInput';
import { purchasesService } from '@/services/api';
import type { PurchasesMultiReportDto } from '@/services/api/purchases';
import { saveAndShareExcel } from '@/utils/fileDownload';
import { logger } from '@/utils/logger';
import Alert from '@/utils/alert';
import { Title, Body, Label, Caption } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { formatDateToString } from '@/utils/dateHelpers';

type DateField = 'guideDate' | 'createdAt';
type ProductStatus = 'PRELIMINARY' | 'IN_VALIDATION' | 'VALIDATED' | 'REJECTED' | 'CLOSED';

const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'PRELIMINARY', label: 'Preliminar' },
  { value: 'IN_VALIDATION', label: 'En Validación' },
  { value: 'VALIDATED', label: 'Validado' },
  { value: 'REJECTED', label: 'Rechazado' },
  { value: 'CLOSED', label: 'Cerrado' },
];

const DEFAULT_STATUSES: ProductStatus[] = ['PRELIMINARY', 'IN_VALIDATION', 'VALIDATED'];

interface PurchasesMultiReportModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PurchasesMultiReportModal: React.FC<PurchasesMultiReportModalProps> = ({
  visible,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateField, setDateField] = useState<DateField>('guideDate');
  const [supplierId, setSupplierId] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [includeStatuses, setIncludeStatuses] = useState<ProductStatus[]>(DEFAULT_STATUSES);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Reset cuando se abre
  useEffect(() => {
    if (visible) {
      setStartDate('');
      setEndDate('');
      setDateField('guideDate');
      setSupplierId('');
      setSku('');
      setIncludeStatuses(DEFAULT_STATUSES);
    }
  }, [visible]);

  const toggleStatus = useCallback((status: ProductStatus) => {
    setIncludeStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }, []);

  const canDownload = useMemo(() => {
    return Boolean(startDate && endDate) && includeStatuses.length > 0 && !downloading;
  }, [startDate, endDate, includeStatuses, downloading]);

  const clearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setSupplierId('');
    setSku('');
    setDateField('guideDate');
    setIncludeStatuses(DEFAULT_STATUSES);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!startDate || !endDate) {
      Alert.alert('Faltan datos', 'Debes seleccionar un rango de fechas.');
      return;
    }
    if (includeStatuses.length === 0) {
      Alert.alert('Faltan datos', 'Selecciona al menos un estado de producto.');
      return;
    }

    try {
      setDownloading(true);

      const filters: PurchasesMultiReportDto = {
        startDate,
        endDate,
        dateField,
        includeStatuses,
      };
      if (supplierId) filters.supplierId = supplierId;
      if (sku.trim()) filters.sku = sku.trim();

      logger.info('🔄 Descargando reporte multi-compra (xlsx)...', filters);
      const start = Date.now();

      const blob = await purchasesService.downloadMultiPurchaseReportXlsx(filters);

      logger.info('✅ XLSX descargado', {
        size: blob.size,
        ms: Date.now() - start,
      });

      const ts = new Date().getTime();
      const fileName = `reporte-compras-multi-${startDate}_${endDate}-${ts}.xlsx`;

      await saveAndShareExcel(blob, fileName, 'Reporte Multi-Compra');

      if (Platform.OS === 'web') {
        Alert.alert('Éxito', 'El reporte se está descargando');
      }
      onClose();
    } catch (error: any) {
      logger.error('Error downloading multi-purchase report:', error);
      Alert.alert('Error', error?.message || 'No se pudo descargar el reporte');
    } finally {
      setDownloading(false);
    }
  }, [startDate, endDate, dateField, supplierId, sku, includeStatuses, onClose]);

  const handleStartConfirm = useCallback((date: Date) => {
    setStartDate(formatDateToString(date));
    setShowStartPicker(false);
  }, []);

  const handleEndConfirm = useCallback((date: Date) => {
    setEndDate(formatDateToString(date));
    setShowEndPicker(false);
  }, []);

  const hasFilters = startDate || endDate || supplierId || sku;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerButton} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.color.icon.subtle} />
              </TouchableOpacity>
              <Title size="medium" style={styles.headerTitle}>
                Reporte Multi-Compra
              </Title>
              <View style={styles.headerButton} />
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Body color="secondary" style={styles.intro}>
                Configura los filtros para descargar el reporte de compras en Excel.
              </Body>

              {/* Rango de fechas */}
              <View style={styles.section}>
                <Label color="secondary" style={styles.sectionLabel}>
                  Rango de Fechas *
                </Label>
                <View style={styles.dateRow}>
                  <View style={styles.dateCol}>
                    <DatePickerButton
                      label="Fecha Inicial"
                      value={startDate}
                      onPress={() => setShowStartPicker(true)}
                      placeholder="Inicio"
                      icon="calendar-outline"
                    />
                  </View>
                  <View style={styles.dateCol}>
                    <DatePickerButton
                      label="Fecha Final"
                      value={endDate}
                      onPress={() => setShowEndPicker(true)}
                      placeholder="Fin"
                      icon="calendar-outline"
                    />
                  </View>
                </View>
              </View>

              {/* Campo de fecha */}
              <View style={styles.section}>
                <Label color="secondary" style={styles.sectionLabel}>
                  Filtrar fecha por
                </Label>
                <View style={styles.chipsRow}>
                  {[
                    { value: 'guideDate' as DateField, label: 'Fecha de Guía' },
                    { value: 'createdAt' as DateField, label: 'Fecha de Creación' },
                  ].map((opt) => {
                    const active = dateField === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setDateField(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Caption
                          color={active ? theme.color.text.inverse : 'secondary'}
                          style={styles.chipText}
                        >
                          {opt.label}
                        </Caption>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Proveedor */}
              <View style={styles.section}>
                <SupplierSearchInput
                  value={supplierId || undefined}
                  onSelect={(s) => setSupplierId(s?.id || '')}
                  label="Proveedor (Opcional)"
                  placeholder="Buscar proveedor..."
                />
              </View>

              {/* SKU */}
              <View style={styles.section}>
                <Label color="secondary" style={styles.sectionLabel}>
                  SKU (Opcional)
                </Label>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="barcode-outline"
                    size={18}
                    color={theme.color.icon.subtle}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={sku}
                    onChangeText={setSku}
                    placeholder="SKU exacto"
                    placeholderTextColor={theme.color.text.placeholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {sku.length > 0 && (
                    <TouchableOpacity onPress={() => setSku('')} hitSlop={8}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={theme.color.text.placeholder}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Estados a incluir */}
              <View style={styles.section}>
                <Label color="secondary" style={styles.sectionLabel}>
                  Estados a Incluir *
                </Label>
                <View style={styles.chipsRow}>
                  {PRODUCT_STATUS_OPTIONS.map((opt) => {
                    const active = includeStatuses.includes(opt.value);
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleStatus(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Caption
                          color={active ? theme.color.text.inverse : 'secondary'}
                          style={styles.chipText}
                        >
                          {opt.label}
                        </Caption>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Caption color="tertiary" style={styles.hint}>
                  Por defecto: Preliminar, En Validación y Validado.
                </Caption>
              </View>

              {/* Info */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={18} color={theme.color.icon.accent} />
                <Caption color="secondary" style={styles.infoText}>
                  El reporte se genera para el rango de fechas seleccionado. Las compras canceladas
                  se excluyen siempre.
                </Caption>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              {hasFilters && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearFilters}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={18} color={theme.color.brand.accent} />
                  <Caption color={theme.color.brand.accent} style={styles.clearButtonText}>
                    Limpiar
                  </Caption>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.downloadButton, !canDownload && styles.downloadButtonDisabled]}
                onPress={handleDownload}
                disabled={!canDownload}
                activeOpacity={0.8}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={theme.color.action.success.text} />
                ) : (
                  <>
                    <Ionicons name="download" size={20} color={theme.color.action.success.text} />
                    <Label style={styles.downloadButtonText}>Descargar Excel</Label>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DatePicker
        visible={showStartPicker}
        date={startDate ? new Date(startDate) : new Date()}
        onConfirm={handleStartConfirm}
        onCancel={() => setShowStartPicker(false)}
        title="Fecha Inicial"
      />
      <DatePicker
        visible={showEndPicker}
        date={endDate ? new Date(endDate) : new Date()}
        onConfirm={handleEndConfirm}
        onCancel={() => setShowEndPicker(false)}
        title="Fecha Final"
      />
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '92%',
      minHeight: '60%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
    },
    headerButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      color: theme.color.text.heading,
    },
    scrollView: {
      flexGrow: 0,
    },
    scrollContent: {
      padding: theme.space[4],
      paddingBottom: theme.space[6],
      gap: theme.space[4],
    },
    intro: {
      marginBottom: theme.space[2],
    },
    section: {
      gap: theme.space[2],
    },
    sectionLabel: {
      marginBottom: theme.space[1],
    },
    dateRow: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    dateCol: {
      flex: 1,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    chip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    chipActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    chipText: {
      fontWeight: '600',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[3],
    },
    inputIcon: {
      marginRight: theme.space[2],
    },
    input: {
      flex: 1,
      paddingVertical: theme.space[3],
      fontSize: 15,
      color: theme.color.text.body,
    },
    hint: {
      marginTop: theme.space[1],
    },
    infoBox: {
      flexDirection: 'row',
      gap: theme.space[2],
      backgroundColor: theme.color.state.info.background,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      alignItems: 'flex-start',
    },
    infoText: {
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      padding: theme.space[4],
      paddingBottom: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      gap: theme.space[2],
    },
    clearButtonText: {
      fontWeight: '600',
    },
    downloadButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.action.success.background,
      gap: theme.space[2],
    },
    downloadButtonDisabled: {
      backgroundColor: theme.color.action.success.backgroundDisabled,
      opacity: 0.7,
    },
    downloadButtonText: {
      color: theme.color.action.success.text,
      fontWeight: '700',
    },
  });

export default PurchasesMultiReportModal;
