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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
          placeholderTextColor={colors.text.tertiary}
          keyboardType="default"
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
            color={colors.text.secondary}
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
    flexDirection: 'row',
    alignItems: 'center',
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
  eyeButton: {
    padding: spacing[1],
    marginLeft: spacing[2],
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger[500],
    marginTop: spacing[1],
  },
});

export default PasswordInput;
