import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { inventoryApi } from '@/services/api/inventory';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { getDocumentAsync } from '@/utils/filePicker';

// Design System
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';
import {
  Title,
  Body,
  Caption,
  Label,
  Numeric,
  Button,
  Card,
  IconButton,
} from '@/design-system/components';

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
  const { user, currentSite } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    totalRows: number;
    updatedRows: number;
    errors: Array<{
      row: number;
      sku: string;
      error: string;
    }>;
  } | null>(null);

  // Get effective site (prefer tenant store, fallback to auth store)
  const effectiveSite = selectedSite || currentSite;

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      console.log('📥 Downloading stock bulk update format...');

      if (!effectiveSite) {
        throw new Error('No se ha seleccionado una sede');
      }

      // Download the format from the API
      const blob = await inventoryApi.downloadStockFormat({
        siteId: effectiveSite.id,
      });
      console.log('✅ Format downloaded successfully');
      console.log('📦 Tamaño del archivo:', blob.size, 'bytes');

      // Handle download based on platform
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `formato_stock_${timestamp}.xlsx`;

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

        Alert.alert('Éxito', 'El formato de stock se está descargando');
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
            dialogTitle: 'Formato de Stock',
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
      console.log('📤 [UPLOAD] Uploading stock update file:', file.name);

      // In React Native, we need to pass the file metadata directly to FormData
      // Don't convert to blob - use the file object with uri, type, and name
      const fileToUpload = {
        uri: file.uri,
        type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: file.name,
      };

      console.log('📦 [UPLOAD] File object prepared for upload:', JSON.stringify(fileToUpload, null, 2));

      // Upload to API
      console.log('🚀 [UPLOAD] Calling inventoryApi.uploadStockUpdate...');
      const result = await inventoryApi.uploadStockUpdate(fileToUpload as any, user.id);
      console.log('✅ [UPLOAD] Upload result received:', JSON.stringify(result, null, 2));

      setUploadResult(result);

      if (result.errors.length === 0) {
        Alert.alert('Éxito', `Se actualizaron ${result.updatedRows} registros de stock correctamente.`, [
          {
            text: 'OK',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]);
      } else if (result.updatedRows > 0) {
        Alert.alert(
          'Actualización Parcial',
          `Se actualizaron ${result.updatedRows} registros correctamente.\n\n` +
            `${result.errors.length} registros tuvieron errores. Revisa los detalles a continuación.`
        );
      } else {
        Alert.alert(
          'Error',
          `No se pudo actualizar ningún registro. Revisa los errores a continuación.`
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
            <Title size="medium">Actualización Masiva de Stock</Title>
            <IconButton
              icon="close"
              onPress={handleClose}
              variant="ghost"
              size="small"
            />
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Instructions */}
            <View style={styles.section}>
              <Label size="large" style={styles.sectionTitle}>📋 Instrucciones</Label>
              <Body size="small" color="secondary" style={styles.instructionText}>
                1. Descarga el formato Excel con el stock actual
              </Body>
              <Body size="small" color="secondary" style={styles.instructionText}>
                2. Edita la columna "NUEVO STOCK BASE" (amarilla) con los nuevos valores
              </Body>
              <Body size="small" color="secondary" style={styles.instructionText}>
                3. Sube el archivo para actualizar el stock automáticamente
              </Body>
            </View>

            {/* Download Template Button */}
            <Button
              title="📥 Descargar Formato de Stock"
              variant="primary"
              onPress={handleDownloadTemplate}
              disabled={downloadingTemplate || loading}
              loading={downloadingTemplate}
              style={styles.primaryButton}
            />

            {/* Upload File Button */}
            <Button
              title="📤 Subir Actualización de Stock"
              variant="outline"
              onPress={handleSelectFile}
              disabled={loading || downloadingTemplate}
              loading={loading}
              style={styles.secondaryButton}
            />

            {/* Upload Result */}
            {uploadResult && (
              <Card variant="filled" padding="medium" style={styles.resultSection}>
                <Label size="large" style={styles.resultTitle}>Resultado de la Actualización</Label>

                <View style={styles.resultStats}>
                  <View style={styles.resultStatItem}>
                    <Numeric size="large" weight="bold">{uploadResult.totalRows}</Numeric>
                    <Caption color="secondary">Total Filas</Caption>
                  </View>
                  <View style={[styles.resultStatItem, styles.successStat]}>
                    <Numeric size="large" weight="bold" color={colors.success[600]}>
                      {uploadResult.updatedRows}
                    </Numeric>
                    <Caption color="secondary">Actualizados</Caption>
                  </View>
                  <View style={[styles.resultStatItem, styles.errorStat]}>
                    <Numeric size="large" weight="bold" color={colors.danger[600]}>
                      {uploadResult.errors.length}
                    </Numeric>
                    <Caption color="secondary">Errores</Caption>
                  </View>
                </View>

                {/* Errors List */}
                {uploadResult.errors.length > 0 && (
                  <View style={styles.errorsSection}>
                    <Label size="medium" color={colors.danger[600]} style={styles.errorsTitle}>
                      ⚠️ Errores Encontrados ({uploadResult.errors.length})
                    </Label>
                    <ScrollView style={styles.errorsList} nestedScrollEnabled>
                      {uploadResult.errors.map((error, index) => (
                        <View key={index} style={styles.errorItem}>
                          <Label size="small" color={colors.danger[600]}>Fila {error.row}</Label>
                          <Caption color="tertiary">SKU: {error.sku}</Caption>
                          <Body size="small">{error.error}</Body>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </Card>
            )}

            {/* Important Notes */}
            <View style={styles.notesSection}>
              <Label size="medium" color={colors.accent[700]} style={styles.notesTitle}>
                💡 Notas Importantes
              </Label>
              <Body size="small" color={colors.accent[700]} style={styles.noteText}>
                • El formato incluye el stock actual de todos los productos
              </Body>
              <Body size="small" color={colors.accent[700]} style={styles.noteText}>
                • Solo edita la columna "NUEVO STOCK BASE" (resaltada en amarillo)
              </Body>
              <Body size="small" color={colors.accent[700]} style={styles.noteText}>
                • No modifiques las columnas de IDs (están ocultas en gris)
              </Body>
              <Body size="small" color={colors.accent[700]} style={styles.noteText}>
                • Cada actualización se registra automáticamente en el historial de movimientos
              </Body>
              <Body size="small" color={colors.accent[700]} style={styles.noteText}>
                • El stock disponible se calcula automáticamente (Stock Base - Stock Reservado)
              </Body>
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
    borderRadius: borderRadius.xl,
    width: '90%',
    maxWidth: 600,
    maxHeight: '85%',
    ...shadows.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  content: {
    padding: spacing[5],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    marginBottom: spacing[3],
  },
  instructionText: {
    marginBottom: spacing[2],
    lineHeight: 20,
  },
  primaryButton: {
    marginBottom: spacing[3],
  },
  secondaryButton: {
    marginBottom: spacing[5],
  },
  resultSection: {
    marginBottom: spacing[5],
  },
  resultTitle: {
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
    borderRadius: borderRadius.md,
    minWidth: 80,
  },
  successStat: {
    backgroundColor: colors.success[50],
  },
  errorStat: {
    backgroundColor: colors.danger[50],
  },
  errorsSection: {
    marginTop: spacing[4],
  },
  errorsTitle: {
    marginBottom: spacing[3],
  },
  errorsList: {
    maxHeight: 200,
  },
  errorItem: {
    backgroundColor: colors.surface.primary,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
    borderLeftWidth: 3,
    borderLeftColor: colors.danger[500],
  },
  notesSection: {
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.accent[200],
  },
  notesTitle: {
    marginBottom: spacing[3],
  },
  noteText: {
    marginBottom: spacing[1.5],
    lineHeight: 18,
  },
});

export default BulkUploadModal;
