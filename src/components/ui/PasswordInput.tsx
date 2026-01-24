import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme';
import { FormTextInput } from './FormTextInput';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  focused?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label = 'Contraseña',
  error,
  focused = false,
  style,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(focused);
  const [showPassword, setShowPassword] = useState(false);
  const [eyePressed, setEyePressed] = useState(false);
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

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const eyeOpacity = eyePressed ? 1 : 0.6;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputContainer, inputStyle, style]}>
        <TextInput
          style={styles.textInput}
          placeholderTextColor={theme.colors.text.hint}
          secureTextEntry={!showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="done"
          {...textInputProps}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={togglePasswordVisibility}
          onPressIn={() => setEyePressed(true)}
          onPressOut={() => setEyePressed(false)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
            size={20}
            color={theme.colors.text.secondary}
            style={{ opacity: eyeOpacity }}
          />
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
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
  eyeButton: {
    padding: 4,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36, // 36px hit area
    height: 36, // 36px hit area
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: theme.spacing.xs,
  },
});

export default PasswordInput;
