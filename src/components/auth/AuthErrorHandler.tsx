import React, { useEffect } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import { useAuthStore } from '@/store/auth';
import { AuthError } from '@/types/auth';

interface AuthErrorHandlerProps {
  children: React.ReactNode;
  onError?: (error: AuthError) => void;
  fallback?: React.ReactNode;
}

export const AuthErrorHandler: React.FC<AuthErrorHandlerProps> = ({
  children,
  onError,
  fallback,
}) => {
  const { error, setError, logout } = useAuthStore();

  useEffect(() => {
    if (error) {
      // Call custom error handler if provided
      if (onError) {
        const authError: AuthError = {
          code: 'SERVER_ERROR',
          message: error,
        };
        onError(authError);
      }

      // Auto-clear error after 5 seconds
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error, onError, setError]);

  const handleRetry = () => {
    setError(null);
  };

  const handleLogout = () => {
    Alert.alert('Sesión Expirada', 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Iniciar Sesión',
        onPress: () => logout(),
      },
    ]);
  };

  if (error) {
    // Check if it's a session expired error
    const isSessionExpired =
      error.toLowerCase().includes('expir') ||
      error.toLowerCase().includes('token') ||
      error.toLowerCase().includes('unauthorized');

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Error de Autenticación</Text>
          <Text style={styles.errorMessage}>{error}</Text>

          <View style={styles.buttonContainer}>
            {isSessionExpired ? (
              <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
                <Text style={styles.buttonText}>Iniciar Sesión</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={[styles.button, styles.retryButton]} onPress={handleRetry}>
                  <Text style={styles.buttonText}>Reintentar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setError(null)}
                >
                  <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

// Hook for handling authentication errors globally
export const useAuthErrorHandler = () => {
  const { error, setError } = useAuthStore();

  const handleError = (error: AuthError | string) => {
    if (typeof error === 'string') {
      setError(error);
    } else {
      setError(error.message);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const handleNetworkError = () => {
    setError('Error de conexión. Verifica tu conexión a internet e intenta nuevamente.');
  };

  const handleUnauthorizedError = () => {
    setError('No tienes permisos para realizar esta acción.');
  };

  const handleForbiddenError = () => {
    setError('Acceso denegado. No tienes los permisos necesarios.');
  };

  const handleTokenExpiredError = () => {
    setError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
  };

  const handleInvalidCredentialsError = () => {
    setError('Credenciales inválidas. Verifica tu correo y contraseña.');
  };

  const handleServerError = () => {
    setError('Error del servidor. Por favor intenta más tarde.');
  };

  return {
    error,
    handleError,
    clearError,
    handleNetworkError,
    handleUnauthorizedError,
    handleForbiddenError,
    handleTokenExpiredError,
    handleInvalidCredentialsError,
    handleServerError,
  };
};

// Component for displaying auth error messages
interface AuthErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
  type?: 'card' | 'banner' | 'inline';
}

export const AuthErrorDisplay: React.FC<AuthErrorDisplayProps> = ({
  error,
  onDismiss,
  type = 'card',
}) => {
  if (!error) {
    return null;
  }

  const isSessionExpired =
    error.toLowerCase().includes('expir') ||
    error.toLowerCase().includes('token') ||
    error.toLowerCase().includes('unauthorized');

  if (type === 'banner') {
    return (
      <View style={[styles.container, styles.bannerContainer]}>
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>⚠️</Text>
          <Text style={styles.bannerText}>{error}</Text>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.bannerClose}>
              <Text style={styles.bannerCloseText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (type === 'inline') {
    return (
      <View style={styles.inlineContainer}>
        <Text style={styles.inlineIcon}>⚠️</Text>
        <Text style={styles.inlineText}>{error}</Text>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.inlineClose}>
            <Text style={styles.inlineCloseText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.errorCard}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <Text style={styles.dismissButtonText}>Entendido</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 320,
    width: '100%',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#3B82F6',
  },
  logoutButton: {
    backgroundColor: '#DC2626',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#6B7280',
  },
  dismissButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Banner styles
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  bannerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '500',
  },
  bannerClose: {
    padding: 4,
  },
  bannerCloseText: {
    fontSize: 16,
    color: '#991B1B',
    fontWeight: '600',
  },
  // Inline styles
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginVertical: 4,
  },
  inlineIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  inlineText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '500',
  },
  inlineClose: {
    padding: 2,
  },
  inlineCloseText: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
  },
});

export default AuthErrorHandler;
