import React, { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePermissions } from '@/hooks/usePermissions';
import { useUIStore, type RegisteredFabAction } from '@/store/ui';

export interface FABAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
}

interface ProtectedFABProps {
  actions: FABAction[];
}

/**
 * ProtectedFAB - registra acciones de pantalla en el FAB global.
 *
 * Componente sin UI propia: al recibir foco, filtra `actions` por permisos
 * y las publica en `useUIStore.fabActions` para que `<GlobalFab />` las
 * renderice junto con las acciones built-in (Recargar, Abrir menu).
 *
 * @example
 * <ProtectedFAB
 *   actions={[
 *     { icon: 'cart-outline', label: 'Crear Compra', onPress: handleCreate,
 *       requiredPermissions: [PERMISSIONS.PURCHASES.CREATE] },
 *   ]}
 * />
 */
export const ProtectedFAB: React.FC<ProtectedFABProps> = ({ actions }) => {
  const setFabActions = useUIStore((s) => s.setFabActions);
  const clearFabActions = useUIStore((s) => s.clearFabActions);
  const { hasAnyPermission, hasAllPermissions } = usePermissions();

  const visibleActions = useMemo<RegisteredFabAction[]>(() => {
    return actions
      .filter((a) => {
        if (!a.requiredPermissions || a.requiredPermissions.length === 0) return true;
        return a.requireAll
          ? hasAllPermissions(a.requiredPermissions)
          : hasAnyPermission(a.requiredPermissions);
      })
      .map(({ icon, label, onPress }) => ({ icon, label, onPress }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, hasAnyPermission, hasAllPermissions]);

  useFocusEffect(
    useCallback(() => {
      setFabActions(visibleActions);
      return () => clearFabActions();
    }, [visibleActions, setFabActions, clearFabActions])
  );

  return null;
};

export default ProtectedFAB;
