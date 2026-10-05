/**
 * Reload Bus
 *
 * Bus mínimo para que cualquier pantalla pueda escuchar el evento de
 * "recargar pantalla" que dispara el botón universal (FAB refresh).
 *
 * Cada listener puede declarar `isActive()`: el native-stack deja montadas las
 * pantallas anteriores (Dashboard casi siempre está debajo), así que solo se
 * ejecutan los listeners de la pantalla enfocada. Si no se filtrara, recargar
 * desde cualquier pantalla refrescaba el Dashboard escondido y la pantalla
 * visible se quedaba igual.
 *
 * `emit()` devuelve el número de listeners que se ejecutaron, para que quien
 * dispara pueda decidir si aplicar un fallback (ej. remount de la ruta).
 */

type Listener = () => void | Promise<void>;

interface Entry {
  run: Listener;
  isActive: () => boolean;
}

const entries = new Set<Entry>();

export const reloadBus = {
  subscribe(listener: Listener, isActive: () => boolean = () => true): () => void {
    const entry: Entry = { run: listener, isActive };
    entries.add(entry);
    return () => {
      entries.delete(entry);
    };
  },

  async emit(): Promise<number> {
    const active = Array.from(entries).filter((e) => {
      try {
        return e.isActive();
      } catch {
        return false;
      }
    });
    await Promise.allSettled(active.map((e) => Promise.resolve(e.run())));
    return active.length;
  },

  get size(): number {
    return entries.size;
  },
};

export default reloadBus;
