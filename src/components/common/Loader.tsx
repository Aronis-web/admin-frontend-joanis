import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle, Animated, Easing } from 'react-native';
import { Svg, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { SplashScreen } from './SplashScreen';

interface LoaderProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
  variant?: 'spinner' | 'dots' | 'pulse';
}

// Size configurations
const sizeConfig = {
  small: { spinner: 24, strokeWidth: 2, dotSize: 6, fontSize: 12 },
  medium: { spinner: 40, strokeWidth: 2.5, dotSize: 8, fontSize: 14 },
  large: { spinner: 56, strokeWidth: 3, dotSize: 10, fontSize: 16 },
};

// Modern Spinner Component
const ModernSpinner: React.FC<{ size: 'small' | 'medium' | 'large'; color?: string }> = ({
  size,
  color = colors.primary[900]
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const config = sizeConfig[size];
  const radius = (config.spinner - config.strokeWidth * 2) / 2;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Svg width={config.spinner} height={config.spinner} viewBox={`0 0 ${config.spinner} ${config.spinner}`}>
        <Defs>
          <SvgLinearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="60%" stopColor={color} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={config.spinner / 2}
          cy={config.spinner / 2}
          r={radius}
          stroke="url(#loaderGradient)"
          strokeWidth={config.strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
};

// Animated Dots Component
const AnimatedDots: React.FC<{ size: 'small' | 'medium' | 'large'; color?: string }> = ({
  size,
  color = colors.primary[900]
}) => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const scale1 = useRef(new Animated.Value(0.8)).current;
  const scale2 = useRef(new Animated.Value(0.8)).current;
  const scale3 = useRef(new Animated.Value(0.8)).current;
  const config = sizeConfig[size];

  useEffect(() => {
    const createAnimation = (opacityAnim: Animated.Value, scaleAnim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.2,
              duration: 300,
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
          ]),
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
              easing: Easing.in(Easing.ease),
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.8,
              duration: 300,
              useNativeDriver: true,
              easing: Easing.in(Easing.ease),
            }),
          ]),
          Animated.delay(400),
        ])
      );
    };

    createAnimation(dot1, scale1, 0).start();
    createAnimation(dot2, scale2, 200).start();
    createAnimation(dot3, scale3, 400).start();
  }, []);

  const dotStyle = {
    width: config.dotSize,
    height: config.dotSize,
    borderRadius: config.dotSize / 2,
    backgroundColor: color,
    marginHorizontal: config.dotSize / 2,
  };

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[dotStyle, { opacity: dot1, transform: [{ scale: scale1 }] }]} />
      <Animated.View style={[dotStyle, { opacity: dot2, transform: [{ scale: scale2 }] }]} />
      <Animated.View style={[dotStyle, { opacity: dot3, transform: [{ scale: scale3 }] }]} />
    </View>
  );
};

// Pulse Loader Component
const PulseLoader: React.FC<{ size: 'small' | 'medium' | 'large'; color?: string }> = ({
  size,
  color = colors.primary[900]
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const config = sizeConfig[size];
  const baseSize = config.spinner * 0.6;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ])
    ).start();
  }, []);

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <View style={[styles.pulseContainer, { width: config.spinner, height: config.spinner }]}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: baseSize,
            height: baseSize,
            borderRadius: baseSize / 2,
            borderColor: color,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
      <View
        style={[
          styles.pulseCore,
          {
            width: baseSize,
            height: baseSize,
            borderRadius: baseSize / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

export const Loader: React.FC<LoaderProps> = ({
  size = 'large',
  color = colors.primary[900],
  text,
  fullScreen = false,
  style,
  variant = 'spinner',
}) => {
  // Use the modern splash screen for full-screen loading
  if (fullScreen) {
    return <SplashScreen text={text} />;
  }

  const config = sizeConfig[size];

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return <AnimatedDots size={size} color={color} />;
      case 'pulse':
        return <PulseLoader size={size} color={color} />;
      case 'spinner':
      default:
        return <ModernSpinner size={size} color={color} />;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {renderLoader()}
      {text && (
        <Text style={[styles.text, { fontSize: config.fontSize }]}>{text}</Text>
      )}
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
    color: colors.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  pulseCore: {
    opacity: 0.9,
  },
});

export default Loader;
