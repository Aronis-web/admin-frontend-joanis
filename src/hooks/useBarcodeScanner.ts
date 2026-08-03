import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export interface UseBarcodeScannerOptions {
  /**
   * Callback invocado cuando la lectora completa un escaneo (buffer + Enter).
   * Recibe el código ya recortado (`trim`).
   */
  onScan: (code: string) => void;
  /** Habilita/deshabilita el listener global. Por defecto `true`. */
  enabled?: boolean;
  /**
   * Longitud mínima del código para considerarlo un escaneo válido.
   * Evita disparos accidentales por teclas sueltas. Por defecto `3`.
   */
  minLength?: number;
  /**
   * Milisegundos máximos entre teclas para asumir que provienen de una lectora
   * (que "teclea" muy rápido) y no de un humano. Por defecto `200`.
   */
  maxInterKeyDelay?: number;
}

/**
 * Escucha una lectora de códigos de barra tipo "keyboard-wedge" (emula teclado)
 * a nivel global en web/Electron, sin necesidad de enfocar ningún input.
 *
 * La lectora envía los caracteres del código muy rápido seguidos de `Enter`.
 * Este hook acumula esas teclas en un buffer, lo resetea si el intervalo entre
 * teclas supera `maxInterKeyDelay` (para distinguir de un humano escribiendo) y,
 * al recibir `Enter`, invoca `onScan` con el código acumulado.
 *
 * Ignora las teclas cuando el foco está en un `INPUT`, `TEXTAREA` o elemento
 * editable, para no interferir con la escritura manual del usuario.
 *
 * Se registra en fase de captura y, al detectar el `Enter` final de un escaneo,
 * detiene su propagación (`stopImmediatePropagation`). Así ese `Enter` nunca
 * llega a un botón que haya quedado enfocado (p. ej. tras cerrar un modal con
 * "Cancelar" o Escape), evitando que se reactive y reabra el modal anterior.
 *
 * No hace nada en plataformas nativas (Android/iOS).
 */
export const useBarcodeScanner = ({
  onScan,
  enabled = true,
  minLength = 3,
  maxInterKeyDelay = 200,
}: UseBarcodeScannerOptions): void => {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef('');
  const lastKeyRef = useRef(0);

  const handleKey = useCallback(
    (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase();
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyRef.current > maxInterKeyDelay) {
        bufferRef.current = '';
      }
      lastKeyRef.current = now;

      if (ev.key === 'Enter') {
        const raw = bufferRef.current.trim();
        bufferRef.current = '';
        if (raw.length >= minLength) {
          // Detener la propagación en captura evita que este `Enter` active un
          // botón enfocado (React Native Web maneja el `keydown` a nivel del
          // elemento, por lo que un `preventDefault` tardío no basta).
          ev.preventDefault();
          ev.stopImmediatePropagation();
          onScanRef.current(raw);
        }
        return;
      }

      if (ev.key.length === 1) {
        bufferRef.current += ev.key;
      }
    },
    [minLength, maxInterKeyDelay]
  );

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    // `capture: true` para interceptar la tecla antes de que llegue al elemento
    // enfocado y poder cancelarla si corresponde a un escaneo.
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [enabled, handleKey]);
};
