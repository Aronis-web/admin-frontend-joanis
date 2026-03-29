import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { rolesApi, Role } from '@/services/api/roles';

interface RoleSelectorProps {
  selectedRoleIds: string[];
  onRolesChange: (roleIds: string[]) => void;
  disabled?: boolean;
  singleSelection?: boolean; // If true, only one role can be selected
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  selectedRoleIds,
  onRolesChange,
  disabled = false,
  singleSelection = true, // Default to single selection
}) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    console.log('RoleSelector - selectedRoleIds changed:', selectedRoleIds);
  }, [selectedRoleIds]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const rolesData = await rolesApi.getRoles();
      setRoles(rolesData);
    } catch (err: any) {
      console.error('Error loading roles:', err);
      setError('No se pudieron cargar los roles');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (roleId: string) => {
    if (disabled) {
      return;
    }

    if (singleSelection) {
      // Single selection mode: replace current selection
      if (selectedRoleIds.includes(roleId)) {
        // Deselect if clicking the same role
        onRolesChange([]);
      } else {
        // Select only this role
        onRolesChange([roleId]);
      }
    } else {
      // Multiple selection mode
      if (selectedRoleIds.includes(roleId)) {
        // Remove role
        onRolesChange(selectedRoleIds.filter((id) => id !== roleId));
      } else {
        // Add role
        onRolesChange([...selectedRoleIds, roleId]);
      }
    }
  };

  const isRoleSelected = (roleId: string) => {
    return selectedRoleIds.includes(roleId);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Roles</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Cargando roles...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Roles</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadRoles} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (roles.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Roles</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay roles disponibles</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {singleSelection ? 'Rol' : 'Roles'}{' '}
        {selectedRoleIds.length > 0 &&
          `(${selectedRoleIds.length} seleccionado${selectedRoleIds.length !== 1 ? 's' : ''})`}
      </Text>
      <Text style={styles.description}>
        {singleSelection
          ? 'Selecciona el rol que deseas asignar al usuario'
          : 'Selecciona los roles que deseas asignar al usuario'}
      </Text>

      <ScrollView
        style={styles.rolesContainer}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
      >
        {roles.map((role) => {
          const selected = isRoleSelected(role.id);
          return (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.roleItem,
                selected && styles.roleItemSelected,
                disabled && styles.roleItemDisabled,
              ]}
              onPress={() => toggleRole(role.id)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <View style={styles.roleItemLeft}>
                <View
                  style={[
                    styles.checkbox,
                    selected && styles.checkboxSelected,
                    disabled && styles.checkboxDisabled,
                  ]}
                >
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.roleInfo}>
                  <Text
                    style={[
                      styles.roleName,
                      selected && styles.roleNameSelected,
                      disabled && styles.roleNameDisabled,
                    ]}
                  >
                    {role.name}
                  </Text>
                  <Text style={[styles.roleCode, disabled && styles.roleCodeDisabled]}>
                    {role.code}
                  </Text>
                  {role.description && (
                    <Text
                      style={[styles.roleDescription, disabled && styles.roleDescriptionDisabled]}
                    >
                      {role.description}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedRoleIds.length === 0 && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            💡 Puedes dejar sin {singleSelection ? 'rol' : 'roles'} si deseas asignarlo más tarde
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  description: {
    fontSize: 13,
    color: colors.neutral[500],
    marginBottom: spacing[3],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  loadingText: {
    marginLeft: spacing[3],
    fontSize: 14,
    color: colors.neutral[500],
  },
  errorContainer: {
    padding: spacing[4],
    backgroundColor: colors.danger[50],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.danger[100],
  },
  errorText: {
    fontSize: 14,
    color: colors.danger[600],
    marginBottom: spacing[3],
  },
  retryButton: {
    backgroundColor: colors.danger[500],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  emptyContainer: {
    padding: spacing[4],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  rolesContainer: {
    maxHeight: 300,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: spacing[2],
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3],
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  roleItemSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  roleItemDisabled: {
    opacity: 0.5,
  },
  roleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  checkboxSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  checkboxDisabled: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.neutral[200],
  },
  checkmark: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '700',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  roleNameSelected: {
    color: colors.primary[800],
  },
  roleNameDisabled: {
    color: colors.neutral[400],
  },
  roleCode: {
    fontSize: 12,
    color: colors.neutral[500],
    fontFamily: 'monospace',
    marginBottom: spacing[1],
  },
  roleCodeDisabled: {
    color: colors.neutral[300],
  },
  roleDescription: {
    fontSize: 12,
    color: colors.neutral[500],
    lineHeight: 16,
  },
  roleDescriptionDisabled: {
    color: colors.neutral[300],
  },
  hintContainer: {
    marginTop: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  hintText: {
    fontSize: 13,
    color: colors.primary[800],
    lineHeight: 18,
  },
});

export default RoleSelector;
