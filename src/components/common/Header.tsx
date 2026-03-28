import React from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Design System
import {
  colors,
  spacing,
  shadows,
} from '@/design-system/tokens';
import {
  Title,
  Caption,
} from '@/design-system/components';

interface HeaderProps {
  title: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  subtitle?: string;
  transparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  leftIcon,
  rightIcon,
  onLeftPress,
  onRightPress,
  subtitle,
  transparent = false,
}) => {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.primary} />
      <SafeAreaView style={[styles.safeArea, transparent && styles.transparent]}>
        <View style={styles.container}>
          <View style={styles.leftContainer}>
            {leftIcon && onLeftPress ? (
              <TouchableOpacity onPress={onLeftPress} style={styles.iconButton}>
                {leftIcon}
              </TouchableOpacity>
            ) : (
              <View style={styles.iconPlaceholder} />
            )}
          </View>

          <View style={styles.centerContainer}>
            <Title size="medium" numberOfLines={1}>{title}</Title>
            {subtitle && (
              <Caption color="secondary" numberOfLines={1} style={styles.subtitle}>
                {subtitle}
              </Caption>
            )}
          </View>

          <View style={styles.rightContainer}>
            {rightIcon && onRightPress ? (
              <TouchableOpacity onPress={onRightPress} style={styles.iconButton}>
                {rightIcon}
              </TouchableOpacity>
            ) : (
              <View style={styles.iconPlaceholder} />
            )}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface.primary,
    ...shadows.xs,
  },
  transparent: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    elevation: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 56,
  },
  leftContainer: {
    width: 40,
    alignItems: 'flex-start',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  rightContainer: {
    width: 40,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: spacing[1],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: {
    width: 40,
  },
  subtitle: {
    marginTop: 2,
  },
});

export default Header;
