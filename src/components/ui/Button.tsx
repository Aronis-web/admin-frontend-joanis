import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '@/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.base,
      ...styles[variant],
      ...styles[`size_${size}`],
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    if (isDisabled) {
      baseStyle.opacity = 0.5;
    }

    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle = {
      ...styles.text,
      ...styles[`text_${variant}`],
      ...styles[`text_${size}`],
    };

    // Si se especifica textStyle, darle máxima prioridad
    if (textStyle) {
      return {
        ...baseTextStyle,
        ...textStyle,
      };
    }

    return baseTextStyle;
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? theme.colors.text.white : theme.colors.primary}
        />
      ) : (
        <Text
          style={[
            getTextStyle(),
            textStyle,
            { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  text: {
    backgroundColor: 'transparent',
  },
  size_small: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 36,
  },
  size_medium: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 44,
  },
  size_large: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    minHeight: 52,
  },
  text_primary: {
    color: '#FFFFFF', // Blanco forzado
    fontFamily: theme.fonts.semibold,
  },
  text_secondary: {
    color: theme.colors.text.white,
    fontFamily: theme.fonts.semibold,
  },
  text_outline: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.semibold,
  },
  text_text: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.semibold,
  },
  text_small: {
    fontSize: theme.fontSize.sm,
  },
  text_medium: {
    fontSize: theme.fontSize.md,
  },
  text_large: {
    fontSize: theme.fontSize.lg,
  },
});

export default Button;
