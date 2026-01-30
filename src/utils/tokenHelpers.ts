import { useAuthStore } from '@/store/auth';

/**
 * Utility functions for token management in file operations
 *
 * These helpers ensure tokens are fresh before long-running operations
 * like file downloads and uploads to prevent JWT expiration errors.
 */

/**
 * Ensures the token is fresh before a file operation
 * Refreshes the token if it will expire within the next 2 minutes
 *
 * @param operationName - Name of the operation for logging
 * @returns The current valid token
 * @throws Error if token refresh fails or no token is available
 */
export const ensureFreshTokenForFileOperation = async (
  operationName: string = 'file operation'
): Promise<string> => {
  const { token, tokenExpiresAt, refreshAccessToken, shouldRefreshToken } = useAuthStore.getState();

  console.log(`🔐 [${operationName}] Checking token freshness...`, {
    hasToken: !!token,
    expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : 'unknown',
    timeUntilExpiry: tokenExpiresAt ? Math.floor((tokenExpiresAt - Date.now()) / 60000) : 'unknown',
  });

  if (!token) {
    console.error(`❌ [${operationName}] No token available`);
    throw new Error('No hay token de autenticación disponible');
  }

  // Check if token will expire in the next 2 minutes (more aggressive than the default 5 minutes)
  // This gives us a buffer for long file operations
  const twoMinutes = 2 * 60 * 1000;
  const needsRefresh = tokenExpiresAt ? Date.now() >= tokenExpiresAt - twoMinutes : true;

  if (needsRefresh || shouldRefreshToken()) {
    const timeUntilExpiry = tokenExpiresAt ? tokenExpiresAt - Date.now() : 0;
    const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);

    console.log(`🔄 [${operationName}] Token needs refresh before operation`, {
      minutesUntilExpiry,
      expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : 'unknown',
    });

    try {
      const success = await refreshAccessToken();

      if (!success) {
        console.error(`❌ [${operationName}] Token refresh failed`);
        throw new Error('No se pudo refrescar el token de autenticación');
      }

      // Get the new token after refresh
      const newToken = useAuthStore.getState().token;

      if (!newToken) {
        console.error(`❌ [${operationName}] No token available after refresh`);
        throw new Error('No hay token disponible después del refresh');
      }

      console.log(`✅ [${operationName}] Token refreshed successfully before operation`);
      return newToken;
    } catch (error) {
      console.error(`❌ [${operationName}] Error refreshing token:`, error);
      throw new Error('Error al refrescar el token de autenticación');
    }
  }

  console.log(`✅ [${operationName}] Token is fresh, proceeding with operation`);
  return token;
};

/**
 * Wrapper for file download operations that ensures token freshness
 *
 * @param downloadFn - The download function to execute
 * @param operationName - Name of the operation for logging
 * @returns The result of the download function
 */
export const withFreshToken = async <T>(
  downloadFn: (token: string) => Promise<T>,
  operationName: string = 'file operation'
): Promise<T> => {
  const freshToken = await ensureFreshTokenForFileOperation(operationName);
  return downloadFn(freshToken);
};
