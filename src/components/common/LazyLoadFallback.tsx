import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '@/design-system/tokens';

interface LazyLoadFallbackProps {
  message?: string;
}

/**
 * Fallback component shown while lazy-loaded screens are loading
 */
export const LazyLoadFallback: React.FC<LazyLoadFallbackProps> = ({
  message = 'Cargando...',
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent[500]} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  text: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[500],
    fontWeight: '500',
  },
});
