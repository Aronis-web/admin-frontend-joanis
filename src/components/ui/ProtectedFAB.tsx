import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
  Easing,
  View,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissions } from '@/hooks/usePermissions';
import { useThemedStyles, useTheme } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useFloatingActionBottomOffset } from '@/design-system/layout/FloatingFooterProvider';

export interface FABAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
}

interface ProtectedFABProps {
  // Nueva API recomendada: menu expandible
  actions?: FABAction[];

  // API legacy (un solo bot\u00f3n directo) - mantenida por back-compat
  icon?: string;
  label?: string;
  onPress?: () => void;
  iconStyle?: TextStyle;
  labelStyle?: TextStyle;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean;
  hideIfNoPermission?: boolean;
  fallback?: React.ReactNode;

  style?: ViewStyle;
  bottom?: number;
}

/**
 * ProtectedFAB - Floating Action Button con permisos.
 *
 * Modo recomendado: pasar `actions=[...]`. Renderiza un boton "+" rojo que
 * al tocarse despliega verticalmente las acciones disponibles (filtradas
 * por permisos), cada una con label-pill + mini-FAB.
 *
 * @example
 * <ProtectedFAB
 *   actions={[
 *     { icon: 'cart-outline', label: 'Crear Compra', onPress: handleCreate,
 *       requiredPermissions: [PERMISSIONS.PURCHASES.CREATE] },
 *   ]}
 * />
 */
export const ProtectedFAB: React.FC<ProtectedFABProps> = ({
  actions,
  icon,
  label,
  onPress,
  iconStyle,
  labelStyle,
  bottom,
  requiredPermissions = [],
  requiredRoles: _requiredRoles = [],
  requireAll = false,
  hideIfNoPermission = true,
  fallback = null,
  style,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { hasAnyPermission, hasAllPermissions } = usePermissions();
  const autoBottom = useFloatingActionBottomOffset('module', insets.bottom);
  const fabBottom = bottom !== undefined ? insets.bottom + bottom : autoBottom;

  const checkAccess = (perms?: string[], all?: boolean): boolean => {
    if (!perms || perms.length === 0) return true;
    return all ? hasAllPermissions(perms) : hasAnyPermission(perms);
  };

  const visibleActions = useMemo<FABAction[]>(() => {
    if (!actions) return [];
    return actions.filter((a) => checkAccess(a.requiredPermissions, a.requireAll));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, hasAnyPermission, hasAllPermissions]);

  // ===== Modo MENU (nueva API) =====
  if (actions && actions.length > 0) {
    if (visibleActions.length === 0) {
      return hideIfNoPermission ? (fallback ? <>{fallback}</> : null) : null;
    }
    return (
      <FabMenu
        actions={visibleActions}
        bottom={fabBottom}
        styles={styles}
        theme={theme}
        style={style}
      />
    );
  }

  // ===== Modo LEGACY (icon/onPress directo) =====
  const legacyAccess = checkAccess(requiredPermissions, requireAll);
  if (!legacyAccess) {
    if (hideIfNoPermission) return fallback ? <>{fallback}</> : null;
  }
  if (!icon || !onPress) return null;

  return (
    <TouchableOpacity
      style={[styles.legacyContainer, { bottom: fabBottom }, !legacyAccess && { opacity: 0.5 }, style]}
      onPress={legacyAccess ? onPress : undefined}
      disabled={!legacyAccess}
      activeOpacity={0.8}
    >
      <View style={styles.legacyFab}>
        <Text style={[styles.legacyIcon, iconStyle]}>{icon}</Text>
      </View>
      {label && <Text style={[styles.legacyLabel, labelStyle]}>{label}</Text>}
    </TouchableOpacity>
  );
};

// ============================================
// Componente interno: menu expandible
// ============================================
interface FabMenuProps {
  actions: FABAction[];
  bottom: number;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  style?: ViewStyle;
}

const FabMenu: React.FC<FabMenuProps> = ({ actions, bottom, styles, theme, style }) => {
  const [open, setOpen] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const itemsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotation, {
        toValue: open ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(itemsAnim, {
        toValue: open ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, rotation, itemsAnim]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] });

  const handleAction = (action: FABAction) => {
    setOpen(false);
    setTimeout(() => action.onPress(), 50);
  };

  const renderStack = (interactive: boolean) => (
    <View style={[styles.menuContainer, { bottom }, style]} pointerEvents="box-none">
      {open &&
        actions.map((action, idx) => {
          const translateY = itemsAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          });
          return (
            <Animated.View
              key={`${action.label}-${idx}`}
              style={[styles.actionRow, { opacity: itemsAnim, transform: [{ translateY }] }]}
              pointerEvents={interactive ? 'auto' : 'none'}
            >
              <Pressable onPress={() => handleAction(action)} style={styles.actionLabelPill}>
                <Text style={styles.actionLabelText}>{action.label}</Text>
              </Pressable>
              <Pressable onPress={() => handleAction(action)} style={styles.actionMiniFab}>
                <Ionicons name={action.icon} size={20} color={theme.color.action.danger.text} />
              </Pressable>
            </Animated.View>
          );
        })}

      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.mainFab}
        accessibilityLabel={open ? 'Cerrar menu de acciones' : 'Abrir menu de acciones'}
        pointerEvents={interactive ? 'auto' : 'none'}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="add" size={28} color={theme.color.action.danger.text} />
        </Animated.View>
      </Pressable>
    </View>
  );

  return (
    <>
      {!open && renderStack(true)}
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {renderStack(true)}
        </Pressable>
      </Modal>
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // ----- Menu mode -----
    menuContainer: {
      position: 'absolute',
      right: theme.space[5],
      alignItems: 'flex-end',
      zIndex: 9998,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    mainFab: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.color.action.danger.background,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 8,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    actionLabelPill: {
      backgroundColor: theme.color.surface.inverse,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      marginRight: theme.space[2],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 3,
      elevation: 3,
    },
    actionLabelText: {
      color: theme.color.text.inverse,
      fontSize: 13,
      fontWeight: '600',
    },
    actionMiniFab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.color.action.danger.background,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
    },
    // ----- Legacy mode -----
    legacyContainer: {
      position: 'absolute',
      right: theme.space[5],
      alignItems: 'center',
      zIndex: 9998,
    },
    legacyFab: {
      width: 56,
      height: 56,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.action.primary.background,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
    },
    legacyIcon: {
      fontSize: 28,
      color: theme.color.action.primary.text,
    },
    legacyLabel: {
      marginTop: theme.space[2],
      fontSize: 12,
      color: theme.color.text.heading,
      fontWeight: '600',
      backgroundColor: theme.color.surface.elevated,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.xl,
    },
  });

export default ProtectedFAB;
