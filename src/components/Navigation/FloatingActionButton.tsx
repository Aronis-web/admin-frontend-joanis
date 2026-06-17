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
    <View style={[styles.wrapper, { bottom }]}>
      <Animated.View style={[styles.reloadContainer, { transform: [{ scale: reloadScaleValue }] }]}>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={handleReloadPress}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={20} color={theme.color.icon.inverse} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.container, { transform: [{ scale: scaleValue }] }]}>
        <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.8}>
          <Ionicons name="menu" size={28} color={theme.color.icon.inverse} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      right: theme.space[5],
      zIndex: 1000,
      flexDirection: 'row',
      alignItems: 'center',
    },
    reloadContainer: {
      marginRight: theme.space[2],
      elevation: 6,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    reloadButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.icon.muted,
      justifyContent: 'center',
      alignItems: 'center',
      opacity: 0.8,
    },
    container: {
      elevation: 8,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
    },
    button: {
      width: 60,
      height: 60,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
