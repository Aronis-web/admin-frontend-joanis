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
import { theme } from '@/theme';

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
          placeholderTextColor={theme.colors.text.hint}
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
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.5,
  },
  inputContainer: {
    borderRadius: 24, // Pill style
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  input: {
    // Base styles
  },
  inputFocused: {
    borderColor: theme.colors.blue,
    shadowColor: theme.colors.blue,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 13,
    elevation: 4,
  },
  inputError: {
    borderColor: '#FFB3BA',
  },
  textInput: {
    fontSize: 16,
    color: theme.colors.text.primary,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: theme.spacing.xs,
  },
});

export default FormTextInput;
