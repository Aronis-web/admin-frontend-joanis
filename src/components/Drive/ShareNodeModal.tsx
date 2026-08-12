/**
 * ShareNodeModal
 *
 * Modal para gestionar la compartición de una carpeta/archivo con usuarios:
 *  - Buscador de usuarios (usa driveApi.searchUsers).
 *  - Selector de rol (viewer / editor) al invitar.
 *  - Lista de personas con acceso + botón de revocar.
 *  - Aviso de que compartir una carpeta da acceso recursivo.
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
  useCreateDriveShare,
  useDriveShares,
  useDriveUserSearch,
  useRevokeDriveShare,
} from '@/hooks/api/useDrive';
import type { DriveAccessLevel, DriveNode, DriveShare, DriveShareUser } from '@/types/drive';
import { ACCESS_LEVEL_LABEL } from '@/types/drive';

interface Props {
  visible: boolean;
  node: DriveNode | null;
  canShare: boolean;
  onClose: () => void;
}

type InviteRole = DriveAccessLevel;

const ROLE_OPTIONS: { value: InviteRole; label: string }[] = [
  { value: 'preview', label: 'Solo lectura' },
  { value: 'download', label: 'Ver y descargar' },
  { value: 'editor', label: 'Editor' },
  { value: 'remover', label: 'Editor y eliminar' },
];

export const ShareNodeModal: React.FC<Props> = ({ visible, node, canShare, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [role, setRole] = useState<InviteRole>('preview');

  const nodeId = node?.id;
  const sharesQ = useDriveShares(nodeId, visible && !!nodeId);
  const searchQ = useDriveUserSearch(debouncedQuery, visible && debouncedQuery.length >= 2);
  const createShare = useCreateDriveShare();
  const revokeShare = useRevokeDriveShare();

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setDebouncedQuery('');
      setRole('preview');
    }
  }, [visible]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const existingUserIds = useMemo(
    () => new Set((sharesQ.data ?? []).map((s) => s.granteeUserId).filter(Boolean) as string[]),
    [sharesQ.data]
  );

  const suggestions = useMemo(
    () => (searchQ.data ?? []).filter((u) => !existingUserIds.has(u.id)),
    [searchQ.data, existingUserIds]
  );

  const handleInvite = (user: DriveShareUser) => {
    if (!nodeId) return;
    createShare.mutate(
      { nodeId, dto: { granteeUserId: user.id, role } },
      {
        onSuccess: () => {
          setQuery('');
          setDebouncedQuery('');
        },
      }
    );
  };

  const handleRevoke = (share: DriveShare) => {
    if (!nodeId) return;
    revokeShare.mutate({ shareId: share.id, nodeId });
  };

  const isFolder = node?.kind === 'folder';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="titleMedium">Compartir</Text>
              {node && (
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  {node.name}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={activeOpacity.medium}>
              <Ionicons name="close" size={iconSizes.lg} color={theme.color.icon.default} />
            </TouchableOpacity>
          </View>

          {isFolder && (
            <View style={styles.notice}>
              <Ionicons
                name="information-circle-outline"
                size={iconSizes.sm}
                color={theme.color.icon.warning}
              />
              <Text variant="caption" color="secondary" style={styles.noticeText}>
                Compartir esta carpeta también da acceso a todo su contenido.
              </Text>
            </View>
          )}

          {/* Buscador + rol */}
          {canShare && (
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
                          onPress={() => handleInvite(item)}
                          disabled={createShare.isPending}
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

          {/* Lista de shares actuales */}
          <View style={styles.currentBox}>
            <Text variant="caption" color="secondary" style={styles.sectionLabel}>
              Personas con acceso
            </Text>
            {sharesQ.isLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color={theme.color.brand.primary} />
              </View>
            ) : (sharesQ.data ?? []).length === 0 ? (
              <View style={styles.centerBox}>
                <Text variant="caption" color="secondary">
                  Todavía nadie tiene acceso.
                </Text>
              </View>
            ) : (
              <FlatList
                data={sharesQ.data ?? []}
                keyExtractor={(s) => s.id}
                renderItem={({ item }) => {
                  const u = item.grantee;
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
                          {u?.name || u?.username || u?.email || 'Usuario'}
                        </Text>
                        <Text variant="caption" color="secondary" numberOfLines={1}>
                          {ACCESS_LEVEL_LABEL[item.role] ?? item.role}
                          {u?.email ? ` · ${u.email}` : ''}
                        </Text>
                      </View>
                      {canShare && (
                        <TouchableOpacity
                          onPress={() => handleRevoke(item)}
                          activeOpacity={activeOpacity.medium}
                          disabled={revokeShare.isPending}
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
      flexWrap: 'wrap',
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

export default ShareNodeModal;
