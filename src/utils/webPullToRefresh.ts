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
 *   - Al iniciar el gesto identificamos el contenedor scrolleable ancestro
 *     del target. Si está en `scrollTop === 0` y el usuario arrastra hacia
 *     abajo más allá de un umbral, mostramos un indicador flotante.
 *   - Al soltar, si se pasó el umbral: llamamos `reloadCurrentScreen()`, el
 *     mismo helper del botón universal de reload (invalida React Query +
 *     bus `useOnReload` + fallback remount).
 *
 * Solo web táctil. En desktop/Electron sin touch es inofensivo.
 */
import { Platform } from 'react-native';
import { reloadCurrentScreen } from '@/utils/reload';
import logger from '@/utils/logger';

const PULL_THRESHOLD = 80; // px de arrastre para disparar
const MAX_INDICATOR_TRAVEL = 120;
const INDICATOR_ID = '__joanisPullToRefreshIndicator';

let installed = false;

interface State {
  active: boolean;
  startY: number;
  container: HTMLElement | Document | null;
  indicator: HTMLDivElement | null;
  reloading: boolean;
}

const state: State = {
  active: false,
  startY: 0,
  container: null,
  indicator: null,
  reloading: false,
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
    background: 'rgba(0,0,0,0.75)',
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
  } as Partial<CSSStyleDeclaration>);
  div.textContent = '↓ Arrastra para recargar';
  document.body.appendChild(div);
  state.indicator = div;
  return div;
};

const setIndicator = (progress: number, label?: string) => {
  const div = ensureIndicator();
  const clamped = Math.max(0, Math.min(1, progress));
  const travel = clamped * MAX_INDICATOR_TRAVEL;
  div.style.transform = `translate(-50%, ${travel - 40}px)`;
  div.style.opacity = clamped > 0 ? '1' : '0';
  if (label) div.textContent = label;
};

const hideIndicator = () => {
  const div = state.indicator;
  if (!div) return;
  div.style.transform = 'translate(-50%, -100%)';
  div.style.opacity = '0';
};

const onTouchStart = (e: TouchEvent) => {
  if (state.reloading) return;
  if (e.touches.length !== 1) return;
  const touch = e.touches[0];
  const container = findScrollableAncestor(e.target);
  if (getScrollTop(container) > 0) return;

  state.active = true;
  state.startY = touch.clientY;
  state.container = container;
};

const onTouchMove = (e: TouchEvent) => {
  if (!state.active) return;
  const touch = e.touches[0];
  const deltaY = touch.clientY - state.startY;

  if (deltaY <= 0) {
    hideIndicator();
    return;
  }

  // Si mientras arrastra el scroll se movió, cancelamos.
  if (getScrollTop(state.container) > 0) {
    state.active = false;
    hideIndicator();
    return;
  }

  // Feedback visual proporcional.
  const progress = deltaY / PULL_THRESHOLD;
  setIndicator(
    progress,
    deltaY >= PULL_THRESHOLD ? '↻ Suelta para recargar' : '↓ Arrastra para recargar'
  );
};

const onTouchEnd = () => {
  if (!state.active) return;
  const div = state.indicator;
  const shouldReload = div && parseFloat(div.style.opacity || '0') > 0 && shouldFire();
  state.active = false;

  if (shouldReload) {
    triggerReload();
  } else {
    hideIndicator();
  }
};

const shouldFire = (): boolean => {
  const div = state.indicator;
  if (!div) return false;
  const m = /translate\(-50%,\s*([\-\d.]+)px\)/.exec(div.style.transform);
  const y = m ? parseFloat(m[1]) : -40;
  return y >= MAX_INDICATOR_TRAVEL - 40 - 1 || y + 40 >= PULL_THRESHOLD * 0.95;
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
  state.active = false;
  hideIndicator();
};

/**
 * Inicializa pull-to-refresh global. Idempotente. Solo web táctil.
 */
export function installWebPullToRefresh(): void {
  if (installed) return;
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Sólo tiene sentido en dispositivos táctiles.
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

  installed = true;

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchCancel, { passive: true });

  logger.info('webPullToRefresh: instalado (gesto de arrastre-para-recargar)');
}

export default installWebPullToRefresh;
