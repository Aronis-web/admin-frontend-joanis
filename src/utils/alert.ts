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
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

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
}

export default CustomAlert;
