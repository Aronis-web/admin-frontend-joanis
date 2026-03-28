import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OperationType, getOperationTypeLabel, getOperationTypeColor } from '@/types/balances';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface BalanceOperationsFABProps {
  onOperationSelect: (operationType: OperationType) => void;
}

interface OperationOption {
  type: OperationType;
  label: string;
  color: string;
  icon: string;
}

export const BalanceOperationsFAB: React.FC<BalanceOperationsFABProps> = ({
  onOperationSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  console.log('🔵 BalanceOperationsFAB rendered');

  // Individual animations for each button
  const button1Anim = useRef(new Animated.Value(0)).current;
  const button2Anim = useRef(new Animated.Value(0)).current;
  const button3Anim = useRef(new Animated.Value(0)).current;
  const button4Anim = useRef(new Animated.Value(0)).current;
  const button5Anim = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const operations: OperationOption[] = [
    {
      type: OperationType.DISTRIBUTED,
      label: 'Monto de Reparto',
      color: getOperationTypeColor(OperationType.DISTRIBUTED),
      icon: '📦',
    },
    {
      type: OperationType.SOLD,
      label: 'Monto Vendido',
      color: getOperationTypeColor(OperationType.SOLD),
      icon: '💰',
    },
    {
      type: OperationType.TO_PAY,
      label: 'Montos Por Pagar',
      color: getOperationTypeColor(OperationType.TO_PAY),
      icon: '⏳',
    },
    {
      type: OperationType.PAID,
      label: 'Registrar Pagos',
      color: getOperationTypeColor(OperationType.PAID),
      icon: '✅',
    },
    {
      type: OperationType.RETURNED,
      label: getOperationTypeLabel(OperationType.RETURNED),
      color: getOperationTypeColor(OperationType.RETURNED),
      icon: '↩️',
    },
  ];

  const toggleMenu = () => {
    console.log('🟡 Toggle menu clicked, isOpen:', isOpen);
    const toValue = isOpen ? 0 : 1;

    Animated.parallel([
      // Rotate main button
      Animated.timing(rotateAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      // Fade in/out overlay
      Animated.timing(opacityAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      // Animate option buttons with stagger
      Animated.stagger(50, [
        Animated.spring(button1Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(button2Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(button3Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(button4Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(button5Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    setIsOpen(!isOpen);
  };

  const handleOperationPress = (operationType: OperationType) => {
    toggleMenu();
    setTimeout(() => {
      onOperationSelect(operationType);
    }, 300);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const buttonAnims = [button1Anim, button2Anim, button3Anim, button4Anim, button5Anim];

  // Calculate positions in a vertical stack (upward)
  const getButtonPosition = (index: number, total: number) => {
    const spacing = isTablet ? 70 : 65; // Vertical spacing between buttons
    const offsetX = isTablet ? -80 : -70; // Move more to the left to avoid going off screen

    // Stack buttons vertically upward from the main FAB
    const position = {
      x: offsetX,
      y: -(spacing * (index + 1)), // Negative Y goes up
    };

    console.log(`🔵 Button ${index} position:`, position);
    return position;
  };

  return (
    <>
      {/* Overlay */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
            }),
          },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={toggleMenu} activeOpacity={1} />
      </Animated.View>

      {/* Container for all buttons */}
      <View
        style={[
          styles.fabContainer,
          {
            bottom: insets.bottom + 90, // Closer to menu FAB
            right: isTablet ? 30 : 20,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Operation Buttons */}
        {operations.map((operation, index) => {
          const position = getButtonPosition(index, operations.length);
          const buttonAnim = buttonAnims[index];

          return (
            <Animated.View
              key={operation.type}
              style={[
                styles.optionButtonContainer,
                {
                  opacity: buttonAnim,
                  transform: [
                    {
                      translateX: buttonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, position.x],
                      }),
                    },
                    {
                      translateY: buttonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, position.y],
                      }),
                    },
                    {
                      scale: buttonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents={isOpen ? 'auto' : 'none'}
            >
              <View style={styles.optionRow}>
                <View style={styles.labelContainer}>
                  <Text style={[styles.optionLabel, isTablet && styles.optionLabelTablet]}>
                    {operation.label}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    isTablet && styles.optionButtonTablet,
                    { backgroundColor: operation.color },
                  ]}
                  onPress={() => handleOperationPress(operation.type)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.optionIcon, isTablet && styles.optionIconTablet]}>
                    {operation.icon}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <Animated.View
          style={[
            styles.mainFabContainer,
            {
              transform: [{ scale: scaleAnim }, { rotate: rotation }],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.mainFab, isTablet && styles.mainFabTablet]}
            onPress={toggleMenu}
            activeOpacity={0.9}
          >
            <Text style={[styles.mainFabIcon, isTablet && styles.mainFabIconTablet]}>+</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.neutral[950],
    zIndex: 10000,
  },
  fabContainer: {
    position: 'absolute',
    zIndex: 10001,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 3,
    borderColor: colors.neutral[0],
  },
  mainFabTablet: {
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowRadius: 16,
    elevation: 10,
  },
  mainFabIcon: {
    fontSize: 28,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  mainFabIconTablet: {
    fontSize: 32,
  },
  optionButtonContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  optionButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.neutral[0],
  },
  optionButtonTablet: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  optionIcon: {
    fontSize: 20,
  },
  optionIconTablet: {
    fontSize: 24,
  },
  labelContainer: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.xl,
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 120,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[800],
    textAlign: 'center',
  },
  optionLabelTablet: {
    fontSize: 13,
  },
});
