/**
 * webBackHandler
 *
 * Fix global para el botón "atrás" del navegador móvil en la versión web.
 *
 * PROBLEMA:
 *   - React Navigation maneja el historial del navegador para pantallas, pero
 *     los `<Modal>` de react-native-web NO empujan nada al historial. Cuando
 *     el usuario abre un modal (o imagen fullscreen) y presiona el botón
 *     "atrás" del móvil, el navegador retrocede una entrada de historial —
 *     que suele ser la pantalla anterior o incluso salir del PWA.
 *
 * SOLUCIÓN (sin tocar 123 modales):
 *   1. Observamos `document.body` con `MutationObserver` buscando portales de
 *      RNW Modal (nodos con role="dialog" o aria-modal="true").
 *   2. Cuando el # de modales abiertos SUBE, empujamos un `history.state`
 *      sentinel para que exista una entrada extra que "consumir" al atrás.
 *   3. Al `popstate`: si hay modales abiertos, disparamos un keydown de
 *      Escape → RNW ya escucha Escape internamente y llama `onRequestClose`
 *      de cada Modal → el top se cierra normalmente por su onClose.
 *   4. Cuando el # de modales baja porque el usuario cerró con la X (sin
 *      pasar por popstate), consumimos la entrada sentinel con history.back
 *      marcado como "programmatic" para no re-disparar la lógica.
 *
 * Solo se activa en web/electron. En nativo (iOS/Android APK) es no-op.
 */
import { Platform } from 'react-native';
import logger from '@/utils/logger';

const SENTINEL_KEY = '__joanisModalSentinel';
const SENTINEL_MARKER = 'modal';

let installed = false;
let openModalCount = 0;
let sentinelCount = 0; // cuántas entradas sentinel creímos empujar
let ignoreNextPopstate = false;

const isRnwModalNode = (node: Node): boolean => {
  if (!(node instanceof HTMLElement)) return false;
  // RNW Modal renderiza un portal con role="dialog" o aria-modal="true".
  // También cubrimos elementos con [data-focusable] que envuelven overlays.
  if (node.getAttribute('role') === 'dialog') return true;
  if (node.getAttribute('aria-modal') === 'true') return true;
  // RNW a veces usa un wrapper. Chequeamos descendencia inmediata.
  return !!node.querySelector?.('[role="dialog"], [aria-modal="true"]');
};

const countOpenModals = (): number => {
  if (typeof document === 'undefined') return 0;
  return document.querySelectorAll('[role="dialog"], [aria-modal="true"]').length;
};

const pushSentinel = () => {
  try {
    window.history.pushState({ [SENTINEL_KEY]: SENTINEL_MARKER }, '');
    sentinelCount += 1;
  } catch (e) {
    logger.warn('webBackHandler: pushState failed', e);
  }
};

const popSentinel = () => {
  if (sentinelCount <= 0) return;
  sentinelCount -= 1;
  ignoreNextPopstate = true;
  try {
    window.history.back();
  } catch (e) {
    ignoreNextPopstate = false;
    logger.warn('webBackHandler: history.back failed', e);
  }
};

const dispatchEscape = () => {
  try {
    // RNW Modal escucha keydown Escape → llama onRequestClose.
    const evt = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(evt);
  } catch (e) {
    logger.warn('webBackHandler: dispatch escape failed', e);
  }
};

const syncFromDom = () => {
  const nextCount = countOpenModals();
  if (nextCount === openModalCount) return;

  if (nextCount > openModalCount) {
    // Modales nuevos abiertos → push sentinel por cada uno.
    const diff = nextCount - openModalCount;
    for (let i = 0; i < diff; i += 1) pushSentinel();
  } else {
    // Modales cerrados sin popstate → consumir sentinels sobrantes.
    const diff = openModalCount - nextCount;
    for (let i = 0; i < diff; i += 1) popSentinel();
  }

  openModalCount = nextCount;
};

const handlePopState = (event: PopStateEvent) => {
  if (ignoreNextPopstate) {
    ignoreNextPopstate = false;
    return;
  }

  if (openModalCount > 0) {
    // El usuario pulsó "atrás" con un modal abierto.
    // Ya perdimos el sentinel de esa capa (el navegador lo consumió).
    sentinelCount = Math.max(0, sentinelCount - 1);

    // Cerramos el modal top. El MutationObserver detectará el cambio y
    // sincronizará openModalCount. NO empujamos otra entrada; queremos
    // que el back consuma UNA capa por press.
    dispatchEscape();

    // React Navigation puede haber recibido este popstate también y navegar
    // hacia atrás — para evitarlo, empujamos de vuelta el estado actual.
    try {
      window.history.pushState(event.state ?? {}, '');
    } catch {
      /* noop */
    }
  }
};

/**
 * Inicializa el handler global. Idempotente. Solo web.
 */
export function installWebBackHandler(): void {
  if (installed) return;
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  installed = true;

  const observer = new MutationObserver((mutations) => {
    // Sólo re-sincronizamos si detectamos añadidos o removidos que puedan ser
    // portales de modal (evitamos costo si nada relevante cambió).
    let relevant = false;
    for (const m of mutations) {
      for (const n of Array.from(m.addedNodes)) {
        if (isRnwModalNode(n)) {
          relevant = true;
          break;
        }
      }
      if (relevant) break;
      for (const n of Array.from(m.removedNodes)) {
        if (isRnwModalNode(n)) {
          relevant = true;
          break;
        }
      }
      if (relevant) break;
    }
    if (!relevant) return;

    // Micro-defer para dejar que RNW termine de montar/desmontar todo el árbol.
    Promise.resolve().then(syncFromDom);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', handlePopState);

  logger.info('webBackHandler: instalado (interceptor de back del navegador)');
}

export default installWebBackHandler;
