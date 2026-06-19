import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  onReload: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, errorInfo, onReset, onReload }) => {
  const styles = useThemedStyles(createStyles);

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
          <TouchableOpacity style={styles.primaryButton} onPress={onReset}>
            <Text style={styles.primaryButtonText}>Intentar de nuevo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onReload}>
            <Text style={styles.secondaryButtonText}>Recargar aplicación</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.helpText}>
          Si el problema persiste, por favor cierra la aplicación y vuelve a abrirla.
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space[5],
    backgroundColor: theme.color.background.subtle,
  },
  errorBox: {
    backgroundColor: theme.color.surface.base,
    padding: theme.space[6],
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 500,
    width: '100%',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: theme.space[4],
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text.danger,
    marginBottom: theme.space[3],
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: theme.color.text.body,
    textAlign: 'center',
    marginBottom: theme.space[5],
    lineHeight: 24,
  },
  errorDetails: {
    width: '100%',
    marginBottom: theme.space[5],
    padding: theme.space[3],
    backgroundColor: theme.color.background.muted,
    borderRadius: theme.radii.lg,
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: theme.space[2],
  },
  errorScroll: {
    maxHeight: 150,
  },
  errorText: {
    fontSize: 12,
    color: theme.color.text.subtle,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actions: {
    width: '100%',
    gap: theme.space[3],
    marginBottom: theme.space[4],
  },
  primaryButton: {
    backgroundColor: theme.color.brand.accent,
    paddingVertical: 14,
    paddingHorizontal: theme.space[6],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: theme.color.text.onAction,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: theme.color.action.secondary.background,
    paddingVertical: 14,
    paddingHorizontal: theme.space[6],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.color.action.secondary.text,
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: theme.color.text.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default GlobalErrorBoundary;
