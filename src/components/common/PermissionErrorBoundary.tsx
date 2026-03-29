import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PermissionDenied } from './PermissionDenied';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isPermissionError: boolean;
}

export class PermissionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isPermissionError: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a permission-related error
    const isPermissionError =
      error.message.includes('403') ||
      error.message.includes('Forbidden') ||
      error.message.includes('permisos') ||
      error.message.includes('permissions') ||
      error.message.includes('permission');

    return {
      hasError: true,
      error,
      isPermissionError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PermissionErrorBoundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      isPermissionError: false,
    });
  };

  render() {
    if (this.state.hasError) {
      // If it's a permission error, show the PermissionDenied component
      if (this.state.isPermissionError) {
        return (
          <PermissionDenied
            message={this.state.error?.message || 'No tienes los permisos necesarios.'}
            onGoBack={this.handleReset}
          />
        );
      }

      // For other errors, show the fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.container}>
            <Ionicons name="alert-circle" size={80} color={colors.danger[500]} />
            <Text style={styles.title}>Algo salió mal</Text>
            <Text style={styles.message}>
              {this.state.error?.message || 'Ha ocurrido un error inesperado.'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
    backgroundColor: colors.background.secondary,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[800],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  message: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  button: {
    backgroundColor: colors.accent[500],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  buttonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PermissionErrorBoundary;
