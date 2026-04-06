import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { productsApi } from '@/services/api/products';
import { saveAndShareExcel } from '@/utils/fileDownload';
import logger from '@/utils/logger';
import { getDocumentAsync } from '@/utils/filePicker';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Label,
  Button,
  IconButton,
} from '@/design-system/components';

interface BulkUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode: 'products' | 'campaign';
  campaignProducts?: Array<{ productId: string; product?: { correlativeNumber?: number } }>;
  productsMap?: Record<string, { correlativeNumber?: number }>;
}

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
  visible,
  onClose,
  onSuccess,
  mode,
  campaignProducts,
  productsMap,
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
        logger.info('📦 Campaign products received:', campaignProducts.length);
        logger.info('📦 Products map available:', productsMap ? Object.keys(productsMap).length : 0);

        const correlatives = campaignProducts
          .map((cp) => {
            // Primero intentar obtener del producto embebido
            let correlative = cp.product?.correlativeNumber;

            // Si no está en el producto embebido, buscar en el productsMap
            if (!correlative && productsMap && productsMap[cp.productId]) {
              correlative = productsMap[cp.productId].correlativeNumber;
            }

            logger.info(`Product ${cp.productId}: correlative = ${correlative}`);
            return correlative;
          })
          .filter((num): num is number => num !== undefined && num !== null);

        logger.info('📊 Correlatives extracted:', correlatives);

        if (correlatives.length === 0) {
          throw new Error('No se encontraron números correlativos en los productos de la campaña. Asegúrate de que los productos tengan información completa.');
        }

        filters.correlatives = correlatives;
      }

      const response = await productsApi.downloadBulkUpdateFormat(filters);

      // Generate filename with timestamp
      const timestamp = new Date().getTime();
      const fileName = `productos_actualizacion_${timestamp}.xlsx`;

      await saveAndShareExcel(response, fileName, 'Formato de Actualización');

      Alert.alert(
        'Éxito',
        'Formato descargado correctamente. Modifica el archivo y súbelo para actualizar los productos.'
      );
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
      const result = await getDocumentAsync({
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
              <Title size="medium" style={{ flex: 1 }}>
                {mode === 'products' ? 'Actualización Masiva de Productos' : 'Actualización de Productos de Campaña'}
              </Title>
              <IconButton
                icon="close"
                onPress={handleClose}
                variant="ghost"
                size="small"
              />
            </View>

            {/* Instructions */}
            <View style={styles.section}>
              <Label size="large" style={styles.sectionTitle}>📋 Instrucciones</Label>
              <Body size="small" color="secondary">
                1. Descarga el formato Excel con los productos{'\n'}
                2. Modifica SKU, Nombre, Costo y/o Precios{'\n'}
                3. NO modifiques la columna "Correlativo"{'\n'}
                4. Sube el archivo modificado para actualizar
              </Body>
            </View>

            {/* Download Section */}
            <View style={styles.section}>
              <Label size="large" style={styles.sectionTitle}>📥 Paso 1: Descargar Formato</Label>

              {mode === 'products' && (
                <View style={styles.filterContainer}>
                  <Label size="medium" color="secondary" style={styles.filterLabel}>
                    Filtrar por fechas (opcional):
                  </Label>
                  <View style={styles.dateInputContainer}>
                    <View style={styles.dateInput}>
                      <Caption color="tertiary" style={styles.dateLabel}>Desde:</Caption>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.text.placeholder}
                        value={fromDate}
                        onChangeText={setFromDate}
                        editable={!loading}
                      />
                    </View>
                    <View style={styles.dateInput}>
                      <Caption color="tertiary" style={styles.dateLabel}>Hasta:</Caption>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.text.placeholder}
                        value={toDate}
                        onChangeText={setToDate}
                        editable={!loading}
                      />
                    </View>
                  </View>
                  <Caption color="tertiary" style={styles.helperText}>
                    Deja vacío para descargar todos los productos
                  </Caption>
                </View>
              )}

              {mode === 'campaign' && (
                <Body size="small" color="secondary" style={styles.campaignInfo}>
                  Se descargarán los productos de esta campaña
                </Body>
              )}

              <Button
                title="📥 Descargar Formato Excel"
                variant="primary"
                onPress={handleDownloadFormat}
                disabled={loading}
                loading={loading}
                fullWidth
                style={styles.actionButton}
              />
            </View>

            {/* Upload Section */}
            <View style={styles.section}>
              <Label size="large" style={styles.sectionTitle}>📤 Paso 2: Subir Archivo Modificado</Label>

              {selectedFile && (
                <View style={styles.fileInfo}>
                  <Body size="small" color="primary" style={{ flex: 1 }}>📄 {selectedFile.name}</Body>
                  <IconButton
                    icon="close-circle"
                    onPress={() => setSelectedFile(null)}
                    variant="ghost"
                    size="small"
                  />
                </View>
              )}

              <Button
                title={selectedFile ? '📄 Cambiar Archivo' : '📄 Seleccionar Archivo'}
                variant="secondary"
                onPress={handleSelectFile}
                disabled={loading}
                fullWidth
                style={styles.actionButton}
              />

              {selectedFile && (
                <Button
                  title="🚀 Actualizar Productos"
                  variant="success"
                  onPress={handleUploadFile}
                  disabled={loading}
                  loading={loading}
                  fullWidth
                  style={styles.actionButton}
                />
              )}
            </View>

            {/* Warning */}
            <View style={styles.warningContainer}>
              <Caption color={colors.warning[800]}>
                ⚠️ Los precios están en SOLES y se convierten automáticamente a céntimos
              </Caption>
              <Caption color={colors.warning[800]} style={{ marginTop: spacing[1] }}>
                ⚠️ Si modificas el costo, los precios NO se recalculan automáticamente
              </Caption>
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
  scrollView: {
    padding: spacing[6],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    marginBottom: spacing[3],
  },
  filterContainer: {
    marginBottom: spacing[4],
  },
  filterLabel: {
    marginBottom: spacing[2],
  },
  dateInputContainer: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    padding: spacing[2.5],
    fontSize: 14,
    color: colors.text.primary,
    backgroundColor: colors.surface.primary,
  },
  helperText: {
    marginTop: spacing[1.5],
    fontStyle: 'italic',
  },
  campaignInfo: {
    marginBottom: spacing[3],
    fontStyle: 'italic',
  },
  actionButton: {
    marginTop: spacing[3],
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.secondary,
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
  },
  warningContainer: {
    backgroundColor: colors.warning[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
});
