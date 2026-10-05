/**
 * useGoBack
 *
 * "Volver" seguro: retrocede si hay pantalla anterior en la pila y, si no
 * (p. ej. se abrió el enlace directo en otra pestaña), va a `fallback` o a la
 * pantalla de inicio. Evita botones "Volver" que no hacen nada.
 */
import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { MAIN_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';

export function useGoBack(fallback?: { name: string; params?: Record<string, unknown> }) {
  const navigation = useNavigation<any>();
  const canSeeDashboard = useAuthStore(
    (s) => !!s.user?.permissions?.includes(PERMISSIONS.DASHBOARD.READ)
  );

  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (fallback) {
      navigation.navigate(fallback.name, fallback.params);
      return;
    }
    navigation.navigate(canSeeDashboard ? MAIN_ROUTES.DASHBOARD : MAIN_ROUTES.HOME);
  }, [navigation, fallback, canSeeDashboard]);
}

export default useGoBack;
