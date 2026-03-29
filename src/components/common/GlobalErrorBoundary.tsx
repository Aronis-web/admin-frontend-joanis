import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console
    console.error('❌ Global Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // You can also log the error to an error reporting service here
    // For example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    // Reload the app
    this.handleReset();
    // In React Native, you might want to use Updates.reloadAsync() from expo-updates
    // or simply reset the app state
    console.log('🔄 Reloading app...');
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;

      return (
        <View style={styles.container}>
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>💥</Text>
            <Text style={styles.errorTitle}>Algo salió mal</Text>
            <Text style={styles.errorMessage}>
              La aplicación encontró un error inesperado. Por favor intenta nuevamente.
            </Text>

            {error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>Error:</Text>
                <ScrollView style={styles.errorScroll}>
                  <Text style={styles.errorText}>{error.toString()}</Text>
                  {errorInfo && <Text style={styles.errorText}>{errorInfo.componentStack}</Text>}
                </ScrollView>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryButton} onPress={this.handleReset}>
                <Text style={styles.primaryButtonText}>Intentar de nuevo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={this.handleReload}>
                <Text style={styles.secondaryButtonText}>Recargar aplicación</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.helpText}>
              Si el problema persiste, por favor cierra la aplicación y vuelve a abrirla.
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

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
    maxWidth: 500,
    width: '100%',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.danger[500],
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.neutral[700],
    textAlign: 'center',
    marginBottom: spacing[5],
    lineHeight: 24,
  },
  errorDetails: {
    width: '100%',
    marginBottom: spacing[5],
    padding: spacing[3],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[2],
  },
  errorScroll: {
    maxHeight: 150,
  },
  errorText: {
    fontSize: 12,
    color: colors.neutral[400],
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actions: {
    width: '100%',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  primaryButton: {
    backgroundColor: colors.accent[500],
    paddingVertical: 14,
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.neutral[200],
    paddingVertical: 14,
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.neutral[700],
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

export default GlobalErrorBoundary;
