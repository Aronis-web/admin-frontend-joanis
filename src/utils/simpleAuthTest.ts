import { apiClient } from '@/services/api/client';

/**
 * Simple test to check if /auth/me endpoint works
 */
export const testAuthMeEndpoint = async () => {
  console.log('=== TESTING /auth/me ENDPOINT ===');

  try {
    const response = await apiClient.get('/auth/me');
    console.log('✅ /auth/me SUCCESS:', response);
    return { success: true, data: response };
  } catch (error: any) {
    console.log('❌ /auth/me FAILED:', error.response?.data || error.message);
    console.log('Status:', error.response?.status);
    return { success: false, error: error.response?.data || error.message };
  }
};

/**
 * Simple test to check if /users endpoint works
 */
export const testUsersEndpoint = async () => {
  console.log('=== TESTING /users ENDPOINT ===');

  try {
    const response = await apiClient.get('/users?page=1&limit=5');
    console.log('✅ /users SUCCESS:', response);
    return { success: true, data: response };
  } catch (error: any) {
    console.log('❌ /users FAILED:', error.response?.data || error.message);
    console.log('Status:', error.response?.status);
    return { success: false, error: error.response?.data || error.message };
  }
};

export default { testAuthMeEndpoint, testUsersEndpoint };