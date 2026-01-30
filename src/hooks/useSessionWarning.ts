import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';

/**
 * Hook to automatically refresh the session token before it expires
 * Refreshes the token automatically when 10 minutes or less remain
 * Checks every 30 seconds for better responsiveness
 */
export const useSessionWarning = () => {
  const { tokenExpiresAt, isAuthenticated, refreshAccessToken } = useAuthStore();
  const lastRefreshAttemptRef = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !tokenExpiresAt) {
      // Clear interval if user is not authenticated
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      lastRefreshAttemptRef.current = 0;
      return;
    }

    // Check every 30 seconds if we should refresh the token (more responsive than 1 minute)
    checkIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      const timeUntilExpiry = tokenExpiresAt - now;
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
      const timeSinceLastRefresh = now - lastRefreshAttemptRef.current;
      const minTimeBetweenRefreshes = 2 * 60 * 1000; // Don't refresh more than once every 2 minutes

      // Auto-refresh token if:
      // 1. Less than 10 minutes remaining (increased from 5 for safety)
      // 2. At least 2 minutes have passed since last refresh attempt
      if (
        timeUntilExpiry > 0 &&
        timeUntilExpiry <= tenMinutes &&
        timeSinceLastRefresh >= minTimeBetweenRefreshes
      ) {
        lastRefreshAttemptRef.current = now;

        const minutesRemaining = Math.ceil(timeUntilExpiry / 60000);
        console.log(
          `🔄 Auto-refreshing token (${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} remaining)...`
        );

        try {
          const success = await refreshAccessToken();
          if (success) {
            console.log('✅ Token auto-refreshed successfully');
          } else {
            console.error('❌ Token auto-refresh failed');
          }
        } catch (error) {
          console.error('❌ Error auto-refreshing token:', error);
        }
      }

      // Reset last refresh time if token was refreshed externally (expiry time changed significantly)
      if (timeUntilExpiry > tenMinutes) {
        lastRefreshAttemptRef.current = 0;
      }
    }, 30000); // Check every 30 seconds (more responsive than 60 seconds)

    // Cleanup interval on unmount
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [tokenExpiresAt, isAuthenticated, refreshAccessToken]);
};

export default useSessionWarning;
