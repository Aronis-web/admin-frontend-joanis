/**
 * webPullToRefresh
 *
 * Habilita "pull-to-refresh" global en la versión web sin tocar cada pantalla.
 *
 * PROBLEMA:
 *   - react-native-web NO implementa el gesto `RefreshControl` del RN nativo.
 *     Los usuarios en móvil-web no pueden arrastrar hacia abajo para recargar.
 *
 * SOLUCIÓN:
 *   - Escuchamos touchstart/touchmove/touchend a nivel de `document`.
 *   - Al iniciar, verificamos que el toque comience cerca del top del
 *     viewport y que el contenedor scrolleable ancestro esté en top.
 *   - Aplicamos resistencia (el indicador viaja a la mitad de la velocidad
 *     del dedo) y umbrales generosos para evitar disparos accidentales.
 *   - Requerimos dominio VERTICAL claro: si el swipe es horizontal o
 *     diagonal, cancelamos.
 *   - Ignoramos toques sobre inputs, botones, links, sliders, imágenes con
 *     zoom, canvases (drawing), etc.
 *   - Al soltar, si se superó el umbral: llamamos `reloadCurrentScreen()`.
 *
 * Solo web táctil. En desktop/Electron sin touch es inofensivo.
 */
import { Platform } from 'react-native';
import { reloadCurrentScreen } from '@/utils/reload';
import logger from '@/utils/logger';

// Umbrales endurecidos para reducir falsos positivos.
const PULL_THRESHOLD = 140; // px arrastrados por el dedo para disparar
const RESISTANCE = 0.5; // el indicador se mueve al 50% de la velocidad del dedo
const START_ZONE_MAX_Y = 200; // el gesto debe iniciar en los primeros 200px
const MIN_VERTICAL_DOMINANCE = 1.5; // |dy| debe ser >= 1.5 * |dx|
const HORIZONTAL_CANCEL = 30; // px de movimiento horizontal → cancela
const MOVEMENT_ACTIVATION = 10; // px de dy antes de "activar" el gesto
const INDICATOR_ID = '__joanisPullToRefreshIndicator';

// Selectores de elementos donde el gesto NO debe interferir.
const IGNORED_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[role="button"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="switch"]',
  '[contenteditable="true"]',
  '[data-no-pull-to-refresh]',
  'canvas',
  'video',
  'audio',
].join(',');

let installed = false;

interface State {
  tracking: boolean; // touchstart válido, esperando confirmar intent
  activated: boolean; // gesto confirmado como pull-down
  startX: number;
  startY: number;
  lastDeltaY: number;
  container: HTMLElement | Document | null;
  indicator: HTMLDivElement | null;
  reloading: boolean;
}

const state: State = {
  tracking: false,
  activated: false,
  startX: 0,
  startY: 0,
  lastDeltaY: 0,
  container: null,
  indicator: null,
  reloading: false,
};

const isIgnoredTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(IGNORED_SELECTOR);
};

const findScrollableAncestor = (el: EventTarget | null): HTMLElement | Document | null => {
  let node = el as HTMLElement | null;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document;
};

const getScrollTop = (container: HTMLElement | Document | null): number => {
  if (!container) return 0;
  if (container instanceof HTMLElement) return container.scrollTop;
  return (
    document.scrollingElement?.scrollTop ??
    document.documentElement.scrollTop ??
    document.body.scrollTop ??
    0
  );
};

const ensureIndicator = (): HTMLDivElement => {
  if (state.indicator) return state.indicator;
  const div = document.createElement('div');
  div.id = INDICATOR_ID;
  div.setAttribute('aria-hidden', 'true');
  Object.assign(div.style, {
    position: 'fixed',
    top: '0',
    left: '50%',
    transform: 'translate(-50%, -100%)',
    zIndex: '999999',
    background: 'rgba(0,0,0,0.78)',
    color: '#fff',
    padding: '8px 14px',
    borderRadius: '9999px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    pointerEvents: 'none',
    transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    opacity: '0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
  } as Partial<CSSStyleDeclaration>);
  div.textContent = '↓ Arrastra para recargar';
  document.body.appendChild(div);
  state.indicator = div;
  return div;
};

