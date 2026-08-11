/**
 * useOnReload
 *
 * Suscribe una callback al bus de reload. Se dispara cuando el usuario pulsa
 * el botón universal de recarga del FAB.
 *
 * Se recomienda usar en pantallas que NO se apoyan 100% en React Query
 * (por ejemplo, aquellas que hacen fetch manual con `apiClient` + `useState`).
 */
import { useEffect } from 'react';
import { reloadBus } from '@/utils/reloadBus';

export function useOnReload(callback: () => void | Promise<void>): void {
  useEffect(() => {
    const unsubscribe = reloadBus.subscribe(callback);
    return unsubscribe;
    // Intencionalmente sin deps: usamos el mismo patrón que `useEffect` con
    // ref-callback estable; los consumidores deben memoizar `callback` con
    // `useCallback` si necesitan lógica dependiente de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback]);
}

export default useOnReload;
