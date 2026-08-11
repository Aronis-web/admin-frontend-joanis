/**
 * Recarga la "pantalla actual" de forma cross-platform sin cambiar de ruta.
 *
 * Estrategia:
 *   1) React Query (fire-and-forget): invalida todas las queries y solicita
 *      refetch de las activas. No se espera a la respuesta HTTP para no
 *      bloquear al resto de listeners si la red va lenta.
 *   2) Reload Bus: emite el evento (síncrono) para pantallas legacy que se
 *      apoyan en `useState + useEffect + apiClient` (se suscriben con
 *      `useOnReload`).
 *
 * Con esto:
 *   - Web, APK y Electron se comportan igual.
 *   - Nos quedamos en la MISMA ruta (linking preserva la URL).
 *   - La paginación en memoria (page, filtros, tabs) sigue intacta.
 *   - Los datos remotos se refrescan de inmediato.
 */
import { queryClient } from '@/providers/QueryProvider';
import { reloadBus } from '@/utils/reloadBus';
import logger from '@/utils/logger';

export async function reloadCurrentScreen(): Promise<void> {
  // 1) React Query: fire-and-forget para no bloquear si la red va lenta.
  try {
    // `invalidateQueries` con `refetchType: 'active'` marca stale y dispara
    // refetch de las queries montadas. No await: dejamos que las respuestas
    // lleguen en background.
    void queryClient.invalidateQueries({ refetchType: 'active' });
    // Segunda pasada explícita: cubre observers que quedaron fuera por
    // filtros/enabled dinámicos.
    void queryClient.refetchQueries({ type: 'active' });
  } catch (e) {
    logger.error('reloadCurrentScreen: react-query step failed', e);
  }

  // 2) Reload bus (para pantallas sin React Query).
  try {
    logger.info(`reloadCurrentScreen: notificando ${reloadBus.size} listeners`);
    await reloadBus.emit();
  } catch (e) {
    logger.error('reloadCurrentScreen: bus step failed', e);
  }
}

export default reloadCurrentScreen;
