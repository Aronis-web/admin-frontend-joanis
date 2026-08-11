import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Button, EmptyState } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';
import { useWebmailArchive } from '@/hooks/api/useWebmail';
import { useOnReload } from '@/hooks/useOnReload';
import { webmailAdminApi } from '@/services/api/webmail';
import { saveAndShareFile } from '@/utils/fileDownload';
import type { ArchiveDirection, ArchiveItem } from '@/types/webmail';
import { formatBytes, formatMailDate, parseSender } from './folderUtils';

interface Props {
  navigation: any;
}

const PAGE_SIZE = 25;

type DirFilter = 'ALL' | ArchiveDirection;

const DIR_LABEL: Record<DirFilter, string> = {
  ALL: 'Todos',
  INBOUND: 'Entrantes',
  OUTBOUND: 'Salientes',
};

const DIR_ICON: Record<ArchiveDirection, keyof typeof Ionicons.glyphMap> = {
  INBOUND: 'arrow-down-circle-outline',
  OUTBOUND: 'arrow-up-circle-outline',
};

export const WebmailArchiveScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [direction, setDirection] = useState<DirFilter>('ALL');
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pendingFrom, setPendingFrom] = useState('');
  const [pendingSubject, setPendingSubject] = useState('');

  const params = useMemo(
    () => ({
      direction: direction === 'ALL' ? undefined : direction,
      from: from.trim() || undefined,
      subject: subject.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [direction, from, subject, page]
  );

  const query = useWebmailArchive(params);

  useOnReload(
    useCallback(() => {
      void query.refetch();
    }, [query])
  );

  const totalPages = useMemo(() => {
    if (!query.data) return 1;
    return Math.max(1, Math.ceil(query.data.total / PAGE_SIZE));
  }, [query.data]);

  const applyFilters = () => {
    setFrom(pendingFrom);
    setSubject(pendingSubject);
    setPage(1);
  };

  const clearFilters = () => {
    setPendingFrom('');
    setPendingSubject('');
    setFrom('');
    setSubject('');
    setDirection('ALL');
    setPage(1);
  };

  const handleDownload = async (item: ArchiveItem) => {
    try {
      setDownloadingId(item.id);
      const blob = await webmailAdminApi.downloadArchiveEml(item.id);
      const safeName = (item.subject || item.id).replace(/[^\w\-\s.]+/g, '_').slice(0, 80);
      await saveAndShareFile({
        blob,
        fileName: `${safeName}.eml`,
        mimeType: 'message/rfc822',
        dialogTitle: 'Compartir archivo .eml',
      });
    } catch (e: any) {
      logger.error('Error descargando .eml:', e);
      const msg = e?.response?.data?.message || e?.message || 'No se pudo descargar el archivo.';
      Alert.alert('Error', String(msg));
    } finally {
      setDownloadingId(null);
    }
  };

  const renderItem = ({ item }: { item: ArchiveItem }) => {
    const sender = parseSender(item.fromAddress);
    return (
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Ionicons
            name={DIR_ICON[item.direction]}
            size={22}
            color={
              item.direction === 'INBOUND' ? theme.color.icon.success : theme.color.icon.accent
            }
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowHeader}>
            <Text numberOfLines={1} style={styles.rowFrom}>
              {sender.name || sender.email}
            </Text>
            <Text style={styles.rowDate}>{formatMailDate(item.sentAt)}</Text>
          </View>
          <Text numberOfLines={1} style={styles.rowSubject}>
            {item.subject || '(sin asunto)'}
          </Text>
          <Text numberOfLines={1} style={styles.rowMeta}>
            {item.direction === 'INBOUND' ? 'Para:' : 'De:'}{' '}
            {item.direction === 'INBOUND' ? item.toAddresses : item.fromAddress} ·{' '}
            {formatBytes(item.sizeBytes)} · {item.source}
          </Text>
        </View>
        <Button
          title="Descargar .eml"
          leftIcon="download-outline"
          variant="secondary"
          size="small"
          loading={downloadingId === item.id}
          onPress={() => handleDownload(item)}
        />
      </View>
    );
  };

  return (
    <ScreenLayout navigation={navigation}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.color.icon.default} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Archivo histórico</Text>
          <Text style={styles.subtitle}>Auditoría inmutable de correos entrantes y salientes.</Text>
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.chips}>
          {(['ALL', 'INBOUND', 'OUTBOUND'] as DirFilter[]).map((d) => {
            const active = direction === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => {
                  setDirection(d);
                  setPage(1);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {DIR_LABEL[d]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterInputWrap}>
            <Ionicons name="person-outline" size={16} color={theme.color.icon.muted} />
            <TextInput
              value={pendingFrom}
              onChangeText={setPendingFrom}
              onSubmitEditing={applyFilters}
              placeholder="Remitente contiene…"
              placeholderTextColor={theme.color.text.placeholder}
              style={styles.filterInput}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.filterInputWrap}>
            <Ionicons name="text-outline" size={16} color={theme.color.icon.muted} />
            <TextInput
              value={pendingSubject}
              onChangeText={setPendingSubject}
              onSubmitEditing={applyFilters}
              placeholder="Asunto contiene…"
              placeholderTextColor={theme.color.text.placeholder}
              style={styles.filterInput}
            />
          </View>
          <Button title="Buscar" size="small" onPress={applyFilters} />
          <Button title="Limpiar" size="small" variant="ghost" onPress={clearFilters} />
        </View>
      </View>

      {query.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.color.icon.accent} />
        </View>
      ) : (
        <FlatList
          data={query.data?.items ?? []}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              icon="file-tray-outline"
              title="Sin resultados"
              description="Ajusta los filtros y vuelve a intentarlo."
            />
          }
          ListFooterComponent={
            query.data && totalPages > 1 ? (
              <View style={styles.pagination}>
                <Button
                  title="Anterior"
                  variant="secondary"
                  size="small"
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                />
                <Text style={styles.pageInfo}>
                  {page} / {totalPages} · {query.data.total} correos
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
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      padding: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    backBtn: { padding: 4 },
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
    filters: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
      gap: theme.space[3],
    },
    chips: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    chipActive: {
      backgroundColor: theme.color.brand.accentSoft,
      borderColor: theme.color.brand.accent,
    },
    chipText: {
      fontSize: 12,
      color: theme.color.text.body,
      fontWeight: '600',
    },
    chipTextActive: {
      color: theme.color.brand.accent,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    filterInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.base,
      flexGrow: 1,
      flexBasis: 200,
    },
    filterInput: {
      flex: 1,
      fontSize: 13,
      color: theme.color.text.body,
      paddingVertical: 4,
      outlineStyle: 'none' as any,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: {
      padding: theme.space[3],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      padding: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    rowIcon: {
      width: 32,
      alignItems: 'center',
    },
    rowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rowFrom: {
      flex: 1,
      color: theme.color.text.body,
      fontWeight: '700',
      fontSize: 14,
      marginRight: 8,
    },
    rowDate: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    rowSubject: {
      color: theme.color.text.body,
      fontSize: 13,
      marginTop: 2,
    },
    rowMeta: {
      color: theme.color.text.muted,
      fontSize: 11,
      marginTop: 4,
    },
    separator: { height: 8 },
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
      fontSize: 12,
    },
  });

export default WebmailArchiveScreen;
