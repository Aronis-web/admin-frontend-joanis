/**
 * LoginScreen - Rediseñado con Design System
 *
 * Pantalla de inicio de sesión con diseño profesional y moderno.
 */

import Alert from '@/utils/alert';

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
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
  Text,
  DisplayText,
  Body,
  Caption,
  Button,
  Input,
  Card,
  Divider,
} from '@/design-system/components';
import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';

// @ts-ignore
import { version } from '../../../package.json';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { usePwaInstall } from '@/hooks/usePwaInstall';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { canPrompt: canInstallPwa, isIOS: isIOSSafari, promptInstall } = usePwaInstall();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // Fix: en Electron/Web, tras un logout por 401 disparado desde un
  // window.confirm/alert, el BrowserWindow puede perder el foco del teclado.
  // Al montar el Login forzamos window.focus() para que los inputs respondan.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.focus();
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && !document.body.contains(active)) {
        active.blur?.();
      }
    } catch {
      // no-op
    }
  }, []);

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

  const handleInstallPwa = async () => {
    if (isIOSSafari) {
      Alert.alert(
        'Instalar en tu iPhone',
        'Para instalar ERP-aio en tu pantalla de inicio:\n\n' +
          '1. Toca el botón Compartir en la barra de Safari.\n' +
          '2. Elige "Añadir a pantalla de inicio".\n' +
          '3. Confirma con "Añadir".'
      );
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'unavailable') {
      Alert.alert(
        'Instalación no disponible',
        'Tu navegador no soporta la instalación automática. Probá desde Chrome o Edge en escritorio, o Chrome en Android.'
      );
    }
  };

  return (
    <>
      <StatusBar
        barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.color.background.canvas}
      />
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
                    color={theme.color.text.onAction}
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
                <Body size="medium" color="secondary" align="center" style={styles.subtitle}>
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
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && (
                    <Ionicons name="checkmark" size={14} color={theme.color.text.onAction} />
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
              {canInstallPwa && (
                <TouchableOpacity
                  onPress={handleInstallPwa}
                  activeOpacity={0.7}
                  style={styles.installButton}
                  accessibilityRole="button"
                  accessibilityLabel="Instalar ERP-aio en el dispositivo"
                >
                  <Ionicons name="download-outline" size={18} color={theme.color.brand.primary} />
                  <Body
                    size="small"
                    color={theme.color.brand.primary}
                    style={styles.installButtonLabel}
                  >
                    {isIOSSafari ? 'Instalar en iPhone' : 'Instalar aplicación'}
                  </Body>
                </TouchableOpacity>
              )}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },

    keyboardView: {
      flex: 1,
    },

    content: {
      flex: 1,
      justifyContent: 'center',
      alignSelf: 'center',
      width: '100%',
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[6],
    },

    // ============================================
    // BRANDING SECTION
    // ============================================
    brandingSection: {
      alignItems: 'center',
      marginBottom: theme.space[8],
    },

    logoContainer: {
      marginBottom: theme.space[6],
    },

    logo: {
      width: 88,
      height: 88,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.brand.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadow.lg,
    },

    logoText: {
      letterSpacing: 2,
    },

    titleContainer: {
      alignItems: 'center',
    },

    subtitle: {
      marginTop: theme.space[2],
      maxWidth: 300,
    },

    // ============================================
    // FORM
    // ============================================
    formCard: {
      marginBottom: theme.space[6],
    },

    rememberMeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[4],
      marginTop: -theme.space[2],
    },

    checkbox: {
      width: 22,
      height: 22,
      borderRadius: theme.radii.sm,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[2],
    },

    checkboxChecked: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },

    submitButton: {
      marginTop: theme.space[2],
    },

    // ============================================
    // FOOTER
    // ============================================
    footer: {
      alignItems: 'center',
    },

    installButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      marginBottom: theme.space[3],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.brand.primary,
      backgroundColor: theme.color.surface.base,
    },

    installButtonLabel: {
      marginLeft: theme.space[2],
      fontWeight: '600',
    },
  });

export default LoginScreen;
