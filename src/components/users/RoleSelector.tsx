import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
          <ActivityIndicator size="small" color={theme.color.brand.primary} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.space[4],
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    description: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: theme.space[3],
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    loadingText: {
      marginLeft: theme.space[3],
      fontSize: 14,
      color: theme.color.text.muted,
    },
    errorContainer: {
      padding: theme.space[4],
      backgroundColor: theme.color.state.danger.background,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.state.danger.border,
    },
    errorText: {
      fontSize: 14,
      color: theme.color.state.danger.text,
      marginBottom: theme.space[3],
    },
    retryButton: {
      backgroundColor: theme.color.action.danger.background,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.lg,
      alignSelf: 'flex-start',
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.action.danger.text,
    },
    emptyContainer: {
      padding: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    rolesContainer: {
      maxHeight: 300,
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: theme.space[2],
    },
    roleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    roleItemSelected: {
      backgroundColor: theme.color.brand.primarySoft,
      borderColor: theme.color.brand.primary,
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
      borderRadius: theme.radii.md,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    checkboxSelected: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    checkboxDisabled: {
      backgroundColor: theme.color.surface.muted,
      borderColor: theme.color.border.subtle,
    },
    checkmark: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '700',
    },
    roleInfo: {
      flex: 1,
    },
    roleName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    roleNameSelected: {
      color: theme.color.brand.primary,
    },
    roleNameDisabled: {
      color: theme.color.text.placeholder,
    },
    roleCode: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontFamily: 'monospace',
      marginBottom: theme.space[1],
    },
    roleCodeDisabled: {
      color: theme.color.text.placeholder,
    },
    roleDescription: {
      fontSize: 12,
      color: theme.color.text.muted,
      lineHeight: 16,
    },
    roleDescriptionDisabled: {
      color: theme.color.text.placeholder,
    },
    hintContainer: {
      marginTop: theme.space[2],
      padding: theme.space[3],
      backgroundColor: theme.color.brand.primarySoft,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    hintText: {
      fontSize: 13,
      color: theme.color.text.heading,
      lineHeight: 18,
    },
  });

export default RoleSelector;
