import { useAuthStore } from '@/store/auth';
import { parseJWTToken, isTokenExpired } from '@/utils/jwt';
import { apiClient } from '@/services/api/client';

/**
 * Comprehensive JWT debugging utility
 */
export const debugJWT = () => {
  console.log('=== JWT DEBUG ANALYSIS ===');

  const authStore = useAuthStore.getState();
  const { token, refreshToken, user, isAuthenticated } = authStore;

  console.log('📊 Auth Store State:');
  console.log('- Is Authenticated:', isAuthenticated);
  console.log('- Has Token:', !!token);
  console.log('- Has Refresh Token:', !!refreshToken);
  console.log('- Has User:', !!user);
  console.log('- User ID:', user?.id);
  console.log('- User Email:', user?.email);

  if (token) {
    console.log('\n🔑 JWT Token Analysis:');
    console.log('- Token Length:', token.length);
    console.log('- Token Format:', token.split('.').length === 3 ? 'Valid JWT' : 'Invalid JWT');
    console.log('- Token Expired:', isTokenExpired(token));

    const payload = parseJWTToken(token);
    if (payload) {
      console.log('- Token Payload:', payload);
      console.log('- Subject (sub):', payload.sub);
      console.log('- Issued At (iat):', new Date(payload.iat * 1000).toISOString());
      console.log('- Expires At (exp):', new Date(payload.exp * 1000).toISOString());
      console.log('- Time Until Expiry:', Math.floor((payload.exp - Date.now() / 1000) / 60), 'minutes');
    } else {
      console.log('- ❌ Failed to parse token payload');
    }
  } else {
    console.log('\n❌ No token available for analysis');
  }

  console.log('\n🔍 Expected vs Actual:');
  console.log('- Expected User ID (from login):', user?.id);
  console.log('- Token Subject (sub):', parseJWTToken(token)?.sub);
  console.log('- Match:', user?.id === parseJWTToken(token)?.sub ? '✅' : '❌');

  console.log('=== END JWT DEBUG ANALYSIS ===\n');
};

/**
 * Test multiple endpoints to understand authentication pattern
 */
export const testMultipleEndpoints = async () => {
  console.log('=== TESTING MULTIPLE ENDPOINTS ===');

  const endpoints = [
    { path: '/auth/me', description: 'Current user info' },
    { path: '/users?page=1&limit=5', description: 'Users list' },
    { path: '/auth/refresh', description: 'Token refresh', method: 'POST' },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n🧪 Testing ${endpoint.description} (${endpoint.path})`);

    try {
      const response = endpoint.method === 'POST'
        ? await apiClient.post(endpoint.path)
        : await apiClient.get(endpoint.path);

      console.log(`✅ ${endpoint.description} SUCCESS:`, response);
    } catch (error: any) {
      console.log(`❌ ${endpoint.description} FAILED:`, {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        requestId: error.response?.data?.requestId,
      });
    }
  }

  console.log('\n=== END MULTIPLE ENDPOINTS TEST ===\n');
};

export default { debugJWT, testMultipleEndpoints };