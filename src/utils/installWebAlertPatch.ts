/**
 * Monkey-patch de Alert.alert / Alert.prompt para web (y Electron).
 *
 * Problema: React Native Web solo soporta Alert.alert con 1 botón y no
 * ejecuta callbacks correctamente para diálogos con confirmación/cancelación.
 * Con ~1500 llamadas en el codebase, migrarlas una a una no es realista.
 *
 * Solución: parcheamos Alert.alert / Alert.prompt globalmente en web para
 * que deleguen en CustomAlert (que usa window.confirm/prompt con timing
 * correcto). En mobile este archivo es un no-op.
 *
 * Se importa una sola vez desde `src/app/index.tsx`.
 */

import { Alert, Platform } from 'react-native';
import CustomAlert from './alert';

let installed = false;

export function installWebAlertPatch(): void {
  if (installed) return;
  if (Platform.OS !== 'web') return;

  try {
    // @ts-ignore - patch monkey
    Alert.alert = (title: string, message?: string, buttons?: any, options?: any) => {
      CustomAlert.alert(title, message, buttons, options);
    };

    // @ts-ignore - RN Web no expone prompt, pero algunos módulos lo llaman
    Alert.prompt = (
      title: string,
      message?: string,
      callbackOrButtons?: any,
      type?: any,
      defaultValue?: string,
      keyboardType?: string
    ) => {
      CustomAlert.prompt(title, message, callbackOrButtons, type, defaultValue, keyboardType);
    };

    installed = true;
    // eslint-disable-next-line no-console
    console.log('[web-alert-patch] Alert.alert / Alert.prompt parcheados para web');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[web-alert-patch] No se pudo parchar Alert:', err);
  }
}
