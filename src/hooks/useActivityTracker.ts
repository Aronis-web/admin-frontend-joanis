/**
 * 🎯 useActivityTracker - Hook optimizado para tracking de actividad
 *
 * Implementa expiración por inactividad con MÍNIMOS requests adicionales:
 *
 * Estrategia "Piggyback + Lazy Heartbeat":
 * 1. Rastrea actividad del usuario localmente (mouse, keyboard, scroll, touch)
 * 2. Rastrea último API call (actualizado por el interceptor)
 * 3. Solo envía heartbeat dedicado si:
 *    - Usuario está activo (interactuó en los últimos X minutos)
 *    - NO ha hecho ningún API call en los últimos Y minutos
 *
 * Resultado:
 * - Usuarios activos haciendo API calls → CERO requests extra
 * - Usuarios activos solo mirando → 1 heartbeat cada 10-15 min
 * - Usuarios inactivos → cero requests, sesión expira naturalmente
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';

// Singleton para tracking global del último API call
// Se actualiza desde el interceptor de API
let lastApiCallTime = Date.now();

/**
 * Actualiza el timestamp del último API call.
 * Llamar desde el interceptor de respuesta del API client.
 */
export function updateLastApiCall(): void {
  lastApiCallTime = Date.now();
}

/**
 * Obtiene el timestamp del último API call.
 */
export function getLastApiCall(): number {
  return lastApiCallTime;
}

interface ActivityTrackerOptions {
  /**
   * Intervalo de verificación en ms (default: 5 minutos)
   * Cada X tiempo se verifica si hay que enviar heartbeat
   */
  checkIntervalMs?: number;

  /**
   * Tiempo sin API calls para considerar enviar heartbeat (default: 10 minutos)
   * Si pasaron más de X minutos sin API calls Y el usuario está activo, enviar heartbeat
   */
  apiIdleThresholdMs?: number;

  /**
   * Tiempo máximo sin actividad de usuario para considerar "inactivo" (default: 15 minutos)
   * Si el usuario no interactuó en X minutos, no enviar heartbeat
   */
  userIdleThresholdMs?: number;

  /**
   * Habilitar logging de debug
   */
  debug?: boolean;
}

const DEFAULT_OPTIONS: Required<ActivityTrackerOptions> = {
  checkIntervalMs: 5 * 60 * 1000, // 5 minutos
  apiIdleThresholdMs: 10 * 60 * 1000, // 10 minutos
  userIdleThresholdMs: 15 * 60 * 1000, // 15 minutos
  debug: false,
};

