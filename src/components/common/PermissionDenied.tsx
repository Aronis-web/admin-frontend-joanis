import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
          <Ionicons name="lock-closed" size={80} color="#EF4444" />
        </View>

        <Text style={styles.title}>Acceso Denegado</Text>

        <Text style={styles.message}>{message}</Text>

        {requiredPermissions.length > 0 && (
          <View style={styles.permissionsContainer}>
            <Text style={styles.permissionsTitle}>Permisos requeridos:</Text>
            {requiredPermissions.map((permission, index) => (
              <View key={index} style={styles.permissionItem}>
                <Ionicons name="key" size={16} color="#6366F1" />
                <Text style={styles.permissionText}>{permission}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionsContainer}>
          {onGoBack && (
            <TouchableOpacity style={styles.button} onPress={onGoBack}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Volver</Text>
            </TouchableOpacity>
          )}

          {onContactAdmin && (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onContactAdmin}
            >
              <Ionicons name="mail" size={20} color="#6366F1" />
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                Contactar Administrador
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle" size={20} color="#64748B" />
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
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#1E293B',
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: '#6366F1',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
});

export default PermissionDenied;
