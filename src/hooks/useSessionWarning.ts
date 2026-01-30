import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '@/store/auth';

/**
 * Hook to show a warning when the session is about to expire
 * Shows an alert 5 minutes before the token expires
 */
export const useSessionWarning = () => {
  const { tokenExpiresAt, isAuthenticated, refreshAccessToken } = useAuthStore();
  const warningShownRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !tokenExpiresAt) {
      // Clear interval if user is not authenticated
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      warningShownRef.current = false;
      return;
    }

    // Check every minute if we should show the warning
    checkIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeUntilExpiry = tokenExpiresAt - now;
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

      // Show warning if less than 5 minutes remaining and warning hasn't been shown yet
      if (timeUntilExpiry > 0 && timeUntilExpiry <= fiveMinutes && !warningShownRef.current) {
        warningShownRef.current = true;

        const minutesRemaining = Math.ceil(timeUntilExpiry / 60000);

        Alert.alert(
          'Sesión por Expirar',
          `Tu sesión expirará en ${minutesRemaining} minuto${minutesRemaining > 1 ? 's' : ''}. ¿Deseas extender tu sesión?`,
          [
            {
              text: 'Cerrar Sesión',
              style: 'destructive',
              onPress: () => {
                useAuthStore.getState().logout();
              },
            },
            {
              text: 'Extender Sesión',
              style: 'default',
              onPress: async () => {
                console.log('🔄 User requested session extension');
                try {
                  const success = await refreshAccessToken();
                  if (success) {
                    Alert.alert(
                      'Sesión Extendida',
                      'Tu sesión ha sido extendida exitosamente.',
                      [{ text: 'OK', style: 'default' }]
                    );
                    // Reset warning flag so it can be shown again later
                    warningShownRef.current = false;
                  } else {
                    Alert.alert(
                      'Error',
                      'No se pudo extender la sesión. Por favor, inicia sesión nuevamente.',
                      [{ text: 'OK', style: 'default' }]
                    );
                  }
                } catch (error) {
                  console.error('Error extending session:', error);
                  Alert.alert(
                    'Error',
                    'No se pudo extender la sesión. Por favor, inicia sesión nuevamente.',
                    [{ text: 'OK', style: 'default' }]
                  );
                }
              },
            },
          ],
          { cancelable: false }
        );
      }

      // Reset warning flag if token was refreshed (expiry time changed)
      if (timeUntilExpiry > fiveMinutes && warningShownRef.current) {
        warningShownRef.current = false;
      }
    }, 60000); // Check every minute

    // Cleanup interval on unmount
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [tokenExpiresAt, isAuthenticated, refreshAccessToken]);
};

export default useSessionWarning;
