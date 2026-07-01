/**
 * AlertHost
 *
 * Componente global que renderiza alerts y prompts custom encima de toda la
 * app, usando <Modal> de React Native (cross-platform: Android, iOS, Web y
 * Electron). Reemplaza Alert.alert nativo + window.alert/confirm/prompt para
 * evitar:
 *  - Pérdida de foco del teclado en Electron.
 *  - Alerts que quedan detrás de modales en Android.
 *  - Alerts consecutivos que se pisan en Android.
 *  - Bloqueo síncrono del renderer en Web/Electron.
 *
 * Debe montarse UNA sola vez en la raíz de la app.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes/defaultLight';
import { alertBus, type AlertRequest } from '@/utils/alertBus';

const DEFAULT_BUTTONS = [{ text: 'OK', style: 'default' as const }];

export const AlertHost: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const [request, setRequest] = useState<AlertRequest | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const unsub = alertBus.subscribe((req) => {
      setRequest(req);
      setInputValue(req?.defaultValue ?? '');
    });
    return unsub;
  }, []);

  // IMPORTANTE: retornar null (no un <Modal visible={false} />) para que en
  // react-native-web NO quede un portal residual anclado al inicio del <body>.
  // Si dejamos un Modal placeholder, cualquier <Modal> abierto después (p. ej.
  // en pantallas de Compras) agrega su portal DESPUÉS y queda encima; al
  // dispararse una alerta, ésta se muestra detrás del modal de la pantalla.
  // Retornando null, cada alerta monta un portal nuevo al final del body y
  // queda siempre por encima.
  if (!request) {
    return null;
  }

  const isPrompt = request.kind === 'prompt';
  const buttons = request.buttons && request.buttons.length > 0 ? request.buttons : DEFAULT_BUTTONS;
  const cancelable = request.cancelable !== false;

  const handleBackdrop = () => {
    if (!cancelable) return;
    alertBus.dismiss(request.id);
  };

  const handleRequestClose = () => {
    alertBus.dismiss(request.id);
  };

  const handlePress = (index: number) => {
    alertBus.resolve(request.id, index, isPrompt ? inputValue : undefined);
  };

  const isVertical = buttons.length > 2;
  const isSecure = request.promptType === 'secure-text' || request.promptType === 'login-password';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Pressable style={styles.backdrop} onPress={handleBackdrop} />
        <View style={styles.dialog} accessibilityRole="alert" accessibilityViewIsModal>
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollInner}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>{request.title}</Text>
            {!!request.message && <Text style={styles.message}>{request.message}</Text>}
            {isPrompt && (
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                secureTextEntry={isSecure}
                autoFocus
                placeholderTextColor={styles.placeholder.color}
                underlineColorAndroid="transparent"
              />
            )}
          </ScrollView>
          <View style={[styles.buttonRow, isVertical && styles.buttonColumn]}>
            {buttons.map((btn, idx) => {
              const text = btn.text ?? (idx === 0 ? 'OK' : `Opción ${idx + 1}`);
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={`${request.id}-${idx}`}
                  onPress={() => handlePress(idx)}
                  style={[
                    styles.button,
                    isVertical ? styles.buttonStacked : styles.buttonInline,
                    isCancel && styles.buttonCancel,
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonTextCancel,
                      isDestructive && styles.buttonTextDestructive,
                    ]}
                    numberOfLines={1}
                  >
                    {text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default AlertHost;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.color.overlay.medium,
    },
    dialog: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '85%',
      backgroundColor: theme.color.surface.elevated,
      borderRadius: theme.radii.lg,
      paddingTop: theme.space[5],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 24,
      overflow: 'hidden',
    },
    contentScroll: {
      maxHeight: 360,
    },
    contentScrollInner: {
      paddingHorizontal: theme.space[5],
      paddingBottom: theme.space[4],
    },
    title: {
      fontSize: theme.text.headingMedium.fontSize,
      lineHeight: theme.text.headingMedium.lineHeight,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    message: {
      fontSize: theme.text.bodyLarge.fontSize,
      lineHeight: theme.text.bodyLarge.lineHeight,
      color: theme.color.text.muted,
    },
    input: {
      marginTop: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      fontSize: theme.text.bodyLarge.fontSize,
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
      minHeight: 44,
    },
    placeholder: {
      color: theme.color.text.subtle,
    },
    buttonRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
    },
    buttonColumn: {
      flexDirection: 'column',
    },
    button: {
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    buttonInline: {
      flex: 1,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: theme.color.border.default,
    },
    buttonStacked: {
      width: '100%',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
    },
    buttonCancel: {
      // visualmente igual; el énfasis lo da el color del texto
    },
    buttonText: {
      fontSize: theme.text.bodyLarge.fontSize,
      lineHeight: theme.text.bodyLarge.lineHeight,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    buttonTextCancel: {
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    buttonTextDestructive: {
      color: theme.color.text.danger,
    },
  });
