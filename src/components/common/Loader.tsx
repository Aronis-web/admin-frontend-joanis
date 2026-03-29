import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '@/design-system/tokens';
import { SplashScreen } from './SplashScreen';

interface LoaderProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'large',
  color = colors.primary[500],
  text,
  fullScreen = false,
  style,
}) => {
  // Use the modern splash screen for full-screen loading
  if (fullScreen) {
    return <SplashScreen text={text} />;
  }

  const containerStyle = styles.container;

  return (
    <View style={[containerStyle, style]}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});

export default Loader;
