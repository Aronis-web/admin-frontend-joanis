import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Rect, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { colors, spacing } from '@/design-system/tokens';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  text?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ text = 'Iniciando aplicación...' }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Dots animation loop
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim1, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim2, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim3, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(dotAnim1, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(dotAnim2, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(dotAnim3, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    };

    animateDots();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1f35', '#2d3548', '#1a1f35']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Subtle background pattern */}
      <View style={styles.patternContainer}>
        <View style={styles.gridLine1} />
        <View style={styles.gridLine2} />
        <View style={styles.gridLine3} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Main icon */}
        <View style={styles.iconContainer}>
          <Svg width={180} height={180} viewBox="0 0 1024 1024">
            <Defs>
              <SvgLinearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                <Stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
              </SvgLinearGradient>
              <SvgLinearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
                <Stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
              </SvgLinearGradient>
            </Defs>

            {/* Modern minimalist icon */}
            <Rect x="212" y="212" width="600" height="600" rx="60" fill="#ffffff" opacity="0.05" />

            {/* Chart bars with gradient */}
            <Rect x="320" y="450" width="70" height="200" rx="8" fill="url(#grad1)" />
            <Rect x="410" y="400" width="70" height="250" rx="8" fill="url(#grad2)" />
            <Rect x="500" y="420" width="70" height="230" rx="8" fill="url(#grad1)" />
            <Rect x="590" y="370" width="70" height="280" rx="8" fill="url(#grad2)" />

            {/* Data points */}
            <Circle cx="355" cy="440" r="10" fill="#60a5fa" />
            <Circle cx="445" cy="390" r="10" fill="#60a5fa" />
            <Circle cx="535" cy="410" r="10" fill="#60a5fa" />
            <Circle cx="625" cy="360" r="10" fill="#60a5fa" />

            {/* Connecting line */}
            <Path
              d="M355 440 L445 390 L535 410 L625 360"
              stroke="#60a5fa"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
              fill="none"
            />

            {/* Top accent bar */}
            <Rect x="280" y="280" width="464" height="60" rx="30" fill="url(#grad1)" opacity="0.15" />
            <Circle cx="320" cy="310" r="8" fill="#60a5fa" opacity="0.8" />
            <Circle cx="360" cy="310" r="8" fill="#60a5fa" opacity="0.6" />
            <Circle cx="400" cy="310" r="8" fill="#60a5fa" opacity="0.4" />
          </Svg>
        </View>

        {/* App name */}
        <View style={styles.appNameContainer}>
          <Text style={styles.appName}>ERP</Text>
          <View style={styles.divider} />
          <Text style={styles.appNameHighlight}>AIO</Text>
        </View>

        {/* Loading dots */}
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, { opacity: dotAnim1 }]} />
          <Animated.View style={[styles.dot, { opacity: dotAnim2 }]} />
          <Animated.View style={[styles.dot, { opacity: dotAnim3 }]} />
        </View>

        {/* Loading text */}
        <Text style={styles.text}>{text}</Text>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Sistema de Gestión Administrativa</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[900],
  },
  patternContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
  },
  gridLine1: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: colors.neutral[0],
    left: '25%',
  },
  gridLine2: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: colors.neutral[0],
    left: '50%',
  },
  gridLine3: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: colors.neutral[0],
    left: '75%',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: spacing[12],
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  appNameContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  appName: {
    fontSize: 28,
    color: colors.neutral[0],
    fontFamily: 'Baloo2_700Bold',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: colors.primary[500],
    marginVertical: spacing[2],
    borderRadius: 2,
  },
  appNameHighlight: {
    fontSize: 24,
    color: colors.primary[400],
    fontFamily: 'Baloo2_600SemiBold',
    letterSpacing: 6,
    textTransform: 'uppercase',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing[5],
    height: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[400],
  },
  text: {
    fontSize: 14,
    color: colors.neutral[400],
    textAlign: 'center',
    fontFamily: 'Baloo2_400Regular',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.neutral[500],
    fontFamily: 'Baloo2_400Regular',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

export default SplashScreen;
