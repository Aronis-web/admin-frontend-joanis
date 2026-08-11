/**
 * DriveBottomBar
 *
 * Barra inferior siempre visible del módulo Drive con 4 destinos.
 * Se registra en el FloatingFooterProvider para que los FABs (menú + reload
 * global y el FAB "+" del módulo) se posicionen por encima automáticamente.
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { Text } from '@/design-system/components';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useMeasuredFloatingFooter } from '@/design-system/layout/FloatingFooterProvider';

export type DriveBottomTab = 'my-unit' | 'spaces' | 'shared-with-me' | 'trash';

export interface DriveBottomBarProps {
  active: DriveBottomTab;
  onSelect: (tab: DriveBottomTab) => void;
}

interface TabDef {
  id: DriveBottomTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabDef[] = [
  { id: 'my-unit', label: 'Mi unidad', icon: 'cloud-outline', iconActive: 'cloud' },
  { id: 'spaces', label: 'Espacios', icon: 'people-outline', iconActive: 'people' },
  {
    id: 'shared-with-me',
    label: 'Compartido',
    icon: 'share-social-outline',
    iconActive: 'share-social',
  },
  { id: 'trash', label: 'Papelera', icon: 'trash-outline', iconActive: 'trash' },
];

export const DriveBottomBar: React.FC<DriveBottomBarProps> = ({ active, onSelect }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { onLayout } = useMeasuredFloatingFooter(72);

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}
      onLayout={onLayout}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const color = isActive ? theme.color.brand.primary : theme.color.icon.muted;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onSelect(tab.id)}
            activeOpacity={activeOpacity.medium}
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={iconSizes.md}
              color={color}
            />
            <Text variant="caption" style={[styles.label, { color }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: theme.color.surface.base,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.subtle,
      paddingTop: theme.space[2],
      paddingHorizontal: theme.space[1],
      zIndex: 900,
      ...theme.shadow.md,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[1],
      gap: 2,
    },
    label: {
      marginTop: 2,
      fontSize: 11,
    },
  });

export default DriveBottomBar;
