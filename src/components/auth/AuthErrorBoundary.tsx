import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/auth';

interface AuthErrorBoundaryProps {
  error?: string | null;
  onRetry?: () => void;
}

export const AuthErrorBoundary: React.FC<AuthErrorBoundaryProps> = ({
  error,
  onRetry
}) => {
  const { clearInvalidAuth } = useAuthStore();

  const handleClearAndRetry = () => {
    clearInvalidAuth();
    if (onRetry) {
      onRetry();
    }
  };

  if (!error) return null;

  return (
    <View style={styles.container}>
      <View style={styles.errorBox}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error de Autenticación</Text>
        <Text style={styles.errorMessage}>{error}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleClearAndRetry}
          >
            <Text style={styles.retryButtonText}>Limpiar Datos y Reintentar</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.helpText}>
          Si el problema persiste, por favor cierra la aplicación y vuelve a iniciar sesión.
        </Text>
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
  errorBox: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 400,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  actions: {
    width: '100%',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AuthErrorBoundary;