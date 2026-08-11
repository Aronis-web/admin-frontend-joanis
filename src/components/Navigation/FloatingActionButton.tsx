import React from 'react';
import { TouchableOpacity, StyleSheet, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useFloatingActionBottomOffset } from '@/design-system/layout/FloatingFooterProvider';
import { reloadCurrentScreen } from '@/utils/reload';

interface FloatingActionButtonProps {
  onPress: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onPress }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const bottom = useFloatingActionBottomOffset('menu', insets.bottom);

  const scaleValue = React.useRef(new Animated.Value(1)).current;
  const reloadScaleValue = React.useRef(new Animated.Value(1)).current;
  const reloadSpin = React.useRef(new Animated.Value(0)).current;
  const [reloading, setReloading] = React.useState(false);

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

  const handleReloadPress = async () => {
    if (reloading) return;
    animatePress(reloadScaleValue);
    setReloading(true);
    // Giro visual del icono mientras refresca
    reloadSpin.setValue(0);
    const spinAnim = Animated.loop(
      Animated.timing(reloadSpin, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    );
    spinAnim.start();
    try {
      await reloadCurrentScreen();
    } finally {
      spinAnim.stop();
      reloadSpin.setValue(0);
      setReloading(false);
    }
  };

  const spin = reloadSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.wrapper, { bottom }]} pointerEvents="box-none">
      <Animated.View style={[styles.reloadWrap, { transform: [{ scale: reloadScaleValue }] }]}>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={handleReloadPress}
          activeOpacity={0.7}
          accessibilityLabel="Recargar pantalla"
          disabled={reloading}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="refresh" size={18} color={theme.color.icon.muted} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.menuWrap, { transform: [{ scale: scaleValue }] }]}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={handlePress}
          activeOpacity={0.85}
          accessibilityLabel="Abrir menu"
        >
          <Ionicons name="menu" size={26} color={theme.color.action.primary.text} />
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
      flexDirection: 'row',
      alignItems: 'center',
    },
    reloadWrap: {
      marginRight: theme.space[2],
      elevation: 3,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    reloadButton: {
      width: 44,
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuWrap: {
      elevation: 8,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    menuButton: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
