import { useCallback, useRef } from 'react';

/**
 * Evita que una acción asíncrona se dispare dos veces (doble clic rápido).
 *
 * `run(fn)` no hace nada si ya hay una ejecución en curso; la marca se libera
 * al terminar `fn` (con éxito o error). Complementa a `mutation.isPending`,
 * que sólo se refleja en el siguiente render.
 */
export const useSingleFlight = () => {
  const inFlight = useRef(false);

  return useCallback(async (fn: () => Promise<unknown>): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await fn();
    } finally {
      inFlight.current = false;
    }
  }, []);
};

export default useSingleFlight;
