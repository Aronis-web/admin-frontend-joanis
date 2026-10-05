/**
 * webBackHandler
 *
 * Botón "atrás" del navegador (y gesto atrás de Android en la web/PWA) con
 * modales abiertos.
 *
 * PROBLEMA:
 *   - Los `<Modal>` de react-native-web NO empujan nada al historial. Al pulsar
 *     "atrás" con un modal abierto, React Navigation retrocede de pantalla y el
 *     modal queda flotando encima (o la app sale del PWA).
 *
 * VERSIÓN ANTERIOR (sentinels): empujaba una entrada falsa al historial por
 * cada modal y hacía `history.back()` al cerrarlo por código. Eso chocaba con
 * el historial propio de React Navigation (que identifica cada entrada por
 * `history.state.id`): guardar desde un modal y navegar en el mismo tick hacía
 * que el `history.back()` retrasado sacara al usuario de la pantalla nueva, o
 * que retrocediera dos pantallas. Además despachaba `keydown` sobre el modal,
 * pero RNW 0.21 escucha `keyup` en `document`, así que el modal nunca cerraba.
 *
 * VERSIÓN ACTUAL (interceptar y deshacer, sin entradas falsas):
 *   1. Cada entrada del historial lleva una posición `__jpos` (parcheamos
 *      `pushState`/`replaceState` para sellarla sin tocar el `id` de React
 *      Navigation).
 *   2. Parcheamos `history.go/back/forward`: los `popstate` que provoca la
 *      propia app (React Navigation al hacer `goBack`) pasan sin tocarse.
 *   3. Un listener de `popstate` en fase de captura (corre antes que el de
 *      React Navigation) detecta un "atrás" del usuario con un modal abierto:
 *      corta el evento (React Navigation no se entera), deshace el salto con
 *      `history.go(+n)` y cierra SOLO el modal superior simulando `Escape`
 *      (RNW enruta Escape al modal activo → `onRequestClose`).
 *   4. Cerrar un modal por código (X, cancelar, guardar y navegar) ya no toca
 *      el historial, así que no hay carreras con React Navigation.
 *   5. Al cargar la app se deja una entrada guardia debajo de la primera
 *      pantalla, para que "atrás" con un modal abierto ahí no saque de la
 *      app/PWA. Sin modales, llegar a la guardia sigue retrocediendo solo.
 *
 * Solo web. En APK/Electron es no-op (allí manda `onRequestClose` nativo).
 */
import { Platform } from 'react-native';
import logger from '@/utils/logger';

const POS_KEY = '__jpos';
const GUARD_KEY = '__jguard';
/** Ventana en la que un popstate se considera provocado por la propia app. */
const INTERNAL_POP_WINDOW_MS = 1000;

let installed = false;
let lastPos = 0;
/** Popstates esperados por `history.go/back/forward` llamados desde la app. */
let internalPops: number[] = [];
/** Popstates provocados por nosotros al deshacer un "atrás" (se ocultan). */
let suppressedPops = 0;

type HistoryState = Record<string, unknown> | null | undefined;

const readPos = (state: HistoryState): number => {
  const value = state?.[POS_KEY];
  return typeof value === 'number' ? value : 0;
};

const withPos = (state: unknown, pos: number): Record<string, unknown> => {
  const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  return { ...base, [POS_KEY]: pos };
};

/** Nº de modales de RNW montados (ModalContent siempre lleva aria-modal). */
export const countOpenWebModals = (): number => {
  if (typeof document === 'undefined') return 0;
  return document.querySelectorAll('[aria-modal="true"]').length;
};

/**
 * Cierra el modal superior. RNW escucha `keyup` de Escape en `document` y solo
 * el modal activo (el de más arriba) llama a su `onRequestClose`.
 */
export const closeTopWebModal = (): void => {
  try {
    document.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      })
    );
  } catch (e) {
    logger.warn('webBackHandler: no se pudo despachar Escape', e);
  }
};

const consumeInternalPop = (): boolean => {
  const now = Date.now();
  internalPops = internalPops.filter((t) => now - t < INTERNAL_POP_WINDOW_MS);
  if (internalPops.length === 0) return false;
  internalPops.shift();
  return true;
};

/**
 * Inicializa el handler global. Idempotente. Solo web.
 * Debe llamarse lo antes posible (antes de montar NavigationContainer) para
 * que el listener de captura quede por delante del de React Navigation.
 */
export function installWebBackHandler(): void {
  if (installed) return;
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  const h = window.history;
  const origPush = h.pushState.bind(h);
  const origReplace = h.replaceState.bind(h);
  const origGo = h.go.bind(h);

  h.pushState = (state: unknown, title: string, url?: string | URL | null) => {
    lastPos += 1;
    origPush(withPos(state, lastPos), title, url);
  };
  h.replaceState = (state: unknown, title: string, url?: string | URL | null) => {
    origReplace(withPos(state, lastPos), title, url);
  };
  h.go = (delta?: number) => {
    if (delta) internalPops.push(Date.now());
    origGo(delta);
  };
  h.back = () => h.go(-1);
  h.forward = () => h.go(1);

  // Sellar la entrada actual (tras un F5 el navegador conserva el state).
  const current = h.state as HistoryState;
  if (current && typeof current[POS_KEY] === 'number') {
    lastPos = readPos(current);
  } else {
    // Primera carga de esta entrada: dejar una entrada guardia debajo (misma
    // URL y mismo `id` de React Navigation). Sin ella, "atrás" con un modal
    // abierto en la primera pantalla sale de la app/PWA sin que podamos
    // interceptarlo (es una navegación entre documentos).
    origReplace({ ...(current ?? {}), [POS_KEY]: 0, [GUARD_KEY]: true }, '');
    lastPos = 1;
    origPush(withPos(current, 1), '');
  }

  window.addEventListener(
    'popstate',
    (event: PopStateEvent) => {
      const newPos = readPos(event.state as HistoryState);
      const delta = newPos - lastPos;

      if (suppressedPops > 0) {
        // Es el `history.go` con el que deshicimos un "atrás": invisible para RN.
        suppressedPops -= 1;
        lastPos = newPos;
        event.stopImmediatePropagation();
        return;
      }

      if (consumeInternalPop()) {
        // React Navigation (o la app) pidió este salto: lo dejamos pasar.
        lastPos = newPos;
        return;
      }

      if (delta !== 0 && countOpenWebModals() > 0) {
        // "Atrás"/"adelante" del usuario con un modal abierto: deshacer el
        // salto y, si era atrás, cerrar el modal superior.
        event.stopImmediatePropagation();
        lastPos = newPos;
        suppressedPops += 1;
        origGo(-delta);
        if (delta < 0) closeTopWebModal();
        return;
      }

      if ((event.state as HistoryState)?.[GUARD_KEY]) {
        // Llegó a la guardia sin modales: seguir saliendo como haría el
        // navegador sin ella (un solo "atrás" para salir de la app).
        event.stopImmediatePropagation();
        lastPos = newPos;
        origGo(-1);
        return;
      }

      lastPos = newPos;
    },
    { capture: true }
  );

  logger.info('webBackHandler: instalado');
}

export default installWebBackHandler;
