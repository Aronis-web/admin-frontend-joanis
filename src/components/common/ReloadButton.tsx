/**
 * ReloadButton Component
 *
 * Botón disimulado para recargar la aplicación.
 * Puede usarse en cualquier header personalizado.
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, Platform, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

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

export const ReloadButton: React.FC<ReloadButtonProps> = ({
  color = colors.neutral[0],
  size = 20,
  opacity = 0.6,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, { opacity }]}
      onPress={handleReload}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="refresh" size={size} color={color} />
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
