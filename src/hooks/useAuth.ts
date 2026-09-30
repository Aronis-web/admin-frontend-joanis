import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { authApi, LoginRequest } from '@/services/api/auth';

export const useAuth = () => {
  const { user, token, isAuthenticated, isLoading, error, login, logout, setError } =
    useAuthStore();
  const [actionLoading, setActionLoading] = useState(false);

  const handleLogin = async (credentials: LoginRequest) => {
    try {
      setActionLoading(true);
      setError(null);
      const response = await authApi.login(credentials);

      if (!response.accessToken) {
        throw new Error('No access token received from server');
      }

      const user = response.user;

      // Validate that we have a valid user ID
      if (!user || !user.id) {
        console.error('❌ Invalid user data - user:', user);
        throw new Error('Invalid user data received from server');
      }

      await login(user, response.accessToken);
      return { success: true };
    } catch (err: any) {
      console.error('❌ Login error in useAuth:', err);
      const errorMessage = err.response?.data?.message || 'Login failed. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setActionLoading(true);
      await authApi.logout();
      await logout();
      return { success: true };
    } catch (err: any) {
      // Even if the API call fails, we still log out locally
      await logout();
      return { success: true };
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePassword = async (oldPassword: string, newPassword: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await authApi.changePassword(oldPassword, newPassword);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to change password.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setActionLoading(false);
    }
  };

  // Debug functions removed - authTest and jwtDebug utilities no longer exist
  // const testAuth = async () => {
  //   const { testAuthentication } = await import('@/utils/authTest');
  //   await testAuthentication();
  // };

  // const testAuthMe = async () => {
  //   const { debugJWT, testMultipleEndpoints } = await import('@/utils/jwtDebug');
  //   console.log('🔍 Running comprehensive authentication debugging...\n');
  //   debugJWT();
  //   setTimeout(async () => {
  //     await testMultipleEndpoints();
  //   }, 500);
  // };

  return {
    user,
    token,
    isAuthenticated,
    isLoading: isLoading || actionLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
    changePassword: handleChangePassword,
    // testAuth,
    // testAuthMe,
  };
};

export default useAuth;
