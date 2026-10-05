/**
 * Fila "🖨️ Impresora: <nombre> · Cambiar" y selector de impresoras de Post venta
 * (solo Electron; en navegador y celular no se muestra: usan el diálogo del
 * sistema).
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Body, Button, Caption, Title, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { printerDisplayName, usePostsalePrinterStore, type PickerHost } from './printerStore';

/** Fila compacta con la impresora en uso y el botón "Cambiar". */
export const PrinterRow: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { supported, printers, printer, auto, loading, loaded, load, openPicker } =
    usePostsalePrinterStore();

  useEffect(() => {
    if (supported && !loaded) load();
  }, [supported, loaded, load]);

  if (!supported) return null;
  const name = printerDisplayName(printers, printer);
  return (
    <View style={styles.printerRow}>
      <Body numberOfLines={1} style={{ flex: 1 }}>
        🖨️ Impresora:{' '}
        {loading && !loaded ? (
          <Caption color={theme.color.text.muted}>buscando…</Caption>
        ) : printer ? (
          <Body style={{ fontWeight: '700' }}>
            {name}
            {auto ? (
              <Caption color={theme.color.text.muted}> (elegida automáticamente)</Caption>
            ) : null}
          </Body>
        ) : (
          <Caption color={theme.color.state.warning.text}>sin impresora</Caption>
        )}
      </Body>
      <Button title="Cambiar" variant="outline" size="small" onPress={openPicker} />
    </View>
  );
};

/**
 * Selector de impresora. `host` evita que se abra dos veces: la pantalla monta
 * uno ('screen') y la hoja de detalle otro ('sheet') mientras está abierta.
 */
export const PrinterPickerModal: React.FC<{ host: PickerHost }> = ({ host }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    supported,
    printers,
    printer,
    loading,
    pickerOpen,
    pickerHost,
    load,
    select,
    closePicker,
  } = usePostsalePrinterStore();

  if (!supported) return null;
  const visible = pickerOpen && pickerHost === host;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closePicker}>
      <Pressable style={styles.modalOverlay} onPress={closePicker}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.rowBetween}>
            <Title>Elegir impresora</Title>
            <Pressable onPress={closePicker} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={theme.color.text.muted} />
            </Pressable>
          </View>
          <Caption color={theme.color.text.muted}>
            Se usa para los stickers (104 × 75 mm) y se preselecciona para la hoja de armado. Se
            recuerda en este equipo.
          </Caption>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
            {loading && !printers.length ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={theme.color.brand.accent} />
              </View>
            ) : printers.length === 0 ? (
              <Caption color={theme.color.state.warning.text}>
                No se detecta ninguna impresora. Enciende y conecta la Godex, luego pulsa
                Actualizar.
              </Caption>
            ) : (
              printers.map((p) => {
                const on = p.name === printer;
                return (
                  <Pressable
                    key={p.name}
                    onPress={() => select(p.name)}
                    style={[styles.orderRow, on && styles.orderRowOn]}
                  >
                    <Ionicons
                      name={on ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={on ? theme.color.brand.accent : theme.color.text.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: on ? '700' : '400' }}>
                        {p.displayName || p.name}
                      </Body>
                      {p.description ? (
                        <Caption color={theme.color.text.muted} numberOfLines={1}>
                          {p.description}
                        </Caption>
                      ) : null}
                    </View>
                    {p.isDefault ? (
                      <Badge variant="info" size="small" label="Predeterminada" />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          <View style={styles.actionsRow}>
            <Button
              title={loading ? 'Buscando…' : 'Actualizar'}
              leftIcon="refresh"
              variant="ghost"
              size="small"
              onPress={() => load()}
              disabled={loading}
            />
            <Button title="Cerrar" variant="outline" size="small" onPress={closePicker} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// Estilos propios (sin importar ./shared, que monta estos componentes).
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    printerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing[4],
    },
    modalSheet: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[4],
      gap: spacing[3],
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    centerBox: { padding: spacing[5], alignItems: 'center' },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      padding: spacing[3],
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    orderRowOn: { borderColor: theme.color.brand.accent, borderWidth: 2 },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
  });
