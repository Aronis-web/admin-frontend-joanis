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
    /Failed to fetch dynamically imported module/i.test(message)
  );
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
      importFunc()
        .then(resolve)
        .catch((error) => {
          if (remaining <= 0) {
            logger.error('[lazyLoad] Chunk load failed after retries', error);

            // Si estamos en web y no reintentamos ya, forzar reload
            // para pedir el HTML nuevo con los hashes correctos.
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
                logger.warn('[lazyLoad] Forzando reload para recuperar chunks actualizados');
                window.location.reload();
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
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.error) {
      return <LazyLoadFallback message={this.props.fallbackMessage} />;
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
