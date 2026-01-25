import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { productsApi } from '@/services/api/products';
import logger from '@/utils/logger';

interface BulkUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode: 'products' | 'campaign';
  campaignProducts?: Array<{ productId: string; product?: { correlativeNumber?: number } }>;
}

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
  visible,
  onClose,
  onSuccess,
  mode,
  campaignProducts,
}) => {
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const handleDownloadFormat = async () => {
    try {
      setLoading(true);
      logger.info('📥 Descargando formato de actualización masiva...');

      let filters: any = {};

      if (mode === 'products') {
        // Para productos, usar filtrado por fechas
        if (fromDate) {
          filters.fromDate = fromDate;
        }
        if (toDate) {
          filters.toDate = toDate;
        }
      } else if (mode === 'campaign' && campaignProducts) {
        // Para campaña, enviar los correlativos de los productos
        const correlatives = campaignProducts
          .map((cp) => cp.product?.correlativeNumber)
          .filter((num): num is number => num !== undefined && num !== null);

        if (correlatives.length > 0) {
          filters.correlatives = correlatives;
        }
      }

      const response = await productsApi.downloadBulkUpdateFormat(filters);

      // Generate filename with current date
      const today = new Date().toISOString().split('T')[0];
      const filename = `productos_actualizacion_${today}.xlsx`;

      if (Platform.OS === 'web') {
        // Web: Create download link
        const blobUrl = URL.createObjectURL(response);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert(
          'Éxito',
          'Formato descargado correctamente. Modifica el archivo y súbelo para actualizar los productos.'
        );
      } else {
        // Mobile: Use new FileSystem API (same as CampaignDetailScreen)
        const timestamp = new Date().getTime();
        const fileName = `productos_actualizacion_${timestamp}.xlsx`;
        const file = new FileSystem.File(FileSystem.Paths.document, fileName);

        // Convert blob to array buffer using FileReader
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(response);
        });

        // Write to file
        await file.create();
        const writer = file.writableStream().getWriter();
        await writer.write(new Uint8Array(arrayBuffer));
        await writer.close();

        logger.info('✅ Archivo guardado exitosamente:', file.uri);

        // Share the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Formato de Actualización',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          });
        } else {
          Alert.alert('Éxito', `Archivo guardado en: ${file.uri}`);
        }

        Alert.alert(
          'Éxito',
          'Formato descargado correctamente. Modifica el archivo y súbelo para actualizar los productos.'
        );
      }
    } catch (error: any) {
      logger.error('❌ Error descargando formato:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Error al descargar el formato de actualización'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file);
        logger.info('📄 Archivo seleccionado:', file.name);
      }
    } catch (error) {
      logger.error('❌ Error seleccionando archivo:', error);
      Alert.alert('Error', 'Error al seleccionar el archivo');
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Por favor selecciona un archivo primero');
      return;
    }

    try {
      setLoading(true);
      logger.info('📤 Subiendo archivo de actualización masiva...');

      let fileToUpload: any;

      if (Platform.OS === 'web') {
        // Web: Use the file directly
        fileToUpload = selectedFile;
      } else {
        // Mobile: Create file object from URI
        fileToUpload = {
          uri: selectedFile.uri,
          type: selectedFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: selectedFile.name,
        };
      }

      const result = await productsApi.uploadBulkUpdate(fileToUpload);

      logger.info('✅ Actualización masiva completada:', result);

      // Show results
      const message = `
Actualización completada:
✅ Productos actualizados: ${result.successCount}
${result.errorCount > 0 ? `❌ Errores: ${result.errorCount}` : ''}
Total procesado: ${result.totalRows}
      `.trim();

      if (result.errorCount > 0) {
        // Show errors in detail
        const errorDetails = result.errors
          .slice(0, 5)
          .map((err) => `Fila ${err.row}: ${err.error}`)
          .join('\n');

        Alert.alert(
          'Actualización con errores',
          `${message}\n\nPrimeros errores:\n${errorDetails}${
            result.errors.length > 5 ? `\n... y ${result.errors.length - 5} más` : ''
          }`,
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedFile(null);
                if (result.successCount > 0 && onSuccess) {
                  onSuccess();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Éxito', message, [
          {
            text: 'OK',
            onPress: () => {
              setSelectedFile(null);
              onClose();
              if (onSuccess) {
                onSuccess();
              }
            },
          },
        ]);
      }
    } catch (error: any) {
      logger.error('❌ Error subiendo archivo:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Error al procesar el archivo de actualización'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFromDate('');
    setToDate('');
    setSelectedFile(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {mode === 'products' ? 'Actualización Masiva de Productos' : 'Actualización de Productos de Campaña'}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Instrucciones</Text>
              <Text style={styles.instructionText}>
                1. Descarga el formato Excel con los productos{'\n'}
                2. Modifica SKU, Nombre, Costo y/o Precios{'\n'}
                3. NO modifiques la columna "Correlativo"{'\n'}
                4. Sube el archivo modificado para actualizar
              </Text>
            </View>

            {/* Download Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📥 Paso 1: Descargar Formato</Text>

              {mode === 'products' && (
                <View style={styles.filterContainer}>
                  <Text style={styles.filterLabel}>Filtrar por fechas (opcional):</Text>
                  <View style={styles.dateInputContainer}>
                    <View style={styles.dateInput}>
                      <Text style={styles.dateLabel}>Desde:</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={fromDate}
                        onChangeText={setFromDate}
                        editable={!loading}
                      />
                    </View>
                    <View style={styles.dateInput}>
                      <Text style={styles.dateLabel}>Hasta:</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={toDate}
                        onChangeText={setToDate}
                        editable={!loading}
                      />
                    </View>
                  </View>
                  <Text style={styles.helperText}>
                    Deja vacío para descargar todos los productos
                  </Text>
                </View>
              )}

              {mode === 'campaign' && (
                <Text style={styles.campaignInfo}>
                  Se descargarán los productos de esta campaña
                </Text>
              )}

              <TouchableOpacity
                style={[styles.button, styles.downloadButton, loading && styles.buttonDisabled]}
                onPress={handleDownloadFormat}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>📥 Descargar Formato Excel</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Upload Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📤 Paso 2: Subir Archivo Modificado</Text>

              {selectedFile && (
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>📄 {selectedFile.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedFile(null)}>
                    <Text style={styles.removeFile}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, styles.selectButton, loading && styles.buttonDisabled]}
                onPress={handleSelectFile}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {selectedFile ? '📄 Cambiar Archivo' : '📄 Seleccionar Archivo'}
                </Text>
              </TouchableOpacity>

              {selectedFile && (
                <TouchableOpacity
                  style={[styles.button, styles.uploadButton, loading && styles.buttonDisabled]}
                  onPress={handleUploadFile}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>🚀 Actualizar Productos</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Warning */}
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ Los precios están en SOLES y se convierten automáticamente a céntimos
              </Text>
              <Text style={styles.warningText}>
                ⚠️ Si modificas el costo, los precios NO se recalculan automáticamente
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollView: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  dateInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    fontStyle: 'italic',
  },
  campaignInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  downloadButton: {
    backgroundColor: '#3B82F6',
  },
  selectButton: {
    backgroundColor: '#8B5CF6',
  },
  uploadButton: {
    backgroundColor: '#10B981',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  removeFile: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  warningContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    marginBottom: 4,
  },
});
