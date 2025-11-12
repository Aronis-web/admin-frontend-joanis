import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { parseJWTToken, isTokenExpired } from '@/utils/jwt';

/**
 * Test function to debug authentication issues
 */
export const testAuthentication = async () => {
  console.log('=== AUTHENTICATION TEST ===');

  const authStore = useAuthStore.getState();
  const { token, refreshToken, user, isAuthenticated } = authStore;

  console.log('Auth Store State:', {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    hasUser: !!user,
    isAuthenticated,
    userId: user?.id,
    userEmail: user?.email
  });

  if (token) {
    console.log('Token Analysis:');
    console.log('- Token length:', token.length);
    console.log('- Token format valid:', token.split('.').length === 3);
    console.log('- Token expired:', isTokenExpired(token));

    const payload = parseJWTToken(token);
    console.log('- Token payload:', payload);
  }

  if (refreshToken) {
    console.log('Refresh Token Analysis:');
    console.log('- Refresh token length:', refreshToken.length);
  }

  // Test /auth/me endpoint
  try {
    console.log('\nTesting /auth/me endpoint...');
    const currentUser = await authApi.getCurrentUser();
    console.log('✅ /auth/me SUCCESS:', currentUser);
  } catch (error: any) {
    console.log('❌ /auth/me FAILED:', error.response?.data || error.message);
  }

  // Test token refresh
  try {
    console.log('\nTesting token refresh...');
    const refreshResult = await authStore.refreshAccessToken();
    console.log('✅ Token refresh result:', refreshResult);

    const newToken = useAuthStore.getState().token;
    console.log('New token:', newToken ? 'Received' : 'Not received');
  } catch (error: any) {
    console.log('❌ Token refresh FAILED:', error.message);
  }

  console.log('=== END AUTHENTICATION TEST ===\n');
};

export default testAuthentication;