const setIndicator = (progress: number, label?: string) => {
  const div = ensureIndicator();
  const clamped = Math.max(0, Math.min(1.2, progress));
  // Indicador arranca oculto en y=-40 y baja hasta ~y=80 al 100%.
  const travel = clamped * 120 - 40;
  div.style.transform = `translate(-50%, ${travel}px)`;
  div.style.opacity = clamped > 0.05 ? '1' : '0';
  if (label) div.textContent = label;
};

const hideIndicator = () => {
  const div = state.indicator;
  if (!div) return;
  div.style.transform = 'translate(-50%, -100%)';
  div.style.opacity = '0';
};

const resetState = () => {
  state.tracking = false;
  state.activated = false;
  state.lastDeltaY = 0;
};

const onTouchStart = (e: TouchEvent) => {
  if (state.reloading) return;
  if (e.touches.length !== 1) return;
  const touch = e.touches[0];

  // Sólo permitir iniciar el gesto cerca del top del viewport.
  if (touch.clientY > START_ZONE_MAX_Y) return;

  // Ignorar toques sobre elementos interactivos donde el gesto molestaría.
  if (isIgnoredTarget(e.target)) return;

  const container = findScrollableAncestor(e.target);
  if (getScrollTop(container) > 0) return;

  state.tracking = true;
  state.activated = false;
  state.startX = touch.clientX;
  state.startY = touch.clientY;
  state.lastDeltaY = 0;
  state.container = container;
};

const onTouchMove = (e: TouchEvent) => {
  if (!state.tracking) return;
  const touch = e.touches[0];
  const deltaY = touch.clientY - state.startY;
  const deltaX = touch.clientX - state.startX;
  const absX = Math.abs(deltaX);

  // Cancelar si el movimiento horizontal es significativo (swipe lateral,
  // carruseles, tabs, back-swipe del navegador).
  if (absX > HORIZONTAL_CANCEL) {
    resetState();
    hideIndicator();
    return;
  }

  // Si mientras arrastra el scroll se movió, cancelamos.
  if (getScrollTop(state.container) > 0) {
    resetState();
    hideIndicator();
    return;
  }

  // Fase de detección: aún no activado.
  if (!state.activated) {
    if (deltaY < MOVEMENT_ACTIVATION) {
      // Todavía no se movió lo suficiente hacia abajo.
      if (deltaY < -MOVEMENT_ACTIVATION) {
        // Se movió hacia arriba → cancelar.
        resetState();
      }
      return;
    }
    // Exigir dominio vertical claro.
    if (deltaY < absX * MIN_VERTICAL_DOMINANCE) {
      resetState();
      hideIndicator();
      return;
    }
    state.activated = true;
  }

  state.lastDeltaY = deltaY;

  // Aplicar resistencia: el indicador viaja a mitad de velocidad.
  const effective = deltaY * RESISTANCE;
  const progress = effective / PULL_THRESHOLD;
  setIndicator(
    progress,
    effective >= PULL_THRESHOLD ? '↻ Suelta para recargar' : '↓ Arrastra para recargar'
  );
};

const onTouchEnd = () => {
  if (!state.tracking) return;
  const wasActivated = state.activated;
  const effective = state.lastDeltaY * RESISTANCE;
  resetState();

  if (wasActivated && effective >= PULL_THRESHOLD) {
    triggerReload();
  } else {
    hideIndicator();
  }
};

const triggerReload = () => {
  if (state.reloading) return;
  state.reloading = true;
  setIndicator(1, '↻ Recargando…');
  reloadCurrentScreen()
    .catch((e) => logger.warn('webPullToRefresh: reload error', e))
    .finally(() => {
      state.reloading = false;
      hideIndicator();
    });
};

const onTouchCancel = () => {
  resetState();
  hideIndicator();
};

/**
 * Inicializa pull-to-refresh global. Idempotente. Solo web táctil.
 */
export function installWebPullToRefresh(): void {
  if (installed) return;
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

  installed = true;

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchCancel, { passive: true });

  logger.info('webPullToRefresh: instalado (gesto de arrastre-para-recargar)');
}

export default installWebPullToRefresh;
