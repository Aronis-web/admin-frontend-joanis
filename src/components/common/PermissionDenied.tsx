import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={80} color={colors.danger[500]} />
        </View>

        <Text style={styles.title}>Acceso Denegado</Text>

        <Text style={styles.message}>{message}</Text>

        {requiredPermissions.length > 0 && (
          <View style={styles.permissionsContainer}>
            <Text style={styles.permissionsTitle}>Permisos requeridos:</Text>
            {requiredPermissions.map((permission, index) => (
              <View key={index} style={styles.permissionItem}>
                <Ionicons name="key" size={16} color={colors.accent[500]} />
                <Text style={styles.permissionText}>{permission}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionsContainer}>
          {onGoBack && (
            <TouchableOpacity style={styles.button} onPress={onGoBack}>
              <Ionicons name="arrow-back" size={20} color={colors.neutral[0]} />
              <Text style={styles.buttonText}>Volver</Text>
            </TouchableOpacity>
          )}

          {onContactAdmin && (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onContactAdmin}
            >
              <Ionicons name="mail" size={20} color={colors.accent[500]} />
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                Contactar Administrador
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle" size={20} color={colors.neutral[500]} />
          <Text style={styles.infoText}>
            Si crees que esto es un error, contacta al administrador del sistema para solicitar los
            permisos necesarios.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  iconContainer: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.neutral[600],
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 24,
  },
  permissionsContainer: {
    width: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[3],
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
  },
  permissionText: {
    fontSize: 14,
    color: colors.neutral[800],
    marginLeft: spacing[2],
    fontFamily: 'monospace',
  },
  actionsContainer: {
    width: '100%',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[500],
    paddingHorizontal: spacing[6],
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    gap: spacing[2],
  },
  buttonSecondary: {
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.accent[500],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  buttonTextSecondary: {
    color: colors.accent[500],
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: colors.warning[800],
    marginLeft: spacing[2],
    flex: 1,
    lineHeight: 20,
  },
});

export default PermissionDenied;
