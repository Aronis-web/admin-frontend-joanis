import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  View,
  Platform,
  NativeModules,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useFloatingActionBottomOffset } from '@/design-system/layout/FloatingFooterProvider';

interface FloatingActionButtonProps {
  onPress: () => void;
}

/**
 * Función para recargar la aplicación
 */
const handleReload = () => {
  if (Platform.OS === 'web') {
    window.location.reload();
  } else {
    const { DevSettings } = NativeModules;
    if (DevSettings?.reload) {
      DevSettings.reload();
    }
  }
};

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onPress }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const bottom = useFloatingActionBottomOffset('menu', insets.bottom);

  const scaleValue = React.useRef(new Animated.Value(1)).current;
  const reloadScaleValue = React.useRef(new Animated.Value(1)).current;

  const animatePress = (ref: Animated.Value) => {
    Animated.sequence([
      Animated.timing(ref, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(ref, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = () => {
    animatePress(scaleValue);
    onPress();
  };

  const handleReloadPress = () => {
    animatePress(reloadScaleValue);
    handleReload();
  };

  return (
    <View style={[styles.wrapper, { bottom }]} pointerEvents="box-none">
      <Animated.View style={[styles.pill, { transform: [{ scale: scaleValue }] }]}>
        <TouchableOpacity
          style={styles.segment}
          onPress={handleReloadPress}
          activeOpacity={0.7}
          accessibilityLabel="Recargar"
        >
          <Animated.View style={{ transform: [{ scale: reloadScaleValue }] }}>
            <Ionicons name="refresh" size={18} color={theme.color.icon.muted} />
          </Animated.View>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.segment}
          onPress={handlePress}
          activeOpacity={0.7}
          accessibilityLabel="Abrir menu"
        >
          <Ionicons name="menu" size={22} color={theme.color.brand.accent} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      right: theme.space[4],
      zIndex: 1000,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.elevated,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      elevation: 4,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
    },
    segment: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    divider: {
      width: 1,
      height: 20,
      backgroundColor: theme.color.border.subtle,
    },
  });
