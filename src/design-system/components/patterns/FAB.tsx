/**
 * FAB (Floating Action Button) Component
 *
 * Botón de acción flotante.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../primitives/Text';
import { colors } from '../../tokens/colors';
import { spacing, borderRadius, iconSizes, zIndex } from '../../tokens/spacing';
import { shadows } from '../../tokens/shadows';
import { activeOpacity, springConfigs, durations } from '../../tokens/animations';

export type FABSize = 'small' | 'medium' | 'large';
export type FABVariant = 'primary' | 'secondary' | 'surface';

export interface FABProps {
  /**
   * Icono del FAB
   */
  icon: keyof typeof Ionicons.glyphMap;

  /**
   * Callback al presionar
   */
  onPress: () => void;

  /**
   * Etiqueta opcional (extended FAB)
   */
  label?: string;

  /**
   * Tamaño
   */
  size?: FABSize;

  /**
   * Variante de color
   */
  variant?: FABVariant;

  /**
   * Si está deshabilitado
   */
  disabled?: boolean;

  /**
   * Posición
   */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;

  /**
   * TestID
   */
  testID?: string;
}

export const FAB: React.FC<FABProps> = ({
  icon,
  onPress,
  label,
  size = 'medium',
  variant = 'primary',
  disabled = false,
  position = 'bottom-right',
  style,
  testID,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      ...springConfigs.stiff,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      ...springConfigs.bouncy,
    }).start();
  };

  const getSize = (): number => {
    switch (size) {
      case 'small':
        return 40;
      case 'large':
        return 64;
      default:
        return 56;
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return iconSizes.md;
      case 'large':
        return iconSizes['2xl'];
      default:
        return iconSizes.lg;
    }
  };

  const getBackgroundColor = (): string => {
    if (disabled) return colors.neutral[300];
    switch (variant) {
      case 'secondary':
        return colors.accent[600];
      case 'surface':
        return colors.surface.primary;
      default:
        return colors.primary[900];
    }
  };

  const getIconColor = (): string => {
    if (disabled) return colors.text.disabled;
    switch (variant) {
      case 'surface':
        return colors.icon.primary;
      default:
        return colors.icon.inverse;
    }
  };

  const fabSize = getSize();

  const containerStyles = [
    styles.container,
    styles[`position_${position.replace('-', '_')}`],
    style,
  ];

  const fabStyles = [
    styles.fab,
    {
      width: label ? undefined : fabSize,
      height: fabSize,
      borderRadius: label ? borderRadius.xl : fabSize / 2,
      backgroundColor: getBackgroundColor(),
    },
    variant !== 'surface' && shadows['2xl'],
    variant === 'surface' && shadows.lg,
    label && styles.extended,
  ];

  return (
    <View style={containerStyles}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={fabStyles}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={1}
          testID={testID}
        >
          <Ionicons name={icon} size={getIconSize()} color={getIconColor()} />
          {label && (
            <Text
              variant="buttonMedium"
              color={variant === 'surface' ? 'primary' : colors.text.inverse}
              style={styles.label}
            >
              {label}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ============================================
// FAB GROUP (Multiple actions)
// ============================================
export interface FABAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

export interface FABGroupProps {
  /**
   * Icono principal
   */
  icon: keyof typeof Ionicons.glyphMap;

  /**
   * Icono cuando está abierto
   */
  openIcon?: keyof typeof Ionicons.glyphMap;

  /**
   * Acciones disponibles
   */
  actions: FABAction[];

  /**
   * Variante de color
   */
  variant?: FABVariant;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;
}

export const FABGroup: React.FC<FABGroupProps> = ({
  icon,
  openIcon = 'close',
  actions,
  variant = 'primary',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const actionAnimations = useRef(actions.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Rotate main FAB
    Animated.timing(rotateAnim, {
      toValue: isOpen ? 1 : 0,
      duration: durations.fast,
      useNativeDriver: true,
    }).start();

    // Animate actions
    const animations = actions.map((_, index) =>
      Animated.spring(actionAnimations[index], {
        toValue: isOpen ? 1 : 0,
        ...springConfigs.stiff,
        delay: isOpen ? index * 50 : (actions.length - index - 1) * 50,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start();
  }, [isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleActionPress = (action: FABAction) => {
    setIsOpen(false);
    setTimeout(action.onPress, 150);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={[styles.groupContainer, style]}>
      {/* Backdrop */}
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setIsOpen(false)}
          activeOpacity={1}
        />
      )}

      {/* Actions */}
      {actions.map((action, index) => (
        <Animated.View
          key={index}
          style={[
            styles.actionContainer,
            {
              opacity: actionAnimations[index],
              transform: [
                {
                  translateY: actionAnimations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
                {
                  scale: actionAnimations[index],
                },
              ],
            },
          ]}
        >
          <View style={styles.actionLabel}>
            <Text variant="labelMedium" color="primary">
              {action.label}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.actionFab, shadows.md]}
            onPress={() => handleActionPress(action)}
            activeOpacity={activeOpacity.medium}
          >
            <Ionicons name={action.icon} size={iconSizes.md} color={colors.icon.primary} />
          </TouchableOpacity>
        </Animated.View>
      ))}

      {/* Main FAB */}
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <FAB
          icon={isOpen ? openIcon : icon}
          onPress={toggleOpen}
          variant={variant}
          style={styles.mainFab}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: zIndex.fixed,
  },

  position_bottom_right: {
    bottom: spacing[4],
    right: spacing[4],
  },

  position_bottom_left: {
    bottom: spacing[4],
    left: spacing[4],
  },

  position_bottom_center: {
    bottom: spacing[4],
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  extended: {
    paddingHorizontal: spacing[4],
  },

  label: {
    marginLeft: spacing[2],
  },

  // FAB Group styles
  groupContainer: {
    position: 'absolute',
    bottom: spacing[4],
    right: spacing[4],
    alignItems: 'flex-end',
    zIndex: zIndex.fixed,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.light,
  },

  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },

  actionLabel: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.sm,
    marginRight: spacing[3],
    ...shadows.sm,
  },

  actionFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mainFab: {
    // No position since it's relative to group
  },
});

export default FAB;
