import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { authService } from '@/services/AuthService';

/**
 * Hook para manejar el refresh automático de tokens
 *
 * Este hook:
 * - Verifica cada minuto si el token necesita ser refrescado
 * - Refresca el token 5 minutos antes de que expire
 * - Refresca el token cuando la app vuelve al foreground si es necesario
 * - Usa el sistema de deduplicación de AuthService para evitar race conditions
 * - Maneja errores de red y timeouts de forma robusta
 */
export const useTokenRefresh = () => {
  const { isAuthenticated, shouldRefreshToken, refreshAccessToken, tokenExpiresAt } = useAuthStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const isRefreshingRef = useRef(false);

  // Función para verificar y refrescar el token si es necesario
  const checkAndRefreshToken = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    // Evitar múltiples refreshes simultáneos a nivel de hook
    if (isRefreshingRef.current) {
      console.log('🔄 Token refresh already in progress at hook level, skipping...');
      return;
    }

    // Verificar si el token necesita ser refrescado (5 minutos antes de expirar)
    if (shouldRefreshToken()) {
      const timeUntilExpiry = tokenExpiresAt ? tokenExpiresAt - Date.now() : 0;
      const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);

      console.log('🔄 Token needs refresh - attempting automatic refresh...', {
        minutesUntilExpiry,
        expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : 'unknown',
      });

      isRefreshingRef.current = true;

      try {
        const success = await refreshAccessToken();
        if (success) {
          console.log('✅ Token refreshed successfully (automatic)');
        } else {
          console.warn('⚠️ Token refresh failed (automatic) - user may need to re-login');
        }
      } catch (error) {
        console.error('❌ Error during automatic token refresh:', error);
      } finally {
        isRefreshingRef.current = false;
      }
    }
  }, [isAuthenticated, shouldRefreshToken, refreshAccessToken, tokenExpiresAt]);

  // Configurar intervalo para verificar el token cada minuto
  useEffect(() => {
    if (!isAuthenticated) {
      // Limpiar intervalo si el usuario no está autenticado
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isRefreshingRef.current = false;
      return;
    }

    console.log('🔐 Starting automatic token refresh monitoring...');

    // Verificar inmediatamente al montar
    checkAndRefreshToken();

    // Configurar intervalo para verificar cada minuto (60000ms)
    intervalRef.current = setInterval(() => {
      checkAndRefreshToken();
    }, 60000); // 1 minuto

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, checkAndRefreshToken]);

  // Manejar cambios de estado de la app (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // Cuando la app vuelve al foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App returned to foreground - checking token...');

        if (isAuthenticated) {
          // Verificar si el token necesita ser refrescado
          await checkAndRefreshToken();
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, checkAndRefreshToken]);
};
