import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Button } from '@/design-system';
import type { MailboxQuota, MailFolder } from '@/types/webmail';
import { folderIcon, folderLabel, formatBytes, sortFolders } from './folderUtils';

interface Props {
  folders: MailFolder[] | undefined;
  quota?: MailboxQuota | undefined;
  currentFolder: string;
  onSelectFolder: (folder: MailFolder) => void;
  onCompose: () => void;
  onNavigateArchive?: () => void;
  emailAddress?: string | null;
  /**
   * Cuando `true`, la barra ocupa todo el ancho disponible del contenedor
   * (útil dentro del drawer móvil). Por defecto usa el ancho fijo de escritorio.
   */
  fullWidth?: boolean;
}

/**
 * Sidebar con lista de carpetas, cuota y acción "Redactar".
 * Se usa como columna izquierda en desktop/web (>= 900px).
 */
export const WebmailFolderSidebar: React.FC<Props> = ({
  folders,
  quota,
  currentFolder,
  onSelectFolder,
  onCompose,
  onNavigateArchive,
  emailAddress,
  fullWidth = false,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const sorted = folders ? sortFolders(folders) : [];

  return (
    <View style={[styles.container, fullWidth && styles.containerFullWidth]}>
      <View style={styles.top}>
        {emailAddress ? (
          <View style={styles.emailBox}>
            <Ionicons name="person-circle-outline" size={20} color={theme.color.icon.muted} />
            <Text numberOfLines={1} style={styles.emailText}>
              {emailAddress}
            </Text>
          </View>
        ) : null}
        <Button title="Redactar" leftIcon="create-outline" onPress={onCompose} fullWidth />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>Carpetas</Text>
        {sorted.map((f) => {
          const isActive = f.path === currentFolder;
          return (
            <TouchableOpacity
              key={f.path}
              onPress={() => onSelectFolder(f)}
              activeOpacity={0.7}
              style={[styles.item, isActive && styles.itemActive]}
            >
              <Ionicons
                name={folderIcon(f)}
                size={18}
                color={isActive ? theme.color.icon.accent : theme.color.icon.muted}
              />
              <Text
                numberOfLines={1}
                style={[styles.itemLabel, isActive && styles.itemLabelActive]}
              >
                {folderLabel(f)}
              </Text>
              {f.unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{f.unread > 999 ? '999+' : f.unread}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {onNavigateArchive ? (
          <TouchableOpacity
            style={[styles.item, styles.archiveShortcut]}
            onPress={onNavigateArchive}
            activeOpacity={0.7}
          >
            <Ionicons name="file-tray-full-outline" size={18} color={theme.color.icon.muted} />
            <Text style={styles.itemLabel}>Archivo histórico</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {quota && (quota.limitBytes || quota.usedBytes) ? (
        <View style={styles.quotaBox}>
          <View style={styles.quotaHeader}>
            <Ionicons name="server-outline" size={14} color={theme.color.icon.muted} />
            <Text style={styles.quotaLabel}>Almacenamiento</Text>
          </View>
          <View style={styles.quotaBar}>
            <View
              style={[
                styles.quotaFill,
                {
                  width: `${Math.min(100, quota.usedPercent ?? 0)}%`,
                  backgroundColor:
                    (quota.usedPercent ?? 0) >= 90
                      ? theme.color.state.danger.border
                      : (quota.usedPercent ?? 0) >= 70
                        ? theme.color.state.warning.border
                        : theme.color.brand.accent,
                },
              ]}
            />
          </View>
          <Text style={styles.quotaText}>
            {formatBytes(quota.usedBytes)}
            {quota.limitBytes ? ` / ${formatBytes(quota.limitBytes)}` : ''}
            {quota.usedPercent !== null ? `  (${quota.usedPercent}%)` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      width: 260,
      backgroundColor: theme.color.surface.subtle,
      borderRightWidth: 1,
      borderRightColor: theme.color.border.subtle,
    },
    containerFullWidth: {
      width: '100%',
      flex: 1,
      borderRightWidth: 0,
    },
    top: {
      padding: theme.space[3],
      gap: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    emailBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    emailText: {
      flex: 1,
      fontSize: 12,
      color: theme.color.text.muted,
    },
    scroll: {
      padding: theme.space[2],
      paddingBottom: theme.space[6],
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: theme.color.text.muted,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[2],
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: theme.space[3],
      paddingVertical: 10,
      borderRadius: theme.radii.lg,
      marginBottom: 2,
    },
    itemActive: {
      backgroundColor: theme.color.brand.accentSoft,
    },
    itemLabel: {
      flex: 1,
      fontSize: 14,
      color: theme.color.text.body,
    },
    itemLabelActive: {
      color: theme.color.brand.accent,
      fontWeight: '700',
    },
    badge: {
      minWidth: 22,
      paddingHorizontal: 6,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: theme.color.text.onAction,
      fontSize: 11,
      fontWeight: '700',
    },
    archiveShortcut: {
      marginTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingTop: theme.space[3],
    },
    quotaBox: {
      padding: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: 6,
    },
    quotaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    quotaLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: theme.color.text.muted,
    },
    quotaBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.color.surface.muted,
      overflow: 'hidden',
    },
    quotaFill: {
      height: '100%',
    },
    quotaText: {
      fontSize: 11,
      color: theme.color.text.muted,
    },
  });

export default WebmailFolderSidebar;
