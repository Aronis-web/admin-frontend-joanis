/**
 * ReloadButton Component
 *
 * Botón disimulado para recargar la aplicación.
 * Puede usarse en cualquier header personalizado.
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { reloadCurrentScreen } from '@/utils/reload';

interface ReloadButtonProps {
  /**
   * Color del icono (por defecto blanco para headers con gradiente)
   */
  color?: string;
  /**
   * Tamaño del icono
   */
  size?: number;
  /**
   * Opacidad del botón (por defecto 0.6 para ser discreto)
   */
  opacity?: number;
}

export const ReloadButton: React.FC<ReloadButtonProps> = ({
  color = colors.neutral[0],
  size = 20,
  opacity = 0.6,
}) => {
  const [busy, setBusy] = React.useState(false);
  const spin = React.useRef(new Animated.Value(0)).current;

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    spin.setValue(0);
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, useNativeDriver: true })
    );
    anim.start();
    try {
      await reloadCurrentScreen();
    } finally {
      anim.stop();
      spin.setValue(0);
      setBusy(false);
    }
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <TouchableOpacity
      style={[styles.button, { opacity }]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={busy}
      accessibilityLabel="Recargar pantalla"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name="refresh" size={size} color={color} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: spacing[2],
    marginLeft: spacing[2],
  },
});

export default ReloadButton;
