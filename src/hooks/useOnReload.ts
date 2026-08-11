/**
 * useOnReload
 *
 * Suscribe una callback al bus de reload. Se dispara cuando el usuario pulsa
 * el botón universal de recarga del FAB.
 *
 * Uso: `useOnReload(() => { void loadData(); })`.
 *
 * Implementación con `useRef` para llamar siempre a la última versión del
 * callback sin necesidad de memoizar en el consumidor (evita resubscribirse
 * en cada render y elimina cierres obsoletos sobre estado del componente).
 */
import { useEffect, useRef } from 'react';
import { reloadBus } from '@/utils/reloadBus';

export function useOnReload(callback: () => void | Promise<void>): void {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    return reloadBus.subscribe(() => ref.current());
  }, []);
}

export default useOnReload;
