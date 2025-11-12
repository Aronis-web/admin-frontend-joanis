import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
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
    if (disabled) return;

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
        onRolesChange(selectedRoleIds.filter(id => id !== roleId));
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
          <ActivityIndicator size="small" color="#3B82F6" />
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
        {singleSelection ? 'Rol' : 'Roles'} {selectedRoleIds.length > 0 && `(${selectedRoleIds.length} seleccionado${selectedRoleIds.length !== 1 ? 's' : ''})`}
      </Text>
      <Text style={styles.description}>
        {singleSelection ? 'Selecciona el rol que deseas asignar al usuario' : 'Selecciona los roles que deseas asignar al usuario'}
      </Text>

      <ScrollView
        style={styles.rolesContainer}
        nestedScrollViewEnabled={true}
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
                <View style={[
                  styles.checkbox,
                  selected && styles.checkboxSelected,
                  disabled && styles.checkboxDisabled,
                ]}>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.roleInfo}>
                  <Text style={[
                    styles.roleName,
                    selected && styles.roleNameSelected,
                    disabled && styles.roleNameDisabled,
                  ]}>
                    {role.name}
                  </Text>
                  <Text style={[
                    styles.roleCode,
                    disabled && styles.roleCodeDisabled,
                  ]}>
                    {role.code}
                  </Text>
                  {role.description && (
                    <Text style={[
                      styles.roleDescription,
                      disabled && styles.roleDescriptionDisabled,
                    ]}>
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
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyContainer: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  rolesContainer: {
    maxHeight: 300,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
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
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkboxDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  roleNameSelected: {
    color: '#1E40AF',
  },
  roleNameDisabled: {
    color: '#94A3B8',
  },
  roleCode: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  roleCodeDisabled: {
    color: '#CBD5E1',
  },
  roleDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  roleDescriptionDisabled: {
    color: '#CBD5E1',
  },
  hintContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  hintText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
});

export default RoleSelector;
