/**
 * Cross-platform Alert / Prompt wrapper
 *
 * Drop-in para `Alert` de react-native. Delega en <AlertHost /> (montado en
 * la raíz de la app) un dialog Modal custom que funciona idéntico en Android,
 * iOS, Web y Electron. Resuelve:
 *  - Pérdida de foco del teclado en Electron tras `window.confirm/alert/prompt`.
 *  - Alerts ocultos detrás de un <Modal> en Android.
 *  - Alerts consecutivos que se pisan en Android (se encolan).
 *  - Bloqueo síncrono del renderer en Web/Electron.
 *
 * API compatible con `Alert.alert(title, message?, buttons?, options?)` y
 * `Alert.prompt(title, message?, callbackOrButtons?, type?, default?, kb?)`.
 */

import { alertBus, type AlertButtonSpec, type AlertPromptType } from './alertBus';

interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

class CustomAlert {
  static alert(
    title: string,
    message?: string,
    buttons?: AlertButtonSpec[],
    options?: AlertOptions
  ): void {
    alertBus.enqueue({
      kind: 'alert',
      title,
      message,
      buttons,
      cancelable: options?.cancelable,
    });
  }

  static prompt(
    title: string,
    message?: string,
    callbackOrButtons?: ((text: string) => void) | AlertButtonSpec[],
    type?: AlertPromptType,
    defaultValue?: string,
    keyboardType?: string
  ): void {
    const isCallback = typeof callbackOrButtons === 'function';
    alertBus.enqueue({
      kind: 'prompt',
      title,
      message,
      buttons: isCallback
        ? [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'OK', style: 'default' },
          ]
        : (callbackOrButtons as AlertButtonSpec[] | undefined),
      promptType: type,
      defaultValue,
      keyboardType,
      promptCallback: isCallback ? (callbackOrButtons as (t: string) => void) : undefined,
    });
  }
}

export default CustomAlert;
