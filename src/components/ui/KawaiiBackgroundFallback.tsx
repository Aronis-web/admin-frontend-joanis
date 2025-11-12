import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient as LinearGradientView } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { theme } from '@/theme';

const { width, height } = Dimensions.get('window');

interface KawaiiBackgroundProps {
  variant: 'turquoise' | 'lilac';
}

export const KawaiiBackgroundFallback: React.FC<KawaiiBackgroundProps> = ({
  variant
}) => {
  const colors = variant === 'turquoise'
    ? {
        gradientFrom: theme.colors.bgTurquoiseSoftFrom,
        gradientTo: theme.colors.bgTurquoiseSoftTo,
        primary: theme.colors.bgTurquoise,
        secondary: theme.colors.blue,
      }
    : {
        gradientFrom: theme.colors.bgLilacSoftFrom,
        gradientTo: theme.colors.bgLilacSoftTo,
        primary: theme.colors.bgLilac,
        secondary: theme.colors.pink,
      };

  return (
    <View style={styles.container}>
      <LinearGradientView
        style={styles.gradient}
        colors={[colors.gradientFrom, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Simple animated circles as fallback for SVG elements */}
      <MotiView
        style={styles.floatingElement1}
        from={{ translateY: -4 }}
        animate={{ translateY: 4 }}
        transition={{
          type: 'timing',
          duration: 3500,
          ease: 'ease-in-out',
          loop: true,
        }}
      >
        <View style={[styles.circle, { backgroundColor: colors.primary, opacity: 0.6 }]} />
      </MotiView>

      <MotiView
        style={styles.floatingElement2}
        from={{ translateY: 4 }}
        animate={{ translateY: -4 }}
        transition={{
          type: 'timing',
          duration: 3500,
          ease: 'ease-in-out',
          loop: true,
          repeatReverse: true,
        }}
      >
        <View style={[styles.circle, { backgroundColor: colors.secondary, opacity: 0.5 }]} />
      </MotiView>

      <MotiView
        style={styles.floatingElement3}
        from={{ translateY: 3 }}
        animate={{ translateY: -3 }}
        transition={{
          type: 'timing',
          duration: 3500,
          ease: 'ease-in-out',
          loop: true,
          delay: 500,
        }}
      >
        <View style={[styles.smallCircle, { backgroundColor: theme.colors.white, opacity: 0.7 }]} />
      </MotiView>

      <MotiView
        style={styles.floatingElement4}
        from={{ translateY: -2 }}
        animate={{ translateY: 2 }}
        transition={{
          type: 'timing',
          duration: 3500,
          ease: 'ease-in-out',
          loop: true,
          delay: 1000,
        }}
      >
        <View style={[styles.star, { backgroundColor: theme.colors.yellow, opacity: 0.8 }]} />
      </MotiView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    flex: 1,
  },
  floatingElement1: {
    position: 'absolute',
    top: height * 0.1,
    left: width * 0.15,
  },
  floatingElement2: {
    position: 'absolute',
    top: height * 0.08,
    right: width * 0.15,
  },
  floatingElement3: {
    position: 'absolute',
    top: height * 0.25,
    left: width * 0.1,
  },
  floatingElement4: {
    position: 'absolute',
    top: height * 0.4,
    left: width * 0.05,
  },
  circle: {
    width: 60,
    height: 30,
    borderRadius: 30,
  },
  smallCircle: {
    width: 20,
    height: 10,
    borderRadius: 10,
  },
  star: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});