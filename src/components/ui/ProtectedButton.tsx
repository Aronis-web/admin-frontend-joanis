import React from 'react';
import { ViewStyle, TextStyle } from 'react-native';
import { Button } from './Button';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;

  // Permission props
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  hideIfNoPermission?: boolean;
  fallback?: React.ReactNode;
}

/**
 * ProtectedButton - Botón con verificación automática de permisos
 *
 * @example
 * ```tsx
 * import { ProtectedButton } from '@/components/ui/ProtectedButton';
 * import { PERMISSIONS } from '@/constants/permissions';
 *
 * <ProtectedButton
 *   title="Crear Producto"
 *   onPress={handleCreate}
 *   requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
 *   hideIfNoPermission={true}
 * />
 * ```
 */
export const ProtectedButton: React.FC<ProtectedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  hideIfNoPermission = true,
  fallback = null,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // Si no hay permisos requeridos, mostrar el botón normalmente
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return (
      <Button
        title={title}
        onPress={onPress}
        variant={variant}
        size={size}
        disabled={disabled}
        loading={loading}
        fullWidth={fullWidth}
        style={style}
        textStyle={textStyle}
      />
    );
  }

  // Verificar permisos
  let hasPermissionAccess = true;
  if (requiredPermissions.length > 0) {
    hasPermissionAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
  }

  // TODO: Implementar verificación de roles cuando esté disponible
  // Por ahora, solo verificamos permisos
  const hasAccess = hasPermissionAccess;

  // Si no tiene acceso
  if (!hasAccess) {
    // Ocultar el botón
    if (hideIfNoPermission) {
      return fallback ? <>{fallback}</> : null;
    }

    // Mostrar el botón deshabilitado
    return (
      <Button
        title={title}
        onPress={onPress}
        variant={variant}
        size={size}
        disabled={true}
        loading={loading}
        fullWidth={fullWidth}
        style={style}
        textStyle={textStyle}
      />
    );
  }

  // Tiene acceso, mostrar el botón normalmente
  return (
    <Button
      title={title}
      onPress={onPress}
      variant={variant}
      size={size}
      disabled={disabled}
      loading={loading}
      fullWidth={fullWidth}
      style={style}
      textStyle={textStyle}
    />
  );
};

export default ProtectedButton;
