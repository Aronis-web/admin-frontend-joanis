import React, { ComponentType, lazy, Suspense } from 'react';
import { Platform } from 'react-native';
import { LazyLoadFallback } from '@/components/common/LazyLoadFallback';
import { logger } from '@/utils/logger';

/**
 * Session flag key para evitar loops infinitos de reload cuando
 * un chunk sigue fallando incluso tras recargar la página.
 */
const RELOAD_FLAG = '__chunk_reload_attempted__';

/**
 * ¿El error corresponde a un fallo REAL de carga de un chunk dinámico
 * (típico tras un deploy: el HTML cacheado apunta a `index-<hash>.js` que ya no
 * existe)? Solo en ese caso tiene sentido forzar `location.reload()`.
 *
 * IMPORTANTE: un error de RENDER cualquiera (bug en una pantalla) NO debe
 * disparar un reload — hacerlo recarga toda la app y "rebota" al usuario a la
 * ruta inicial (síntoma: al entrar a una pestaña la app se recarga y vuelve a
 * "Mi unidad"), ocultando además el error real. Para esos casos mostramos el
 * fallback en lugar de recargar.
 */
function isChunkLoadError(error: unknown): boolean {
  const err = error as { name?: string; message?: string } | null;
  const name = err?.name ?? '';
  const message = err?.message ?? '';
  if (name === 'ChunkLoadError') return true;
  return (
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    // El servidor devolvió HTML (404 SPA fallback) en vez del JS del chunk:
    // "Refused to execute script ... MIME type ('text/html')".
    /Refused to execute script/i.test(message) ||
    /MIME type/i.test(message) ||
    // Nuestro propio timeout cuando el import se queda colgado (ver
    // `importWithTimeout`). En móvil/PWA el error de MIME a veces NO rechaza la
    // promesa, así que el timeout es la única señal de fallo.
    /chunk load timed out/i.test(message)
  );
}

/**
 * Envuelve un `import()` con un timeout. Un chunk servido como HTML (MIME
 * text/html) puede provocar que la promesa del import NUNCA se resuelva ni
 * rechace, dejando el `Suspense` colgado con el spinner para siempre (síntoma
 * en celular: "se queda cargando" y no hay forma de recargar). El timeout
 * convierte ese cuelgue en un rechazo manejable.
 */
