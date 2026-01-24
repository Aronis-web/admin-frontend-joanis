import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

interface PermissionError {
  isPermissionError: boolean;
  permissionMessage: string;
  requiredPermissions: string[];
}

export const usePermissionError = () => {
  const [permissionError, setPermissionError] = useState<PermissionError | null>(null);

  const handlePermissionError = useCallback((error: any) => {
    // Check if it's a permission error (either from our enhanced error or from 403 status)
    const isPermissionError =
      error.isPermissionError ||
      error.response?.status === 403 ||
      error.message?.includes('permisos') ||
      error.message?.includes('permissions');

    if (isPermissionError) {
      const permissionData: PermissionError = {
        isPermissionError: true,
        permissionMessage:
          error.permissionMessage ||
          error.response?.data?.message ||
          error.message ||
          'No tienes los permisos necesarios para realizar esta acción.',
        requiredPermissions: error.requiredPermissions || [],
      };

      setPermissionError(permissionData);
      return true;
    }

    return false;
  }, []);

  const clearPermissionError = useCallback(() => {
    setPermissionError(null);
  }, []);

  const showPermissionAlert = useCallback(
    (error?: any) => {
      const errorToHandle = error || permissionError;

      if (!errorToHandle) {
        return;
      }

      const message = errorToHandle.permissionMessage || errorToHandle.message;
      const permissions = errorToHandle.requiredPermissions || [];

      let alertMessage = message;

      if (permissions.length > 0) {
        alertMessage +=
          '\n\nPermisos requeridos:\n' + permissions.map((p: string) => `• ${p}`).join('\n');
      }

      Alert.alert(
        'Acceso Denegado',
        alertMessage,
        [
          {
            text: 'Entendido',
            style: 'default',
          },
        ],
        { cancelable: true }
      );
    },
    [permissionError]
  );

  return {
    permissionError,
    handlePermissionError,
    clearPermissionError,
    showPermissionAlert,
    hasPermissionError: !!permissionError,
  };
};

export default usePermissionError;
