import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CircularProgressFallbackProps {
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

export const CircularProgressFallback: React.FC<CircularProgressFallbackProps> = ({
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
      {/* Background Circle */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: backgroundColor,
          },
        ]}
      >
        {/* Progress Indicator - Using a simple overlay */}
        <View
          style={[
            styles.progressOverlay,
            {
              width: size - strokeWidth * 2,
              height: size - strokeWidth * 2,
              borderRadius: (size - strokeWidth * 2) / 2,
              backgroundColor: progressColor + '20',
            },
          ]}
        />

        {/* Label */}
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

      {/* Progress Bar (Linear fallback) */}
      <View
        style={[
          styles.progressBar,
          {
            width: size,
            height: 4,
            backgroundColor: backgroundColor,
            marginTop: 4,
            borderRadius: 2,
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress}%`,
              height: '100%',
              backgroundColor: progressColor,
              borderRadius: 2,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressOverlay: {
    position: 'absolute',
  },
  labelContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
  progressBar: {
    overflow: 'hidden',
  },
  progressFill: {},
});
