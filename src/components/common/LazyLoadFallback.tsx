import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, spacing } from '@/design-system/tokens';

interface LazyLoadFallbackProps {
  message?: string;
  /**
   * Cuando se pasa, el fallback deja de mostrar el spinner y pasa a modo error:
   * muestra un mensaje y un botón "Reintentar". Es clave en móvil/PWA, donde el
   * usuario no puede recargar la página manualmente si un chunk queda colgado.
   */
  onRetry?: () => void;
  /** Fuerza el modo error aunque no haya `onRetry`. */
  isError?: boolean;
}

/**
 * Fallback component shown while lazy-loaded screens are loading (or when the
 * chunk fails to load and we offer a manual retry).
 */
export const LazyLoadFallback: React.FC<LazyLoadFallbackProps> = ({
  message = 'Cargando...',
  onRetry,
  isError = false,
}) => {
  const showError = isError || !!onRetry;

  if (showError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>No se pudo cargar la pantalla</Text>
        <Text style={styles.text}>
          Revisa tu conexión. Si el problema persiste, reintenta para actualizar la app.
        </Text>
        {onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent[500]} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[6],
  },
  text: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[500],
    fontWeight: '500',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: spacing[2],
  },
  errorTitle: {
    fontSize: 18,
    color: colors.neutral[700],
    fontWeight: '700',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing[5],
    backgroundColor: colors.accent[500],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
