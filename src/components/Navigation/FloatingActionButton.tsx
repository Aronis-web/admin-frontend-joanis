import React from 'react';
import { TouchableOpacity, StyleSheet, Animated, View, Platform, NativeModules } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { Ionicons } from '@expo/vector-icons';

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
  const scaleValue = React.useRef(new Animated.Value(1)).current;
  const reloadScaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  const handleReloadPress = () => {
    Animated.sequence([
      Animated.timing(reloadScaleValue, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(reloadScaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    handleReload();
  };

  return (
    <View style={styles.wrapper}>
      {/* Botón de recarga (arriba del menú) */}
      <Animated.View
        style={[
          styles.reloadContainer,
          {
            transform: [{ scale: reloadScaleValue }],
          },
        ]}
      >
        <TouchableOpacity style={styles.reloadButton} onPress={handleReloadPress} activeOpacity={0.8}>
          <Ionicons name="refresh" size={20} color={colors.neutral[0]} />
        </TouchableOpacity>
      </Animated.View>

      {/* Botón del menú */}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ scale: scaleValue }],
          },
        ]}
      >
        <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.8}>
          <Ionicons name="menu" size={28} color={colors.neutral[0]} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: spacing[5],
    right: spacing[5],
    zIndex: 1000,
    alignItems: 'center',
  },
  reloadContainer: {
    marginBottom: spacing[2],
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  reloadButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[600],
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  container: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
