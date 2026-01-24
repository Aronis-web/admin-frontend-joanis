import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationProp } from '@/types/navigation';

interface ScreenLayoutProps {
  children: React.ReactNode;
  navigation: NavigationProp;
  showBottomNav?: boolean; // Deprecated - kept for backward compatibility
}

/**
 * ScreenLayout Component
 *
 * Simple layout wrapper for screens.
 * Navigation is now handled by the universal FloatingActionButton
 * which is integrated at the app level.
 */
export const ScreenLayout: React.FC<ScreenLayoutProps> = ({ children }) => {
  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
