import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface TaxDocumentsFABProps {
  onOpenSalesReport: () => void;
}

interface ActionOption {
  key: string;
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  requiredPermissions: string[];
  onPress: () => void;
}

export const TaxDocumentsFAB: React.FC<TaxDocumentsFABProps> = ({ onOpenSalesReport }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const reportButtonAnim = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { hasAnyPermission } = usePermissions();

  const actions = useMemo<ActionOption[]>(() => {
    const configuredActions: ActionOption[] = [
      {
        key: 'sales-report',
        label: 'Reporte de Ventas',
        color: colors.accent[500],
        icon: 'download-outline',
        requiredPermissions: ['bizlinks.documents.view', 'sales.read'],
        onPress: onOpenSalesReport,
      },
    ];

    return configuredActions.filter((action) => hasAnyPermission(action.requiredPermissions));
  }, [hasAnyPermission, onOpenSalesReport]);

  if (actions.length === 0) {
    return null;
  }

  const toggleMenu = () => {
    if (isAnimating) {
      return;
    }

    const willOpen = !isOpen;
    const toValue = willOpen ? 1 : 0;

    setIsAnimating(true);
    setIsOpen(willOpen);

    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(reportButtonAnim, {
        toValue,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
    });
  };

  const closeMenu = (onClosed?: () => void) => {
    if (isAnimating) {
      return;
    }

    setIsAnimating(true);

    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(reportButtonAnim, {
        toValue: 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsOpen(false);
      setIsAnimating(false);
      onClosed?.();
    });
  };

  const handleActionPress = (action: ActionOption) => {
    if (isAnimating || !isOpen) {
      return;
    }

    closeMenu(action.onPress);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const getButtonPosition = () => {
    return {
      x: isTablet ? -88 : -76,
      y: -(isTablet ? 72 : 66),
    };
  };

  return (
    <>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.45],
            }),
          },
        ]}
        pointerEvents={isOpen && !isAnimating ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => closeMenu()} activeOpacity={1} />
      </Animated.View>

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
        {actions.map((action) => {
          const position = getButtonPosition();

          return (
            <Animated.View
              key={action.key}
              style={[
                styles.optionButtonContainer,
                {
                  opacity: reportButtonAnim,
                  transform: [
                    {
                      translateX: reportButtonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, position.x],
                      }),
                    },
                    {
                      translateY: reportButtonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, position.y],
                      }),
                    },
                    {
                      scale: reportButtonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents={isOpen && !isAnimating ? 'auto' : 'none'}
            >
              <View style={styles.optionRow}>
                <View style={styles.labelContainer}>
                  <Text style={[styles.optionLabel, isTablet && styles.optionLabelTablet]}>
                    {action.label}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    isTablet && styles.optionButtonTablet,
                    { backgroundColor: action.color },
                  ]}
                  onPress={() => handleActionPress(action)}
                  activeOpacity={0.9}
                  disabled={isAnimating}
                >
                  <Ionicons name={action.icon} size={isTablet ? 24 : 20} color={colors.neutral[0]} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}

        <Animated.View style={[styles.mainFabContainer, { transform: [{ rotate: rotation }] }]}>
          <TouchableOpacity
            style={[styles.mainFab, isTablet && styles.mainFabTablet]}
            onPress={toggleMenu}
            activeOpacity={0.9}
            disabled={isAnimating}
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
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 3,
    borderColor: colors.neutral[0],
  },
  mainFabTablet: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    minWidth: 128,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[800],
    textAlign: 'center',
  },
  optionLabelTablet: {
    fontSize: 14,
  },
});

export default TaxDocumentsFAB;
