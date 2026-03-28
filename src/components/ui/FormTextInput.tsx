import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Animated,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface FormTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  focused?: boolean;
}

export const FormTextInput: React.FC<FormTextInputProps> = ({
  label,
  error,
  focused = false,
  style,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = React.useState(focused);
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const inputStyle = [
    styles.input,
    error && styles.inputError,
    isFocused && styles.inputFocused,
    {
      shadowOpacity: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.1],
      }),
    },
  ];

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View style={[styles.inputContainer, inputStyle, style]}>
        <TextInput
          style={styles.textInput}
          placeholderTextColor={colors.text.tertiary}
          keyboardType="default"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...textInputProps}
        />
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing[1],
    letterSpacing: 0.5,
  },
  inputContainer: {
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  input: {
    // Base styles
  },
  inputFocused: {
    borderColor: colors.primary[500],
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 13,
    elevation: 4,
  },
  inputError: {
    borderColor: colors.danger[200],
  },
  textInput: {
    fontSize: 16,
    color: colors.text.primary,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger[500],
    marginTop: spacing[1],
  },
});

export default FormTextInput;
