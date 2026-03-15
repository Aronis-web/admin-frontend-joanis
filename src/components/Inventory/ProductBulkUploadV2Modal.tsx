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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { getDocumentAsync } from '@/utils/filePicker';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';

interface ProductBulkUploadV2ModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadResult {
  successCount: number;
  errorCount: number;
  totalRows: number;
  errors: Array<{
    row: number;
    sku?: string;
    error: string;
  }>;
  createdProductIds: string[];
}

export const ProductBulkUploadV2Modal: React.FC<ProductBulkUploadV2ModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { user, currentSite, currentCompany } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Get effective site and company (prefer tenant store, fallback to auth store)
  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      console.log('📥 Downloading product bulk upload template V2...');

      if (!effectiveSite) {
        throw new Error('No se ha seleccionado una sede');
      }

      if (!effectiveCompany) {
        throw new Error('No se ha seleccionado una empresa');
      }

      // Build headers with authentication and tenant context
      const token = authService.getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-App-Id': config.APP_ID,
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (user?.id) {
        headers['X-User-Id'] = user.id;
      }
      if (effectiveCompany.id) {
        headers['X-Company-Id'] = effectiveCompany.id;
      }
      if (effectiveSite.id) {
        headers['X-Site-Id'] = effectiveSite.id;
      }

      // Download the template from the API
      const response = await fetch(`${config.API_URL}/admin/products/bulk/template-v2`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Error al descargar la plantilla' }));
        throw new Error(errorData.message || 'Error al descargar la plantilla');
      }

      const blob = await response.blob();
      console.log('✅ Template downloaded successfully');
      console.log('📦 File size:', blob.size, 'bytes');

      // Handle download based on platform
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `plantilla_productos_v2_${timestamp}.xlsx`;

      // Check if we're on web
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

        Alert.alert('Éxito', 'La plantilla de productos V2 se está descargando');
      } else {
        // For mobile (iOS/Android), use legacy expo-file-system API
        console.log('📱 Using mobile download method (legacy API)');

        // Convert blob to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Save to file system
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log('✅ File saved to:', fileUri);

        // Share the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Guardar plantilla de productos V2',
            UTI: 'com.microsoft.excel.xlsx',
          });
          Alert.alert('Éxito', 'La plantilla de productos V2 se ha descargado correctamente');
        } else {
          Alert.alert(
            'Archivo guardado',
            `La plantilla se guardó en: ${fileUri}\n\nPuedes encontrarla en la carpeta de documentos de la aplicación.`
          );
        }
      }
    } catch (error: any) {
      console.error('❌ Error downloading template:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo descargar la plantilla. Por favor, intenta nuevamente.'
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUploadFile = async () => {
    try {
      console.log('📤 Starting file upload process...');

      if (!effectiveSite) {
        throw new Error('No se ha seleccionado una sede');
      }

      if (!effectiveCompany) {
        throw new Error('No se ha seleccionado una empresa');
      }

      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      // Pick file
      const pickerResult = await getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });

      console.log('📄 File picker result:', pickerResult);

      if (pickerResult.canceled) {
        console.log('❌ File selection cancelled');
        return;
      }

      if (!pickerResult.assets || pickerResult.assets.length === 0) {
        throw new Error('No se seleccionó ningún archivo');
      }

      const file = pickerResult.assets[0];
      console.log('📄 Selected file:', {
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        uri: file.uri,
      });

      setLoading(true);
      setUploadResult(null);

      // Prepare FormData
      const formData = new FormData();

      // Check if we're on web
      const isWeb = typeof document !== 'undefined';

      if (isWeb) {
        // For web, file is already a File object
        formData.append('file', file as any);
      } else {
        // For mobile, create a file object from URI
        const fileToUpload = {
          uri: file.uri,
          type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: file.name || 'productos.xlsx',
        } as any;
        formData.append('file', fileToUpload);
      }

      console.log('📤 Uploading file to API...');

      // Build headers
      const token = authService.getAccessToken();
      const headers: Record<string, string> = {
        'X-App-Id': config.APP_ID,
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (user.id) {
        headers['X-User-Id'] = user.id;
      }
      if (effectiveCompany.id) {
        headers['X-Company-Id'] = effectiveCompany.id;
      }
      if (effectiveSite.id) {
        headers['X-Site-Id'] = effectiveSite.id;
      }

      // Upload file
      const response = await fetch(`${config.API_URL}/admin/products/bulk/upload-v2`, {
        method: 'POST',
        headers,
        body: formData,
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Error al procesar el archivo' }));
        throw new Error(errorData.message || 'Error al procesar el archivo');
      }

      const uploadResponse: UploadResult = await response.json();
      console.log('✅ Upload result:', uploadResponse);

      setUploadResult(uploadResponse);

      if (uploadResponse.errorCount === 0) {
        Alert.alert(
          'Éxito',
          `Se crearon ${uploadResponse.successCount} productos correctamente.`,
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess();
                handleClose();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Carga completada con errores',
          `Se crearon ${uploadResponse.successCount} productos.\n${uploadResponse.errorCount} productos tuvieron errores.\n\nRevisa los detalles a continuación.`
        );
      }
    } catch (error: any) {
      console.error('❌ Error uploading file:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo procesar el archivo. Por favor, intenta nuevamente.'
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Carga Masiva de Productos V2</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Instructions */}
            <View style={styles.instructionsCard}>
              <View style={styles.instructionHeader}>
                <Ionicons name="information-circle" size={24} color="#6366F1" />
                <Text style={styles.instructionTitle}>Instrucciones</Text>
              </View>
              <Text style={styles.instructionText}>
                1. Descarga la plantilla Excel con todas las presentaciones disponibles
              </Text>
              <Text style={styles.instructionText}>
                2. Completa los datos de los productos (SKU, Nombre, Costo, Stock, etc.)
              </Text>
              <Text style={styles.instructionText}>
                3. Especifica las cantidades por presentación que apliquen
              </Text>
              <Text style={styles.instructionText}>4. Sube el archivo completado</Text>
            </View>

            {/* Features */}
            <View style={styles.featuresCard}>
              <Text style={styles.featuresTitle}>✨ Características V2</Text>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.featureText}>
                  Todas las presentaciones disponibles en el sistema
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.featureText}>
                  Especifica solo las presentaciones que necesites
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.featureText}>Stock inicial por almacén y área</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.featureText}>Validación automática de datos</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.downloadButton]}
                onPress={handleDownloadTemplate}
                disabled={downloadingTemplate}
              >
                {downloadingTemplate ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Descargar Plantilla V2</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.uploadButton]}
                onPress={handleUploadFile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Subir Archivo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Upload Result */}
            {uploadResult && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Ionicons
                    name={uploadResult.errorCount === 0 ? 'checkmark-circle' : 'warning'}
                    size={24}
                    color={uploadResult.errorCount === 0 ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={styles.resultTitle}>Resultado de la Carga</Text>
                </View>

                <View style={styles.resultStats}>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatLabel}>Total de filas:</Text>
                    <Text style={styles.resultStatValue}>{uploadResult.totalRows}</Text>
                  </View>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatLabel}>Productos creados:</Text>
                    <Text style={[styles.resultStatValue, styles.successText]}>
                      {uploadResult.successCount}
                    </Text>
                  </View>
                  {uploadResult.errorCount > 0 && (
                    <View style={styles.resultStat}>
                      <Text style={styles.resultStatLabel}>Errores:</Text>
                      <Text style={[styles.resultStatValue, styles.errorText]}>
                        {uploadResult.errorCount}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Errors List */}
                {uploadResult.errors.length > 0 && (
                  <View style={styles.errorsContainer}>
                    <Text style={styles.errorsTitle}>Detalles de errores:</Text>
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

            {/* Warning */}
            <View style={styles.warningCard}>
              <Ionicons name="alert-circle" size={20} color="#F59E0B" />
              <Text style={styles.warningText}>
                Asegúrate de que el archivo Excel esté correctamente formateado y contenga todos
                los campos obligatorios.
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  instructionsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  instructionText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 20,
  },
  featuresCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#166534',
    flex: 1,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  downloadButton: {
    backgroundColor: '#F59E0B',
  },
  uploadButton: {
    backgroundColor: '#6366F1',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  resultStats: {
    gap: 8,
    marginBottom: 12,
  },
  resultStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultStatLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  resultStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  successText: {
    color: '#10B981',
  },
  errorText: {
    color: '#EF4444',
  },
  errorsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  errorsList: {
    maxHeight: 200,
  },
  errorItem: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorRow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorSku: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 12,
    color: '#7F1D1D',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
});
