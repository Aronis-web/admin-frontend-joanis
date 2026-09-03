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
import Alert from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';

import { DateRangePicker } from '@/components/DateRangePicker';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  useSendKardexSalidas,
  useSendKardexSalidasDetalle,
  useSendRegistroVentas,
} from '@/hooks/api/useReports';
import type {
  SendKardexSalidasPayload,
  SendPleReportResponse,
  SendRegistroVentasPayload,
} from '@/services/api/reports';
import { siteContactsApi } from '@/services/api/site-contacts';
import type { SiteContact } from '@/types/site-contacts';
import logger from '@/utils/logger';
import {
  AVAILABLE_QUICK_FILTERS,
  getDateRangeByFilter,
  QUICK_DATE_FILTERS,
  QuickDateFilter,
  validateDateRange,
} from '@/utils/dateFilters';

export type PleLibroCode = '14.1' | '12.1' | '12.1-detallado';

interface PleLibroMeta {
  code: PleLibroCode;
  codigoLibro: string;
  title: string;
  subtitle: string;
  captionPlaceholder: string;
}

const PLE_LIBRO_META: Record<PleLibroCode, PleLibroMeta> = {
  '14.1': {
    code: '14.1',
    codigoLibro: '14010000',
    title: 'Registro de Ventas 14.1',
    subtitle: 'PLE SUNAT · Libro Electrónico de Ventas e Ingresos (01/03/07/08)',
    captionPlaceholder: 'Registro de ventas del periodo',
  },
  '12.1': {
    code: '12.1',
    codigoLibro: '12010000',
    title: 'Kardex 12.1 (Salidas)',
    subtitle: 'PLE SUNAT · Kardex Físico de Salidas (Guías de Remisión 09)',
    captionPlaceholder: 'Kardex de salidas del periodo',
  },
  '12.1-detallado': {
    code: '12.1-detallado',
    codigoLibro: '12010000',
    title: 'Kardex 12.1 Detallado (Salidas)',
    subtitle: 'Movimiento de almacén · Egresos (Guías 09 detalle)',
    captionPlaceholder: 'Movimiento de almacén del periodo',
  },
};

type RecipientMode = 'contact' | 'phone';

interface PleSunatReportModalProps {
  visible: boolean;
  onClose: () => void;
  libro: PleLibroCode;
}

const dateFromIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const formatIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplay = (iso: string): string => {
  if (!iso) return '—';
  return dateFromIso(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const periodoFromIso = (iso: string): string => iso.replace(/-/g, '').substring(0, 6);

const sanitizePhoneNumber = (raw: string): string => raw.replace(/\D/g, '');

export const PleSunatReportModal: React.FC<PleSunatReportModalProps> = ({
  visible,
  onClose,
  libro,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const meta = PLE_LIBRO_META[libro];
  const authStore = useAuthStore();
  const tenantStore = useTenantStore();

  const sendRegistroVentas = useSendRegistroVentas();
  const sendKardexSalidas = useSendKardexSalidas();
  const sendKardexSalidasDetalle = useSendKardexSalidasDetalle();

  const activeMutation = useMemo(() => {
    switch (libro) {
      case '14.1':
        return sendRegistroVentas;
      case '12.1':
        return sendKardexSalidas;
      case '12.1-detallado':
        return sendKardexSalidasDetalle;
    }
  }, [libro, sendRegistroVentas, sendKardexSalidas, sendKardexSalidasDetalle]);

  const initialRange = useMemo(() => getDateRangeByFilter(QUICK_DATE_FILTERS.THIS_MONTH)!, []);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickDateFilter>(
    QUICK_DATE_FILTERS.THIS_MONTH
  );
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);
  const [showRangePicker, setShowRangePicker] = useState(false);

  // Recipient state
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('contact');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [caption, setCaption] = useState('');

  const submitting = activeMutation.isPending;
  const selectedSite = tenantStore.selectedSite;

  useEffect(() => {
    if (visible) {
      const r = getDateRangeByFilter(QUICK_DATE_FILTERS.LAST_MONTH);
      if (r) {
        setFromDate(r.fromDate);
        setToDate(r.toDate);
      }
      setSelectedQuickFilter(QUICK_DATE_FILTERS.LAST_MONTH);
      setShowRangePicker(false);
      setRecipientMode('contact');
      setSelectedContactId(null);
      setPhoneNumber('');
      setContactName('');
      setCaption('');
    }
  }, [visible]);

  // Cargar contactos de la sede cuando el modal abre en modo "contact"
  useEffect(() => {
    if (!visible) return;
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
        const list: SiteContact[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
        const eligible = list.filter((c) => c.isActive && c.receiveWhatsApp && !!c.phoneNumber);
        setContacts(eligible);
        if (eligible.length === 1) {
          setSelectedContactId(eligible[0].id);
        } else if (eligible.length === 0) {
          // Sin contactos elegibles: auto-cambiar a modo "Celular libre"
          // para que el usuario no quede sin opción visible.
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
  }, [visible, selectedSite?.id]);

  const handleQuickFilter = (filter: QuickDateFilter) => {
    setSelectedQuickFilter(filter);
    const r = getDateRangeByFilter(filter);
    if (r) {
      setFromDate(r.fromDate);
      setToDate(r.toDate);
    }
  };

  const rangeLabel = useMemo(
    () => `${formatDisplay(fromDate)} — ${formatDisplay(toDate)}`,
    [fromDate, toDate]
  );

  const periodoLabel = useMemo(() => {
    const p = periodoFromIso(fromDate);
    if (p.length !== 6) return '—';
    return `${p.substring(0, 4)}-${p.substring(4, 6)}`;
  }, [fromDate]);

  const cleanedPhone = useMemo(() => sanitizePhoneNumber(phoneNumber), [phoneNumber]);
  const recipientValid = useMemo(() => {
    if (recipientMode === 'contact') return !!selectedContactId;
    return cleanedPhone.length >= 8;
  }, [recipientMode, selectedContactId, cleanedPhone]);

  const canSubmit = !submitting && recipientValid;

  const handleSend = async () => {
    const validation = validateDateRange(fromDate, toDate, 366);
    if (!validation.valid) {
      Alert.alert('Rango inválido', validation.message || 'Revisa el periodo seleccionado');
      return;
    }
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id || '';
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id || '';
    if (!companyId || !siteId) {
      Alert.alert(
        'Contexto incompleto',
        'Selecciona empresa y sede antes de generar el reporte PLE'
      );
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
      companyId,
      siteId,
      fechaInicio: fromDate,
      fechaFin: toDate,
      ...(caption.trim() && { caption: caption.trim() }),
    };

    const payload =
      recipientMode === 'contact'
        ? ({ ...base, siteContactId: selectedContactId! } as
            | SendRegistroVentasPayload
            | SendKardexSalidasPayload)
        : ({
            ...base,
            phoneNumber: cleanedPhone,
            ...(contactName.trim() && { contactName: contactName.trim() }),
          } as SendRegistroVentasPayload | SendKardexSalidasPayload);

    try {
      const result: SendPleReportResponse = await activeMutation.mutateAsync(payload as any);
      const displayName =
        result.contactName ||
        (recipientMode === 'contact'
          ? contacts.find((c) => c.id === selectedContactId)?.contactName || 'el destinatario'
          : contactName.trim() || cleanedPhone);
      Alert.alert(
        'Envío programado',
        result.message || `El reporte se está generando y se enviará por WhatsApp a ${displayName}.`
      );
      onClose();
    } catch (err: any) {
      logger.error('Error enviando reporte PLE por WhatsApp', err);
      const backendMessage =
        err?.response?.data?.message || err?.message || 'No se pudo generar el reporte PLE';
      Alert.alert('No se pudo generar el reporte', backendMessage);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerButton} disabled={submitting}>
                <Ionicons name="close" size={24} color={theme.color.text.muted} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{meta.title}</Text>
              <View style={styles.headerButton} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Ionicons name="logo-whatsapp" size={28} color={theme.color.brand.accent} />
                </View>
                <View style={styles.heroTextContainer}>
                  <Text style={styles.heroTitle}>Envío por WhatsApp</Text>
                  <Text style={styles.heroSubtitle}>{meta.subtitle}</Text>
                  <Text style={styles.heroHelper}>
                    El reporte se genera en background y llega al destinatario por WhatsApp.
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Periodo</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickFiltersContent}
                >
                  {AVAILABLE_QUICK_FILTERS.map((filter) => {
                    const isActive = selectedQuickFilter === filter.key;
                    return (
                      <TouchableOpacity
                        key={filter.key}
                        style={[styles.quickFilterChip, isActive && styles.quickFilterChipActive]}
                        onPress={() => handleQuickFilter(filter.key)}
                        disabled={submitting}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.quickFilterIcon}>{filter.icon}</Text>
                        <Text
                          style={[styles.quickFilterText, isActive && styles.quickFilterTextActive]}
                        >
                          {filter.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.quickFilterChip,
                      selectedQuickFilter === QUICK_DATE_FILTERS.CUSTOM &&
                        styles.quickFilterChipActive,
                    ]}
                    onPress={() => setShowRangePicker(true)}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickFilterIcon}>🗓️</Text>
                    <Text
                      style={[
                        styles.quickFilterText,
                        selectedQuickFilter === QUICK_DATE_FILTERS.CUSTOM &&
                          styles.quickFilterTextActive,
                      ]}
                    >
                      Personalizado
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => setShowRangePicker(true)}
                  activeOpacity={0.8}
                  disabled={submitting}
                >
                  <View style={styles.dateRangeLeft}>
                    <Ionicons name="calendar-outline" size={22} color={theme.color.brand.primary} />
                    <View>
                      <Text style={styles.dateRangeLabel}>Rango de fechas</Text>
                      <Text style={styles.dateRangeValue}>{rangeLabel}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.color.text.placeholder} />
                </TouchableOpacity>
              </View>

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
                    activeOpacity={0.8}
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
                    activeOpacity={0.8}
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
                  ) : !selectedSite ? (
                    <View style={styles.emptyContacts}>
                      <Text style={styles.emptyContactsText}>
                        Selecciona una sede para ver los contactos disponibles.
                      </Text>
                    </View>
                  ) : contacts.length === 0 ? (
                    <View style={styles.emptyContacts}>
                      <Text style={styles.emptyContactsText}>
                        No hay contactos activos con WhatsApp habilitado para la sede{' '}
                        {selectedSite.name}.
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
                            activeOpacity={0.8}
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
                      placeholder="Ej. Contabilidad"
                      placeholderTextColor={theme.color.text.placeholder}
                      value={contactName}
                      onChangeText={setContactName}
                      editable={!submitting}
                    />
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mensaje (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.captionInput]}
                  placeholder={meta.captionPlaceholder}
                  placeholderTextColor={theme.color.text.placeholder}
                  value={caption}
                  onChangeText={setCaption}
                  editable={!submitting}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Libro</Text>
                  <Text style={styles.metaValue}>
                    {meta.code} · {meta.codigoLibro}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Periodo tributario</Text>
                  <Text style={styles.metaValue}>{periodoLabel}</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={theme.color.state.info.text}
                />
                <Text style={styles.infoText}>
                  El reporte se encola en background y llega por WhatsApp al destinatario. No hay
                  descarga directa desde el navegador.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={submitting}>
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

      <DateRangePicker
        visible={showRangePicker}
        startDate={dateFromIso(fromDate)}
        endDate={dateFromIso(toDate)}
        onConfirm={(start, end) => {
          setFromDate(formatIso(start));
          setToDate(formatIso(end));
          setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
          setShowRangePicker(false);
        }}
        onCancel={() => setShowRangePicker(false)}
        title={`Periodo para ${meta.title}`}
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
    quickFiltersContent: { gap: theme.space[2], paddingVertical: theme.space[1] },
    quickFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    quickFilterChipActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    quickFilterIcon: { fontSize: 14 },
    quickFilterText: { fontSize: 13, fontWeight: '600', color: theme.color.text.body },
    quickFilterTextActive: { color: theme.color.text.inverse },
    dateRangeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    dateRangeLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      flex: 1,
    },
    dateRangeLabel: { fontSize: 12, color: theme.color.text.muted, marginBottom: 2 },
    dateRangeValue: { fontSize: 15, fontWeight: '700', color: theme.color.text.heading },
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
    modeSwitchButtonActive: {
      backgroundColor: theme.color.brand.primary,
    },
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
    contactItemSelected: {
      backgroundColor: theme.color.brand.accentSoft,
    },
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
    helperText: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
      fontStyle: 'italic',
    },
    captionInput: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    metaCard: {
      padding: theme.space[3],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metaLabel: { fontSize: 13, color: theme.color.text.muted },
    metaValue: { fontSize: 14, fontWeight: '700', color: theme.color.text.heading },
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

export default PleSunatReportModal;
