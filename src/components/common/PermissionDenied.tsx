import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PermissionDeniedProps {
  message?: string;
  requiredPermissions?: string[];
  onGoBack?: () => void;
  onContactAdmin?: () => void;
}

export const PermissionDenied: React.FC<PermissionDeniedProps> = ({
  message = 'No tienes los permisos necesarios para acceder a esta página.',
  requiredPermissions = [],
  onGoBack,
  onContactAdmin,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={80} color={theme.color.icon.danger} />
        </View>

        <Text style={styles.title}>Acceso Denegado</Text>

        <Text style={styles.message}>{message}</Text>

        {requiredPermissions.length > 0 && (
          <View style={styles.permissionsContainer}>
            <Text style={styles.permissionsTitle}>Permisos requeridos:</Text>
            {requiredPermissions.map((permission, index) => (
              <View key={index} style={styles.permissionItem}>
                <Ionicons name="key" size={16} color={theme.color.icon.accent} />
                <Text style={styles.permissionText}>{permission}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionsContainer}>
          {onGoBack && (
            <TouchableOpacity style={styles.button} onPress={onGoBack}>
              <Ionicons name="arrow-back" size={20} color={theme.color.text.onAction} />
              <Text style={styles.buttonText}>Volver</Text>
            </TouchableOpacity>
          )}

          {onContactAdmin && (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onContactAdmin}
            >
              <Ionicons name="mail" size={20} color={theme.color.icon.accent} />
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                Contactar Administrador
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle" size={20} color={theme.color.icon.muted} />
          <Text style={styles.infoText}>
            Si crees que esto es un error, contacta al administrador del sistema para solicitar los
            permisos necesarios.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.background.canvas,
  },
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  content: {
    padding: theme.space[6],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  iconContainer: {
    marginBottom: theme.space[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[4],
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: theme.color.text.muted,
    textAlign: 'center',
    marginBottom: theme.space[6],
    lineHeight: 24,
  },
  permissionsContainer: {
    width: '100%',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[6],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: theme.space[3],
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.background.muted,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.lg,
    marginBottom: theme.space[2],
  },
  permissionText: {
    fontSize: 14,
    color: theme.color.text.body,
    marginLeft: theme.space[2],
    fontFamily: 'monospace',
  },
  actionsContainer: {
    width: '100%',
    gap: theme.space[3],
    marginBottom: theme.space[6],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.brand.accent,
    paddingHorizontal: theme.space[6],
    paddingVertical: 14,
    borderRadius: theme.radii.xl,
    gap: theme.space[2],
  },
  buttonSecondary: {
    backgroundColor: theme.color.surface.base,
    borderWidth: 2,
    borderColor: theme.color.brand.accent,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.onAction,
  },
  buttonTextSecondary: {
    color: theme.color.brand.accent,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.color.state.warning.background,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.xl,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: theme.color.state.warning.text,
    marginLeft: theme.space[2],
    flex: 1,
    lineHeight: 20,
  },
});

export default PermissionDenied;
