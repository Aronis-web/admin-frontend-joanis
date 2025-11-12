import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient as LinearGradientView } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { theme } from '@/theme';

const { width, height } = Dimensions.get('window');

interface KawaiiBackgroundProps {
  variant: 'turquoise' | 'lilac';
}

export const KawaiiBackgroundNoSvg: React.FC<KawaiiBackgroundProps> = ({
  variant
}) => {
  const colors = variant === 'turquoise'
    ? {
        gradientFrom: '#FF00FF', // Magenta neón intenso (arriba)
        gradientTo: '#00FFFF',   // Cian neón intenso (abajo)
        primary: '#FF00FF',     // Magenta neón intenso
        secondary: '#00FFFF',   // Cian neón intenso
      }
    : {
        gradientFrom: '#00FFFF', // Cian neón intenso (arriba)
        gradientTo: '#FF00FF',   // Magenta neón intenso (abajo)
        primary: '#00FFFF',      // Cian neón intenso
        secondary: '#FF00FF',    // Magenta neón intenso
      };

  return (
    <View style={styles.container}>
      <LinearGradientView
        style={styles.gradient}
        colors={[colors.gradientFrom, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Kawaii Sun */}
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{ duration: 20000, loop: true, type: 'timing' }}
        style={[styles.sun, { position: 'absolute', top: 45, right: 25 }]}
      >
        <View style={[styles.sunCore, { backgroundColor: '#FFE5B4' }]} />
        <View style={[styles.sunRay, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.sunRay, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.sunRay, { transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.sunRay, { transform: [{ rotate: '135deg' }] }]} />
      </MotiView>

      {/* Left Rainbow with Cloud */}
      <MotiView
        style={styles.svgContainer}
        from={{ translateY: -4 }}
        animate={{ translateY: 4 }}
        transition={{
          type: 'timing',
          duration: 3500,
          ease: 'ease-in-out',
          loop: true,
        }}
      >
        {/* Rainbow arcs using View with borderRadius */}
        <View style={[styles.rainbowContainer, { position: 'absolute', top: height * 0.12, left: width * 0.15 }]}>
          <View style={[styles.rainbowArc, {
            width: 120,
            height: 60,
            borderColor: colors.primary,
            borderWidth: 3,
            opacity: 0.6
          }]} />
          <View style={[styles.rainbowArc, {
            width: 90,
            height: 45,
            borderColor: colors.secondary,
            borderWidth: 3,
            opacity: 0.5,
            position: 'absolute',
            top: 7.5,
            left: 15
          }]} />
          <View style={[styles.rainbowArc, {
            width: 60,
            height: 30,
            borderColor: colors.primary,
            borderWidth: 3,
            opacity: 0.4,
            position: 'absolute',
            top: 15,
            left: 30
          }]} />
        </View>

        {/* Cloud using circles */}
        <View style={[styles.cloudContainer, { position: 'absolute', top: height * 0.17, left: width * 0.22 }]}>
          <View style={[styles.cloudPart, { width: 30, height: 16, backgroundColor: theme.colors.white, opacity: 0.8 }]} />
          <View style={[styles.cloudPart, {
            width: 20,
            height: 12,
            backgroundColor: theme.colors.white,
            opacity: 0.8,
            position: 'absolute',
            top: 2,
            left: -5
          }]} />
          <View style={[styles.cloudPart, {
            width: 20,
            height: 12,
            backgroundColor: theme.colors.white,
            opacity: 0.8,
            position: 'absolute',
            top: 2,
            right: -5
          }]} />
        </View>
      </MotiView>

      {/* Right Rainbow with Cloud */}
      <MotiView
        style={styles.svgContainer}
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
        {/* Rainbow arcs */}
        <View style={[styles.rainbowContainer, { position: 'absolute', top: height * 0.08, right: width * 0.15 }]}>
          <View style={[styles.rainbowArc, {
            width: 110,
            height: 56,
            borderColor: colors.secondary,
            borderWidth: 3,
            opacity: 0.6
          }]} />
          <View style={[styles.rainbowArc, {
            width: 80,
            height: 40,
            borderColor: colors.primary,
            borderWidth: 3,
            opacity: 0.5,
            position: 'absolute',
            top: 8,
            left: 15
          }]} />
          <View style={[styles.rainbowArc, {
            width: 50,
            height: 24,
            borderColor: colors.secondary,
            borderWidth: 3,
            opacity: 0.4,
            position: 'absolute',
            top: 16,
            left: 30
          }]} />
        </View>

        {/* Cloud */}
        <View style={[styles.cloudContainer, { position: 'absolute', top: height * 0.13, right: width * 0.22 }]}>
          <View style={[styles.cloudPart, { width: 24, height: 12, backgroundColor: theme.colors.white, opacity: 0.8 }]} />
          <View style={[styles.cloudPart, {
            width: 16,
            height: 10,
            backgroundColor: theme.colors.white,
            opacity: 0.8,
            position: 'absolute',
            top: 1,
            left: -4
          }]} />
          <View style={[styles.cloudPart, {
            width: 16,
            height: 10,
            backgroundColor: theme.colors.white,
            opacity: 0.8,
            position: 'absolute',
            top: 1,
            right: -4
          }]} />
        </View>
      </MotiView>

      {/* Floating clouds */}
      <MotiView
        style={styles.svgContainer}
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
        {/* Left cloud - TRIPLE TAMAÑO */}
        <View style={[styles.cloudContainer, { position: 'absolute', top: height * 0.23, left: width * 0.12 }]}>
          <View style={[styles.cloudPart, { width: 150, height: 75, backgroundColor: theme.colors.white, opacity: 0.9 }]} />
          <View style={[styles.cloudPart, {
            width: 90,
            height: 45,
            backgroundColor: theme.colors.white,
            opacity: 0.9,
            position: 'absolute',
            top: 15,
            left: -30
          }]} />
          <View style={[styles.cloudPart, {
            width: 90,
            height: 45,
            backgroundColor: theme.colors.white,
            opacity: 0.9,
            position: 'absolute',
            top: 15,
            right: -30
          }]} />
        </View>

        {/* Right cloud - TRIPLE TAMAÑO */}
        <View style={[styles.cloudContainer, { position: 'absolute', top: height * 0.28, right: width * 0.12 }]}>
          <View style={[styles.cloudPart, { width: 135, height: 66, backgroundColor: theme.colors.white, opacity: 0.85 }]} />
          <View style={[styles.cloudPart, {
            width: 75,
            height: 36,
            backgroundColor: theme.colors.white,
            opacity: 0.85,
            position: 'absolute',
            top: 15,
            left: -24
          }]} />
          <View style={[styles.cloudPart, {
            width: 75,
            height: 36,
            backgroundColor: theme.colors.white,
            opacity: 0.85,
            position: 'absolute',
            top: 15,
            right: -24
          }]} />
        </View>
      </MotiView>

      {/* Stars */}
      <MotiView
        style={styles.svgContainer}
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
        <View style={[styles.star, { position: 'absolute', top: height * 0.38, left: width * 0.08 }]} />
        <View style={[styles.star, {
          position: 'absolute',
          top: height * 0.33,
          right: width * 0.08,
          width: 10,
          height: 10
        }]} />
        <View style={[styles.star, {
          position: 'absolute',
          top: height * 0.48,
          left: width * 0.28,
          width: 8,
          height: 8
        }]} />
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
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sun: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunCore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    position: 'absolute',
  },
  sunRay: {
    width: 70,
    height: 4,
    backgroundColor: '#FFD700',
    position: 'absolute',
    opacity: 0.6,
  },
  rainbowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rainbowArc: {
    borderRadius: 60,
    borderBottomWidth: 0,
  },
  cloudContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudPart: {
    borderRadius: 20,
  },
  star: {
    width: 12,
    height: 12,
    backgroundColor: theme.colors.yellow,
    borderRadius: 6,
    opacity: 0.8,
  },
});

export default KawaiiBackgroundNoSvg;