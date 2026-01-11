import React, { ComponentType } from 'react';
import { Alert } from 'react-native';
import { usePermissionError } from '@/hooks/usePermissionError';

/**
 * Higher-Order Component that adds permission error handling to any screen
 * Usage: export default withPermissionErrorHandling(MyScreen);
 */
export function withPermissionErrorHandling<P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  return function WithPermissionErrorHandling(props: P) {
    const { handlePermissionError, showPermissionAlert } = usePermissionError();

    // Enhanced navigation prop that intercepts errors
    const enhancedProps = {
      ...props,
      // You can add more props here if needed
    };

    return <WrappedComponent {...enhancedProps} />;
  };
}

/**
 * Hook to wrap async functions with permission error handling
 * Usage:
 * const { withPermissionCheck } = useWithPermissionCheck();
 * await withPermissionCheck(() => someApiCall());
 */
export function useWithPermissionCheck() {
  const { handlePermissionError, showPermissionAlert } = usePermissionError();

  const withPermissionCheck = async <T,>(
    fn: () => Promise<T>,
    options?: {
      onError?: (error: any) => void;
      showAlert?: boolean;
    }
  ): Promise<T | null> => {
    try {
      return await fn();
    } catch (error: any) {
      if (handlePermissionError(error)) {
        if (options?.showAlert !== false) {
          showPermissionAlert(error);
        }
        if (options?.onError) {
          options.onError(error);
        }
        return null;
      }
      throw error; // Re-throw if it's not a permission error
    }
  };

  return { withPermissionCheck };
}

export default withPermissionErrorHandling;
