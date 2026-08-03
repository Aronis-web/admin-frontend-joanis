/**
 * ShiftTicketsScreen — Módulo libre para imprimir tickets de turno en impresora
 * térmica de 80mm.
 *
 * Permite:
 *  - Elegir el rango de turnos a imprimir (desde / hasta).
 *  - (Electron) Seleccionar la impresora térmica conectada.
 *  - Previsualizar el ticket ("Joanis" arriba y el código de barras al final).
 *  - Imprimir un ticket por turno; cada turno recibe un código único que se
 *    guarda en base de datos local (AsyncStorage) para consultarlo luego,
 *    incluso escaneando su código de barras.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  isElectronPrinting,
  listPrinters,
  type PrinterInfo,
} from '@/utils/priceLabel/priceLabelPrint';
import { printShiftTickets } from '@/utils/shiftTickets/shiftTicketPrint';
import {
  getAllShiftTickets,
  getLastPrintedShift,
  getOrCreateShiftTicket,
  setLastPrintedShift,
  type ShiftTicketRecord,
} from '@/utils/shiftTickets/shiftTicketStore';
import { logger } from '@/utils/logger';
import Alert from '@/utils/alert';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Button, Caption, Card, Divider, EmptyState, Text } from '@/design-system/components';

interface ShiftTicketsScreenProps {
  navigation: any;
}

const MAX_TICKETS_PER_RUN = 200;

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ShiftTicketsScreen: React.FC<ShiftTicketsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [fromShift, setFromShift] = useState('1');
  const [toShift, setToShift] = useState('1');
  const [printing, setPrinting] = useState(false);

  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  const [savedTickets, setSavedTickets] = useState<ShiftTicketRecord[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [lastPrinted, setLastPrinted] = useState<number | null>(null);
  // Solo precargamos el rango una vez, para no pisar lo que el usuario escriba.
  const hasPrefilledRef = useRef(false);

  const supportsPrinterSelection = isElectronPrinting();

  const from = Math.max(1, Math.floor(Number(fromShift) || 0));
  const to = Math.max(1, Math.floor(Number(toShift) || 0));
  const validRange = to >= from;
  const ticketsCount = validRange ? to - from + 1 : 0;
  const exceedsLimit = ticketsCount > MAX_TICKETS_PER_RUN;

  const loadPrinters = useCallback(async () => {
    if (!isElectronPrinting()) return;
    try {
      setLoadingPrinters(true);
      const list = await listPrinters();
      setPrinters(list);
      const preferred = list.find((p) => p.isDefault) || list[0] || null;
      setSelectedPrinter((prev) => prev ?? preferred?.name ?? null);
    } catch (error) {
      logger.error('Error cargando impresoras para tickets de turno', error);
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  const loadSavedTickets = useCallback(async () => {
    try {
      setLoadingSaved(true);
      const records = await getAllShiftTickets();
      setSavedTickets(records);
    } catch (error) {
      logger.error('Error cargando tickets de turno guardados', error);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  const loadLastPrinted = useCallback(async () => {
    try {
      const last = await getLastPrintedShift();
      setLastPrinted(last);
      // Al abrir por primera vez, continúa la numeración desde el siguiente turno.
      if (!hasPrefilledRef.current && last !== null) {
        const next = String(last + 1);
        setFromShift(next);
        setToShift(next);
      }
      hasPrefilledRef.current = true;
    } catch (error) {
      logger.error('Error leyendo el último turno impreso', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPrinters();
      void loadSavedTickets();
      void loadLastPrinted();
    }, [loadPrinters, loadSavedTickets, loadLastPrinted])
  );

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = [...savedTickets].sort((a, b) => b.shift - a.shift);
    if (!query) return sorted;
    return sorted.filter(
      (t) => String(t.shift).includes(query) || t.code.toLowerCase().includes(query)
    );
  }, [savedTickets, searchQuery]);

  const handlePrint = useCallback(async () => {
    if (!validRange) {
      Alert.alert('Rango inválido', 'El turno "hasta" debe ser mayor o igual al turno "desde".');
      return;
    }
    if (exceedsLimit) {
      Alert.alert(
        'Demasiados tickets',
        `Puedes imprimir hasta ${MAX_TICKETS_PER_RUN} tickets por vez.`
      );
      return;
    }
    if (supportsPrinterSelection && !selectedPrinter) {
      Alert.alert(
        'Sin impresora',
        'No se detecta ninguna impresora conectada. Verifica que la impresora térmica esté encendida y conectada, luego actualiza la lista.'
      );
      return;
    }

    try {
      setPrinting(true);
      // Genera/recupera el código único de cada turno y lo persiste localmente.
      const records: ShiftTicketRecord[] = [];
      for (let shift = from; shift <= to; shift++) {
        records.push(await getOrCreateShiftTicket(shift));
      }
      await printShiftTickets(records, selectedPrinter ?? undefined);
      // Recuerda el último turno impreso para continuar la próxima vez.
      await setLastPrintedShift(to);
      setLastPrinted(to);
      // Deja listo el rango para continuar desde el siguiente turno.
      const next = String(to + 1);
      setFromShift(next);
      setToShift(next);
      await loadSavedTickets();
    } catch (error) {
      logger.error('Error imprimiendo tickets de turno', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No se pudieron imprimir los tickets.'
      );
    } finally {
      setPrinting(false);
    }
  }, [
    validRange,
    exceedsLimit,
    supportsPrinterSelection,
    selectedPrinter,
    from,
    to,
    loadSavedTickets,
  ]);

  const renderSavedTicket = (record: ShiftTicketRecord) => (
    <Card key={record.shift} variant="outlined" padding="medium" style={styles.savedCard}>
      <View style={styles.savedRow}>
        <View style={styles.savedShiftBadge}>
          <Caption color={theme.color.text.inverse}>Turno</Caption>
          <Text variant="titleMedium" color={theme.color.text.inverse}>
            {record.shift}
          </Text>
        </View>
        <View style={styles.flexOne}>
          <Text variant="labelLarge" color="primary" style={styles.savedCode}>
            {record.code}
          </Text>
          <Caption color="tertiary">{formatDateTime(record.createdAt)}</Caption>
        </View>
        <Ionicons name="barcode-outline" size={24} color={theme.color.icon.subtle} />
      </View>
    </Card>
  );

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="receipt-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.title}>Tickets de Turno</Text>
          </View>
          <Text style={styles.subtitle}>Impresión térmica 80mm · código único por turno</Text>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
        >
          {/* Rango de turnos */}
          <Card variant="elevated" padding="large" style={styles.sectionCard}>
            <Text variant="titleSmall" color="primary">
              Rango de turnos a imprimir
            </Text>
            {lastPrinted !== null && (
              <View style={styles.lastPrintedRow}>
                <Ionicons name="bookmark-outline" size={14} color={theme.color.state.info.text} />
                <Caption color={theme.color.state.info.text}>
                  Último turno impreso: {lastPrinted} · continúa desde {lastPrinted + 1}
                </Caption>
              </View>
            )}
            <View style={styles.rangeRow}>
              <View style={styles.rangeField}>
                <Caption color="secondary" style={styles.fieldLabel}>
                  Desde turno
                </Caption>
                <TextInput
                  style={styles.rangeInput}
                  value={fromShift}
                  onChangeText={(v) => setFromShift(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={theme.color.text.placeholder}
                  selectTextOnFocus
                />
              </View>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={theme.color.icon.subtle}
                style={styles.rangeArrow}
              />
              <View style={styles.rangeField}>
                <Caption color="secondary" style={styles.fieldLabel}>
                  Hasta turno
                </Caption>
                <TextInput
                  style={styles.rangeInput}
                  value={toShift}
                  onChangeText={(v) => setToShift(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={theme.color.text.placeholder}
                  selectTextOnFocus
                />
              </View>
            </View>
            {!validRange ? (
              <Caption color={theme.color.text.danger}>
                El turno &quot;hasta&quot; debe ser mayor o igual al &quot;desde&quot;.
              </Caption>
            ) : exceedsLimit ? (
              <Caption color={theme.color.text.danger}>
                Máximo {MAX_TICKETS_PER_RUN} tickets por impresión.
              </Caption>
            ) : (
              <Caption color="tertiary">
                Se imprimirá{ticketsCount === 1 ? '' : 'n'} {ticketsCount} ticket
                {ticketsCount === 1 ? '' : 's'}.
              </Caption>
            )}
          </Card>

          {/* Vista previa del ticket */}
          <Card variant="elevated" padding="large" style={styles.sectionCard}>
            <Text variant="titleSmall" color="primary">
              Vista previa
            </Text>
            <View style={styles.previewWrap}>
              <View style={styles.previewTicket}>
                <Text style={styles.previewBrand}>Joanis</Text>
                <Text style={styles.previewTitle}>TICKET DE TURNO</Text>
                <Text style={styles.previewShift}>Turno {validRange ? from : '—'}</Text>
                <View style={styles.previewDivider} />
                <View style={styles.barcodeStripes}>
                  {Array.from({ length: 32 }).map((_, i) => (
                    <View
                      key={i}
                      style={[styles.barcodeBar, { width: i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 2 }]}
                    />
                  ))}
                </View>
                <Caption color="tertiary" style={styles.previewCode}>
                  Código único por turno
                </Caption>
              </View>
            </View>
          </Card>

          {/* Selección de impresora (solo Electron) */}
          {supportsPrinterSelection && (
            <Card variant="elevated" padding="large" style={styles.sectionCard}>
              <View style={styles.printerHeader}>
                <Text variant="titleSmall" color="primary">
                  Impresora
                </Text>
                <TouchableOpacity
                  style={styles.refreshPrinters}
                  onPress={() => void loadPrinters()}
                  disabled={loadingPrinters}
                >
                  <Ionicons name="refresh" size={14} color={theme.color.state.info.text} />
                  <Caption color={theme.color.state.info.text}>
                    {loadingPrinters ? 'Buscando...' : 'Actualizar'}
                  </Caption>
                </TouchableOpacity>
              </View>
              {printers.length === 0 ? (
                <View style={styles.printerWarning}>
                  <Ionicons
                    name="warning-outline"
                    size={16}
                    color={theme.color.state.warning.text}
                  />
                  <Caption color={theme.color.state.warning.text} style={styles.flexOne}>
                    No se detecta ninguna impresora conectada. Enciende y conecta la impresora
                    térmica, luego pulsa Actualizar.
                  </Caption>
                </View>
              ) : (
                <View style={styles.printerRow}>
                  {printers.map((printer) => {
                    const active = printer.name === selectedPrinter;
                    return (
                      <Pressable
                        key={printer.name}
                        onPress={() => setSelectedPrinter(printer.name)}
                        style={[styles.printerChip, active && styles.printerChipActive]}
                      >
                        <Text
                          variant="labelMedium"
                          color={active ? theme.color.text.inverse : 'primary'}
                          numberOfLines={1}
                        >
                          {printer.displayName}
                        </Text>
                        {printer.isDefault && (
                          <Caption color={active ? theme.color.text.inverse : 'tertiary'}>
                            Predeterminada
                          </Caption>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Card>
          )}

          <Button
            title={printing ? 'Imprimiendo...' : `Imprimir ${ticketsCount || ''} ticket(s)`}
            variant="primary"
            leftIcon="print-outline"
            onPress={handlePrint}
            loading={printing}
            disabled={printing || !validRange || exceedsLimit}
            style={styles.printButton}
          />

          {/* Historial local (consultar luego) */}
          <Card variant="elevated" padding="large" style={styles.sectionCard}>
            <Text variant="titleSmall" color="primary">
              Códigos guardados
            </Text>
            <Caption color="tertiary" style={styles.fieldLabel}>
              Guardados en este dispositivo. Busca por turno o código.
            </Caption>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={18} color={theme.color.icon.subtle} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por turno o código..."
                placeholderTextColor={theme.color.text.placeholder}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.color.icon.subtle} />
                </TouchableOpacity>
              )}
            </View>

            <Divider spacing="small" />

            {loadingSaved ? (
              <View style={styles.savedLoading}>
                <ActivityIndicator size="small" color={theme.color.brand.accent} />
              </View>
            ) : filteredTickets.length === 0 ? (
              <EmptyState
                emoji=""
                title="Sin códigos guardados"
                description={
                  searchQuery
                    ? 'No hay coincidencias para esa búsqueda.'
                    : 'Imprime tickets de turno para guardar sus códigos aquí.'
                }
              />
            ) : (
              <View style={styles.savedList}>{filteredTickets.map(renderSavedTicket)}</View>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    headerGradient: {
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[4],
      paddingBottom: theme.space[4],
    },
    headerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[1],
    },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: theme.space[12],
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: theme.space[4],
      paddingBottom: theme.space[24],
      gap: theme.space[4],
    },
    sectionCard: {
      gap: theme.space[3],
    },
    lastPrintedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
      backgroundColor: theme.color.state.info.background,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
    },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.space[3],
    },
    rangeField: {
      flex: 1,
    },
    fieldLabel: {
      marginBottom: theme.space[1],
    },
    rangeInput: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.color.text.body,
    },
    rangeArrow: {
      marginBottom: theme.space[3],
    },
    previewWrap: {
      alignItems: 'center',
    },
    previewTicket: {
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#000000',
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[5],
      alignItems: 'center',
      width: 240,
    },
    previewBrand: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: 2,
      color: '#000000',
    },
    previewTitle: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1,
      color: '#333333',
      marginTop: 2,
    },
    previewShift: {
      fontSize: 30,
      fontWeight: '800',
      color: '#000000',
      marginVertical: 2,
    },
    previewDivider: {
      borderTopWidth: 1,
      borderTopColor: '#000000',
      borderStyle: 'dashed',
      alignSelf: 'stretch',
      marginVertical: theme.space[2],
    },
    barcodeStripes: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 42,
      gap: 2,
    },
    barcodeBar: {
      height: '100%',
      backgroundColor: '#000000',
    },
    previewCode: {
      marginTop: 4,
    },
    printerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    refreshPrinters: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2],
    },
    printerWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
    },
    printerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    printerChip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
      minWidth: 110,
    },
    printerChipActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    printButton: {
      marginTop: theme.space[1],
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.space[2.5],
      fontSize: 15,
      color: theme.color.text.body,
    },
    savedLoading: {
      paddingVertical: theme.space[6],
      alignItems: 'center',
    },
    savedList: {
      gap: theme.space[2],
    },
    savedCard: {
      marginBottom: 0,
    },
    savedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    savedShiftBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.brand.accent,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      minWidth: 64,
    },
    savedCode: {
      letterSpacing: 1.5,
    },
    flexOne: {
      flex: 1,
    },
  });

export default ShiftTicketsScreen;
