import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { inventoryApi, ExportFormat } from '@/services/api/inventory';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  iconSizes,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Label,
  Button,
  Card,
  IconButton,
} from '@/design-system/components';

interface StockExportModalProps {
  visible: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
}

export const StockExportModal: React.FC<StockExportModalProps> = ({
  visible,
  onClose,
  siteId,
  siteName,
}) => {
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [includePrices, setIncludePrices] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);

      // Validate date range
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
          Alert.alert('Error', 'La fecha de inicio no puede ser mayor a la fecha de fin');
          setLoading(false);
          return;
        }
      }

      console.log('📊 Exporting stock report:', {
        format,
        siteId,
        startDate,
        endDate,
        includePrices,
      });

      // Call the export API
      const blob = await inventoryApi.exportStock({
        format,
        siteId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        includePrices,
      });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      const filename = `reporte-stock-${timestamp}.${extension}`;

      // For web/React Native, create a download link
      if (Platform.OS === 'web') {
        // Web download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        Alert.alert('Éxito', 'Reporte descargado correctamente');
        setLoading(false);
        onClose();
      } else {
        // Mobile - convert blob to base64 and save
        try {
          // Convert blob to base64 using FileReader (available in React Native)
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              // Remove the data URL prefix to get just the base64 data
              const base64 = dataUrl.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Create a temporary file URI
          const fileUri = `${FileSystem.cacheDirectory}${filename}`;

          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log('✅ File saved to:', fileUri);

          // Share the file
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType:
                format === 'excel'
                  ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  : 'application/pdf',
              dialogTitle: 'Guardar Reporte de Stock',
              UTI: format === 'excel' ? 'com.microsoft.excel.xlsx' : 'com.adobe.pdf',
            });
          } else {
            Alert.alert('Éxito', `Reporte guardado en: ${fileUri}`);
          }

          setLoading(false);
          onClose();
        } catch (error) {
          console.error('Error saving file:', error);
          Alert.alert('Error', 'No se pudo guardar el archivo');
          setLoading(false);
        }
      }

      // Reset form
      setFormat('excel');
      setIncludePrices(false);
      setStartDate('');
      setEndDate('');
    } catch (error: any) {
      console.error('Error exporting stock:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo exportar el reporte. Por favor, intenta nuevamente.'
      );
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const parseDate = (dateString: string): Date => {
    if (!dateString) {
      return new Date();
    }
    return new Date(dateString);
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Ionicons name="download-outline" size={iconSizes.lg} color={colors.accent[600]} />
                <Title size="medium">Exportar Reporte de Stock</Title>
              </View>
              <IconButton
                icon="close"
                onPress={handleClose}
                variant="ghost"
                size="medium"
                disabled={loading}
              />
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Site Info */}
              <View style={styles.siteInfo}>
                <Ionicons name="business-outline" size={iconSizes.md} color={colors.accent[600]} />
                <Label size="medium" color={colors.accent[700]}>Sede: {siteName}</Label>
              </View>

              {/* Format Selection */}
              <View style={styles.section}>
                <Title size="small" style={styles.sectionTitle}>Formato de Exportación</Title>
                <View style={styles.formatContainer}>
                  <TouchableOpacity
                    style={[styles.formatButton, format === 'excel' && styles.formatButtonSelected]}
                    onPress={() => setFormat('excel')}
                    disabled={loading}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={iconSizes.lg}
                      color={format === 'excel' ? colors.text.inverse : colors.text.tertiary}
                    />
                    <Label size="large" color={format === 'excel' ? colors.text.inverse : colors.text.secondary}>
                      Excel
                    </Label>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.formatButton, format === 'pdf' && styles.formatButtonSelected]}
                    onPress={() => setFormat('pdf')}
                    disabled={loading}
                  >
                    <Ionicons
                      name="document-outline"
                      size={iconSizes.lg}
                      color={format === 'pdf' ? colors.text.inverse : colors.text.tertiary}
                    />
                    <Label size="large" color={format === 'pdf' ? colors.text.inverse : colors.text.secondary}>
                      PDF
                    </Label>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Range */}
              <View style={styles.section}>
                <Title size="small" style={styles.sectionTitle}>Rango de Fechas (Opcional)</Title>
                <Caption color="secondary" style={styles.sectionDescription}>
                  Filtra productos por fecha de creación
                </Caption>

                <DatePickerButton
                  label="Fecha de Inicio"
                  value={startDate}
                  onPress={() => setShowStartDatePicker(true)}
                  placeholder="Seleccionar fecha de inicio"
                  icon="calendar-outline"
                />

                <DatePickerButton
                  label="Fecha de Fin"
                  value={endDate}
                  onPress={() => setShowEndDatePicker(true)}
                  placeholder="Seleccionar fecha de fin"
                  icon="calendar-outline"
                />

                {(startDate || endDate) && (
                  <TouchableOpacity
                    style={styles.clearDatesButton}
                    onPress={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    disabled={loading}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.danger[500]} />
                    <Label size="medium" color={colors.danger[500]}>Limpiar fechas</Label>
                  </TouchableOpacity>
                )}
              </View>

              {/* Include Prices Option */}
              <View style={styles.section}>
                <Title size="small" style={styles.sectionTitle}>Opciones Adicionales</Title>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setIncludePrices(!includePrices)}
                  disabled={loading}
                >
                  <View style={[styles.checkbox, includePrices && styles.checkboxChecked]}>
                    {includePrices && <Ionicons name="checkmark" size={18} color={colors.text.inverse} />}
                  </View>
                  <View style={styles.checkboxLabelContainer}>
                    <Label size="large" color="primary">Incluir Precios y Valorización</Label>
                    <Caption color="secondary">
                      Muestra costos unitarios y valor total del inventario
                    </Caption>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={iconSizes.md} color={colors.info[600]} />
                <Body size="small" color={colors.info[800]} style={styles.infoText}>
                  El reporte incluirá todos los productos con stock en la sede seleccionada
                  {startDate || endDate ? ' dentro del rango de fechas especificado' : ''}.
                </Body>
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.footer}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={handleClose}
                disabled={loading}
                style={{ flex: 1 }}
              />
              <Button
                title={loading ? 'Exportando...' : 'Exportar'}
                variant="primary"
                onPress={handleExport}
                disabled={loading}
                loading={loading}
                leftIcon="download-outline"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DatePicker
        visible={showStartDatePicker}
        date={startDate ? parseDate(startDate) : new Date()}
        onConfirm={(date) => {
          const isoDate = date.toISOString().split('T')[0];
          setStartDate(isoDate);
          setShowStartDatePicker(false);
          // Si la fecha de inicio es mayor que la fecha de fin, ajustar la fecha de fin
          if (endDate && date > parseDate(endDate)) {
            setEndDate(isoDate);
          }
        }}
        onCancel={() => setShowStartDatePicker(false)}
        title="Fecha de Inicio"
        maximumDate={new Date()}
      />

      <DatePicker
        visible={showEndDatePicker}
        date={endDate ? parseDate(endDate) : new Date()}
        onConfirm={(date) => {
          const isoDate = date.toISOString().split('T')[0];
          setEndDate(isoDate);
          setShowEndDatePicker(false);
          // Si la fecha de fin es menor que la fecha de inicio, ajustar la fecha de inicio
          if (startDate && date < parseDate(startDate)) {
            setStartDate(isoDate);
          }
        }}
        onCancel={() => setShowEndDatePicker(false)}
        title="Fecha de Fin"
        maximumDate={new Date()}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    height: '85%',
    paddingBottom: spacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  section: {
    marginTop: spacing[5],
  },
  sectionTitle: {
    marginBottom: spacing[2],
  },
  sectionDescription: {
    marginBottom: spacing[3],
  },
  formatContainer: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  formatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.secondary,
  },
  formatButtonSelected: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  clearDatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginTop: spacing[2],
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  checkboxLabelContainer: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.info[50],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[5],
    marginBottom: spacing[5],
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});
