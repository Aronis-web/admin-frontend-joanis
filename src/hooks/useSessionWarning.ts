import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';

/**
 * Hook to automatically refresh the session token before it expires
 * Refreshes the token automatically when 5 minutes or less remain
 */
export const useSessionWarning = () => {
  const { tokenExpiresAt, isAuthenticated, refreshAccessToken } = useAuthStore();
  const refreshedRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !tokenExpiresAt) {
      // Clear interval if user is not authenticated
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      refreshedRef.current = false;
      return;
    }

    // Check every minute if we should refresh the token
    checkIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      const timeUntilExpiry = tokenExpiresAt - now;
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

      // Auto-refresh token if less than 5 minutes remaining and hasn't been refreshed yet
      if (timeUntilExpiry > 0 && timeUntilExpiry <= fiveMinutes && !refreshedRef.current) {
        refreshedRef.current = true;

        const minutesRemaining = Math.ceil(timeUntilExpiry / 60000);
        console.log(
          `🔄 Auto-refreshing token (${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} remaining)...`
        );

        try {
          const success = await refreshAccessToken();
          if (success) {
            console.log('✅ Token auto-refreshed successfully');
            // Reset flag so it can refresh again later
            refreshedRef.current = false;
          } else {
            console.error('❌ Token auto-refresh failed');
            // Keep flag set to avoid repeated failed attempts
          }
        } catch (error) {
          console.error('❌ Error auto-refreshing token:', error);
          // Keep flag set to avoid repeated failed attempts
        }
      }

      // Reset refresh flag if token was refreshed externally (expiry time changed significantly)
      if (timeUntilExpiry > fiveMinutes && refreshedRef.current) {
        refreshedRef.current = false;
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
