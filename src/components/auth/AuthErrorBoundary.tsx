import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { useAuthStore } from '@/store/auth';

interface AuthErrorBoundaryProps {
  error?: string | null;
  onRetry?: () => void;
}

export const AuthErrorBoundary: React.FC<AuthErrorBoundaryProps> = ({ error, onRetry }) => {
  const { clearInvalidAuth } = useAuthStore();

  const handleClearAndRetry = () => {
    clearInvalidAuth();
    if (onRetry) {
      onRetry();
    }
  };

  if (!error) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.errorBox}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error de Autenticación</Text>
        <Text style={styles.errorMessage}>{error}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.retryButton} onPress={handleClearAndRetry}>
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
    padding: spacing[5],
    backgroundColor: colors.background.secondary,
  },
  errorBox: {
    backgroundColor: colors.neutral[0],
    padding: spacing[6],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 400,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.danger[500],
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.neutral[700],
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 24,
  },
  actions: {
    width: '100%',
    marginBottom: spacing[4],
  },
  retryButton: {
    backgroundColor: colors.danger[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AuthErrorBoundary;