export function useActivityTracker(options: ActivityTrackerOptions = {}): void {
  const { isAuthenticated } = useAuthStore();
  const lastUserActivity = useRef<number>(Date.now());
  const isTracking = useRef<boolean>(false);

  const opts = { ...DEFAULT_OPTIONS, ...options };

  const log = useCallback(
    (message: string, ...args: any[]) => {
      if (opts.debug) {
        console.log(`[ActivityTracker] ${message}`, ...args);
      }
    },
    [opts.debug]
  );

  // Handler para eventos de actividad del usuario
  const handleUserActivity = useCallback(() => {
    lastUserActivity.current = Date.now();
  }, []);

  // Enviar heartbeat al backend
  const sendHeartbeat = useCallback(async () => {
    try {
      const token = authService.getAccessToken();
      if (!token) {
        log('No token, skipping heartbeat');
        return;
      }

      log('Sending heartbeat...');

      const response = await fetch(`${config.API_URL}/auth/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-App-Id': config.APP_ID,
        },
      });

      if (response.ok) {
        log('Heartbeat sent successfully');
        // Actualizar timestamp de API call ya que esto cuenta como actividad
        updateLastApiCall();
      } else if (response.status === 401) {
        log('Heartbeat returned 401 - session may have expired');
        // No hacer logout aquí, dejar que el interceptor normal lo maneje
      } else {
        log('Heartbeat failed with status:', response.status);
      }
    } catch (error) {
      log('Heartbeat error:', error);
      // No fallar silenciosamente, pero tampoco interrumpir la app
    }
  }, [log]);

  // Verificar si necesitamos enviar heartbeat
  const checkAndSendHeartbeat = useCallback(() => {
    const now = Date.now();
    const timeSinceLastApiCall = now - lastApiCallTime;
    const timeSinceLastUserActivity = now - lastUserActivity.current;

    log('Checking heartbeat need:', {
      timeSinceLastApiCall: Math.round(timeSinceLastApiCall / 1000) + 's',
      timeSinceLastUserActivity: Math.round(timeSinceLastUserActivity / 1000) + 's',
      apiIdleThreshold: Math.round(opts.apiIdleThresholdMs / 1000) + 's',
      userIdleThreshold: Math.round(opts.userIdleThresholdMs / 1000) + 's',
    });

    // Condiciones para enviar heartbeat:
    // 1. Usuario activo (interactuó recientemente)
    // 2. No hubo API calls en un rato (actividad no registrada por piggyback)
    const userIsActive = timeSinceLastUserActivity < opts.userIdleThresholdMs;
    const noRecentApiCalls = timeSinceLastApiCall > opts.apiIdleThresholdMs;

    if (userIsActive && noRecentApiCalls) {
      log('User active but no recent API calls - sending heartbeat');
      sendHeartbeat();
    } else if (!userIsActive) {
      log('User idle - skipping heartbeat (session will expire naturally)');
    } else {
      log('Recent API calls detected - skipping heartbeat (activity already tracked)');
    }
  }, [opts.apiIdleThresholdMs, opts.userIdleThresholdMs, sendHeartbeat, log]);

  useEffect(() => {
    if (!isAuthenticated) {
      log('Not authenticated, skipping activity tracking');
      return;
    }

    if (isTracking.current) {
      log('Already tracking, skipping duplicate setup');
      return;
    }

    isTracking.current = true;
    log('Starting activity tracking on platform:', Platform.OS);

    let throttleTimeout: ReturnType<typeof setTimeout> | null = null;

    // Para plataformas móviles (Android/iOS), usar AppState
    // Para web/Electron, usar window events
    const isWeb = Platform.OS === 'web';

    if (isWeb && typeof window !== 'undefined') {
      // Eventos a escuchar para detectar actividad del usuario (solo web)
      const activityEvents = [
        'mousedown',
        'mousemove',
        'keydown',
        'scroll',
        'touchstart',
        'click',
        'wheel',
      ];

      // Throttle para eventos frecuentes (mousemove, scroll)
      const throttledHandler = () => {
        if (throttleTimeout) return;
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          handleUserActivity();
        }, 1000); // Máximo 1 update por segundo
      };

      // Agregar listeners
      activityEvents.forEach((event) => {
        if (event === 'mousemove' || event === 'scroll' || event === 'wheel') {
          window.addEventListener(event, throttledHandler, { passive: true });
        } else {
          window.addEventListener(event, handleUserActivity, { passive: true });
        }
      });

      // Cleanup para web
      const cleanupWeb = () => {
        activityEvents.forEach((event) => {
          if (event === 'mousemove' || event === 'scroll' || event === 'wheel') {
            window.removeEventListener(event, throttledHandler);
          } else {
            window.removeEventListener(event, handleUserActivity);
          }
        });
        if (throttleTimeout) {
          clearTimeout(throttleTimeout);
        }
      };

      // Inicializar timestamps
      lastUserActivity.current = Date.now();
      updateLastApiCall();

      // Intervalo de verificación
      const intervalId = setInterval(checkAndSendHeartbeat, opts.checkIntervalMs);

      log('Activity tracking initialized (web)', {
        checkInterval: Math.round(opts.checkIntervalMs / 1000) + 's',
        apiIdleThreshold: Math.round(opts.apiIdleThresholdMs / 1000) + 's',
        userIdleThreshold: Math.round(opts.userIdleThresholdMs / 1000) + 's',
      });

      return () => {
        log('Stopping activity tracking (web)');
        isTracking.current = false;
        cleanupWeb();
        clearInterval(intervalId);
      };
    } else {
      // Para móviles (Android/iOS), usar AppState para detectar actividad
      // Cuando la app está en foreground, asumimos que el usuario está activo
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          log('App came to foreground - updating activity');
          handleUserActivity();
        }
      };

      const subscription = AppState.addEventListener('change', handleAppStateChange);

      // Inicializar timestamps
      lastUserActivity.current = Date.now();
      updateLastApiCall();

      // Intervalo de verificación
      const intervalId = setInterval(checkAndSendHeartbeat, opts.checkIntervalMs);

      log('Activity tracking initialized (mobile)', {
        platform: Platform.OS,
        checkInterval: Math.round(opts.checkIntervalMs / 1000) + 's',
        apiIdleThreshold: Math.round(opts.apiIdleThresholdMs / 1000) + 's',
        userIdleThreshold: Math.round(opts.userIdleThresholdMs / 1000) + 's',
      });

      return () => {
        log('Stopping activity tracking (mobile)');
        isTracking.current = false;
        subscription.remove();
        clearInterval(intervalId);
      };
    }
  }, [isAuthenticated, handleUserActivity, checkAndSendHeartbeat, opts.checkIntervalMs, log]);
}

export default useActivityTracker;
