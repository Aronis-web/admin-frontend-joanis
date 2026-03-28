import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/design-system/tokens';

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0-100
  total?: number;
  validated?: number;
  showLabel?: boolean;
  color?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  size = 80,
  strokeWidth = 8,
  progress,
  total,
  validated,
  showLabel = true,
  color,
  backgroundColor = colors.border.default,
  textColor,
  fontSize = 16,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressOffset = circumference - (progress / 100) * circumference;

  // Determinar color y gradiente basado en el progreso
  const getProgressColors = () => {
    if (color) {
      return { color, gradient: null, textColor: textColor || colors.neutral[800] };
    }
    if (progress === 100) {
      return {
        color: 'url(#gradient-green)',
        gradient: { start: colors.success[500], end: colors.success[600] },
        textColor: textColor || colors.success[600]
      }; // Verde brillante
    }
    if (progress >= 75) {
      return {
        color: 'url(#gradient-blue)',
        gradient: { start: colors.primary[500], end: colors.primary[600] },
        textColor: textColor || colors.primary[600]
      }; // Azul vibrante
    }
    if (progress >= 50) {
      return {
        color: 'url(#gradient-yellow)',
        gradient: { start: colors.warning[400], end: colors.warning[500] },
        textColor: textColor || colors.warning[600]
      }; // Amarillo/Naranja
    }
    if (progress >= 25) {
      return {
        color: 'url(#gradient-orange)',
        gradient: { start: colors.warning[400], end: colors.warning[500] },
        textColor: textColor || colors.warning[600]
      }; // Naranja
    }
    return {
      color: 'url(#gradient-red)',
      gradient: { start: colors.danger[400], end: colors.danger[500] },
      textColor: textColor || colors.danger[600]
    }; // Rojo
  };

  const { color: progressColor, gradient, textColor: dynamicTextColor } = getProgressColors();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {gradient && (
            <>
              <LinearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradient.start} stopOpacity="1" />
                <Stop offset="100%" stopColor={gradient.end} stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="gradient-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#3B82F6" stopOpacity="1" />
                <Stop offset="100%" stopColor="#2563EB" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="gradient-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FBBF24" stopOpacity="1" />
                <Stop offset="100%" stopColor="#F59E0B" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="gradient-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FB923C" stopOpacity="1" />
                <Stop offset="100%" stopColor="#F97316" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="gradient-red" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#F87171" stopOpacity="1" />
                <Stop offset="100%" stopColor="#EF4444" stopOpacity="1" />
              </LinearGradient>
            </>
          )}
        </Defs>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {showLabel && (
        <View style={styles.labelContainer}>
          {total !== undefined && validated !== undefined ? (
            <>
              <Text style={[styles.progressText, { color: dynamicTextColor, fontSize }]}>
                {validated}
              </Text>
              <Text style={[styles.totalText, { color: dynamicTextColor, fontSize: fontSize * 0.6 }]}>
                / {total}
              </Text>
            </>
          ) : (
            <Text style={[styles.percentageText, { color: dynamicTextColor, fontSize }]}>
              {Math.round(progress)}%
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontWeight: 'bold',
  },
  totalText: {
    fontWeight: '500',
    opacity: 0.7,
  },
  percentageText: {
    fontWeight: 'bold',
  },
});
