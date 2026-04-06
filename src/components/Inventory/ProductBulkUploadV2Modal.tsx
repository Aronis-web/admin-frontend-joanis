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
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { getDocumentAsync } from '@/utils/filePicker';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';

// Design System
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';
import {
  Title,
  Body,
  Caption,
  Label,
  Button,
  Card,
  IconButton,
} from '@/design-system/components';

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
      headers['X-App-Version'] = config.APP_VERSION;
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
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
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
      headers['X-App-Version'] = config.APP_VERSION;
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
            <Title size="medium">Carga Masiva de Productos V2</Title>
            <IconButton
              icon="close"
              onPress={handleClose}
              variant="ghost"
              size="small"
            />
          </View>

          {/* Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Instructions */}
            <Card variant="filled" padding="medium" style={styles.instructionsCard}>
              <View style={styles.instructionHeader}>
                <Ionicons name="information-circle" size={24} color={colors.accent[500]} />
                <Label size="large">Instrucciones</Label>
              </View>
              <Body size="small" color="secondary" style={styles.instructionText}>
                1. Descarga la plantilla Excel con todas las presentaciones disponibles
              </Body>
              <Body size="small" color="secondary" style={styles.instructionText}>
                2. Completa los datos de los productos (SKU, Nombre, Costo, Stock, etc.)
              </Body>
              <Body size="small" color="secondary" style={styles.instructionText}>
                3. Especifica las cantidades por presentación que apliquen
              </Body>
              <Body size="small" color="secondary" style={styles.instructionText}>
                4. Sube el archivo completado
              </Body>
            </Card>

            {/* Features */}
            <View style={styles.featuresCard}>
              <Label size="large" style={styles.featuresTitle}>✨ Características V2</Label>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
                <Body size="small" color={colors.success[700]} style={styles.featureText}>
                  Todas las presentaciones disponibles en el sistema
                </Body>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
                <Body size="small" color={colors.success[700]} style={styles.featureText}>
                  Especifica solo las presentaciones que necesites
                </Body>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
                <Body size="small" color={colors.success[700]} style={styles.featureText}>
                  Stock inicial por almacén y área
                </Body>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
                <Body size="small" color={colors.success[700]} style={styles.featureText}>
                  Validación automática de datos
                </Body>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <Button
                title="📄 Descargar Plantilla V2"
                variant="secondary"
                onPress={handleDownloadTemplate}
                disabled={downloadingTemplate}
                loading={downloadingTemplate}
              />

              <Button
                title="☁️ Subir Archivo"
                variant="primary"
                onPress={handleUploadFile}
                disabled={loading}
                loading={loading}
              />
            </View>

            {/* Upload Result */}
            {uploadResult && (
              <Card variant="filled" padding="medium" style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Ionicons
                    name={uploadResult.errorCount === 0 ? 'checkmark-circle' : 'warning'}
                    size={24}
                    color={uploadResult.errorCount === 0 ? colors.success[500] : colors.warning[500]}
                  />
                  <Label size="large">Resultado de la Carga</Label>
                </View>

                <View style={styles.resultStats}>
                  <View style={styles.resultStat}>
                    <Body size="small" color="secondary">Total de filas:</Body>
                    <Label size="medium">{uploadResult.totalRows}</Label>
                  </View>
                  <View style={styles.resultStat}>
                    <Body size="small" color="secondary">Productos creados:</Body>
                    <Label size="medium" color={colors.success[600]}>
                      {uploadResult.successCount}
                    </Label>
                  </View>
                  {uploadResult.errorCount > 0 && (
                    <View style={styles.resultStat}>
                      <Body size="small" color="secondary">Errores:</Body>
                      <Label size="medium" color={colors.danger[600]}>
                        {uploadResult.errorCount}
                      </Label>
                    </View>
                  )}
                </View>

                {/* Errors List */}
                {uploadResult.errors.length > 0 && (
                  <View style={styles.errorsContainer}>
                    <Label size="medium" style={styles.errorsTitle}>Detalles de errores:</Label>
                    <ScrollView style={styles.errorsList} nestedScrollEnabled>
                      {uploadResult.errors.map((error, index) => (
                        <View key={index} style={styles.errorItem}>
                          <Label size="small" color={colors.danger[700]}>Fila {error.row}</Label>
                          {error.sku && <Caption color={colors.danger[600]}>SKU: {error.sku}</Caption>}
                          <Caption color={colors.danger[800]}>{error.error}</Caption>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </Card>
            )}

            {/* Warning */}
            <View style={styles.warningCard}>
              <Ionicons name="alert-circle" size={20} color={colors.warning[500]} />
              <Caption color={colors.warning[700]} style={styles.warningText}>
                Asegúrate de que el archivo Excel esté correctamente formateado y contenga todos
                los campos obligatorios.
              </Caption>
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
    padding: spacing[5],
  },
  modalContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalContent: {
    padding: spacing[5],
  },
  instructionsCard: {
    marginBottom: spacing[4],
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  instructionText: {
    marginBottom: spacing[2],
    lineHeight: 20,
  },
  featuresCard: {
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  featuresTitle: {
    marginBottom: spacing[3],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  featureText: {
    flex: 1,
  },
  actionsContainer: {
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  resultCard: {
    marginBottom: spacing[4],
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  resultStats: {
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  resultStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorsContainer: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  errorsTitle: {
    marginBottom: spacing[2],
  },
  errorsList: {
    maxHeight: 200,
  },
  errorItem: {
    backgroundColor: colors.danger[50],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.danger[200],
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.xl,
    padding: spacing[3],
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  warningText: {
    flex: 1,
    lineHeight: 18,
  },
});
