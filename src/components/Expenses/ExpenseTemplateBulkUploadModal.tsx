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
import { expensesService } from '@/services/api/expenses';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { getDocumentAsync } from '@/utils/filePicker';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface ExpenseTemplateBulkUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpenseTemplateBulkUploadModal: React.FC<ExpenseTemplateBulkUploadModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { user, currentSite } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    created: any[];
    errors: Array<{
      row: number;
      error: string;
      data?: any;
    }>;
    message: string;
  } | null>(null);

  // Get effective site (prefer tenant store, fallback to auth store)
  const effectiveSite = selectedSite || currentSite;

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      console.log('📥 Downloading expense templates bulk upload format...');

      if (!effectiveSite) {
        throw new Error('No se ha seleccionado una sede');
      }

      // Download the format from the API
      const blob = await expensesService.downloadTemplateBulkUploadFormat();
      console.log('✅ Format downloaded successfully');
      console.log('📦 Tamaño del archivo:', blob.size, 'bytes');

      // Handle download based on platform
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `formato_gastos_recurrentes_${timestamp}.xlsx`;

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

        Alert.alert('Éxito', 'El formato de gastos recurrentes se está descargando');
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
            dialogTitle: 'Formato de Gastos Recurrentes',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          });
        } else {
          Alert.alert('Éxito', `Formato guardado en: ${fileUri}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Error downloading format:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo descargar el formato. Por favor, intenta nuevamente.'
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      console.log('📂 Opening document picker...');

      const result = await getDocumentAsync({
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

      console.log('🔍 [UPLOAD] Starting upload process...');
      console.log('🔍 [UPLOAD] File result received:', JSON.stringify(fileResult, null, 2));

      const file = fileResult.assets?.[0];
      if (!file) {
        console.error('❌ [UPLOAD] No file found in result.assets');
        throw new Error('No se pudo obtener el archivo');
      }

      console.log('✅ [UPLOAD] File extracted from assets:', {
        name: file.name,
        uri: file.uri,
        size: file.size,
        mimeType: file.mimeType,
      });

      if (!user?.id) {
        console.error('❌ [UPLOAD] User ID not found');
        throw new Error('No se pudo identificar el usuario');
      }

      console.log('✅ [UPLOAD] User ID:', user.id);
      console.log('📤 [UPLOAD] Uploading expense templates file:', file.name);

      let fileToUpload: any;

      if (Platform.OS === 'web') {
        // Web: Use the original File object if available
        console.log('📤 [Web] Preparing file upload...');
        if (file.file) {
          fileToUpload = file.file;
          console.log('✅ Using File object');
        } else {
          // Fallback: fetch the blob from URI and create a File
          console.log('⚠️ No File object, fetching from URI...');
          const response = await fetch(file.uri);
          const blob = await response.blob();
          fileToUpload = new File([blob], file.name, {
            type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
        }
      } else {
        // Mobile: Use file metadata object
        fileToUpload = {
          uri: file.uri,
          type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: file.name,
        };
      }

      console.log('📦 [UPLOAD] File object prepared for upload');

      // Upload to API
      console.log('🚀 [UPLOAD] Calling expensesService.uploadBulkTemplates...');
      const result = await expensesService.uploadBulkTemplates(fileToUpload as any);
      console.log('✅ [UPLOAD] Upload result received:', JSON.stringify(result, null, 2));

      setUploadResult(result);

      if (result.errors.length === 0) {
        Alert.alert('Éxito', `Se crearon ${result.success} plantillas de gastos correctamente.`, [
          {
            text: 'OK',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]);
      } else if (result.success > 0) {
        Alert.alert(
          'Creación Parcial',
          `Se crearon ${result.success} plantillas correctamente.\n\n` +
            `${result.errors.length} registros tuvieron errores. Revisa los detalles a continuación.`
        );
      } else {
        Alert.alert(
          'Error',
          `No se pudo crear ninguna plantilla. Revisa los errores a continuación.`
        );
      }
    } catch (error: any) {
      console.error('❌ [UPLOAD] Error uploading file:', error);
      console.error('❌ [UPLOAD] Error details:', {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        responseHeaders: error.response?.headers,
        stack: error.stack,
      });

      Alert.alert(
        'Error',
        error.response?.data?.message || error.message ||
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
            <Text style={styles.headerTitle}>Carga Masiva de Gastos Recurrentes</Text>
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
                1. Descarga el formato Excel para crear gastos recurrentes
              </Text>
              <Text style={styles.instructionText}>
                2. Verifica que el archivo tenga 3 hojas: "Plantillas de Gastos", "Instrucciones", "Catálogos"
              </Text>
              <Text style={styles.instructionText}>
                3. Elimina las filas de ejemplo y agrega tus plantillas de gastos
              </Text>
              <Text style={styles.instructionText}>
                4. Sube el archivo para crear las plantillas automáticamente
              </Text>
            </View>

            {/* Download Template Button */}
            <TouchableOpacity
              style={[styles.primaryButton, downloadingTemplate && styles.buttonDisabled]}
              onPress={handleDownloadTemplate}
              disabled={downloadingTemplate || loading}
            >
              {downloadingTemplate ? (
                <ActivityIndicator color={colors.neutral[0]} />
              ) : (
                <>
                  <Text style={styles.primaryButtonIcon}>📥</Text>
                  <Text style={styles.primaryButtonText}>Descargar Formato</Text>
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
                <ActivityIndicator color={colors.danger[600]} />
              ) : (
                <>
                  <Text style={styles.secondaryButtonIcon}>📤</Text>
                  <Text style={styles.secondaryButtonText}>Subir Archivo de Plantillas</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Upload Result */}
            {uploadResult && (
              <View style={styles.resultSection}>
                <Text style={styles.resultTitle}>Resultado de la Carga</Text>

                <View style={styles.resultStats}>
                  <View style={styles.resultStatItem}>
                    <Text style={styles.resultStatValue}>
                      {uploadResult.success + uploadResult.errors.length}
                    </Text>
                    <Text style={styles.resultStatLabel}>Total Filas</Text>
                  </View>
                  <View style={[styles.resultStatItem, styles.successStat]}>
                    <Text style={[styles.resultStatValue, styles.successText]}>
                      {uploadResult.success}
                    </Text>
                    <Text style={styles.resultStatLabel}>Creadas</Text>
                  </View>
                  <View style={[styles.resultStatItem, styles.errorStat]}>
                    <Text style={[styles.resultStatValue, styles.errorText]}>
                      {uploadResult.errors.length}
                    </Text>
                    <Text style={styles.resultStatLabel}>Errores</Text>
                  </View>
                </View>

                {/* Message */}
                {uploadResult.message && (
                  <View style={styles.messageSection}>
                    <Text style={styles.messageText}>{uploadResult.message}</Text>
                  </View>
                )}

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
                          {error.data && (
                            <>
                              {error.data.code && (
                                <Text style={styles.errorSku}>Código: {error.data.code}</Text>
                              )}
                              {error.data.name && (
                                <Text style={styles.errorSku}>Nombre: {error.data.name}</Text>
                              )}
                              {error.data.categoryCode && (
                                <Text style={styles.errorSku}>Categoría: {error.data.categoryCode}</Text>
                              )}
                              {error.data.siteCode && (
                                <Text style={styles.errorSku}>Sede: {error.data.siteCode}</Text>
                              )}
                            </>
                          )}
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
                • El formato incluye 3 hojas: Plantillas, Instrucciones y Catálogos
              </Text>
              <Text style={styles.noteText}>
                • La hoja de catálogos muestra las categorías y sedes de tu empresa
              </Text>
              <Text style={styles.noteText}>
                • Hay 2 filas de ejemplo que debes eliminar antes de agregar tus datos
              </Text>
              <Text style={styles.noteText}>
                • Asegúrate de usar los IDs correctos de categorías y sedes del catálogo
              </Text>
              <Text style={styles.noteText}>
                • Las plantillas creadas estarán activas por defecto
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
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    width: '90%',
    maxWidth: 600,
    maxHeight: '85%',
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: '300',
  },
  content: {
    padding: spacing[5],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  instructionText: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[2],
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger[600],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[3],
    shadowColor: colors.danger[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonIcon: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.primary,
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[5],
    borderWidth: 2,
    borderColor: colors.danger[600],
  },
  secondaryButtonIcon: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger[600],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resultSection: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[4],
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[4],
  },
  resultStatItem: {
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    minWidth: 80,
  },
  successStat: {
    backgroundColor: colors.success[50],
  },
  errorStat: {
    backgroundColor: colors.danger[100],
  },
  resultStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  successText: {
    color: colors.success[500],
  },
  errorText: {
    color: colors.danger[500],
  },
  resultStatLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  messageSection: {
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginTop: spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: colors.accent[500],
  },
  messageText: {
    fontSize: 13,
    color: colors.accent[800],
    lineHeight: 18,
  },
  errorsSection: {
    marginTop: spacing[4],
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger[600],
    marginBottom: spacing[3],
  },
  errorsList: {
    maxHeight: 200,
  },
  errorItem: {
    backgroundColor: colors.surface.primary,
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
    borderLeftWidth: 3,
    borderLeftColor: colors.danger[500],
  },
  errorRow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger[600],
    marginBottom: spacing[1],
  },
  errorSku: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  errorMessage: {
    fontSize: 13,
    color: colors.neutral[800],
    lineHeight: 18,
  },
  notesSection: {
    backgroundColor: colors.danger[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.danger[200],
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger[800],
    marginBottom: spacing[3],
  },
  noteText: {
    fontSize: 13,
    color: colors.danger[800],
    marginBottom: spacing[1.5],
    lineHeight: 18,
  },
});

export default ExpenseTemplateBulkUploadModal;
