/**
 * Recarga la "pantalla actual" de forma cross-platform sin cambiar de ruta.
 *
 * En lugar de un reload duro del navegador (que perdía el estado local, la
 * paginación en memoria y en APK ni siquiera funcionaba en producción),
 * invalidamos y refetch-eamos todas las queries activas de React Query.
 * Con esto:
 *   - Web, APK y Electron se comportan igual.
 *   - Nos quedamos en la MISMA ruta (linking preserva la URL).
 *   - La paginación en memoria (page, filtros, tabs) sigue intacta.
 *   - Los datos remotos se refrescan de inmediato.
 */
import { queryClient } from '@/providers/QueryProvider';
import logger from '@/utils/logger';

export async function reloadCurrentScreen(): Promise<void> {
  try {
    // Invalida todas las queries: las activas se refetch-ean automáticamente,
    // las inactivas quedan marcadas como stale para su próximo uso.
    await queryClient.invalidateQueries();
    // Fuerza refetch inmediato para las queries actualmente montadas.
    await queryClient.refetchQueries({ type: 'active' });
  } catch (e) {
    logger.error('reloadCurrentScreen failed', e);
  }
}

export default reloadCurrentScreen;
