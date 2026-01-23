import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

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
  backgroundColor = '#E2E8F0',
  textColor = '#1E293B',
  fontSize = 16,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressOffset = circumference - (progress / 100) * circumference;

  // Determinar color basado en el progreso
  const getProgressColor = () => {
    if (color) return color;
    if (progress === 100) return '#10B981'; // Verde - Completado
    if (progress >= 75) return '#3B82F6'; // Azul - Casi completo
    if (progress >= 50) return '#F59E0B'; // Naranja - En progreso
    if (progress >= 25) return '#EF4444'; // Rojo - Poco progreso
    return '#94A3B8'; // Gris - Muy poco progreso
  };

  const progressColor = getProgressColor();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
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
              <Text style={[styles.progressText, { color: textColor, fontSize }]}>
                {validated}
              </Text>
              <Text style={[styles.totalText, { color: textColor, fontSize: fontSize * 0.6 }]}>
                / {total}
              </Text>
            </>
          ) : (
            <Text style={[styles.percentageText, { color: textColor, fontSize }]}>
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
