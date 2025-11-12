import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { authService } from '@/services/AuthService';
import { ProtectedRoute, ProtectedElement, useCommonPermissions } from '@/components/auth/ProtectedRoute';
import { AuthErrorHandler, useAuthErrorHandler } from '@/components/auth/AuthErrorHandler';

/**
 * Comprehensive example showing how to use the authentication system
 * This demonstrates all the features implemented according to the API guide
 */
export const AuthenticationUsageExample: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
    error
  } = useAuthStore();

  const { handleError, clearError } = useAuthErrorHandler();
  const { canManageUsers, canManageRoles, isAdmin } = useCommonPermissions();

  // Example of checking authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated && !isLoading) {
        console.log('User not authenticated, should redirect to login');
      }
    };

    checkAuth();
  }, [isAuthenticated, isLoading]);

  const handleLogin = async () => {
    try {
      const success = await login('admin@example.com', 'password');
      if (!success) {
        handleError('Login failed. Please check your credentials.');
      }
    } catch (error) {
      handleError('Network error during login');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      handleError('Error during logout');
    }
  };

  const handleTestApiCall = async () => {
    try {
      // Example of making an authenticated API call
      const users = await authService.makeAuthenticatedRequest('/users?page=1&limit=10');
      Alert.alert('Success', `Fetched ${users.data?.length || 0} users`);
    } catch (error) {
      handleError('Failed to fetch users');
    }
  };

  const handleTestPermissions = () => {
    const permissions = [
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      'roles.read',
      'roles.create',
    ];

    const permissionResults = permissions.map(permission => ({
      permission,
      hasPermission: hasPermission(permission),
    }));

    Alert.alert(
      'Permission Check',
      permissionResults
        .map(p => `${p.permission}: ${p.hasPermission ? '✅' : '❌'}`)
        .join('\n')
    );
  };

  const handleTestRoles = () => {
    const roles = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'OPERATOR'];
    const roleResults = roles.map(role => ({
      role,
      hasRole: hasRole(role),
    }));

    Alert.alert(
      'Role Check',
      roleResults
        .map(r => `${r.role}: ${r.hasRole ? '✅' : '❌'}`)
        .join('\n')
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading authentication...</Text>
      </View>
    );
  }

  return (
    <AuthErrorHandler>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Authentication System Demo</Text>

        {/* Authentication Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication Status</Text>
          <Text style={styles.statusText}>
            Status: {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
          </Text>
          {user && (
            <View style={styles.userInfo}>
              <Text style={styles.userInfoText}>Name: {user.name}</Text>
              <Text style={styles.userInfoText}>Email: {user.email}</Text>
              <Text style={styles.userInfoText}>Roles: {user.roles?.map(r => r.code).join(', ') || 'None'}</Text>
              <Text style={styles.userInfoText}>
                Permissions: {user.permissions?.slice(0, 3).join(', ') || 'None'}
                {user.permissions && user.permissions.length > 3 && '...'}
              </Text>
            </View>
          )}
        </View>

        {/* Authentication Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication Actions</Text>
          <View style={styles.buttonContainer}>
            {!isAuthenticated ? (
              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Login (admin@example.com)</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
                <Text style={styles.buttonText}>Logout</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* API Testing */}
        <ProtectedRoute requiredPermissions={['users.read']}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>API Testing</Text>
            <TouchableOpacity style={styles.button} onPress={handleTestApiCall}>
              <Text style={styles.buttonText}>Test Authenticated API Call</Text>
            </TouchableOpacity>
          </View>
        </ProtectedRoute>

        {/* Permission Testing */}
        <ProtectedRoute>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permission Testing</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={handleTestPermissions}>
                <Text style={styles.buttonText}>Check Permissions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleTestRoles}>
                <Text style={styles.buttonText}>Check Roles</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ProtectedRoute>

        {/* Protected Elements Examples */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Protected Elements Examples</Text>

          <ProtectedElement requiredPermissions={['users.create']}>
            <View style={styles.protectedElement}>
              <Text style={styles.protectedText}>👤 Create User Button (requires users.create)</Text>
            </View>
          </ProtectedElement>

          <ProtectedElement requiredRoles={['SUPERADMIN']}>
            <View style={styles.protectedElement}>
              <Text style={styles.protectedText}>👑 Admin Only Content (requires SUPERADMIN role)</Text>
            </View>
          </ProtectedElement>

          <ProtectedElement requiredPermissions={['users.read']} fallback={<Text style={styles.fallbackText}>🔒 You cannot view users</Text>}>
            <View style={styles.protectedElement}>
              <Text style={styles.protectedText}>📋 User List (requires users.read)</Text>
            </View>
          </ProtectedElement>

          <ProtectedElement requiredPermissions={['nonexistent.permission']} fallback={<Text style={styles.fallbackText}>🚫 This permission doesn't exist</Text>}>
            <View style={styles.protectedElement}>
              <Text style={styles.protectedText}>This should never show</Text>
            </View>
          </ProtectedElement>
        </View>

        {/* Common Permissions Hook */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Permissions Hook</Text>
          <Text style={styles.permissionText}>Can Manage Users: {canManageUsers ? '✅' : '❌'}</Text>
          <Text style={styles.permissionText}>Can Manage Roles: {canManageRoles ? '✅' : '❌'}</Text>
          <Text style={styles.permissionText}>Is Admin: {isAdmin ? '✅' : '❌'}</Text>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.clearButton} onPress={clearError}>
              <Text style={styles.clearButtonText}>Clear Error</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Usage Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage Instructions</Text>
          <Text style={styles.instructionText}>
            1. Click "Login" to authenticate with the API
          </Text>
          <Text style={styles.instructionText}>
            2. Once authenticated, you can test API calls and permissions
          </Text>
          <Text style={styles.instructionText}>
            3. Protected elements will only show if you have the required permissions/roles
          </Text>
          <Text style={styles.instructionText}>
            4. The system automatically handles token refresh and session management
          </Text>
        </View>
      </ScrollView>
    </AuthErrorHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  userInfo: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  userInfoText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  protectedElement: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  protectedText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '500',
  },
  fallbackText: {
    fontSize: 14,
    color: '#DC2626',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  clearButton: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default AuthenticationUsageExample;