/**
 * usePwaInstall
 *
 * Hook para exponer el estado y la acción de "Instalar como PWA" desde
 * cualquier pantalla (típicamente Login).
 *
 * Comportamiento:
 *   - En Android/Chrome/Edge desktop: captura el evento `beforeinstallprompt`
 *     y expone `promptInstall()` que dispara el banner nativo del navegador.
 *   - En iOS Safari: no existe API para instalar por código. Devolvemos
 *     `isIOS: true` y `canPrompt: true` para que la UI muestre instrucciones
 *     manuales (Compartir → Añadir a pantalla de inicio).
 *   - En Electron / React Native (Android/iOS builds): no hace nada,
 *     `canPrompt` queda en `false`.
 *   - Si la app ya está instalada (display-mode: standalone), tampoco muestra
 *     el botón para no ensuciar la UI.
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface UsePwaInstallResult {
  /** El botón se debe mostrar. Cubre Chrome (evento capturado) e iOS Safari. */
  canPrompt: boolean;
  /** Si es iOS Safari, la instalación es manual (mostrar instrucciones). */
  isIOS: boolean;
  /** Dispara el prompt nativo del navegador; en iOS no hace nada. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

function isRunningInElectron(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /electron/i.test(navigator.userAgent);
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  if (mql?.matches) return true;
  // iOS Safari legacy flag
  return (window.navigator as any).standalone === true;
}

function detectIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

export function usePwaInstall(): UsePwaInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    if (isRunningInElectron()) return;

    setAlreadyInstalled(isStandaloneDisplayMode());
    setIsIOS(detectIOSSafari());

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setDeferredPrompt(null);
      setAlreadyInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      return 'unavailable' as const;
    }
  }, [deferredPrompt]);

  const canPrompt =
    Platform.OS === 'web' &&
    !alreadyInstalled &&
    !isRunningInElectron() &&
    (deferredPrompt !== null || isIOS);

  return { canPrompt, isIOS, promptInstall };
}

export default usePwaInstall;
