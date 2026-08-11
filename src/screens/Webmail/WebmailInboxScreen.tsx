import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { EmptyState, Button } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';
import {
  useArchiveMessage,
  useDeleteMessage,
  useEmptyTrash,
  useMarkNotSpam,
  useMarkSpam,
  useMoveMessage,
  useTrashMessage,
  useUpdateFlags,
  useWebmailFolders,
  useWebmailMessages,
  useWebmailQuota,
  useWebmailSearch,
  useWebmailStatus,
} from '@/hooks/api/useWebmail';
import type { MailFolder, MessageListItem } from '@/types/webmail';
import { MAIN_ROUTES } from '@/constants/routes';
import { WebmailFolderSidebar } from './WebmailFolderSidebar';
import {
  formatMailDate,
  isSpam,
  isTrash,
  parseSender,
  folderLabel,
  sortFolders,
} from './folderUtils';

interface Props {
  navigation: any;
}

const PAGE_SIZE = 25;
const DEFAULT_FOLDER = 'INBOX';

export const WebmailInboxScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const { hasPermission } = usePermissions();

  const isWide = width >= 900;
  const canReadArchive = hasPermission(PERMISSIONS.WEBMAIL.ARCHIVE_READ);

  const [currentFolder, setCurrentFolder] = useState<string>(DEFAULT_FOLDER);
  const [currentFolderLabel, setCurrentFolderLabel] = useState<string>('Bandeja de entrada');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // el que dispara la búsqueda
  const [showMobileFolders, setShowMobileFolders] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MessageListItem | null>(null);

  const status = useWebmailStatus();
  const enabled = !!(status.data?.configured && status.data?.active);

  const folders = useWebmailFolders(enabled);
  const quota = useWebmailQuota(enabled);

  const isSearching = searchQuery.trim().length > 0;

  const messages = useWebmailMessages(
    { page, pageSize: PAGE_SIZE, folder: currentFolder },
    enabled && !isSearching
  );

  const searchResults = useWebmailSearch(
    { q: searchQuery, folder: currentFolder, page, pageSize: PAGE_SIZE },
    enabled && isSearching
  );

  const activeQuery = isSearching ? searchResults : messages;
  const data = activeQuery.data;

  // Mutations
  const updateFlags = useUpdateFlags();
  const archiveMsg = useArchiveMessage();
  const trashMsg = useTrashMessage();
  const deleteMsg = useDeleteMessage();
  const markSpam = useMarkSpam();
  const markNotSpam = useMarkNotSpam();
  const moveMsg = useMoveMessage();
  const emptyTrash = useEmptyTrash();

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  }, [data]);

  const inTrash = isTrash(currentFolder, folders.data);
  const inSpam = isSpam(currentFolder, folders.data);

  const handleSelectFolder = useCallback((f: MailFolder) => {
    setCurrentFolder(f.path);
    setCurrentFolderLabel(folderLabel(f));
    setPage(1);
    setSearchQuery('');
    setSearchTerm('');
    setShowMobileFolders(false);
  }, []);

  const runSearch = () => {
    setPage(1);
    setSearchQuery(searchTerm.trim());
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchQuery('');
    setPage(1);
  };

  const onOpenMessage = (item: MessageListItem) => {
    navigation.navigate(MAIN_ROUTES.WEBMAIL_MESSAGE, {
      uid: item.uid,
      folder: currentFolder,
    });
  };

  const runMutation = async (
    action: () => Promise<unknown>,
    errorMsg: string
  ): Promise<boolean> => {
    try {
      await action();
      return true;
    } catch (e: any) {
      logger.error(errorMsg, e);
      const msg = e?.response?.data?.message || e?.message || errorMsg;
      Alert.alert('Error', String(msg));
      return false;
    }
  };

  const handleToggleRead = (item: MessageListItem) =>
    runMutation(
      () =>
        updateFlags.mutateAsync({
          uid: item.uid,
          folder: currentFolder,
          dto: { seen: !item.seen },
        }),
      'No se pudo actualizar el estado de leído.'
    );

  const handleToggleFlag = (item: MessageListItem) =>
    runMutation(
      () =>
        updateFlags.mutateAsync({
          uid: item.uid,
          folder: currentFolder,
          dto: { flagged: !item.flagged },
        }),
      'No se pudo destacar el mensaje.'
    );

  const handleArchive = (item: MessageListItem) =>
    runMutation(
      () => archiveMsg.mutateAsync({ uid: item.uid, folder: currentFolder }),
      'No se pudo archivar el mensaje.'
    );

  const handleTrash = (item: MessageListItem) =>
    runMutation(
      () => trashMsg.mutateAsync({ uid: item.uid, folder: currentFolder }),
      'No se pudo mover a la papelera.'
    );

  const handleSpam = (item: MessageListItem) =>
    runMutation(
      () => markSpam.mutateAsync({ uid: item.uid, folder: currentFolder }),
      'No se pudo marcar como no deseado.'
    );

  const handleNotSpam = (item: MessageListItem) =>
    runMutation(
      () => markNotSpam.mutateAsync({ uid: item.uid, folder: currentFolder }),
      'No se pudo restaurar el mensaje.'
    );

  const handleDeletePermanent = (item: MessageListItem) => {
    Alert.alert(
      'Eliminar permanentemente',
      '¿Confirmas que quieres eliminar este mensaje de forma permanente? No se podrá recuperar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            runMutation(
              () => deleteMsg.mutateAsync({ uid: item.uid, folder: currentFolder }),
              'No se pudo eliminar el mensaje.'
            ),
        },
      ]
    );
  };

  const handleEmptyTrash = () => {
    Alert.alert(
      'Vaciar papelera',
      '¿Confirmas que quieres eliminar todos los mensajes de la papelera? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar',
          style: 'destructive',
          onPress: () =>
            runMutation(() => emptyTrash.mutateAsync(), 'No se pudo vaciar la papelera.'),
        },
      ]
    );
  };

  const handleMoveTo = async (targetPath: string) => {
    if (!moveTarget) return;
    const ok = await runMutation(
      () =>
        moveMsg.mutateAsync({
          uid: moveTarget.uid,
          folder: currentFolder,
          toFolder: targetPath,
        }),
      'No se pudo mover el mensaje.'
    );
    if (ok) setMoveTarget(null);
  };

  const renderItem = ({ item }: { item: MessageListItem }) => {
    const isUnread = !item.seen;
    const sender = parseSender(item.from);
    return (
      <Pressable
        onPress={() => onOpenMessage(item)}
        style={({ pressed }) => [
          styles.row,
          isUnread && styles.rowUnread,
          pressed && styles.rowPressed,
        ]}
      >
        <TouchableOpacity onPress={() => handleToggleFlag(item)} style={styles.starBtn} hitSlop={8}>
          <Ionicons
            name={item.flagged ? 'star' : 'star-outline'}
            size={18}
            color={item.flagged ? theme.color.icon.warning : theme.color.icon.subtle}
          />
        </TouchableOpacity>

        <View style={styles.rowMain}>
          <View style={styles.rowHeader}>
            <Text numberOfLines={1} style={[styles.from, isUnread && styles.bold]}>
              {sender.name || sender.email}
            </Text>
            <Text style={styles.date}>{formatMailDate(item.date)}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.subject, isUnread && styles.semibold]}>
            {item.subject || '(sin asunto)'}
          </Text>
          <View style={styles.rowFooter}>
            {item.hasAttachments ? (
              <Ionicons name="attach" size={14} color={theme.color.icon.muted} />
            ) : null}
            {isUnread ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>

        <View style={styles.rowActions}>
          <QuickAction
            icon={item.seen ? 'mail-unread-outline' : 'mail-open-outline'}
            label={item.seen ? 'No leído' : 'Leído'}
            onPress={() => handleToggleRead(item)}
            theme={theme}
          />
          {!inTrash && !inSpam ? (
            <QuickAction
              icon="archive-outline"
              label="Archivar"
              onPress={() => handleArchive(item)}
              theme={theme}
            />
          ) : null}
          {!inSpam ? (
            <QuickAction
              icon="warning-outline"
              label="Spam"
              onPress={() => handleSpam(item)}
              theme={theme}
            />
          ) : (
            <QuickAction
              icon="return-up-back-outline"
              label="No es spam"
              onPress={() => handleNotSpam(item)}
              theme={theme}
            />
          )}
          <QuickAction
            icon="folder-outline"
            label="Mover"
            onPress={() => setMoveTarget(item)}
            theme={theme}
          />
          {inTrash ? (
            <QuickAction
              icon="trash-bin-outline"
              label="Eliminar"
              onPress={() => handleDeletePermanent(item)}
              theme={theme}
              danger
            />
          ) : (
            <QuickAction
              icon="trash-outline"
              label="Papelera"
              onPress={() => handleTrash(item)}
              theme={theme}
              danger
            />
          )}
        </View>
      </Pressable>
    );
  };

  // -----------------------------------------------------------------
  // States: loading, sin configurar, desactivado
  // -----------------------------------------------------------------

  if (status.isLoading) {
    return (
      <ScreenLayout navigation={navigation}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.color.icon.accent} />
        </View>
      </ScreenLayout>
    );
  }

  if (!status.data?.configured) {
    return (
      <ScreenLayout navigation={navigation}>
        <EmptyState
          icon="mail-outline"
          title="No tienes buzón configurado"
          description="Solicita a un administrador que active tu correo corporativo."
        />
      </ScreenLayout>
    );
  }

  if (!status.data.active) {
    return (
      <ScreenLayout navigation={navigation}>
        <EmptyState
          icon="mail-unread-outline"
          title="Buzón desactivado"
          description="Tu buzón está temporalmente desactivado. Contacta al administrador."
        />
      </ScreenLayout>
    );
  }

  const sidebar = (
    <WebmailFolderSidebar
      folders={folders.data}
      quota={quota.data}
      currentFolder={currentFolder}
      onSelectFolder={handleSelectFolder}
      onCompose={() => navigation.navigate(MAIN_ROUTES.WEBMAIL_COMPOSE)}
      onNavigateArchive={
        canReadArchive ? () => navigation.navigate(MAIN_ROUTES.WEBMAIL_ARCHIVE) : undefined
      }
      emailAddress={status.data?.emailAddress}
    />
  );

  return (
    <ScreenLayout navigation={navigation}>
      <View style={styles.wrapper}>
        {isWide ? sidebar : null}

        <View style={{ flex: 1 }}>
          <View style={styles.topBar}>
            {!isWide ? (
              <TouchableOpacity onPress={() => setShowMobileFolders(true)} style={styles.iconBtn}>
                <Ionicons name="menu-outline" size={22} color={theme.color.icon.default} />
              </TouchableOpacity>
            ) : null}

            <View style={styles.titleBlock}>
              <Text style={styles.title}>{currentFolderLabel}</Text>
              <Text style={styles.subtitle}>
                {isSearching ? `Búsqueda: "${searchQuery}"` : `${data?.total ?? 0} mensajes`}
              </Text>
            </View>

            {inTrash && (data?.total ?? 0) > 0 ? (
              <Button
                title="Vaciar"
                leftIcon="trash-bin-outline"
                variant="danger"
                size="small"
                loading={emptyTrash.isPending}
                onPress={handleEmptyTrash}
              />
            ) : null}

            {!isWide ? (
              <TouchableOpacity
                onPress={() => navigation.navigate(MAIN_ROUTES.WEBMAIL_COMPOSE)}
                style={styles.iconBtn}
              >
                <Ionicons name="create-outline" size={22} color={theme.color.icon.accent} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={theme.color.icon.muted} />
            <TextInput
              placeholder='Buscar (de:, para:, asunto:, "frase", con:adjunto, no-leidos…)'
              placeholderTextColor={theme.color.text.placeholder}
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmitEditing={runSearch}
              returnKeyType="search"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchTerm ? (
              <TouchableOpacity onPress={clearSearch} hitSlop={6}>
                <Ionicons name="close-circle" size={18} color={theme.color.icon.muted} />
              </TouchableOpacity>
            ) : null}
            <Button title="Buscar" size="small" variant="secondary" onPress={runSearch} />
          </View>

          {activeQuery.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.color.icon.accent} />
            </View>
          ) : (
            <FlatList
              data={data?.messages ?? []}
              keyExtractor={(m) => `${m.uid}`}
              renderItem={renderItem}
              refreshControl={
                <RefreshControl
                  refreshing={activeQuery.isFetching}
                  onRefresh={() => activeQuery.refetch()}
                />
              }
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <EmptyState
                  icon={isSearching ? 'search-outline' : 'file-tray-outline'}
                  title={isSearching ? 'Sin resultados' : 'Sin mensajes'}
                  description={
                    isSearching
                      ? 'No encontramos correos que coincidan con tu búsqueda.'
                      : 'Esta carpeta está vacía.'
                  }
                />
              }
              ListFooterComponent={
                data && totalPages > 1 ? (
                  <View style={styles.pagination}>
                    <Button
                      title="Anterior"
                      variant="secondary"
                      size="small"
                      onPress={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    />
                    <Text style={styles.pageInfo}>
                      {page} / {totalPages}
                    </Text>
                    <Button
                      title="Siguiente"
                      variant="secondary"
                      size="small"
                      onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>

      {/* Sidebar móvil */}
      {!isWide ? (
        <Modal
          visible={showMobileFolders}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMobileFolders(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.mobileSidebar}>
              <View style={styles.mobileSidebarHeader}>
                <Text style={styles.mobileSidebarTitle}>Carpetas</Text>
                <TouchableOpacity onPress={() => setShowMobileFolders(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={theme.color.icon.default} />
                </TouchableOpacity>
              </View>
              {sidebar}
            </View>
            <Pressable style={styles.modalBackdrop} onPress={() => setShowMobileFolders(false)} />
          </View>
        </Modal>
      ) : null}

      {/* Modal mover a carpeta */}
      <Modal
        visible={!!moveTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveTarget(null)}
      >
        <View style={styles.centerModal}>
          <View style={styles.moveDialog}>
            <View style={styles.moveHeader}>
              <Text style={styles.moveTitle}>Mover a…</Text>
              <TouchableOpacity onPress={() => setMoveTarget(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.color.icon.default} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {(folders.data ? sortFolders(folders.data) : [])
                .filter((f) => f.path !== currentFolder)
                .map((f) => (
                  <TouchableOpacity
                    key={f.path}
                    style={styles.moveItem}
                    onPress={() => handleMoveTo(f.path)}
                    disabled={moveMsg.isPending}
                  >
                    <Ionicons name="folder-outline" size={18} color={theme.color.icon.muted} />
                    <Text style={styles.moveItemLabel}>{folderLabel(f)}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
};

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  theme: Theme;
  danger?: boolean;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, onPress, theme, danger }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ padding: 6, alignItems: 'center' }}
    accessibilityLabel={label}
    hitSlop={6}
  >
    <Ionicons
      name={icon}
      size={18}
      color={danger ? theme.color.icon.danger : theme.color.icon.muted}
    />
    {Platform.OS === 'web' ? null : null}
  </TouchableOpacity>
);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.color.background.canvas,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[3],
      gap: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    iconBtn: {
      padding: 4,
    },
    titleBlock: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    subtitle: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.color.text.body,
      paddingVertical: 6,
      outlineStyle: 'none' as any,
    },
    list: {
      padding: theme.space[3],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    rowPressed: {
      backgroundColor: theme.color.surface.hover,
    },
    rowUnread: {
      borderLeftWidth: 3,
      borderLeftColor: theme.color.brand.accent,
    },
    starBtn: {
      padding: 4,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
    },
    rowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    from: {
      flex: 1,
      color: theme.color.text.body,
      marginRight: 8,
      fontSize: 14,
    },
    date: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    subject: {
      color: theme.color.text.body,
      marginTop: 2,
      fontSize: 14,
    },
    rowFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    bold: { fontWeight: '700', color: theme.color.text.heading },
    semibold: { fontWeight: '600' },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.color.brand.accent,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    separator: {
      height: 8,
    },
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
      gap: theme.space[3],
    },
    pageInfo: {
      color: theme.color.text.body,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      flexDirection: 'row',
    },
    mobileSidebar: {
      width: 280,
      backgroundColor: theme.color.background.canvas,
      flex: 1,
    },
    mobileSidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    mobileSidebarTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
    },
    centerModal: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.overlay.medium,
      padding: theme.space[4],
    },
    moveDialog: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
    },
    moveHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[3],
    },
    moveTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    moveItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: theme.radii.md,
    },
    moveItemLabel: {
      fontSize: 14,
      color: theme.color.text.body,
    },
  });

export default WebmailInboxScreen;
