import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedFABProps {
  icon: string;
  label?: string;
  onPress: () => void;
  style?: ViewStyle;
  iconStyle?: TextStyle;
  labelStyle?: TextStyle;
  bottom?: number; // Offset desde el bottom (default: 90px para estar sobre el menú)

  // Permission props
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  hideIfNoPermission?: boolean;
  fallback?: React.ReactNode;
}

/**
 * ProtectedFAB - Floating Action Button con verificación automática de permisos
 *
 * @example
 * ```tsx
 * import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
 * import { PERMISSIONS } from '@/constants/permissions';
 *
 * // FAB simple
 * <ProtectedFAB
 *   icon="+"
 *   onPress={handleCreate}
 *   requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
 *   hideIfNoPermission={true}
 * />
 *
 * // FAB con label
 * <ProtectedFAB
 *   icon="📝"
 *   label="Crear Gasto"
 *   onPress={handleCreateExpense}
 *   requiredPermissions={[PERMISSIONS.EXPENSES.CREATE]}
 *   hideIfNoPermission={true}
 * />
 * ```
 */
export const ProtectedFAB: React.FC<ProtectedFABProps> = ({
  icon,
  label,
  onPress,
  style,
  iconStyle,
  labelStyle,
  bottom = 90,
  requiredPermissions = [],
  requiredRoles = [],
  requireAll = false,
  hideIfNoPermission = true,
  fallback = null,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // Si no hay permisos requeridos, mostrar el FAB normalmente
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    return (
      <TouchableOpacity
        style={[
          styles.fabContainer,
          {
            bottom: insets.bottom + bottom,
          },
          style,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <TouchableOpacity
          style={[styles.fab, isTablet && styles.fabTablet]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.fabIcon, isTablet && styles.fabIconTablet, iconStyle]}>
            {icon}
          </Text>
        </TouchableOpacity>
        {label && (
          <Text style={[styles.fabLabel, isTablet && styles.fabLabelTablet, labelStyle]}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
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
  const hasAccess = hasPermissionAccess;

  // Si no tiene acceso
  if (!hasAccess) {
    // Ocultar el FAB
    if (hideIfNoPermission) {
      return fallback ? <>{fallback}</> : null;
    }

    // Mostrar el FAB deshabilitado
    return (
      <TouchableOpacity
        style={[
          styles.fabContainer,
          {
            bottom: insets.bottom + bottom,
            opacity: 0.5,
          },
          style,
        ]}
        disabled={true}
        activeOpacity={0.8}
      >
        <TouchableOpacity
          style={[styles.fab, isTablet && styles.fabTablet]}
          disabled={true}
          activeOpacity={0.8}
        >
          <Text style={[styles.fabIcon, isTablet && styles.fabIconTablet, iconStyle]}>
            {icon}
          </Text>
        </TouchableOpacity>
        {label && (
          <Text style={[styles.fabLabel, isTablet && styles.fabLabelTablet, labelStyle]}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // Tiene acceso, mostrar el FAB normalmente
  return (
    <TouchableOpacity
      style={[
        styles.fabContainer,
        {
          bottom: insets.bottom + bottom,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <TouchableOpacity
        style={[styles.fab, isTablet && styles.fabTablet]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.fabIcon, isTablet && styles.fabIconTablet, iconStyle]}>
          {icon}
        </Text>
      </TouchableOpacity>
      {label && (
        <Text style={[styles.fabLabel, isTablet && styles.fabLabelTablet, labelStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
    zIndex: 9998, // Just below the menu FAB (9999)
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  fabTablet: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  fabIconTablet: {
    fontSize: 32,
  },
  fabLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  fabLabelTablet: {
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});

export default ProtectedFAB;
