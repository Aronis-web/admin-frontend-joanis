import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { NavigationProp } from '@/types/navigation';

interface ScreenLayoutProps {
  children: React.ReactNode;
  navigation: NavigationProp;
  showBottomNav?: boolean; // Deprecated - kept for backward compatibility
}

/**
 * ScreenLayout Component
 *
 * Simple layout wrapper for screens with global SafeArea handling.
 * Navigation is now handled by the universal FloatingActionButton
 * which is integrated at the app level.
 *
 * IMPORTANTE: Este componente ahora incluye padding superior automático
 * para Android APK compilado, resolviendo el problema de botones muy arriba.
 */
export const ScreenLayout: React.FC<ScreenLayoutProps> = ({ children }) => {
  // En Android APK, agregar padding adicional para el StatusBar
  const androidStatusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  return (
    <View style={styles.container}>
      {Platform.OS === 'android' && <View style={{ height: androidStatusBarHeight }} />}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
