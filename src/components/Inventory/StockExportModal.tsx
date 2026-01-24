import React, { useState } from 'react';
import {
  View,
  Text,
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
        // Mobile - use sharing
        try {
          const FileSystem = require('expo-file-system');

          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            try {
              const base64data = reader.result as string;
              const base64 = base64data.split(',')[1];

              // Create a temporary file URI
              const fileUri = `${FileSystem.cacheDirectory}${filename}`;

              await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });

              console.log('✅ File saved to:', fileUri);

              // Share the file
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                  mimeType: format === 'excel'
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
          };

          reader.onerror = () => {
            console.error('Error reading blob');
            Alert.alert('Error', 'No se pudo procesar el archivo');
            setLoading(false);
          };
        } catch (error) {
          console.error('Error loading FileSystem:', error);
          Alert.alert('Error', 'No se pudo acceder al sistema de archivos');
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
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const parseDate = (dateString: string): Date => {
    if (!dateString) return new Date();
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
                <Ionicons name="download-outline" size={24} color="#6366F1" />
                <Text style={styles.headerTitle}>Exportar Reporte de Stock</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                disabled={loading}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Site Info */}
              <View style={styles.siteInfo}>
                <Ionicons name="business-outline" size={20} color="#6366F1" />
                <Text style={styles.siteInfoText}>Sede: {siteName}</Text>
              </View>

              {/* Format Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Formato de Exportación</Text>
                <View style={styles.formatContainer}>
                  <TouchableOpacity
                    style={[
                      styles.formatButton,
                      format === 'excel' && styles.formatButtonSelected,
                    ]}
                    onPress={() => setFormat('excel')}
                    disabled={loading}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={24}
                      color={format === 'excel' ? '#FFFFFF' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.formatButtonText,
                        format === 'excel' && styles.formatButtonTextSelected,
                      ]}
                    >
                      Excel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.formatButton,
                      format === 'pdf' && styles.formatButtonSelected,
                    ]}
                    onPress={() => setFormat('pdf')}
                    disabled={loading}
                  >
                    <Ionicons
                      name="document-outline"
                      size={24}
                      color={format === 'pdf' ? '#FFFFFF' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.formatButtonText,
                        format === 'pdf' && styles.formatButtonTextSelected,
                      ]}
                    >
                      PDF
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Range */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rango de Fechas (Opcional)</Text>
                <Text style={styles.sectionDescription}>
                  Filtra productos por fecha de creación
                </Text>

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
                    <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                    <Text style={styles.clearDatesText}>Limpiar fechas</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Include Prices Option */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Opciones Adicionales</Text>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setIncludePrices(!includePrices)}
                  disabled={loading}
                >
                  <View style={[styles.checkbox, includePrices && styles.checkboxChecked]}>
                    {includePrices && (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={styles.checkboxLabelContainer}>
                    <Text style={styles.checkboxLabel}>Incluir Precios y Valorización</Text>
                    <Text style={styles.checkboxDescription}>
                      Muestra costos unitarios y valor total del inventario
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#3B82F6" />
                <Text style={styles.infoText}>
                  El reporte incluirá todos los productos con stock en la sede seleccionada
                  {startDate || endDate ? ' dentro del rango de fechas especificado' : ''}.
                </Text>
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportButton, loading && styles.exportButtonDisabled]}
                onPress={handleExport}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.exportButtonText}>Exportando...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.exportButtonText}>Exportar</Text>
                  </>
                )}
              </TouchableOpacity>
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
        }}
        onCancel={() => setShowStartDatePicker(false)}
        title="Fecha de Inicio"
        maximumDate={endDate ? parseDate(endDate) : new Date()}
      />

      <DatePicker
        visible={showEndDatePicker}
        date={endDate ? parseDate(endDate) : new Date()}
        onConfirm={(date) => {
          const isoDate = date.toISOString().split('T')[0];
          setEndDate(isoDate);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
        title="Fecha de Fin"
        minimumDate={startDate ? parseDate(startDate) : undefined}
        maximumDate={new Date()}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  siteInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  formatContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  formatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  formatButtonSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  formatButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  formatButtonTextSelected: {
    color: '#FFFFFF',
  },
  clearDatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  clearDatesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkboxLabelContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
