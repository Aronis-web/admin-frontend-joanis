import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { MAIN_ROUTES } from '@/constants/routes';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface PermissionsDebugScreenProps {
  navigation: any;
}

export const PermissionsDebugScreen: React.FC<PermissionsDebugScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug de Permisos</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Herramientas</Text>
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => navigation.navigate(MAIN_ROUTES.THEME_PLAYGROUND)}
          >
            <Text style={styles.toolButtonText}>Theme Playground</Text>
          </TouchableOpacity>
        </View>

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
                  <View style={[styles.badge, { backgroundColor: theme.color.state.danger.border }]}>
                    <Text style={styles.badgeText}>USERS</Text>
                  </View>
                )}
                {permission.startsWith('roles.') && (
                  <View style={[styles.badge, { backgroundColor: theme.color.state.danger.text }]}>
                    <Text style={styles.badgeText}>ROLES</Text>
                  </View>
                )}
                {permission.startsWith('apps.') && (
                  <View style={[styles.badge, { backgroundColor: theme.color.state.warning.border }]}>
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
            Si acabas de asignar permisos en el backend, necesitas cerrar sesión y volver a iniciar
            sesión para que se actualicen en el frontend.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: theme.color.text.muted,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.space[5],
  },
  section: {
    marginTop: theme.space[5],
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[3],
  },
  infoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.space[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.surface.muted,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: theme.color.text.heading,
    fontWeight: '600',
  },
  itemBox: {
    backgroundColor: theme.color.background.subtle,
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    marginBottom: theme.space[2],
  },
  itemText: {
    fontSize: 14,
    color: theme.color.text.heading,
    fontWeight: '500',
  },
  permissionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.background.subtle,
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    marginBottom: theme.space[2],
  },
  permissionText: {
    fontSize: 14,
    color: theme.color.text.heading,
    fontWeight: '500',
    flex: 1,
  },
  badge: {
    backgroundColor: theme.color.state.info.border,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },
  badgeText: {
    fontSize: 10,
    color: theme.color.text.onAction,
    fontWeight: '700',
  },
  toolButton: {
    backgroundColor: theme.color.brand.primary,
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  toolButtonText: {
    fontSize: 14,
    color: theme.color.text.onAction,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: theme.color.text.placeholder,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.space[3],
  },
  requirementBox: {
    backgroundColor: theme.color.background.subtle,
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    marginBottom: theme.space[3],
  },
  requirementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[1],
  },
  requirementPermission: {
    fontSize: 13,
    color: theme.color.text.muted,
    fontFamily: 'monospace',
    marginBottom: theme.space[1],
  },
  requirementStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: theme.space[1],
  },
  noteBox: {
    marginTop: theme.space[5],
    marginBottom: theme.space[10],
    backgroundColor: theme.color.state.warning.background,
    padding: theme.space[4],
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.state.warning.text,
    marginBottom: theme.space[2],
  },
  noteText: {
    fontSize: 14,
    color: theme.color.state.warning.text,
    lineHeight: 20,
  },
});

export default PermissionsDebugScreen;
