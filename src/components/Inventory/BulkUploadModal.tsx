import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Alert from '@/utils/alert';

import { inventoryApi } from '@/services/api/inventory';
import { useSendStockFormat } from '@/hooks/api/useStock';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { getDocumentAsync } from '@/utils/filePicker';
import { siteContactsApi } from '@/services/api/site-contacts';
import type { SiteContact } from '@/types/site-contacts';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import logger from '@/utils/logger';

type RecipientMode = 'contact' | 'phone';

interface BulkUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadResult {
  success: boolean;
  totalRows: number;
  updatedRows: number;
  errors: Array<{ row: number; sku: string; error: string }>;
}

const sanitizePhoneNumber = (raw: string): string => raw.replace(/\D/g, '');

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, currentSite } = useAuthStore();
  const { selectedSite } = useTenantStore();

  const sendStockFormat = useSendStockFormat();

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Destinatario para envío del formato por WhatsApp
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('contact');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [caption, setCaption] = useState('');

  const effectiveSite = selectedSite || currentSite;
  const sendingFormat = sendStockFormat.isPending;

  useEffect(() => {
    if (visible) {
      setUploadResult(null);
      setRecipientMode('contact');
      setSelectedContactId(null);
      setPhoneNumber('');
      setContactName('');
      setCaption('');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    if (!effectiveSite?.id) {
      setContacts([]);
      setLoadingContacts(false);
      return;
    }
    (async () => {
      try {
        setLoadingContacts(true);
        const data = await siteContactsApi.getSiteContacts(effectiveSite.id);
        if (cancelled) return;
        const list: SiteContact[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
        const eligible = list.filter((c) => c.isActive && c.receiveWhatsApp && !!c.phoneNumber);
        setContacts(eligible);
        if (eligible.length === 1) {
          setSelectedContactId(eligible[0].id);
        } else if (eligible.length === 0) {
          setRecipientMode('phone');
        }
      } catch (error) {
        logger.error('Error cargando contactos de sede', error);
        if (!cancelled) {
          setContacts([]);
          setRecipientMode('phone');
        }
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, effectiveSite?.id]);

  const cleanedPhone = useMemo(() => sanitizePhoneNumber(phoneNumber), [phoneNumber]);
  const recipientValid = useMemo(() => {
    if (recipientMode === 'contact') return !!selectedContactId;
    return cleanedPhone.length >= 8;
  }, [recipientMode, selectedContactId, cleanedPhone]);

  const handleSendFormat = async () => {
    if (!effectiveSite) {
      Alert.alert('Sede requerida', 'Selecciona una sede antes de generar el formato');
      return;
    }
    if (!recipientValid) {
      Alert.alert(
        'Destinatario requerido',
        recipientMode === 'contact'
          ? 'Selecciona un contacto de sede con WhatsApp habilitado.'
          : 'Ingresa un número de celular válido con código de país (ej. 51999888777).'
      );
      return;
    }

    const base = {
      siteId: effectiveSite.id,
      ...(caption.trim() && { caption: caption.trim() }),
    };

    const payload =
      recipientMode === 'contact'
        ? { ...base, siteContactId: selectedContactId! }
        : {
            ...base,
            phoneNumber: cleanedPhone,
            ...(contactName.trim() && { contactName: contactName.trim() }),
          };

    try {
      const result = await sendStockFormat.mutateAsync(payload);
      const displayName =
        result.contactName ||
        (recipientMode === 'contact'
          ? contacts.find((c) => c.id === selectedContactId)?.contactName || 'el destinatario'
          : contactName.trim() || cleanedPhone);
      Alert.alert(
        'Envío programado',
        result.message ||
          `El formato de stock se está generando y se enviará por WhatsApp a ${displayName}.`
      );
    } catch (err: any) {
      logger.error('Error enviando formato de stock por WhatsApp', err);
      const backendMessage =
        err?.response?.data?.message || err?.message || 'No se pudo generar el formato de stock';
      Alert.alert('No se pudo generar el formato', backendMessage);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      await handleUploadFile(result);
    } catch (error: any) {
      logger.error('Error seleccionando archivo', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Por favor, intenta nuevamente.');
    }
  };

  const handleUploadFile = async (fileResult: any) => {
    try {
      setUploading(true);
      setUploadResult(null);

      const file = fileResult.assets?.[0];
      if (!file) throw new Error('No se pudo obtener el archivo');
      if (!user?.id) throw new Error('No se pudo identificar el usuario');

      let fileToUpload: any;
      if (Platform.OS === 'web') {
        if (file.file) {
          fileToUpload = file.file;
        } else {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          fileToUpload = new File([blob], file.name, {
            type:
              file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        }
      } else {
        fileToUpload = {
          uri: file.uri,
          type:
            file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: file.name,
        };
      }

      const result = await inventoryApi.uploadStockUpdate(fileToUpload as any, user.id);
      setUploadResult(result);

      if (result.errors.length === 0) {
        Alert.alert(
          'Éxito',
          `Se actualizaron ${result.updatedRows} registros de stock correctamente.`,
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
      } else if (result.updatedRows > 0) {
        Alert.alert(
          'Actualización parcial',
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
      logger.error('Error subiendo actualización de stock', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message ||
          error?.message ||
          'No se pudo cargar el archivo. Por favor, intenta nuevamente.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (sendingFormat || uploading) return;
    setUploadResult(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.headerButton}
              disabled={sendingFormat || uploading}
            >
              <Ionicons name="close" size={24} color={theme.color.text.muted} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Actualización masiva de stock</Text>
            <View style={styles.headerButton} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Hero */}
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Ionicons name="logo-whatsapp" size={28} color={theme.color.brand.accent} />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>Envío del formato por WhatsApp</Text>
                <Text style={styles.heroSubtitle}>Sede: {effectiveSite?.name || '—'}</Text>
                <Text style={styles.heroHelper}>
                  El Excel se genera en background y llega al destinatario por WhatsApp.
                </Text>
              </View>
            </View>

            {/* Instrucciones */}
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>📋 ¿Cómo funciona?</Text>
              <Text style={styles.noteText}>
                1. Selecciona el destinatario y genera el formato — llega por WhatsApp.
              </Text>
              <Text style={styles.noteText}>
                2. Edita el Excel: columna &quot;NUEVO STOCK BASE&quot; y opcionalmente &quot;NUEVO
                ESTADO&quot; (ACTIVO / ARCHIVADO).
              </Text>
              <Text style={styles.noteText}>
                3. Vuelve aquí y sube el archivo editado para aplicar los cambios.
              </Text>
              <Text style={styles.noteText}>
                • Los productos archivados no aparecen en el formato ni en el reporte.
              </Text>
            </View>

            {/* Destinatario */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Destinatario</Text>
              <View style={styles.modeSwitch}>
                <TouchableOpacity
                  style={[
                    styles.modeSwitchButton,
                    recipientMode === 'contact' && styles.modeSwitchButtonActive,
                  ]}
                  onPress={() => setRecipientMode('contact')}
                  disabled={sendingFormat}
                >
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={
                      recipientMode === 'contact' ? theme.color.text.inverse : theme.color.text.body
                    }
                  />
                  <Text
                    style={[
                      styles.modeSwitchText,
                      recipientMode === 'contact' && styles.modeSwitchTextActive,
                    ]}
                  >
                    Contacto de sede
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeSwitchButton,
                    recipientMode === 'phone' && styles.modeSwitchButtonActive,
                  ]}
                  onPress={() => setRecipientMode('phone')}
                  disabled={sendingFormat}
                >
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color={
                      recipientMode === 'phone' ? theme.color.text.inverse : theme.color.text.body
                    }
                  />
                  <Text
                    style={[
                      styles.modeSwitchText,
                      recipientMode === 'phone' && styles.modeSwitchTextActive,
                    ]}
                  >
                    Celular libre
                  </Text>
                </TouchableOpacity>
              </View>

              {recipientMode === 'contact' ? (
                loadingContacts ? (
                  <View style={styles.contactsLoading}>
                    <ActivityIndicator size="small" color={theme.color.brand.primary} />
                    <Text style={styles.contactsLoadingText}>Cargando contactos...</Text>
                  </View>
                ) : !effectiveSite ? (
                  <View style={styles.emptyContacts}>
                    <Text style={styles.emptyContactsText}>
                      Selecciona una sede para ver los contactos disponibles.
                    </Text>
                  </View>
                ) : contacts.length === 0 ? (
                  <View style={styles.emptyContacts}>
                    <Text style={styles.emptyContactsText}>
                      No hay contactos activos con WhatsApp habilitado para la sede{' '}
                      {effectiveSite.name}.
                    </Text>
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
                          disabled={sendingFormat}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.contactName}>{contact.contactName}</Text>
                            <Text style={styles.contactMeta}>
                              {contact.phoneNumber}
                              {contact.position ? ` · ${contact.position}` : ''}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color={theme.color.brand.primary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )
              ) : (
                <View style={styles.phoneForm}>
                  <Text style={styles.fieldLabel}>Número de celular *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="51999888777"
                    placeholderTextColor={theme.color.text.placeholder}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    editable={!sendingFormat}
                    maxLength={15}
                  />
                  <Text style={styles.helperText}>
                    Incluye el código de país (Perú: 51). Solo dígitos.
                  </Text>
                  <Text style={[styles.fieldLabel, { marginTop: theme.space[3] }]}>
                    Nombre del contacto (opcional)
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. Almacén Cercado"
                    placeholderTextColor={theme.color.text.placeholder}
                    value={contactName}
                    onChangeText={setContactName}
                    editable={!sendingFormat}
                  />
                </View>
              )}
            </View>

            {/* Caption */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mensaje (opcional)</Text>
              <TextInput
                style={[styles.input, styles.captionInput]}
                placeholder="Formato de stock Cercado"
                placeholderTextColor={theme.color.text.placeholder}
                value={caption}
                onChangeText={setCaption}
                editable={!sendingFormat}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Enviar formato */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!recipientValid || sendingFormat) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendFormat}
              disabled={!recipientValid || sendingFormat}
            >
              {sendingFormat ? (
                <ActivityIndicator size="small" color={theme.color.text.inverse} />
              ) : (
                <Ionicons name="logo-whatsapp" size={20} color={theme.color.text.inverse} />
              )}
              <Text style={styles.sendButtonText}>
                {sendingFormat ? 'Enviando formato...' : 'Generar y enviar formato por WhatsApp'}
              </Text>
            </TouchableOpacity>

            {/* Separador */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o sube el formato ya editado</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Subir archivo */}
            <TouchableOpacity
              style={[
                styles.uploadButton,
                (uploading || sendingFormat) && styles.sendButtonDisabled,
              ]}
              onPress={handleSelectFile}
              disabled={uploading || sendingFormat}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={theme.color.brand.primary} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={20} color={theme.color.brand.primary} />
              )}
              <Text style={styles.uploadButtonText}>
                {uploading ? 'Subiendo...' : 'Subir archivo editado (.xlsx)'}
              </Text>
            </TouchableOpacity>

            {/* Resultado */}
            {uploadResult && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Resultado de la actualización</Text>
                <View style={styles.resultStats}>
                  <View style={styles.resultStatItem}>
                    <Text style={styles.resultStatValue}>{uploadResult.totalRows}</Text>
                    <Text style={styles.resultStatLabel}>Total filas</Text>
                  </View>
                  <View style={[styles.resultStatItem, styles.successStat]}>
                    <Text
                      style={[styles.resultStatValue, { color: theme.color.state.success.text }]}
                    >
                      {uploadResult.updatedRows}
                    </Text>
                    <Text style={styles.resultStatLabel}>Actualizados</Text>
                  </View>
                  <View style={[styles.resultStatItem, styles.errorStat]}>
                    <Text
                      style={[styles.resultStatValue, { color: theme.color.state.danger.text }]}
                    >
                      {uploadResult.errors.length}
                    </Text>
                    <Text style={styles.resultStatLabel}>Errores</Text>
                  </View>
                </View>

                {uploadResult.errors.length > 0 && (
                  <View style={styles.errorsSection}>
                    <Text style={styles.errorsTitle}>
                      ⚠️ Errores encontrados ({uploadResult.errors.length})
                    </Text>
                    {uploadResult.errors.slice(0, 20).map((error, index) => (
                      <View key={index} style={styles.errorItem}>
                        <Text style={styles.errorRow}>Fila {error.row}</Text>
                        <Text style={styles.errorMeta}>SKU: {error.sku}</Text>
                        <Text style={styles.errorMessage}>{error.error}</Text>
                      </View>
                    ))}
                    {uploadResult.errors.length > 20 && (
                      <Text style={styles.helperText}>
                        Mostrando 20 de {uploadResult.errors.length} errores.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={theme.color.state.info.text}
              />
              <Text style={styles.infoText}>
                Datasets grandes (~20k filas) se procesan por lotes y el WhatsApp puede tardar
                algunos minutos. Es normal.
              </Text>
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
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '92%',
      minHeight: 420,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    scrollView: { flex: 1 },
    scrollContent: { padding: theme.space[4], gap: theme.space[4] },
    heroCard: {
      flexDirection: 'row',
      gap: theme.space[3],
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.brand.accentSoft,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTextContainer: { flex: 1 },
    heroTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    heroSubtitle: { fontSize: 13, lineHeight: 19, color: theme.color.text.body },
    heroHelper: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
    },
    notesSection: {
      backgroundColor: theme.color.state.info.background,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
      gap: theme.space[1.5],
    },
    notesTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.state.info.text,
      marginBottom: theme.space[1],
    },
    noteText: { fontSize: 12, lineHeight: 18, color: theme.color.state.info.text },
    section: { gap: theme.space[2] },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.color.text.heading },
    helperText: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
      fontStyle: 'italic',
    },
    modeSwitch: {
      flexDirection: 'row',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.full,
      padding: 4,
      gap: 4,
    },
    modeSwitchButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[1],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
    },
    modeSwitchButtonActive: { backgroundColor: theme.color.brand.primary },
    modeSwitchText: { fontSize: 13, fontWeight: '600', color: theme.color.text.body },
    modeSwitchTextActive: { color: theme.color.text.inverse },
    contactsLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
    },
    contactsLoadingText: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginLeft: theme.space[2],
    },
    emptyContacts: {
      backgroundColor: theme.color.state.warning.background,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.state.warning.border,
    },
    emptyContactsText: { fontSize: 13, color: theme.color.state.warning.text },
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
    contactItemSelected: { backgroundColor: theme.color.brand.accentSoft },
    contactName: { fontSize: 14, fontWeight: '600', color: theme.color.text.heading },
    contactMeta: { fontSize: 12, color: theme.color.text.muted, marginTop: 2 },
    phoneForm: { gap: theme.space[1] },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: theme.space[1],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2.5],
      fontSize: 14,
      color: theme.color.text.heading,
      backgroundColor: theme.color.surface.base,
    },
    captionInput: { minHeight: 60, textAlignVertical: 'top' },
    sendButton: {
      flexDirection: 'row',
      gap: theme.space[2],
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: { opacity: 0.5 },
    sendButtonText: { fontSize: 14, fontWeight: '700', color: theme.color.text.inverse },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      marginVertical: theme.space[1],
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.color.border.subtle },
    dividerText: { fontSize: 12, color: theme.color.text.muted, fontWeight: '600' },
    uploadButton: {
      flexDirection: 'row',
      gap: theme.space[2],
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 2,
      borderColor: theme.color.brand.primary,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadButtonText: { fontSize: 14, fontWeight: '700', color: theme.color.brand.primary },
    resultCard: {
      padding: theme.space[4],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    resultTitle: { fontSize: 14, fontWeight: '700', color: theme.color.text.heading },
    resultStats: {
      flexDirection: 'row',
      gap: theme.space[3],
      justifyContent: 'space-around',
    },
    resultStatItem: {
      flex: 1,
      alignItems: 'center',
      padding: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
    },
    successStat: { backgroundColor: theme.color.state.success.background },
    errorStat: { backgroundColor: theme.color.state.danger.background },
    resultStatValue: { fontSize: 20, fontWeight: '700', color: theme.color.text.heading },
    resultStatLabel: { fontSize: 11, color: theme.color.text.muted, marginTop: 2 },
    errorsSection: { gap: theme.space[2] },
    errorsTitle: { fontSize: 13, fontWeight: '700', color: theme.color.state.danger.text },
    errorItem: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.color.state.danger.border,
      gap: 2,
    },
    errorRow: { fontSize: 12, fontWeight: '600', color: theme.color.state.danger.text },
    errorMeta: { fontSize: 11, color: theme.color.text.muted },
    errorMessage: { fontSize: 12, color: theme.color.text.body },
    infoBox: {
      flexDirection: 'row',
      gap: theme.space[2],
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.state.info.background,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: theme.color.state.info.text,
    },
  });

export default BulkUploadModal;
