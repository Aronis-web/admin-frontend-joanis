import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  touchTargets,
} from '@/design-system/tokens';
import { textVariants } from '@/design-system/tokens/typography';

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
    const baseTextStyle: TextStyle = {
      ...styles.textBase,
      ...styles[`text_${variant}`],
      ...styles[`text_${size}`],
    };

    if (textStyle) {
      return {
        ...baseTextStyle,
        ...textStyle,
      };
    }

    return baseTextStyle;
  };

  const getLoaderColor = (): string => {
    switch (variant) {
      case 'primary':
        return colors.text.inverse;
      case 'secondary':
        return colors.text.primary;
      case 'outline':
      case 'text':
        return colors.primary[900];
      default:
        return colors.text.inverse;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={getLoaderColor()} size="small" />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  secondary: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.neutral[200],
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.primary[900],
  },
  text: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  size_small: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    minHeight: touchTargets.small,
  },
  size_medium: {
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    minHeight: touchTargets.medium,
  },
  size_large: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    minHeight: touchTargets.large,
  },
  textBase: {
    ...textVariants.buttonMedium,
  },
  text_primary: {
    color: colors.text.inverse,
  },
  text_secondary: {
    color: colors.text.primary,
  },
  text_outline: {
    color: colors.primary[900],
  },
  text_text: {
    color: colors.primary[900],
  },
  text_small: {
    ...textVariants.buttonSmall,
  },
  text_medium: {
    ...textVariants.buttonMedium,
  },
  text_large: {
    ...textVariants.buttonLarge,
  },
});

export default Button;
