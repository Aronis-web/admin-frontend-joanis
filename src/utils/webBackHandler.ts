/**
 * webBackHandler
 *
 * Fix global para el botón "atrás" del navegador móvil en la versión web.
 *
 * PROBLEMA:
 *   - React Navigation maneja el historial del navegador para pantallas, pero
 *     los `<Modal>` de react-native-web NO empujan nada al historial. Cuando
 *     el usuario abre un modal (o imagen fullscreen) y presiona "atrás", el
 *     navegador retrocede una entrada real — que suele ser la pantalla
 *     anterior o incluso salir del PWA.
 *
 * SOLUCIÓN (sin tocar 123 modales, con soporte de modales anidados):
 *   1. `MutationObserver` sobre `document.body` cuenta portales de RNW Modal
 *      (nodos con role="dialog" o aria-modal="true").
 *   2. Cuando abre un modal (openCount ↑): push de un sentinel a history.
 *   3. Cuando cierra un modal (openCount ↓):
 *      a) Si el cierre fue por popstate (usuario pulsó atrás): el navegador
 *         ya consumió el sentinel, sólo actualizamos contadores.
 *      b) Si el cierre fue programático (X, cancelar, click en overlay):
 *         hacemos `history.back()` marcado como programático para consumir
 *         el sentinel y mantener la pila alineada.
 *   4. En `popstate` con modales abiertos: dispatch de `Escape` para que RNW
 *      (que ya escucha Escape y lo enruta al Modal top) llame a su
 *      `onRequestClose`. RNW mantiene su propio stack, así solo cierra el
 *      modal superior — perfecto para modales anidados.
 *
 * Trazas verificadas para casos:
 *   - Abrir 2 modales, back back → cierra top, luego bottom.
 *   - Abrir 2, X en top, back en bottom → OK.
 *   - Abrir 2, back en top, X en bottom → OK.
 *   - Abrir 2, X X → OK, sin entradas huérfanas.
 *
 * Solo se activa en web. En APK/Electron es no-op.
 */
import { Platform } from 'react-native';
import logger from '@/utils/logger';

const SENTINEL_KEY = '__joanisModalSentinel';

let installed = false;
let openModalCount = 0;
let sentinelCount = 0;
/**
 * Nº de cierres que ya fueron contabilizados por popstate y no requieren
 * `history.back` extra desde el observer. Incrementa en handlePopState y
 * decrementa en syncFromDom.
 */
let pendingBackDismissals = 0;
let ignoreNextPopstate = false;

const isRnwModalNode = (node: Node): boolean => {
  if (!(node instanceof HTMLElement)) return false;
  if (node.getAttribute('role') === 'dialog') return true;
  if (node.getAttribute('aria-modal') === 'true') return true;
  return !!node.querySelector?.('[role="dialog"], [aria-modal="true"]');
};

const countOpenModals = (): number => {
  if (typeof document === 'undefined') return 0;
  return document.querySelectorAll('[role="dialog"], [aria-modal="true"]').length;
};

const pushSentinel = () => {
  try {
    window.history.pushState({ [SENTINEL_KEY]: sentinelCount + 1 }, '');
    sentinelCount += 1;
  } catch (e) {
    logger.warn('webBackHandler: pushState failed', e);
  }
};

const consumeSentinelViaBack = () => {
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

const makeEscapeEvent = () =>
  new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true,
  });

const dispatchEscape = () => {
  try {
    // IMPORTANTE: react-native-web engancha el handler de Escape (que llama a
    // `onRequestClose`) sobre el PROPIO elemento del modal (`[role="dialog"]`),
    // no sobre `document`. Un `keydown` despachado en `document` NO desciende
    // hasta ese elemento, así que el modal no se cierra y el "atrás" termina
    // consumiendo una entrada real del historial (te saca de la pantalla).
    //
    // Solución: despachar el Escape sobre el modal superior (o sobre el
    // elemento enfocado dentro de él). Con `bubbles: true` el evento también
    // alcanza cualquier listener global en `document`/`window`, así que cubre
    // ambas estrategias de RNW.
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]');
    const topModal = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;

    if (topModal) {
      const active = document.activeElement as HTMLElement | null;
      const target = active && topModal.contains(active) ? active : topModal;
      target.dispatchEvent(makeEscapeEvent());
    } else {
      document.dispatchEvent(makeEscapeEvent());
    }
  } catch (e) {
    logger.warn('webBackHandler: dispatch escape failed', e);
  }
};

const syncFromDom = () => {
  const nextCount = countOpenModals();
  if (nextCount === openModalCount) return;

  if (nextCount > openModalCount) {
    // Modales nuevos abiertos → sentinel por cada uno.
    const diff = nextCount - openModalCount;
    for (let i = 0; i < diff; i += 1) pushSentinel();
  } else {
    // Modales cerrados. Puede ser por popstate (ya contabilizado con
    // pendingBackDismissals) o programáticamente (necesita history.back).
    const diff = openModalCount - nextCount;
    for (let i = 0; i < diff; i += 1) {
      if (pendingBackDismissals > 0) {
        pendingBackDismissals -= 1;
        // popstate ya consumió el sentinel; nada más que hacer.
      } else {
        consumeSentinelViaBack();
      }
    }
  }

  openModalCount = nextCount;
};

const handlePopState = () => {
  if (ignoreNextPopstate) {
    ignoreNextPopstate = false;
    return;
  }

  if (openModalCount > 0) {
    // El navegador ya consumió una entrada. Contabilizamos y dejamos que RNW
    // cierre el modal top vía Escape. El MutationObserver detectará el
    // desmontaje y llamará a syncFromDom, que verá pendingBackDismissals > 0
    // y NO hará history.back adicional.
    sentinelCount = Math.max(0, sentinelCount - 1);
    pendingBackDismissals += 1;
    const snapshotOpen = openModalCount;
    dispatchEscape();
    // Salvavidas: si el Modal top NO tiene onRequestClose (o es no-op), Escape
    // no cierra nada. Después de un tick verificamos y, si el DOM sigue igual,
    // restauramos el sentinel para que el próximo "atrás" no consuma una
    // entrada real del historial de React Navigation.
    window.setTimeout(() => {
      const stillOpen = countOpenModals();
      if (stillOpen >= snapshotOpen && pendingBackDismissals > 0) {
        pendingBackDismissals -= 1;
        pushSentinel();
        logger.info('webBackHandler: modal sin onRequestClose, sentinel restaurado');
      }
    }, 120);
  }
  // Si no hay modales abiertos, dejamos que React Navigation maneje el
  // popstate normalmente (retroceso de ruta).
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

    // Micro-defer para dejar que RNW complete el mount/unmount del árbol.
    Promise.resolve().then(syncFromDom);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', handlePopState);

  logger.info('webBackHandler: instalado (interceptor de back del navegador)');
}

export default installWebBackHandler;
