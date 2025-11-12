import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';

interface PermissionsDebugScreenProps {
  navigation: any;
}

export const PermissionsDebugScreen: React.FC<PermissionsDebugScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug de Permisos</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usuario</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>ID:</Text>
            <Text style={styles.infoValue}>{user?.id || 'N/A'}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Nombre:</Text>
            <Text style={styles.infoValue}>{user?.name || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Roles ({user?.roles?.length || 0})</Text>
          {user?.roles && user.roles.length > 0 ? (
            user.roles.map((role, index) => (
              <View key={index} style={styles.itemBox}>
                <Text style={styles.itemText}>
                  {role.code} - {role.name}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No hay roles asignados</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permisos ({user?.permissions?.length || 0})</Text>
          {user?.permissions && user.permissions.length > 0 ? (
            user.permissions.map((permission, index) => (
              <View key={index} style={styles.permissionBox}>
                <Text style={styles.permissionText}>{permission}</Text>
                {permission.startsWith('sites.') && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>SITES</Text>
                  </View>
                )}
                {permission.startsWith('users.') && (
                  <View style={[styles.badge, { backgroundColor: '#FF6B9D' }]}>
                    <Text style={styles.badgeText}>USERS</Text>
                  </View>
                )}
                {permission.startsWith('roles.') && (
                  <View style={[styles.badge, { backgroundColor: '#C44569' }]}>
                    <Text style={styles.badgeText}>ROLES</Text>
                  </View>
                )}
                {permission.startsWith('apps.') && (
                  <View style={[styles.badge, { backgroundColor: '#F38181' }]}>
                    <Text style={styles.badgeText}>APPS</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No hay permisos asignados</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permisos Requeridos para el Menú</Text>
          <View style={styles.requirementBox}>
            <Text style={styles.requirementTitle}>👤 Usuarios</Text>
            <Text style={styles.requirementPermission}>users.read</Text>
            <Text style={styles.requirementStatus}>
              {user?.permissions?.includes('users.read') ? '✅ Tienes acceso' : '❌ Sin acceso'}
            </Text>
          </View>
          <View style={styles.requirementBox}>
            <Text style={styles.requirementTitle}>🔑 Roles y Permisos</Text>
            <Text style={styles.requirementPermission}>roles.read</Text>
            <Text style={styles.requirementStatus}>
              {user?.permissions?.includes('roles.read') ? '✅ Tienes acceso' : '❌ Sin acceso'}
            </Text>
          </View>
          <View style={styles.requirementBox}>
            <Text style={styles.requirementTitle}>📲 Gestión de Apps</Text>
            <Text style={styles.requirementPermission}>apps.read</Text>
            <Text style={styles.requirementStatus}>
              {user?.permissions?.includes('apps.read') ? '✅ Tienes acceso' : '❌ Sin acceso'}
            </Text>
          </View>
          <View style={styles.requirementBox}>
            <Text style={styles.requirementTitle}>🏢 Sedes</Text>
            <Text style={styles.requirementPermission}>sites.list</Text>
            <Text style={styles.requirementStatus}>
              {user?.permissions?.includes('sites.list') ? '✅ Tienes acceso' : '❌ Sin acceso'}
            </Text>
          </View>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>💡 Nota Importante</Text>
          <Text style={styles.noteText}>
            Si acabas de asignar permisos en el backend, necesitas cerrar sesión y volver a iniciar sesión para que se actualicen en el frontend.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  itemBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  permissionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  badge: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  requirementBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  requirementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  requirementPermission: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  requirementStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  noteBox: {
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
});

export default PermissionsDebugScreen;
