import React from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Design System
import {
  Title,
  Caption,
} from '@/design-system/components';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <StatusBar
        barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.color.surface.base}
      />
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

const createStyles = (theme: Theme) => StyleSheet.create({
  safeArea: {
    backgroundColor: theme.color.surface.base,
    ...theme.shadow.xs,
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
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
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
    paddingHorizontal: theme.space[2],
  },
  rightContainer: {
    width: 40,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: theme.space[1],
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
