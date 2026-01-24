import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { productsApi } from '@/services/api/products';

interface BulkUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    successCount: number;
    errorCount: number;
    totalRows: number;
    errors: Array<{
      row: number;
      error: string;
      sku?: string;
    }>;
  } | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      console.log('📥 Downloading bulk upload template...');

      // Download the template from the API
      const blob = await productsApi.downloadBulkTemplate();
      console.log('✅ Template downloaded successfully');
      console.log('📦 Tamaño del archivo:', blob.size, 'bytes');

      // Handle download based on platform
      const timestamp = new Date().getTime();
      const fileName = `plantilla_productos_${timestamp}.xlsx`;

      // Check if we're on web by checking for document object
      const isWeb = typeof document !== 'undefined';
      console.log('🌐 Platform detection:', {
        platformOS: Platform.OS,
        isWeb,
        hasDocument: typeof document !== 'undefined',
      });

      if (isWeb) {
        // For web, create a download link using blob URL
        console.log('📥 Using web download method');
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', 'La plantilla se está descargando');
      } else {
        // For mobile (iOS/Android), use legacy expo-file-system API
        console.log('📱 Using mobile download method (legacy API)');

        // Convert blob to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            // Remove the data URL prefix to get just the base64 data
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Save to file system using legacy API
        const fileUri = FileSystem.cacheDirectory + fileName;
        console.log('💾 Saving file to:', fileUri);

        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log('✅ File saved successfully');

        // Share the file - user can choose to save to Downloads from share menu
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          console.log('📤 Sharing file...');
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Plantilla de Productos',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          });
        } else {
          Alert.alert('Éxito', `Plantilla guardada en: ${fileUri}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Error downloading template:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message ||
          'No se pudo descargar la plantilla. Por favor, intenta nuevamente.'
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      console.log('📂 Opening document picker...');

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        console.log('❌ User cancelled file selection');
        return;
      }

      console.log('✅ File selected:', result);

      // Upload the file
      await handleUploadFile(result);
    } catch (error: any) {
      console.error('❌ Error selecting file:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Por favor, intenta nuevamente.');
    }
  };

  const handleUploadFile = async (fileResult: any) => {
    try {
      setLoading(true);
      setUploadResult(null);

      const file = fileResult.assets?.[0];
      if (!file) {
        throw new Error('No se pudo obtener el archivo');
      }

      console.log('📤 Uploading file:', file.name);

      // In React Native, we need to pass the file metadata directly to FormData
      // Don't convert to blob - use the file object with uri, type, and name
      const fileToUpload = {
        uri: file.uri,
        type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: file.name,
      };

      console.log('📦 File to upload:', fileToUpload);

      // Upload to API
      const result = await productsApi.uploadBulkProducts(fileToUpload as any);
      console.log('✅ Upload result:', result);

      setUploadResult(result);

      if (result.errorCount === 0) {
        Alert.alert('Éxito', `Se crearon ${result.successCount} productos correctamente.`, [
          {
            text: 'OK',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]);
      } else if (result.successCount > 0) {
        Alert.alert(
          'Carga Parcial',
          `Se crearon ${result.successCount} productos correctamente.\n\n` +
            `${result.errorCount} productos tuvieron errores. Revisa los detalles a continuación.`
        );
      } else {
        Alert.alert(
          'Error',
          `No se pudo crear ningún producto. Revisa los errores a continuación.`
        );
      }
    } catch (error: any) {
      console.error('❌ Error uploading file:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message ||
          'No se pudo cargar el archivo. Por favor, intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUploadResult(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Carga Masiva de Productos</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Instrucciones</Text>
              <Text style={styles.instructionText}>
                1. Descarga la plantilla Excel con el formato correcto
              </Text>
              <Text style={styles.instructionText}>
                2. Completa la información de los productos
              </Text>
              <Text style={styles.instructionText}>
                3. Sube el archivo completado para crear los productos
              </Text>
            </View>

            {/* Download Template Button */}
            <TouchableOpacity
              style={[styles.primaryButton, downloadingTemplate && styles.buttonDisabled]}
              onPress={handleDownloadTemplate}
              disabled={downloadingTemplate || loading}
            >
              {downloadingTemplate ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonIcon}>📥</Text>
                  <Text style={styles.primaryButtonText}>Descargar Plantilla Excel</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Upload File Button */}
            <TouchableOpacity
              style={[styles.secondaryButton, loading && styles.buttonDisabled]}
              onPress={handleSelectFile}
              disabled={loading || downloadingTemplate}
            >
              {loading ? (
                <ActivityIndicator color="#667eea" />
              ) : (
                <>
                  <Text style={styles.secondaryButtonIcon}>📤</Text>
                  <Text style={styles.secondaryButtonText}>Subir Archivo Excel</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Upload Result */}
            {uploadResult && (
              <View style={styles.resultSection}>
                <Text style={styles.resultTitle}>Resultado de la Carga</Text>

                <View style={styles.resultStats}>
                  <View style={styles.resultStatItem}>
                    <Text style={styles.resultStatValue}>{uploadResult.totalRows}</Text>
                    <Text style={styles.resultStatLabel}>Total Filas</Text>
                  </View>
                  <View style={[styles.resultStatItem, styles.successStat]}>
                    <Text style={[styles.resultStatValue, styles.successText]}>
                      {uploadResult.successCount}
                    </Text>
                    <Text style={styles.resultStatLabel}>Exitosos</Text>
                  </View>
                  <View style={[styles.resultStatItem, styles.errorStat]}>
                    <Text style={[styles.resultStatValue, styles.errorText]}>
                      {uploadResult.errorCount}
                    </Text>
                    <Text style={styles.resultStatLabel}>Errores</Text>
                  </View>
                </View>

                {/* Errors List */}
                {uploadResult.errors.length > 0 && (
                  <View style={styles.errorsSection}>
                    <Text style={styles.errorsTitle}>
                      ⚠️ Errores Encontrados ({uploadResult.errors.length})
                    </Text>
                    <ScrollView style={styles.errorsList} nestedScrollEnabled>
                      {uploadResult.errors.map((error, index) => (
                        <View key={index} style={styles.errorItem}>
                          <Text style={styles.errorRow}>Fila {error.row}</Text>
                          {error.sku && <Text style={styles.errorSku}>SKU: {error.sku}</Text>}
                          <Text style={styles.errorMessage}>{error.error}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* Important Notes */}
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>💡 Notas Importantes</Text>
              <Text style={styles.noteText}>
                • La plantilla incluye listas desplegables con categorías y presentaciones
              </Text>
              <Text style={styles.noteText}>• Los campos marcados con * son obligatorios</Text>
              <Text style={styles.noteText}>
                • Los costos deben ingresarse en céntimos (ej: 10000 = S/ 100.00)
              </Text>
              <Text style={styles.noteText}>• Los códigos de barras deben ser únicos</Text>
              <Text style={styles.noteText}>
                • El estado siempre será "active" y el tipo de impuesto "GRAVADO"
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '300',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  secondaryButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resultSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  resultStatItem: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 80,
  },
  successStat: {
    backgroundColor: '#F0FDF4',
  },
  errorStat: {
    backgroundColor: '#FEE2E2',
  },
  resultStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  successText: {
    color: '#10B981',
  },
  errorText: {
    color: '#EF4444',
  },
  resultStatLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  errorsSection: {
    marginTop: 16,
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 12,
  },
  errorsList: {
    maxHeight: 200,
  },
  errorItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorRow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  errorSku: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  notesSection: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338CA',
    marginBottom: 12,
  },
  noteText: {
    fontSize: 13,
    color: '#4338CA',
    marginBottom: 6,
    lineHeight: 18,
  },
});

export default BulkUploadModal;
