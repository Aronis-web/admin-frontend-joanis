import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import Alert from '@/utils/alert';
import { getDocumentAsync } from '@/utils/filePicker';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { campaignsService } from '@/services/api';
import { logger } from '@/utils/logger';

interface BulkDistributionModalProps {
  visible: boolean;
  campaignId: string;
  campaignCode: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkDistributionModal: React.FC<BulkDistributionModalProps> = ({
  visible,
  campaignId,
  campaignCode,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    repartosCreated: number;
    totalProducts: number;
    totalQuantity: number;
    errors: Array<{
      row: number;
      participantName: string;
      productSku: string;
      error: string;
    }>;
  } | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      logger.info('📥 Descargando formato de distribución masiva...');

      const blob = await campaignsService.downloadBulkDistributionTemplate(campaignId);

      if (Platform.OS === 'web') {
        // Web: Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `distribucion-masiva-${campaignCode}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        Alert.alert('Éxito', 'El formato Excel se ha descargado correctamente');
      } else {
        // Mobile: Save to file system and share
        const fileName = `distribucion-masiva-${campaignCode}.xlsx`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];

          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Share the file
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              dialogTitle: `Formato de Distribución Masiva - ${campaignCode}`,
              UTI: 'com.microsoft.excel.xlsx',
            });
          } else {
            Alert.alert('Éxito', `Archivo guardado en: ${fileUri}`);
          }
        };
      }

      logger.info('✅ Formato descargado exitosamente');
    } catch (error: any) {
      logger.error('❌ Error al descargar formato:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo descargar el formato Excel'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUploadFile = async () => {
    try {
      logger.info('📤 Seleccionando archivo para subir...');

      const result = await getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        logger.info('❌ Selección de archivo cancelada');
        return;
      }

      const file = result.assets?.[0];
      if (!file) {
        logger.warn('⚠️ No se obtuvo ningún archivo del selector');
        return;
      }
      logger.info('📄 Archivo seleccionado:', file.name);

      setIsUploading(true);
      setUploadResult(null);

      logger.info('📤 Subiendo archivo y generando repartos...');

      let fileToUpload: any;

      if (Platform.OS === 'web') {
        // Web: Use the original File object if available
        logger.info('📤 [Web] Preparing file upload...');
        if ((file as any).file) {
          fileToUpload = (file as any).file;
          logger.info('✅ Using File object');
        } else {
          // Fallback: fetch the blob from URI and create a File
          logger.info('⚠️ No File object, fetching from URI...');
          const fetchResponse = await fetch(file.uri);
          const blob = await fetchResponse.blob();
          fileToUpload = new File([blob], file.name, {
            type:
              file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        }
      } else {
        // Mobile: Use file metadata object (React Native FormData format)
        fileToUpload = {
          uri: file.uri,
          type:
            file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: file.name,
        };
      }

      logger.info('📦 Archivo preparado para upload');

      const response = await campaignsService.uploadBulkDistribution(campaignId, fileToUpload);

      logger.info('✅ Respuesta del servidor:', response);

      setUploadResult(response);

      if (response.success && response.errors.length === 0) {
        Alert.alert(
          'Éxito',
          `Se generaron ${response.repartosCreated} repartos con ${response.totalProducts} productos (${response.totalQuantity} unidades totales)`,
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ]
        );
      } else if (response.repartosCreated > 0) {
        Alert.alert(
          'Completado con errores',
          `Se generaron ${response.repartosCreated} repartos, pero hubo ${response.errors.length} errores. Revisa los detalles abajo.`
        );
      } else {
        Alert.alert(
          'Error',
          `No se pudo generar ningún reparto. Hubo ${response.errors.length} errores. Revisa los detalles abajo.`
        );
      }
    } catch (error: any) {
      logger.error('❌ Error al subir archivo:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo procesar el archivo Excel');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (uploadResult && uploadResult.repartosCreated > 0) {
      onSuccess();
    }
    setUploadResult(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>📦 Distribución Masiva</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={styles.description}>
              Genera repartos automáticamente para todos los participantes mediante un archivo
              Excel.
            </Text>

            {/* Steps */}
            <View style={styles.stepsContainer}>
              {/* Step 1 */}
              <View style={styles.step}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.stepTitle}>Descargar Formato Excel</Text>
                </View>
                <Text style={styles.stepDescription}>
                  Descarga el formato con los participantes y productos disponibles.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.downloadButton,
                    isDownloading && styles.buttonDisabled,
                  ]}
                  onPress={handleDownloadTemplate}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color={theme.color.text.inverse} />
                  ) : (
                    <Text style={styles.buttonText}>📥 Descargar Formato</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Step 2 */}
              <View style={styles.step}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.stepTitle}>Completar Cantidades</Text>
                </View>
                <Text style={styles.stepDescription}>
                  Abre el archivo Excel y completa la columna "Cantidad a Distribuir" (amarilla).
                </Text>
                <View style={styles.noteBox}>
                  <Text style={styles.noteTitle}>⚠️ Importante:</Text>
                  <Text style={styles.noteText}>
                    • Solo se procesarán filas con cantidad {'>'} 0
                  </Text>
                  <Text style={styles.noteText}>• No modificar las demás columnas</Text>
                  <Text style={styles.noteText}>• No exceder el stock disponible</Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={styles.step}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepTitle}>Subir Archivo y Generar</Text>
                </View>
                <Text style={styles.stepDescription}>
                  Sube el archivo completado para generar los repartos automáticamente.
                </Text>
                <TouchableOpacity
                  style={[styles.button, styles.uploadButton, isUploading && styles.buttonDisabled]}
                  onPress={handleUploadFile}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <ActivityIndicator size="small" color={theme.color.text.inverse} />
                      <Text style={[styles.buttonText, { marginLeft: 8 }]}>Procesando...</Text>
                    </>
                  ) : (
                    <Text style={styles.buttonText}>📤 Subir Archivo</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Upload Result */}
            {uploadResult && (
              <View style={styles.resultContainer}>
                <View
                  style={[
                    styles.resultHeader,
                    uploadResult.success ? styles.resultSuccess : styles.resultError,
                  ]}
                >
                  <Text style={styles.resultTitle}>
                    {uploadResult.success ? '✅ Proceso Completado' : '⚠️ Completado con Errores'}
                  </Text>
                </View>

                <View style={styles.resultStats}>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatLabel}>Repartos Creados:</Text>
                    <Text style={styles.resultStatValue}>{uploadResult.repartosCreated}</Text>
                  </View>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatLabel}>Productos:</Text>
                    <Text style={styles.resultStatValue}>{uploadResult.totalProducts}</Text>
                  </View>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatLabel}>Cantidad Total:</Text>
                    <Text style={styles.resultStatValue}>{uploadResult.totalQuantity}</Text>
                  </View>
                </View>

                {uploadResult.errors.length > 0 && (
                  <View style={styles.errorsContainer}>
                    <Text style={styles.errorsTitle}>
                      ❌ Errores ({uploadResult.errors.length}):
                    </Text>
                    <ScrollView style={styles.errorsList} nestedScrollEnabled>
                      {uploadResult.errors.map((error, index) => (
                        <View key={index} style={styles.errorItem}>
                          <Text style={styles.errorRow}>Fila {error.row}</Text>
                          <Text style={styles.errorParticipant}>{error.participantName}</Text>
                          <Text style={styles.errorProduct}>SKU: {error.productSku}</Text>
                          <Text style={styles.errorMessage}>{error.error}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },
    modalContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: '100%',
      maxWidth: 600,
      maxHeight: '90%',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    scrollView: {
      padding: theme.space[5],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[4],
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.background.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 20,
      color: theme.color.text.subtle,
      fontWeight: 'bold',
    },
    description: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginBottom: theme.space[6],
      lineHeight: 20,
    },
    stepsContainer: {
      gap: theme.space[5],
    },
    step: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    stepNumberText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.color.text.inverse,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    stepDescription: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginBottom: theme.space[3],
      lineHeight: 20,
    },
    button: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.lg,
      marginTop: theme.space[2],
    },
    downloadButton: {
      backgroundColor: theme.color.brand.accent,
    },
    uploadButton: {
      backgroundColor: theme.color.action.success.background,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    noteBox: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginTop: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    noteTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.state.warning.text,
      marginBottom: theme.space[1.5],
    },
    noteText: {
      fontSize: 12,
      color: theme.color.state.warning.text,
      lineHeight: 18,
    },
    resultContainer: {
      marginTop: theme.space[6],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      overflow: 'hidden',
    },
    resultHeader: {
      padding: theme.space[4],
    },
    resultSuccess: {
      backgroundColor: theme.color.state.success.background,
    },
    resultError: {
      backgroundColor: theme.color.state.danger.background,
    },
    resultTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    resultStats: {
      padding: theme.space[4],
      gap: theme.space[3],
    },
    resultStat: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    resultStatLabel: {
      fontSize: 14,
      color: theme.color.text.subtle,
    },
    resultStatValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    errorsContainer: {
      padding: theme.space[4],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    errorsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.danger,
      marginBottom: theme.space[3],
    },
    errorsList: {
      maxHeight: 200,
    },
    errorItem: {
      backgroundColor: theme.color.state.danger.background,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.state.danger.border,
    },
    errorRow: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.state.danger.text,
      marginBottom: theme.space[1],
    },
    errorParticipant: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    errorProduct: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginBottom: theme.space[1],
    },
    errorMessage: {
      fontSize: 12,
      color: theme.color.text.danger,
      fontStyle: 'italic',
    },
  });
