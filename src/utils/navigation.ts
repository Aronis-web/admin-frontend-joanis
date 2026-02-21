/**
 * Navigation Utilities
 *
 * Helper functions for navigation-related operations
 */

import Alert from '@/utils/alert';
import { getRouteParams, RouteProp } from '@/types/navigation';

/**
 * Safely extracts and validates route parameters
 * Shows an error alert and returns null if parameters are missing
 *
 * @param route - The route object from navigation
 * @param screenName - The name of the screen (for error messages)
 * @returns The route parameters or null if validation fails
 */
export function validateRouteParams<
  T extends keyof import('@/types/navigation').RootStackParamList,
>(
  route: RouteProp<T>,
  screenName: string
): import('@/types/navigation').RootStackParamList[T] | null {
  try {
    return getRouteParams(route, screenName as T);
  } catch (error) {
    Alert.alert(
      'Error de Navegación',
      `Esta pantalla requiere parámetros que no fueron proporcionados. Por favor, intenta nuevamente.`,
      [{ text: 'OK' }]
    );
    console.error(`Missing parameters for screen ${screenName}:`, error);
    return null;
  }
}

/**
 * Validates a single required parameter
 *
 * @param value - The parameter value to validate
 * @param paramName - The name of the parameter (for error messages)
 * @param screenName - The name of the screen (for error messages)
 * @returns true if valid, false otherwise
 */
export function validateRequiredParam(value: any, paramName: string, screenName: string): boolean {
  if (!value) {
    Alert.alert(
      'Error de Navegación',
      `Falta el parámetro requerido "${paramName}" para la pantalla ${screenName}.`,
      [{ text: 'OK' }]
    );
    console.error(`Missing required parameter "${paramName}" for screen ${screenName}`);
    return false;
  }
  return true;
}

/**
 * Creates a navigation error handler
 *
 * @param screenName - The name of the screen
 * @returns An error handler function
 */
export function createNavigationErrorHandler(screenName: string) {
  return (error: any) => {
    console.error(`Navigation error in ${screenName}:`, error);
    Alert.alert(
      'Error de Navegación',
      'No se pudo completar la navegación. Por favor, intenta nuevamente.',
      [{ text: 'OK' }]
    );
  };
}
