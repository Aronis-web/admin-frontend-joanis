/**
 * LoginScreen - Rediseñado con Design System
 *
 * Pantalla de inicio de sesión con diseño profesional y moderno.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { AUTH_ROUTES } from '@/constants/routes';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
} from '@/design-system/tokens';
import {
  Text,
  DisplayText,
  Body,
  Caption,
  Button,
  Input,
  Card,
  Divider,
} from '@/design-system/components';

// @ts-ignore
import { version } from '../../../package.json';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { width, height } = useWindowDimensions();

  const { loginWithCredentials, isLoading, error } = useAuthStore();
  const { clearTenantContext } = useTenantStore();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    try {
      console.log('🔑 Iniciando proceso de login...');
      const success = await loginWithCredentials(email, password, rememberMe);

      if (!success) {
        console.log('❌ Login falló');
        Alert.alert('Error', error || 'Credenciales incorrectas');
        return;
      }

      console.log('✅ Login exitoso, limpiando contexto de tenant...');
      await clearTenantContext();
      console.log('✅ Login completado - La navegación se manejará automáticamente');
    } catch (error) {
      console.error('❌ Error en handleLogin:', error);
      Alert.alert('Error', 'No se pudo conectar al servidor');
    }
  };

  const containerMaxWidth = isTablet ? (isLandscape ? 480 : 440) : '100%';

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.content, { maxWidth: containerMaxWidth }]}>
            {/* Logo & Branding */}
            <View style={styles.brandingSection}>
              <View style={styles.logoContainer}>
                <View style={styles.logo}>
                  <Text
                    variant="displayMedium"
                    color={colors.text.inverse}
                    style={styles.logoText}
                  >
                    ERP
                  </Text>
                </View>
              </View>

              <View style={styles.titleContainer}>
                <DisplayText size="small" color="primary" align="center">
                  Bienvenido
                </DisplayText>
                <Body
                  size="medium"
                  color="secondary"
                  align="center"
                  style={styles.subtitle}
                >
                  Inicia sesión para acceder a tu panel de administración
                </Body>
              </View>
            </View>

            {/* Login Form */}
            <Card variant="elevated" padding="large" style={styles.formCard}>
              <Input
                label="Correo electrónico"
                placeholder="correo@empresa.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon="mail-outline"
                size="large"
              />

              <Input
                label="Contraseña"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCorrect={false}
                leftIcon="lock-closed-outline"
                size="large"
              />

              {/* Remember Me */}
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={14} color={colors.text.inverse} />
                  )}
                </View>
                <Body size="small" color="secondary">
                  Mantener sesión iniciada
                </Body>
              </TouchableOpacity>

              {/* Submit Button */}
              <Button
                title={isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                onPress={handleLogin}
                variant="primary"
                size="large"
                fullWidth
                loading={isLoading}
                disabled={isLoading}
                style={styles.submitButton}
              />
            </Card>

            {/* Footer */}
            <View style={styles.footer}>
              <Caption color="tertiary" align="center">
                © 2024 ERP-aio • Versión {version}
              </Caption>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[6],
  },

  // ============================================
  // BRANDING SECTION
  // ============================================
  brandingSection: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },

  logoContainer: {
    marginBottom: spacing[6],
  },

  logo: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[900],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },

  logoText: {
    letterSpacing: 2,
  },

  titleContainer: {
    alignItems: 'center',
  },

  subtitle: {
    marginTop: spacing[2],
    maxWidth: 300,
  },

  // ============================================
  // FORM
  // ============================================
  formCard: {
    marginBottom: spacing[6],
  },

  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
    marginTop: -spacing[2],
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[2],
  },

  checkboxChecked: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },

  submitButton: {
    marginTop: spacing[2],
  },

  // ============================================
  // FOOTER
  // ============================================
  footer: {
    alignItems: 'center',
  },
});

export default LoginScreen;
