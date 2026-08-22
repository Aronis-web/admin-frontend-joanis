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
import { useTenantStore } from '@/store/tenant';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { apiClient } from '@/services/api/client';
import { useSendTaxSalesReport } from '@/hooks/api/useReports';
import type { SendPleReportResponse, SendTaxSalesReportPayload } from '@/services/api/reports';
import { siteContactsApi } from '@/services/api/site-contacts';
import type { SiteContact } from '@/types/site-contacts';
import logger from '@/utils/logger';

interface TaxSeriesItem {
  series: string;
  documentTypeCode: string;
  documentTypeName: string;
  count: number;
}

interface TaxDocumentsReportModalProps {
  visible: boolean;
  onClose: () => void;
}

type RecipientMode = 'contact' | 'phone';

const getDefaultStartDate = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
};

const getDefaultEndDate = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
};

const formatDateForApi = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (date: Date) => {
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const sanitizePhoneNumber = (raw: string): string => raw.replace(/\D/g, '');

export const TaxDocumentsReportModal: React.FC<TaxDocumentsReportModalProps> = ({
  visible,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const tenantStore = useTenantStore();
  const selectedSite = tenantStore.selectedSite;

  const sendTaxSales = useSendTaxSalesReport();

  const [startDate, setStartDate] = useState<Date>(getDefaultStartDate);
  const [endDate, setEndDate] = useState<Date>(getDefaultEndDate);
  const [correlative, setCorrelative] = useState('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [seriesExpanded, setSeriesExpanded] = useState(false);
  const [seriesList, setSeriesList] = useState<TaxSeriesItem[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  // Recipient state
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('contact');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [caption, setCaption] = useState('');

  const submitting = sendTaxSales.isPending;

  useEffect(() => {
    if (visible) {
      setStartDate(getDefaultStartDate());
      setEndDate(getDefaultEndDate());
      setCorrelative('');
      setShowDateRangePicker(false);
      setSeriesExpanded(false);
      setSelectedSeries([]);
      setSeriesError(null);
      setRecipientMode('contact');
      setSelectedContactId(null);
      setPhoneNumber('');
      setContactName('');
      setCaption('');
      loadSeries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Cargar contactos de la sede cuando el modal abre
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

  const loadSeries = async () => {
    try {
      setLoadingSeries(true);
      setSeriesError(null);
      const response = await apiClient.get<{ data: TaxSeriesItem[] } | TaxSeriesItem[]>(
        '/sales/reports/tax-sales/series'
      );
      const data = Array.isArray(response) ? response : response?.data || [];
      setSeriesList(Array.isArray(data) ? data : []);
    } catch (error: any) {
      logger.error('Error loading tax series', error);
      setSeriesError('No se pudieron cargar las series disponibles');
      setSeriesList([]);
    } finally {
      setLoadingSeries(false);
    }
  };

  const toggleSeries = (series: string) => {
    setSelectedSeries((prev) =>
      prev.includes(series) ? prev.filter((s) => s !== series) : [...prev, series]
    );
  };

  const selectAllSeries = () => {
    setSelectedSeries(seriesList.map((s) => s.series));
  };

  const clearAllSeries = () => {
    setSelectedSeries([]);
  };

  const seriesByType = useMemo(() => {
    const groups: Record<string, { name: string; items: TaxSeriesItem[] }> = {};
    seriesList.forEach((item) => {
      const key = item.documentTypeCode;
      if (!groups[key]) {
        groups[key] = { name: item.documentTypeName, items: [] };
      }
      groups[key].items.push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [seriesList]);

  const formattedStartDate = useMemo(() => formatDateForApi(startDate), [startDate]);
  const formattedEndDate = useMemo(() => formatDateForApi(endDate), [endDate]);

  const selectedRangeLabel = useMemo(() => {
    return `${formatDateForDisplay(startDate)} — ${formatDateForDisplay(endDate)}`;
  }, [endDate, startDate]);

  const cleanedPhone = useMemo(() => sanitizePhoneNumber(phoneNumber), [phoneNumber]);
  const recipientValid = useMemo(() => {
    if (recipientMode === 'contact') return !!selectedContactId;
    return cleanedPhone.length >= 8;
  }, [recipientMode, selectedContactId, cleanedPhone]);

  const canSubmit = !submitting && recipientValid;

  const handleSend = async () => {
    if (startDate > endDate) {
      Alert.alert('Rango inválido', 'La fecha inicial no puede ser mayor que la fecha final.');
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

    const base: Omit<SendTaxSalesReportPayload, 'siteContactId' | 'phoneNumber' | 'contactName'> = {
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      ...(correlative.trim() && { correlative: correlative.trim() }),
      ...(selectedSeries.length > 0 && { series: selectedSeries }),
      ...(caption.trim() && { caption: caption.trim() }),
    };

    const payload: SendTaxSalesReportPayload =
      recipientMode === 'contact'
        ? { ...base, siteContactId: selectedContactId! }
        : {
            ...base,
            phoneNumber: cleanedPhone,
            ...(contactName.trim() && { contactName: contactName.trim() }),
          };

    try {
      const result: SendPleReportResponse = await sendTaxSales.mutateAsync(payload);
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
    } catch (error: any) {
      logger.error('Error enviando reporte de documentos tributarios', error);
      Alert.alert(
        'No se pudo generar el reporte',
        error?.response?.data?.message ||
          error?.message ||
          'No se pudo generar el reporte de documentos tributarios'
      );
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
              <Text style={styles.headerTitle}>Reporte de Documentos Tributarios</Text>
              <View style={styles.headerButton} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Ionicons name="logo-whatsapp" size={28} color={theme.color.brand.accent} />
                </View>
                <View style={styles.heroTextContainer}>
                  <Text style={styles.heroTitle}>Envío por WhatsApp</Text>
                  <Text style={styles.heroSubtitle}>
                    Incluye Facturas, Boletas y Notas de Crédito con hojas de resumen y detalle.
                  </Text>
                  <Text style={styles.heroHelper}>
                    El reporte se genera en background y llega al destinatario por WhatsApp.
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rango de fechas</Text>
                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => setShowDateRangePicker(true)}
                  activeOpacity={0.8}
                  disabled={submitting}
                >
                  <View style={styles.dateRangeLeft}>
                    <Ionicons name="calendar-outline" size={22} color={theme.color.brand.primary} />
                    <View>
                      <Text style={styles.dateRangeLabel}>Periodo del reporte</Text>
                      <Text style={styles.dateRangeValue}>{selectedRangeLabel}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.color.text.placeholder} />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Comprobante específico (opcional)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="receipt-outline" size={20} color={theme.color.text.placeholder} />
                  <TextInput
                    style={styles.input}
                    value={correlative}
                    onChangeText={setCorrelative}
                    placeholder="Ej: F001-00000001"
                    placeholderTextColor={theme.color.text.placeholder}
                    autoCapitalize="characters"
                    editable={!submitting}
                  />
                  {correlative.length > 0 && (
                    <TouchableOpacity onPress={() => setCorrelative('')} disabled={submitting}>
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={theme.color.text.placeholder}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setSeriesExpanded((v) => !v)}
                  activeOpacity={0.8}
                  disabled={submitting}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <Ionicons name="layers-outline" size={20} color={theme.color.brand.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitle}>Filtrar por series (opcional)</Text>
                      <Text style={styles.collapsibleSubtitle}>
                        {selectedSeries.length === 0
                          ? 'Todas las series del tenant'
                          : `${selectedSeries.length} serie${selectedSeries.length === 1 ? '' : 's'} seleccionada${selectedSeries.length === 1 ? '' : 's'}`}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={seriesExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.color.text.placeholder}
                  />
                </TouchableOpacity>

                {seriesExpanded && (
                  <View style={styles.seriesPanel}>
                    {loadingSeries ? (
                      <View style={styles.seriesLoading}>
                        <ActivityIndicator size="small" color={theme.color.brand.primary} />
                        <Text style={styles.seriesLoadingText}>Cargando series...</Text>
                      </View>
                    ) : seriesError ? (
                      <View style={styles.seriesEmpty}>
                        <Text style={styles.seriesEmptyText}>{seriesError}</Text>
                        <TouchableOpacity onPress={loadSeries} style={styles.retryButton}>
                          <Text style={styles.retryButtonText}>Reintentar</Text>
                        </TouchableOpacity>
                      </View>
                    ) : seriesList.length === 0 ? (
                      <View style={styles.seriesEmpty}>
                        <Text style={styles.seriesEmptyText}>No hay series disponibles</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.seriesActions}>
                          <TouchableOpacity onPress={selectAllSeries} disabled={submitting}>
                            <Text style={styles.seriesActionText}>Seleccionar todas</Text>
                          </TouchableOpacity>
                          <Text style={styles.seriesActionSeparator}>·</Text>
                          <TouchableOpacity onPress={clearAllSeries} disabled={submitting}>
                            <Text style={styles.seriesActionText}>Limpiar</Text>
                          </TouchableOpacity>
                        </View>

                        {seriesByType.map(([code, group]) => (
                          <View key={code} style={styles.seriesGroup}>
                            <Text style={styles.seriesGroupTitle}>
                              {group.name} ({code})
                            </Text>
                            {group.items.map((item) => {
                              const isSelected = selectedSeries.includes(item.series);
                              return (
                                <TouchableOpacity
                                  key={item.series}
                                  style={styles.seriesRow}
                                  onPress={() => toggleSeries(item.series)}
                                  disabled={submitting}
                                  activeOpacity={0.7}
                                >
                                  <View
                                    style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                                  >
                                    {isSelected && (
                                      <Ionicons
                                        name="checkmark"
                                        size={14}
                                        color={theme.color.text.inverse}
                                      />
                                    )}
                                  </View>
                                  <Text style={styles.seriesRowLabel}>{item.series}</Text>
                                  <Text style={styles.seriesRowCount}>
                                    {item.count.toLocaleString('es-PE')} docs
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
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
                      style={styles.phoneInput}
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
                      style={styles.phoneInput}
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
                  style={[styles.phoneInput, styles.captionInput]}
                  placeholder="Reporte de ventas del periodo"
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
                  size={20}
                  color={theme.color.state.info.text}
                />
                <Text style={styles.infoText}>
                  Si tu sesión tiene sede seleccionada, el reporte se restringirá a esa sede
                  automáticamente. El archivo llega por WhatsApp; no hay descarga directa.
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
        visible={showDateRangePicker}
        startDate={startDate}
        endDate={endDate}
        onConfirm={(start, end) => {
          setStartDate(start);
          setEndDate(end);
          setShowDateRangePicker(false);
        }}
        onCancel={() => setShowDateRangePicker(false)}
        title="Seleccionar rango del reporte"
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
    headerButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.space[4],
      gap: theme.space[4],
    },
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
    heroTextContainer: {
      flex: 1,
    },
    heroTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    heroSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.color.text.body,
    },
    heroHelper: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
    },
    section: {
      gap: theme.space[2],
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
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
    dateRangeLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    dateRangeValue: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    input: {
      flex: 1,
      paddingVertical: theme.space[3],
      fontSize: 15,
      color: theme.color.text.heading,
      fontWeight: '600',
    },
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.space[3],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    collapsibleHeaderLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    collapsibleSubtitle: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    seriesPanel: {
      marginTop: theme.space[2],
      padding: theme.space[3],
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    seriesLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[3],
      justifyContent: 'center',
    },
    seriesLoadingText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    seriesEmpty: {
      alignItems: 'center',
      paddingVertical: theme.space[3],
      gap: theme.space[2],
    },
    seriesEmptyText: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    retryButton: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.state.info.background,
    },
    retryButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.state.info.text,
    },
    seriesActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingBottom: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
    },
    seriesActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.primary,
    },
    seriesActionSeparator: {
      fontSize: 12,
      color: theme.color.text.placeholder,
    },
    seriesGroup: {
      gap: theme.space[1],
    },
    seriesGroupTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.body,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: theme.space[1],
    },
    seriesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[2],
      borderRadius: theme.radii.md,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: theme.radii.sm,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.base,
    },
    checkboxSelected: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    seriesRowLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    seriesRowCount: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '600',
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
    phoneInput: {
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
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.body,
    },
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
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
  });

export default TaxDocumentsReportModal;
