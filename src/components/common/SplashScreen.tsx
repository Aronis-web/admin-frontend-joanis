import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Svg, Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface SplashScreenProps {
  text?: string;
}

// Animated SVG Circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export const SplashScreen: React.FC<SplashScreenProps> = ({ text = 'Iniciando aplicación...' }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();

    // Rotation animation for spinner
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();

    // Pulse animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();

    // Progress animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Subtle gradient background */}
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientOverlay} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Logo with pulse animation */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.logoInner}>
            <Text style={styles.logoText}>ERP</Text>
            <View style={styles.logoDivider} />
            <Text style={styles.logoSubtext}>AIO</Text>
          </View>
        </Animated.View>

        {/* Modern spinner */}
        <View style={styles.spinnerContainer}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Svg width={56} height={56} viewBox="0 0 56 56">
              <Defs>
                <SvgLinearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={theme.color.brand.primary} stopOpacity="1" />
                  <Stop offset="50%" stopColor={theme.color.text.muted} stopOpacity="0.5" />
                  <Stop offset="100%" stopColor={theme.color.brand.primary} stopOpacity="0" />
                </SvgLinearGradient>
              </Defs>
              <Circle
                cx="28"
                cy="28"
                r="24"
                stroke="url(#spinnerGradient)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
          {/* Center dot */}
          <View style={styles.spinnerDot} />
        </View>

        {/* Loading text */}
        <Text style={styles.loadingText}>{text}</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Sistema de Gestión Administrativa</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.background.canvas,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.background.subtle,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.background.canvas,
    opacity: 0.97,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: theme.space[10],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    backgroundColor: theme.color.brand.primary,
    width: 120,
    height: 120,
    borderRadius: theme.radii['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.color.brand.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  logoText: {
    fontSize: 28,
    color: theme.color.text.onAction,
    fontWeight: '700',
    letterSpacing: 3,
  },
  logoDivider: {
    width: 40,
    height: 2,
    backgroundColor: theme.color.text.onAction,
    opacity: 0.3,
    marginVertical: theme.space[1],
    borderRadius: 1,
  },
  logoSubtext: {
    fontSize: 18,
    color: theme.color.border.default,
    fontWeight: '600',
    letterSpacing: 4,
  },
  spinnerContainer: {
    marginBottom: theme.space[6],
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
  },
  spinnerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.brand.primary,
  },
  loadingText: {
    fontSize: 14,
    color: theme.color.text.muted,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: theme.space[4],
  },
  progressContainer: {
    width: 180,
    height: 3,
    backgroundColor: theme.color.border.subtle,
    borderRadius: theme.radii.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.color.brand.primary,
    borderRadius: theme.radii.full,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: theme.color.text.subtle,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default SplashScreen;
