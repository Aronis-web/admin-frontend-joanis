import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface FloatingButtonProps {
  onPress: () => void;
  isVisible: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const FloatingButton: React.FC<FloatingButtonProps> = ({ onPress, isVisible }) => {
  const slideAnim = React.useRef(new Animated.Value(100)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, scaleAnim]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.8}>
        <Text style={styles.buttonText}>☰</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing[5],
    top: 60,
    zIndex: 999,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: colors.neutral[0],
  },
  buttonText: {
    fontSize: 24,
    color: colors.neutral[0],
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
  },
});

export default FloatingButton;
