/**
 * Reload Bus
 *
 * Bus mínimo para que cualquier pantalla pueda escuchar el evento de
 * "recargar pantalla" que dispara el botón universal (FAB refresh).
 *
 * Uso típico en pantallas legacy que NO usan React Query:
 *
 *   useOnReload(() => {
 *     void loadData();
 *   }, [loadData]);
 *
 * Para pantallas que sí usan React Query, `queryClient.invalidateQueries()`
 * en `reloadCurrentScreen()` ya cubre la mayoría de los casos. Este bus es
 * el fallback explícito para el resto.
 */

type Listener = () => void | Promise<void>;

const listeners = new Set<Listener>();

export const reloadBus = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async emit(): Promise<void> {
    // Ejecuta todos los listeners en paralelo; ignora los que fallen para no
    // bloquear al resto.
    await Promise.allSettled(Array.from(listeners).map((fn) => Promise.resolve(fn())));
  },

  get size(): number {
    return listeners.size;
  },
};

export default reloadBus;
