/**
 * Recarga la "pantalla actual" de forma cross-platform sin cambiar de ruta.
 *
 * Estrategia:
 *   1) React Query: invalida todas las queries y solicita refetch de las
 *      activas (fire-and-forget para no bloquear si la red va lenta).
 *   2) Reload Bus: emite el evento para pantallas que se suscribieron con
 *      `useOnReload`. Preserva estado local (paginación, filtros).
 *   3) Fallback: si NINGUNA pantalla se suscribió, remonta la ruta actual con
 *      `StackActions.replace`, forzando que sus `useEffect` de fetch se
 *      vuelvan a ejecutar. Pierde `useState` local pero garantiza que
 *      cualquier pantalla legacy sí refresque.
 */
import { CommonActions, StackActions } from '@react-navigation/native';
import { queryClient } from '@/providers/QueryProvider';
import { navigationRef } from '@/navigation/navigationRef';
import { reloadBus } from '@/utils/reloadBus';
import logger from '@/utils/logger';

function remountCurrentRoute(): boolean {
  try {
    if (!navigationRef.isReady()) return false;
    const route = navigationRef.getCurrentRoute();
    if (!route) return false;
    // `replace` sólo funciona en un stack; si estamos en algo tipo tabs, el
    // fallback es `setParams` con un timestamp que fuerza re-render.
    try {
      navigationRef.dispatch(StackActions.replace(route.name, route.params));
    } catch {
      navigationRef.dispatch(
        CommonActions.setParams({ __reloadTs: Date.now() } as Record<string, unknown>)
      );
    }
    logger.info(`reloadCurrentScreen: remount de ${route.name}`);
    return true;
  } catch (e) {
    logger.error('reloadCurrentScreen: remount failed', e);
    return false;
  }
}

export async function reloadCurrentScreen(): Promise<void> {
  // 1) React Query (fire-and-forget).
  try {
    void queryClient.invalidateQueries({ refetchType: 'active' });
    void queryClient.refetchQueries({ type: 'active' });
  } catch (e) {
    logger.error('reloadCurrentScreen: react-query step failed', e);
  }

  // 2) Bus de listeners registrados con useOnReload.
  let handledCount = 0;
  try {
    handledCount = await reloadBus.emit();
    logger.info(`reloadCurrentScreen: ${handledCount} listeners atendieron`);
  } catch (e) {
    logger.error('reloadCurrentScreen: bus step failed', e);
  }

  // 3) Fallback: si nadie escuchaba, remount de la ruta actual.
  if (handledCount === 0) {
    remountCurrentRoute();
  }
}

export default reloadCurrentScreen;
