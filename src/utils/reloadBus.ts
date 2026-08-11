/**
 * Reload Bus
 *
 * Bus mínimo para que cualquier pantalla pueda escuchar el evento de
 * "recargar pantalla" que dispara el botón universal (FAB refresh).
 *
 * `emit()` devuelve el número de listeners que se ejecutaron, para que quien
 * dispara pueda decidir si aplicar un fallback (ej. remount de la ruta).
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

  async emit(): Promise<number> {
    const snapshot = Array.from(listeners);
    await Promise.allSettled(snapshot.map((fn) => Promise.resolve(fn())));
    return snapshot.length;
  },

  get size(): number {
    return listeners.size;
  },
};

export default reloadBus;
