/**
 * SpaceMembersModal
 *
 * Modal para gestionar los miembros de un espacio compartido (Shared Drives):
 *  - Buscador de usuarios (usa driveApi.searchUsers).
 *  - Selector de rol base (viewer / editor / manager) al invitar.
 *  - Lista de miembros con su rol + botón de quitar.
 *
 * El rol base se hereda por todos los nodos del espacio y se combina con el
 * compartir por nodo (gana el rol más permisivo). El dueño del espacio no
 * aparece en la lista y siempre tiene acceso total.
 *
 * Solo aplica a espacios `type=shared`; el espacio personal no admite miembros.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Text } from '@/design-system/components';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import {
  useAddDriveSpaceMember,
  useDriveSpaceMembers,
  useDriveUserSearch,
  useRemoveDriveSpaceMember,
} from '@/hooks/api/useDrive';
import type {
  DriveSpace,
  DriveSpaceMember,
  DriveSpaceMemberRole,
  DriveShareUser,
} from '@/types/drive';

interface Props {
  visible: boolean;
  space: DriveSpace | null;
  /** Si puede gestionar miembros (dueño o manager). Controla invitar/quitar. */
  canManage: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS: { value: DriveSpaceMemberRole; label: string }[] = [
  { value: 'viewer', label: 'Lector' },
  { value: 'editor', label: 'Editor' },
  { value: 'manager', label: 'Administrador' },
];

const roleLabel = (role: DriveSpaceMemberRole): string =>
  ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;

export const SpaceMembersModal: React.FC<Props> = ({ visible, space, canManage, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [role, setRole] = useState<DriveSpaceMemberRole>('viewer');

  const spaceId = space?.id;
  const membersQ = useDriveSpaceMembers(spaceId, visible && !!spaceId);
  const searchQ = useDriveUserSearch(debouncedQuery, visible && debouncedQuery.length >= 2);
  const addMember = useAddDriveSpaceMember();
  const removeMember = useRemoveDriveSpaceMember();

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setDebouncedQuery('');
      setRole('viewer');
    }
  }, [visible]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const existingUserIds = useMemo(
    () => new Set((membersQ.data ?? []).map((m) => m.user.id)),
    [membersQ.data]
  );

  const suggestions = useMemo(
    () => (searchQ.data ?? []).filter((u) => !existingUserIds.has(u.id)),
    [searchQ.data, existingUserIds]
  );

  const handleAdd = (user: DriveShareUser) => {
    if (!spaceId) return;
    addMember.mutate(
      { spaceId, dto: { userId: user.id, role } },
      {
        onSuccess: () => {
          setQuery('');
          setDebouncedQuery('');
        },
      }
    );
  };

  const handleRemove = (member: DriveSpaceMember) => {
    if (!spaceId) return;
    removeMember.mutate({ spaceId, userId: member.user.id });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="titleMedium">Miembros del espacio</Text>
              {space && (
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  {space.name}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={activeOpacity.medium}>
              <Ionicons name="close" size={iconSizes.lg} color={theme.color.icon.default} />
            </TouchableOpacity>
          </View>

          <View style={styles.notice}>
            <Ionicons
              name="information-circle-outline"
              size={iconSizes.sm}
              color={theme.color.icon.warning}
            />
            <Text variant="caption" color="secondary" style={styles.noticeText}>
              El rol asignado se hereda por todo el contenido del espacio.
            </Text>
          </View>

          {/* Buscador + rol */}
          {canManage && (
            <>
              <Input
                placeholder="Buscar por nombre, usuario o email"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
              />
              <View style={styles.roleGroup}>
                {ROLE_OPTIONS.map((r) => {
                  const active = role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => setRole(r.value)}
                      activeOpacity={activeOpacity.medium}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                    >
                      <Text
                        variant="caption"
                        style={active ? styles.roleChipTextActive : undefined}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {debouncedQuery.length >= 2 && (
                <View style={styles.suggestionsBox}>
                  {searchQ.isLoading ? (
                    <View style={styles.centerBox}>
                      <ActivityIndicator size="small" color={theme.color.brand.primary} />
                    </View>
                  ) : suggestions.length === 0 ? (
                    <View style={styles.centerBox}>
                      <Text variant="caption" color="secondary">
                        Sin coincidencias
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={suggestions}
                      keyExtractor={(u) => u.id}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          activeOpacity={activeOpacity.medium}
                          style={styles.userRow}
                          onPress={() => handleAdd(item)}
                          disabled={addMember.isPending}
                        >
                          <View style={styles.avatar}>
                            <Ionicons
                              name="person"
                              size={iconSizes.sm}
                              color={theme.color.text.inverse}
                            />
                          </View>
                          <View style={styles.userInfo}>
                            <Text variant="bodyMedium" numberOfLines={1}>
                              {item.name || item.username || item.email || 'Usuario'}
                            </Text>
                            {item.email && (
                              <Text variant="caption" color="secondary" numberOfLines={1}>
                                {item.email}
                              </Text>
                            )}
                          </View>
                          <Ionicons
                            name="add-circle"
                            size={iconSizes.md}
                            color={theme.color.brand.primary}
                          />
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </View>
              )}
            </>
          )}

          {/* Lista de miembros actuales */}
          <View style={styles.currentBox}>
            <Text variant="caption" color="secondary" style={styles.sectionLabel}>
              Miembros con acceso
            </Text>
            {membersQ.isLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color={theme.color.brand.primary} />
              </View>
            ) : (membersQ.data ?? []).length === 0 ? (
              <View style={styles.centerBox}>
                <Text variant="caption" color="secondary">
                  Solo el dueño tiene acceso por ahora.
                </Text>
              </View>
            ) : (
              <FlatList
                data={membersQ.data ?? []}
                keyExtractor={(m) => m.id}
                renderItem={({ item }) => {
                  const u = item.user;
                  return (
                    <View style={styles.userRow}>
                      <View style={[styles.avatar, styles.avatarNeutral]}>
                        <Ionicons
                          name="person"
                          size={iconSizes.sm}
                          color={theme.color.text.inverse}
                        />
                      </View>
                      <View style={styles.userInfo}>
                        <Text variant="bodyMedium" numberOfLines={1}>
                          {u.name || u.username || u.email || 'Usuario'}
                        </Text>
                        <Text variant="caption" color="secondary" numberOfLines={1}>
                          {roleLabel(item.role)}
                          {u.email ? ` · ${u.email}` : ''}
                        </Text>
                      </View>
                      {canManage && (
                        <TouchableOpacity
                          onPress={() => handleRemove(item)}
                          activeOpacity={activeOpacity.medium}
                          disabled={removeMember.isPending}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={iconSizes.md}
                            color={theme.color.icon.danger}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>

          <View style={styles.footer}>
            <Button title="Listo" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[5],
      gap: theme.space[3],
      ...theme.shadow.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[2],
    },
    headerText: {
      flex: 1,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2],
    },
    noticeText: {
      flex: 1,
    },
    roleGroup: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    roleChip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    roleChipActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    roleChipTextActive: {
      color: theme.color.text.inverse,
    },
    suggestionsBox: {
      maxHeight: 200,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
    },
    currentBox: {
      maxHeight: 220,
    },
    sectionLabel: {
      marginBottom: theme.space[1],
    },
    centerBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[3],
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[2],
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.color.brand.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarNeutral: {
      backgroundColor: theme.color.text.muted,
    },
    userInfo: {
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: theme.space[2],
    },
  });

export default SpaceMembersModal;