function importWithTimeout<T>(importFunc: () => Promise<T>, timeoutMs = 20000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`chunk load timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    importFunc().then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Recuperación "dura" para web/PWA: desregistra los service workers y limpia
 * las Cache Storage antes de recargar. Un `location.reload()` normal NO basta
 * en móvil, porque el service worker puede seguir sirviendo el HTML viejo
 * cacheado (que apunta a chunks que ya no existen tras un deploy). Esto es lo
 * que hace que en el celular "se quede cargando" sin poder recuperarse.
 */
async function hardRecoverAndReload(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (err) {
    logger.warn('[lazyLoad] No se pudo desregistrar el service worker', err);
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    logger.warn('[lazyLoad] No se pudieron limpiar las caches', err);
  }
  try {
    window.location.reload();
  } catch {
    // ignore
  }
}

/**
 * Envuelve el `import(...)` de un chunk con reintentos exponenciales.
 * Si tras N intentos sigue fallando y estamos en web, fuerza un
 * `location.reload()` (una sola vez) para recuperar el HTML/asset-manifest
 * más reciente. Este error suele darse cuando se despliega una nueva
 * versión y el navegador tiene el HTML viejo cacheado apuntando a
 * chunks (`index-<hash>.js`) que ya no existen en el servidor.
 */
function retryImport<T>(importFunc: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (remaining: number, wait: number) => {
      importWithTimeout(importFunc)
        .then(resolve)
        .catch((error) => {
          if (remaining <= 0) {
            logger.error('[lazyLoad] Chunk load failed after retries', error);

            // Si estamos en web y no reintentamos ya, forzar una recuperación
            // dura (limpiar service worker + caches) y recargar para pedir el
            // HTML nuevo con los hashes correctos. En móvil un reload normal no
            // basta porque el SW sigue sirviendo el HTML viejo cacheado.
            if (
              Platform.OS === 'web' &&
              typeof window !== 'undefined' &&
              typeof sessionStorage !== 'undefined'
            ) {
              const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
              if (!alreadyReloaded) {
                try {
                  sessionStorage.setItem(RELOAD_FLAG, '1');
                } catch {
                  // ignore
                }
                logger.warn('[lazyLoad] Forzando recuperación dura para recuperar chunks');
                void hardRecoverAndReload();
                // No resolvemos: la página se está recargando.
                return;
              }
            }
            reject(error);
            return;
          }
          logger.warn(
            `[lazyLoad] Retry chunk load (${remaining} left) in ${wait}ms`,
            error?.message ?? error
          );
          setTimeout(() => attempt(remaining - 1, wait * 2), wait);
        });
    };
    attempt(retries, delayMs);
  });
}

/**
 * Error boundary que atrapa fallos de carga de chunks post-Suspense
 * (por ejemplo, si el retry se agota o si un dependiente sub-import falla).
 */
interface LazyErrorBoundaryState {
  error: Error | null;
}

class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackMessage?: string },
  LazyErrorBoundaryState
> {
  state: LazyErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    logger.error('[lazyLoad] Boundary caught error', error);

    // Persistir el último error atrapado en localStorage para poder
    // diagnosticar en dispositivos donde no tenemos consola (p. ej. PWA iOS).
    // Se lee con `localStorage.getItem('__last_lazy_boundary_error__')`.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          '__last_lazy_boundary_error__',
          JSON.stringify({
            when: new Date().toISOString(),
            name: error?.name ?? null,
            message: error?.message ?? String(error),
            stack: error?.stack ?? null,
          })
        );
      } catch {
        // ignore (quota / modo privado)
      }
    }

    // Último recurso: reload en web SOLO si es un fallo real de carga de chunk
    // (HTML cacheado tras un deploy). Un error de render normal NO debe recargar
    // la app: mostramos el fallback (ver render) para no rebotar al usuario a la
    // ruta inicial ni ocultar el error.
    if (
      isChunkLoadError(error) &&
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof sessionStorage !== 'undefined'
    ) {
      const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
      if (!alreadyReloaded) {
        try {
          sessionStorage.setItem(RELOAD_FLAG, '1');
        } catch {
          // ignore
        }
        void hardRecoverAndReload();
      }
    }
  }

  // Reintento manual desde el fallback. En web hace la recuperación dura
  // (limpia SW + caches y recarga) — imprescindible en celular, donde el
  // usuario no puede recargar/limpiar caché a mano. Limpiamos primero el flag
  // para que el reintento sea un intento fresco. En nativo simplemente
  // reintenta el render.
  handleRetry = (): void => {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.removeItem(RELOAD_FLAG);
        } catch {
          // ignore
        }
      }
      void hardRecoverAndReload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <LazyLoadFallback message={this.props.fallbackMessage} isError onRetry={this.handleRetry} />
      );
    }
    return this.props.children;
  }
}

/**
 * Utility to create lazy-loaded components with Suspense boundary
 * This helps reduce initial bundle size by code-splitting heavy screens
 *
 * @param importFunc - Dynamic import function that returns the component
 * @param fallbackMessage - Optional custom loading message
 * @returns Lazy-loaded component wrapped in Suspense
 *
 * @example
 * const ProductsScreen = lazyLoad(() => import('@/screens/Inventory/ProductsScreen'));
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallbackMessage?: string
): React.FC<React.ComponentProps<T>> {
  const LazyComponent = lazy(() => retryImport(importFunc));

  return (props: React.ComponentProps<T>) => (
    <LazyErrorBoundary fallbackMessage={fallbackMessage}>
      <Suspense fallback={<LazyLoadFallback message={fallbackMessage} />}>
        <LazyComponent {...props} />
      </Suspense>
    </LazyErrorBoundary>
  );
}

/**
 * Preload a lazy-loaded component
 * Useful for prefetching screens the user is likely to navigate to
 *
 * @example
 * // Preload when hovering over a button
 * onMouseEnter={() => preloadComponent(() => import('@/screens/Detail'))}
 */
export function preloadComponent(importFunc: () => Promise<any>): void {
  retryImport(importFunc).catch((err) => {
    logger.warn('[lazyLoad] preloadComponent failed', err);
  });
}

/**
 * Limpia el flag de reload cuando la app arranca correctamente.
 * Debe llamarse una vez después de que la app monta bien (p.ej. en App.tsx).
 */
export function clearLazyReloadFlag(): void {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      // ignore
    }
  }
}
