import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text as RNText,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface ExpenseTemplatesFABProps {
  onCreateTemplate: () => void;
  onDownloadReport: () => void;
  onBulkUpload: () => void;
  onTestGeneration: () => void;
  generatingExpenses?: boolean;
}

interface ActionOption {
  key: string;
  label: string;
  color: string;
  icon: string;
  onPress: () => void;
  loading?: boolean;
}

export const ExpenseTemplatesFAB: React.FC<ExpenseTemplatesFABProps> = ({
  onCreateTemplate,
  onDownloadReport,
  onBulkUpload,
  onTestGeneration,
  generatingExpenses = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Individual animations for each button
  const button1Anim = useRef(new Animated.Value(0)).current;
  const button2Anim = useRef(new Animated.Value(0)).current;
  const button3Anim = useRef(new Animated.Value(0)).current;
  const button4Anim = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const actions: ActionOption[] = [
    {
      key: 'test-generation',
      label: 'Generar Gastos',
      color: colors.warning[500],
      icon: 'play-circle',
      onPress: onTestGeneration,
      loading: generatingExpenses,
    },
    {
      key: 'bulk-upload',
      label: 'Carga Masiva',
      color: colors.success[500],
      icon: 'cloud-upload',
      onPress: onBulkUpload,
    },
    {
      key: 'download',
      label: 'Descargar Reporte',
      color: colors.accent[500],
      icon: 'download',
      onPress: onDownloadReport,
    },
    {
      key: 'create',
      label: 'Crear Plantilla',
      color: colors.danger[600],
      icon: 'add',
      onPress: onCreateTemplate,
    },
  ];

  const toggleMenu = () => {
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
      ]),
    ]).start();

    setIsOpen(!isOpen);
  };

  const handleActionPress = (action: ActionOption) => {
    toggleMenu();
    setTimeout(() => {
      action.onPress();
    }, 300);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const buttonAnims = [button1Anim, button2Anim, button3Anim, button4Anim];

  // Calculate positions in a vertical stack (upward)
  const getButtonPosition = (index: number) => {
    const spacing = isTablet ? 70 : 65;
    const offsetX = isTablet ? -80 : -70;

    return {
      x: offsetX,
      y: -(spacing * (index + 1)),
    };
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
            bottom: insets.bottom + 90,
            right: isTablet ? 30 : 20,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Action Buttons */}
        {actions.map((action, index) => {
          const position = getButtonPosition(index);
          const buttonAnim = buttonAnims[index];

          return (
            <Animated.View
              key={action.key}
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
                  <RNText style={[styles.optionLabel, isTablet && styles.optionLabelTablet]}>
                    {action.label}
                  </RNText>
                </View>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    isTablet && styles.optionButtonTablet,
                    { backgroundColor: action.color },
                  ]}
                  onPress={() => handleActionPress(action)}
                  activeOpacity={0.9}
                  disabled={action.loading}
                >
                  <Ionicons
                    name={action.icon as any}
                    size={isTablet ? 24 : 20}
                    color={colors.neutral[0]}
                  />
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
              transform: [{ rotate: rotation }],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.mainFab, isTablet && styles.mainFabTablet]}
            onPress={toggleMenu}
            activeOpacity={0.9}
          >
            <RNText style={[styles.mainFabIcon, isTablet && styles.mainFabIconTablet]}>🔄</RNText>
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
    borderRadius: 28,
    backgroundColor: colors.danger[600],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.danger[600],
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
  labelContainer: {
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
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
