/**
 * Recarga la "pantalla actual" de forma cross-platform sin cambiar de ruta.
 *
 * Estrategia en tres pasos, tolerante a fallas:
 *   1) React Query: cancela requests en vuelo, invalida TODAS las queries y
 *      fuerza refetch inmediato de las activas (las montadas).
 *   2) Reload Bus: emite el evento para pantallas legacy que se apoyan en
 *      `useState + useEffect + apiClient` (pueden suscribirse con
 *      `useOnReload`).
 *   3) Log: registra cuántos listeners se dispararon (útil para diagnosticar
 *      pantallas que no reaccionan).
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
  // 1) React Query
  try {
    // Cancela cualquier request en vuelo para arrancar limpio.
    await queryClient.cancelQueries();
    // Marca todas las queries como stale — las activas se refetch-ean.
    await queryClient.invalidateQueries({ refetchType: 'active' });
    // Fuerza refetch inmediato como segunda pasada por si alguna quedó fuera.
    await queryClient.refetchQueries({ type: 'active' });
  } catch (e) {
    logger.error('reloadCurrentScreen: react-query step failed', e);
  }

  // 2) Reload bus (para pantallas sin React Query).
  try {
    if (reloadBus.size > 0) {
      logger.info(`reloadCurrentScreen: notificando ${reloadBus.size} listeners`);
      await reloadBus.emit();
    }
  } catch (e) {
    logger.error('reloadCurrentScreen: bus step failed', e);
  }
}

export default reloadCurrentScreen;
