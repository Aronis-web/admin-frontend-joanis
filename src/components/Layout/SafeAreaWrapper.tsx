import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  style?: any;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
}

/**
 * SafeAreaWrapper - Componente global para manejar SafeArea de forma consistente
 *
 * Este componente asegura que el SafeArea funcione correctamente tanto en Expo Go
 * como en el APK compilado, agregando padding adicional en Android cuando es necesario.
 */
export const SafeAreaWrapper: React.FC<SafeAreaWrapperProps> = ({
  children,
  style,
  edges = ['top', 'bottom'],
}) => {
  // En Android, agregar padding adicional para el StatusBar
  const androidStatusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {Platform.OS === 'android' && edges.includes('top') && (
        <View style={{ height: androidStatusBarHeight }} />
      )}
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
