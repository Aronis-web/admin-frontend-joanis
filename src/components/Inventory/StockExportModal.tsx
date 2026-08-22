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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Alert from '@/utils/alert';

import { DatePicker } from '@/components/DatePicker';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useSendStockReport } from '@/hooks/api/useStock';
import type { ExportFormat, ExportStockDto } from '@/services/api/inventory';
import { siteContactsApi } from '@/services/api/site-contacts';
import type { SiteContact } from '@/types/site-contacts';
import logger from '@/utils/logger';

type RecipientMode = 'contact' | 'phone';

interface StockExportModalProps {
  visible: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
}

const sanitizePhoneNumber = (raw: string): string => raw.replace(/\D/g, '');

export const StockExportModal: React.FC<StockExportModalProps> = ({
  visible,
  onClose,
  siteId,
  siteName,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const sendStockReport = useSendStockReport();

  // Config del reporte
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [includePrices, setIncludePrices] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Destinatario
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('contact');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [caption, setCaption] = useState('');

  const submitting = sendStockReport.isPending;

  // Reset al abrir
  useEffect(() => {
    if (visible) {
      setFormat('excel');
      setIncludePrices(false);
      setStartDate('');
      setEndDate('');
      setRecipientMode('contact');
      setSelectedContactId(null);
      setPhoneNumber('');
      setContactName('');
      setCaption('');
    }
  }, [visible]);

  // Cargar contactos elegibles cuando se abre el modal
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    if (!siteId) {
      setContacts([]);
      setLoadingContacts(false);
      return;
    }
    (async () => {
      try {
        setLoadingContacts(true);
        const data = await siteContactsApi.getSiteContacts(siteId);
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
  }, [visible, siteId]);

  const cleanedPhone = useMemo(() => sanitizePhoneNumber(phoneNumber), [phoneNumber]);
  const recipientValid = useMemo(() => {
    if (recipientMode === 'contact') return !!selectedContactId;
    return cleanedPhone.length >= 8;
  }, [recipientMode, selectedContactId, cleanedPhone]);
  const canSubmit = !submitting && recipientValid;

  const parseDate = (dateString: string): Date => (dateString ? new Date(dateString) : new Date());

  const handleSend = async () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        Alert.alert('Error', 'La fecha de inicio no puede ser mayor a la fecha de fin');
        return;
      }
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

    const base: ExportStockDto = {
      format,
      siteId,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      includePrices,
      ...(caption.trim() && { caption: caption.trim() }),
    };

    const payload: ExportStockDto =
      recipientMode === 'contact'
        ? { ...base, siteContactId: selectedContactId! }
        : {
            ...base,
            phoneNumber: cleanedPhone,
            ...(contactName.trim() && { contactName: contactName.trim() }),
          };

    try {
      const result = await sendStockReport.mutateAsync(payload);
      const displayName =
        result.contactName ||
        (recipientMode === 'contact'
          ? contacts.find((c) => c.id === selectedContactId)?.contactName || 'el destinatario'
          : contactName.trim() || cleanedPhone);
      Alert.alert(
        'Envío programado',
        result.message ||
          `El reporte de stock se está generando y se enviará por WhatsApp a ${displayName}.`
      );
      onClose();
    } catch (err: any) {
      logger.error('Error enviando reporte de stock por WhatsApp', err);
      const backendMessage =
        err?.response?.data?.message || err?.message || 'No se pudo generar el reporte de stock';
      Alert.alert('No se pudo generar el reporte', backendMessage);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.headerButton}
                disabled={submitting}
              >
                <Ionicons name="close" size={24} color={theme.color.text.muted} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Reporte de Stock</Text>
              <View style={styles.headerButton} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {/* Hero */}
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Ionicons name="logo-whatsapp" size={28} color={theme.color.brand.accent} />
                </View>
                <View style={styles.heroTextContainer}>
                  <Text style={styles.heroTitle}>Envío por WhatsApp</Text>
                  <Text style={styles.heroSubtitle}>Sede: {siteName}</Text>
                  <Text style={styles.heroHelper}>
                    El reporte se genera en background y llega al destinatario por WhatsApp.
                  </Text>
                </View>
              </View>

              {/* Formato */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Formato de exportación</Text>
                <View style={styles.formatContainer}>
                  <TouchableOpacity
                    style={[styles.formatButton, format === 'excel' && styles.formatButtonSelected]}
                    onPress={() => setFormat('excel')}
                    disabled={submitting}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={
                        format === 'excel' ? theme.color.text.inverse : theme.color.text.subtle
                      }
                    />
                    <Text
                      style={[
                        styles.formatButtonText,
                        format === 'excel' && styles.formatButtonTextSelected,
                      ]}
                    >
                      Excel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formatButton, format === 'pdf' && styles.formatButtonSelected]}
                    onPress={() => setFormat('pdf')}
                    disabled={submitting}
                  >
                    <Ionicons
                      name="document-outline"
                      size={20}
                      color={format === 'pdf' ? theme.color.text.inverse : theme.color.text.subtle}
                    />
                    <Text
                      style={[
                        styles.formatButtonText,
                        format === 'pdf' && styles.formatButtonTextSelected,
                      ]}
                    >
                      PDF
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Fechas */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rango de fechas (opcional)</Text>
                <Text style={styles.helperText}>Filtra productos por fecha de creación.</Text>

                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                  disabled={submitting}
                >
                  <Ionicons name="calendar-outline" size={18} color={theme.color.brand.primary} />
                  <Text style={styles.dateButtonText}>
                    {startDate
                      ? new Date(startDate).toLocaleDateString('es-PE')
                      : 'Fecha de inicio'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                  disabled={submitting}
                >
                  <Ionicons name="calendar-outline" size={18} color={theme.color.brand.primary} />
                  <Text style={styles.dateButtonText}>
                    {endDate ? new Date(endDate).toLocaleDateString('es-PE') : 'Fecha de fin'}
                  </Text>
                </TouchableOpacity>

                {(startDate || endDate) && (
                  <TouchableOpacity
                    style={styles.clearDatesButton}
                    onPress={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    disabled={submitting}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={16}
                      color={theme.color.state.danger.border}
                    />
                    <Text style={styles.clearDatesText}>Limpiar fechas</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Opciones */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setIncludePrices(!includePrices)}
                  disabled={submitting}
                >
                  <View style={[styles.checkbox, includePrices && styles.checkboxChecked]}>
                    {includePrices && (
                      <Ionicons name="checkmark" size={14} color={theme.color.text.inverse} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkboxTitle}>Incluir precios y valorización</Text>
                    <Text style={styles.helperText}>
                      Muestra costos unitarios y valor total del inventario.
                    </Text>
                  </View>
                </TouchableOpacity>
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
                    disabled={submitting}
                  >
                    <Ionicons
                      name="people-outline"
                      size={16}
                      color={
                        recipientMode === 'contact'
                          ? theme.color.text.inverse
                          : theme.color.text.body
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
                    disabled={submitting}
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
                  ) : contacts.length === 0 ? (
                    <View style={styles.emptyContacts}>
                      <Text style={styles.emptyContactsText}>
                        No hay contactos activos con WhatsApp habilitado para la sede {siteName}.
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
                            disabled={submitting}
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
                      editable={!submitting}
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
                      placeholder="Ej. Almacén Central"
                      placeholderTextColor={theme.color.text.placeholder}
                      value={contactName}
                      onChangeText={setContactName}
                      editable={!submitting}
                    />
                  </View>
                )}
              </View>

              {/* Mensaje opcional */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mensaje (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.captionInput]}
                  placeholder="Reporte valorizado agosto"
                  placeholderTextColor={theme.color.text.placeholder}
                  value={caption}
                  onChangeText={setCaption}
                  editable={!submitting}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={theme.color.state.info.text}
                />
                <Text style={styles.infoText}>
                  El reporte se encola en background y llega por WhatsApp al destinatario. No hay
                  descarga directa desde el navegador. Los productos archivados no se incluyen.
                </Text>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendButton, !canSubmit && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={theme.color.text.inverse} />
                ) : (
                  <Ionicons name="logo-whatsapp" size={20} color={theme.color.text.inverse} />
                )}
                <Text style={styles.sendButtonText}>
                  {submitting ? 'Enviando...' : 'Generar y enviar por WhatsApp'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DatePicker
        visible={showStartDatePicker}
        date={startDate ? parseDate(startDate) : new Date()}
        onConfirm={(date) => {
          const isoDate = date.toISOString().split('T')[0];
          setStartDate(isoDate);
          setShowStartDatePicker(false);
          if (endDate && date > parseDate(endDate)) {
            setEndDate(isoDate);
          }
        }}
        onCancel={() => setShowStartDatePicker(false)}
        title="Fecha de inicio"
        maximumDate={new Date()}
      />

      <DatePicker
        visible={showEndDatePicker}
        date={endDate ? parseDate(endDate) : new Date()}
        onConfirm={(date) => {
          const isoDate = date.toISOString().split('T')[0];
          setEndDate(isoDate);
          setShowEndDatePicker(false);
          if (startDate && date < parseDate(startDate)) {
            setStartDate(isoDate);
          }
        }}
        onCancel={() => setShowEndDatePicker(false)}
        title="Fecha de fin"
        maximumDate={new Date()}
      />
    </>
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
    section: { gap: theme.space[2] },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.color.text.heading },
    helperText: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
      fontStyle: 'italic',
    },
    formatContainer: { flexDirection: 'row', gap: theme.space[3] },
    formatButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
    },
    formatButtonSelected: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    formatButtonText: { fontSize: 14, fontWeight: '600', color: theme.color.text.muted },
    formatButtonTextSelected: { color: theme.color.text.inverse },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
      marginTop: theme.space[2],
    },
    dateButtonText: { fontSize: 14, color: theme.color.text.body },
    clearDatesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
      alignSelf: 'flex-start',
      paddingVertical: theme.space[1.5],
      marginTop: theme.space[1],
    },
    clearDatesText: { fontSize: 12, color: theme.color.state.danger.border, fontWeight: '600' },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[3],
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: theme.radii.sm,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    checkboxTitle: { fontSize: 14, fontWeight: '600', color: theme.color.text.heading },
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
    footer: {
      flexDirection: 'row',
      gap: theme.space[3],
      padding: theme.space[4],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: { fontSize: 14, fontWeight: '700', color: theme.color.text.body },
    sendButton: {
      flex: 1.6,
      flexDirection: 'row',
      gap: theme.space[2],
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: { opacity: 0.5 },
    sendButtonText: { fontSize: 14, fontWeight: '700', color: theme.color.text.inverse },
  });

export default StockExportModal;
