/**
 * useOnReload
 *
 * Suscribe una callback al bus de reload. Se dispara cuando el usuario pulsa
 * el botón universal de recarga del FAB (o pull-to-refresh en web), solo si
 * la pantalla que contiene al componente está enfocada.
 *
 * Uso: `useOnReload(() => { void loadData(); })`.
 *
 * Implementación con `useRef` para llamar siempre a la última versión del
 * callback sin necesidad de memoizar en el consumidor (evita resubscribirse
 * en cada render y elimina cierres obsoletos sobre estado del componente).
 */
import { useContext, useEffect, useRef } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { reloadBus } from '@/utils/reloadBus';

export function useOnReload(callback: () => void | Promise<void>): void {
  const ref = useRef(callback);
  ref.current = callback;
  // Puede no haber navegación (componentes fuera del stack): siempre activo.
  const navigation = useContext(NavigationContext);
  const navRef = useRef(navigation);
  navRef.current = navigation;

  useEffect(() => {
    return reloadBus.subscribe(
      () => ref.current(),
      () => (navRef.current ? navRef.current.isFocused() : true)
    );
  }, []);
}

export default useOnReload;
