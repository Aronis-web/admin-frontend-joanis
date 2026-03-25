import { Alert as RNAlert, Platform } from 'react-native';
import { isElectron } from './platform';

/**
 * Custom Alert implementation that works properly in Electron
 *
 * In Electron/Web, React Native's Alert.alert() uses window.alert() which is synchronous
 * and blocks execution. This causes callbacks to execute before the user sees the alert.
 *
 * This implementation ensures proper async behavior in Electron while maintaining
 * native behavior on mobile platforms (Android/iOS).
 */

interface AlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
}

type AlertType = 'default' | 'plain-text' | 'secure-text' | 'login-password';

class CustomAlert {
  /**
   * Show an alert dialog
   * - On Android/iOS: Uses native Alert (synchronous, works correctly)
   * - On Web/Electron: Uses custom async implementation to fix callback timing
   */
  static alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ): void {
    // On mobile (iOS/Android), ALWAYS use native Alert - it works correctly
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      RNAlert.alert(title, message, buttons, options);
      return;
    }

    // On Web/Electron ONLY, use custom async implementation
    if (Platform.OS === 'web') {
      this.showWebAlert(title, message, buttons);
      return;
    }

    // Fallback to native Alert for any other platform
    RNAlert.alert(title, message, buttons, options);
  }

  /**
   * Show a prompt dialog with text input
   * - On Android/iOS: Uses native Alert.prompt (works correctly)
   * - On Web/Electron: Uses custom async implementation with window.prompt
   */
  static prompt(
    title: string,
    message?: string,
    callbackOrButtons?: ((text: string) => void) | AlertButton[],
    type?: AlertType,
    defaultValue?: string,
    keyboardType?: string
  ): void {
    // On mobile (iOS/Android), ALWAYS use native Alert.prompt - it works correctly
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      RNAlert.prompt(title, message, callbackOrButtons as any, type, defaultValue, keyboardType);
      return;
    }

    // On Web/Electron ONLY, use custom async implementation
    if (Platform.OS === 'web') {
      this.showWebPrompt(title, message, callbackOrButtons, defaultValue);
      return;
    }

    // Fallback to native Alert.prompt for any other platform
    RNAlert.prompt(title, message, callbackOrButtons as any, type, defaultValue, keyboardType);
  }

  /**
   * Custom alert implementation for Web/Electron
   */
  private static showWebAlert(
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ): void {
    const fullMessage = message ? `${title}\n\n${message}` : title;

    // If no buttons or only one button, use simple alert
    if (!buttons || buttons.length <= 1) {
      // Use setTimeout to make it async and non-blocking
      setTimeout(() => {
        window.alert(fullMessage);
        if (buttons && buttons[0]?.onPress) {
          // Execute callback after alert is dismissed
          setTimeout(() => {
            buttons[0].onPress!();
          }, 100);
        }
      }, 0);
      return;
    }

    // For multiple buttons, use confirm dialog
    if (buttons.length === 2) {
      setTimeout(() => {
        const result = window.confirm(fullMessage);

        // Execute appropriate callback after dialog is dismissed
        setTimeout(() => {
          if (result) {
            // User clicked OK/Yes (first non-cancel button)
            const confirmButton = buttons.find(b => b.style !== 'cancel') || buttons[0];
            if (confirmButton.onPress) {
              confirmButton.onPress();
            }
          } else {
            // User clicked Cancel/No
            const cancelButton = buttons.find(b => b.style === 'cancel') || buttons[1];
            if (cancelButton.onPress) {
              cancelButton.onPress();
            }
          }
        }, 100);
      }, 0);
      return;
    }

    // For more than 2 buttons, show alert with button text and use first button
    setTimeout(() => {
      const buttonTexts = buttons.map(b => b.text || 'OK').join(' / ');
      window.alert(`${fullMessage}\n\nOpciones: ${buttonTexts}`);

      // Execute first button's callback
      setTimeout(() => {
        if (buttons[0]?.onPress) {
          buttons[0].onPress();
        }
      }, 100);
    }, 0);
  }

  /**
   * Custom prompt implementation for Web/Electron
   */
  private static showWebPrompt(
    title: string,
    message?: string,
    callbackOrButtons?: ((text: string) => void) | AlertButton[],
    defaultValue?: string
  ): void {
    const fullMessage = message ? `${title}\n\n${message}` : title;

    setTimeout(() => {
      const result = window.prompt(fullMessage, defaultValue || '');

      setTimeout(() => {
        // If callback is a function (simple callback)
        if (typeof callbackOrButtons === 'function') {
          if (result !== null) {
            callbackOrButtons(result);
          }
          return;
        }

        // If callback is an array of buttons
        if (Array.isArray(callbackOrButtons)) {
          const buttons = callbackOrButtons;

          if (result !== null) {
            // User clicked OK - find the confirm button (non-cancel)
            const confirmButton = buttons.find(b => b.style !== 'cancel') || buttons[buttons.length - 1];
            if (confirmButton?.onPress) {
              confirmButton.onPress(result);
            }
          } else {
            // User clicked Cancel - find the cancel button
            const cancelButton = buttons.find(b => b.style === 'cancel');
            if (cancelButton?.onPress) {
              cancelButton.onPress();
            }
          }
        }
      }, 100);
    }, 0);
  }
}

export default CustomAlert;
