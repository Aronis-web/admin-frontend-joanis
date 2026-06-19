import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AddButtonProps {
  onPress: () => void;
  icon?: string;
  label?: string;
}

export const AddButton: React.FC<AddButtonProps> = ({ onPress, icon = '+', label }) => {
  const styles = useThemedStyles(createStyles);
  const [scaleAnim] = useState(new Animated.Value(1));
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <Animated.View
      style={[
        styles.fabContainer,
        {
          bottom: insets.bottom + 90, // 90px above the menu FAB (60px FAB + 20px margin + 10px gap)
          right: isTablet ? 30 : 20,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.fab, isTablet && styles.fabTablet]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <Text style={[styles.fabIcon, isTablet && styles.fabIconTablet]}>{icon}</Text>
      </TouchableOpacity>
      {label && <Text style={[styles.fabLabel, isTablet && styles.fabLabelTablet]}>{label}</Text>}
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    fabContainer: {
      position: 'absolute',
      zIndex: 9998,
      alignItems: 'center',
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.color.action.success.background,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.color.action.success.background,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
      borderWidth: 3,
      borderColor: theme.color.surface.base,
    },
    fabTablet: {
      width: 64,
      height: 64,
      borderRadius: 32,
      shadowRadius: 16,
      elevation: 10,
    },
    fabIcon: {
      fontSize: 28,
      color: theme.color.action.success.text,
      fontWeight: '700',
    },
    fabIconTablet: {
      fontSize: 32,
    },
    fabLabel: {
      marginTop: theme.space[1.5],
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.muted,
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.lg,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    fabLabelTablet: {
      fontSize: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
  });
