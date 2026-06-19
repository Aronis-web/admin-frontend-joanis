import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Animated,
  Easing,
  View,
  Modal,
  Pressable,
  Text,
  Platform,
  NativeModules,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles, useTheme } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useFloatingActionBottomOffset } from '@/design-system/layout/FloatingFooterProvider';
import { useUIStore, type RegisteredFabAction } from '@/store/ui';

const handleReloadApp = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.location.reload();
  } else {
    const { DevSettings } = NativeModules;
    if (DevSettings?.reload) DevSettings.reload();
  }
};

/**
 * GlobalFab - FAB unico global. Renderiza el "+" rojo. Al abrir despliega:
 *   - acciones registradas por la pantalla focusada (via ProtectedFAB)
 *   - "Recargar" (siempre)
 *   - "Abrir menu" (siempre, abre el drawer)
 */
export const GlobalFab: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const bottom = useFloatingActionBottomOffset('module', insets.bottom);

  const registered = useUIStore((s) => s.fabActions);
  const openDrawer = useUIStore((s) => s.openDrawer);

  const allActions = useMemo<RegisteredFabAction[]>(
    () => [
      ...registered,
      { icon: 'refresh', label: 'Recargar', onPress: handleReloadApp },
      { icon: 'menu', label: 'Abrir men\u00fa', onPress: openDrawer },
    ],
    [registered, openDrawer]
  );

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

  const handleAction = (action: RegisteredFabAction) => {
    setOpen(false);
    setTimeout(() => action.onPress(), 50);
  };

  const renderStack = (interactive: boolean) => (
    <View style={[styles.menuContainer, { bottom }]} pointerEvents="box-none">
      {open &&
        allActions.map((action, idx) => {
          const translateY = itemsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
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
    menuContainer: { position: 'absolute', right: theme.space[5], alignItems: 'flex-end', zIndex: 9998 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
    mainFab: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: theme.color.action.danger.background,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: theme.color.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 5, elevation: 8,
    },
    actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.space[3] },
    actionLabelPill: {
      backgroundColor: theme.color.surface.inverse,
      paddingHorizontal: theme.space[3], paddingVertical: theme.space[2],
      borderRadius: theme.radii.md, marginRight: theme.space[2],
      shadowColor: theme.color.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18, shadowRadius: 3, elevation: 3,
    },
    actionLabelText: { color: theme.color.text.inverse, fontSize: 13, fontWeight: '600' },
    actionMiniFab: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: theme.color.action.danger.background,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: theme.color.shadow, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
    },
  });

export default GlobalFab;
