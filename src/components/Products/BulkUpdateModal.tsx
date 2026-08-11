import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { productsApi } from '@/services/api/products';
import { siteContactsApi } from '@/services/api/site-contacts';
import type { SiteContact } from '@/types/site-contacts';
import { useTenantStore } from '@/store/tenant';
import { saveAndShareExcel } from '@/utils/fileDownload';
import logger from '@/utils/logger';
import { getDocumentAsync } from '@/utils/filePicker';
import Alert from '@/utils/alert';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Text, Title, Body, Caption, Label, Button, IconButton } from '@/design-system/components';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const selectedSite = useTenantStore((state) => state.selectedSite);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (!visible || mode !== 'products') return;
    let cancelled = false;
    if (!selectedSite?.id) {
      setContacts([]);
      setLoadingContacts(false);
      return;
    }
    (async () => {
      try {
        setLoadingContacts(true);
        const data = await siteContactsApi.getSiteContacts(selectedSite.id);
        if (cancelled) return;
        const eligible = data.filter((c) => c.isActive && c.receiveWhatsApp && !!c.phoneNumber);
        setContacts(eligible);
        if (eligible.length === 1) {
          setSelectedContactId(eligible[0].id);
        }
      } catch (error) {
        logger.error('❌ Error cargando contactos:', error);
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, mode, selectedSite?.id]);

  const handleSendFormat = async () => {
    if (!selectedContactId) {
      Alert.alert(
        'Contacto requerido',
        'Selecciona un contacto para recibir el formato por WhatsApp.'
      );
      return;
    }

    try {
      setLoading(true);
      logger.info('📤 Enviando formato de actualización por WhatsApp...');

      const payload: Parameters<typeof productsApi.sendBulkUpdateFormat>[0] = {
        siteContactId: selectedContactId,
      };

      if (selectedSite?.id) {
        payload.siteId = selectedSite.id;
      }
      if (fromDate) {
        payload.fromDate = fromDate;
      }
      if (toDate) {
        payload.toDate = toDate;
      }
      if (caption.trim()) {
        payload.caption = caption.trim();
      }

      const result = await productsApi.sendBulkUpdateFormat(payload);

      Alert.alert(
        'Envío programado',
        result.message ||
          `El formato se está generando y se enviará por WhatsApp a ${result.contactName}.`
      );
    } catch (error: any) {
      logger.error('❌ Error enviando formato:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Error al enviar el formato de actualización'
      );
    } finally {
      setLoading(false);
    }
  };

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
        logger.info(
          '📦 Products map available:',
          productsMap ? Object.keys(productsMap).length : 0
        );

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
          throw new Error(
            'No se encontraron números correlativos en los productos de la campaña. Asegúrate de que los productos tengan información completa.'
          );
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
        // Web: Use the original File object if available
        console.log('📤 [Web] Preparing file upload...');
        if ((selectedFile as any).file) {
          fileToUpload = (selectedFile as any).file;
          console.log('✅ Using File object');
        } else {
          // Fallback: fetch the blob from URI and create a File
          console.log('⚠️ No File object, fetching from URI...');
          const response = await fetch(selectedFile.uri);
          const blob = await response.blob();
          fileToUpload = new File([blob], selectedFile.name, {
            type:
              selectedFile.mimeType ||
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        }
      } else {
        // Mobile: Create file object from URI
        fileToUpload = {
          uri: selectedFile.uri,
          type:
            selectedFile.mimeType ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
    setSelectedContactId(null);
    setCaption('');
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
                {mode === 'products'
                  ? 'Actualización Masiva de Productos'
                  : 'Actualización de Productos de Campaña'}
              </Title>
              <IconButton icon="close" onPress={handleClose} variant="ghost" size="small" />
            </View>

            {/* Instructions */}
            <View style={styles.section}>
              <Label size="large" style={styles.sectionTitle}>
                📋 Instrucciones
              </Label>
              <Body size="small" color="secondary">
                {mode === 'products'
                  ? '1. Envía el formato Excel por WhatsApp a un contacto\n2. Modifica SKU, Nombre, Costo y/o Precios en el archivo recibido\n3. NO modifiques la columna "Correlativo"\n4. Sube el archivo modificado para actualizar'
                  : '1. Descarga el formato Excel con los productos\n2. Modifica SKU, Nombre, Costo y/o Precios\n3. NO modifiques la columna "Correlativo"\n4. Sube el archivo modificado para actualizar'}
              </Body>
            </View>

            {/* Download Section */}
            <View style={styles.section}>
              <Label size="large" style={styles.sectionTitle}>
                {mode === 'products'
                  ? '📲 Paso 1: Enviar Formato por WhatsApp'
                  : '📥 Paso 1: Descargar Formato'}
              </Label>

              {mode === 'products' && (
                <View style={styles.filterContainer}>
                  <Label size="medium" color="secondary" style={styles.filterLabel}>
                    Filtrar por fechas (opcional):
                  </Label>
                  <View style={styles.dateInputContainer}>
                    <View style={styles.dateInput}>
                      <Caption color="tertiary" style={styles.dateLabel}>
                        Desde:
                      </Caption>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.color.text.placeholder}
                        value={fromDate}
                        onChangeText={setFromDate}
                        editable={!loading}
                      />
                    </View>
                    <View style={styles.dateInput}>
                      <Caption color="tertiary" style={styles.dateLabel}>
                        Hasta:
                      </Caption>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.color.text.placeholder}
                        value={toDate}
                        onChangeText={setToDate}
                        editable={!loading}
                      />
                    </View>
                  </View>
                  <Caption color="tertiary" style={styles.helperText}>
                    Deja vacío para incluir todos los productos
                  </Caption>

                  <Label
                    size="medium"
                    color="secondary"
                    style={[styles.filterLabel, { marginTop: theme.space[4] }]}
                  >
                    Contacto que recibirá el WhatsApp *
                  </Label>
                  {loadingContacts ? (
                    <View style={styles.contactsLoading}>
                      <ActivityIndicator size="small" color={theme.color.brand.primary} />
                      <Caption color="tertiary" style={{ marginLeft: theme.space[2] }}>
                        Cargando contactos...
                      </Caption>
                    </View>
                  ) : !selectedSite ? (
                    <View style={styles.emptyContacts}>
                      <Caption color={theme.color.state.warning.text}>
                        Selecciona una sede para ver los contactos disponibles.
                      </Caption>
                    </View>
                  ) : contacts.length === 0 ? (
                    <View style={styles.emptyContacts}>
                      <Caption color={theme.color.state.warning.text}>
                        No hay contactos activos con WhatsApp habilitado para la sede{' '}
                        {selectedSite.name}.
                      </Caption>
                    </View>
                  ) : (
                    <View style={styles.contactsList}>
                      {contacts.map((contact) => {
                        const isSelected = selectedContactId === contact.id;
                        return (
                          <TouchableOpacity
                            key={contact.id}
                            style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                            onPress={() => setSelectedContactId(contact.id)}
                            disabled={loading}
                          >
                            <View style={{ flex: 1 }}>
                              <Body size="small" color={isSelected ? 'primary' : 'heading'}>
                                {contact.contactName}
                              </Body>
                              <Caption color="tertiary">
                                {contact.phoneNumber}
                                {contact.position ? ` · ${contact.position}` : ''}
                              </Caption>
                            </View>
                            {isSelected && <Caption color={theme.color.brand.primary}>✓</Caption>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <Label
                    size="medium"
                    color="secondary"
                    style={[styles.filterLabel, { marginTop: theme.space[4] }]}
                  >
                    Mensaje (opcional)
                  </Label>
                  <TextInput
                    style={[styles.input, styles.captionInput]}
                    placeholder="Texto que acompañará al archivo en WhatsApp"
                    placeholderTextColor={theme.color.text.placeholder}
                    value={caption}
                    onChangeText={setCaption}
                    editable={!loading}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}

              {mode === 'campaign' && (
                <Body size="small" color="secondary" style={styles.campaignInfo}>
                  Se descargarán los productos de esta campaña
                </Body>
              )}

              <Button
                title={
                  mode === 'products' ? '📲 Enviar por WhatsApp' : '📥 Descargar Formato Excel'
                }
                variant="primary"
                onPress={mode === 'products' ? handleSendFormat : handleDownloadFormat}
                disabled={
                  loading || (mode === 'products' && (loadingContacts || !selectedContactId))
                }
                loading={loading}
                fullWidth
                style={styles.actionButton}
              />
            </View>

            {/* Upload Section */}
            <View style={styles.section}>
              <Label size="large" style={styles.sectionTitle}>
                📤 Paso 2: Subir Archivo Modificado
              </Label>

              {selectedFile && (
                <View style={styles.fileInfo}>
                  <Body size="small" color="primary" style={{ flex: 1 }}>
                    📄 {selectedFile.name}
                  </Body>
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
              <Caption color={theme.color.state.warning.text}>
                ⚠️ Los precios están en SOLES y se convierten automáticamente a céntimos
              </Caption>
              <Caption color={theme.color.state.warning.text} style={{ marginTop: theme.space[1] }}>
                ⚠️ Si modificas el costo, los precios NO se recalculan automáticamente
              </Caption>
            </View>
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
      ...theme.shadow.xl,
    },
    scrollView: {
      padding: theme.space[6],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[5],
    },
    section: {
      marginBottom: theme.space[6],
    },
    sectionTitle: {
      marginBottom: theme.space[3],
    },
    filterContainer: {
      marginBottom: theme.space[4],
    },
    filterLabel: {
      marginBottom: theme.space[2],
    },
    dateInputContainer: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    dateInput: {
      flex: 1,
    },
    dateLabel: {
      marginBottom: theme.space[1],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      padding: theme.space[2.5],
      fontSize: 14,
      color: theme.color.text.heading,
      backgroundColor: theme.color.surface.base,
    },
    helperText: {
      marginTop: theme.space[1.5],
      fontStyle: 'italic',
    },
    captionInput: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    contactsLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
    },
    emptyContacts: {
      backgroundColor: theme.color.state.warning.background,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.state.warning.border,
    },
    contactsList: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      overflow: 'hidden',
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    contactItemSelected: {
      backgroundColor: theme.color.brand.accentSoft,
    },
    campaignInfo: {
      marginBottom: theme.space[3],
      fontStyle: 'italic',
    },
    actionButton: {
      marginTop: theme.space[3],
    },
    fileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[2],
    },
    warningContainer: {
      backgroundColor: theme.color.state.warning.background,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.state.warning.border,
    },
  });
