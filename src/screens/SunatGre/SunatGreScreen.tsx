import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Pagination } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import {
  useSunatGre,
  useSunatGreInvoice,
  useImportSunatGre,
  useSyncRangeSunatGre,
} from '@/hooks/api/useSunatGre';
import type { SunatGre, SunatGreRun } from '@/types/sunatGre';

type Props = NativeStackScreenProps<any, 'SunatGre'>;
type RolFilter = 'all' | 'emitida' | 'recibida';

const PAGE_SIZE = 50;

export const SunatGreScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [rol, setRol] = useState<RolFilter>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ rol: rol === 'all' ? undefined : rol, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    [rol, page]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useSunatGre(params);
  const importMut = useImportSunatGre();
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectRol = useCallback((id: RolFilter) => {
    setRol(id);
    setPage(1);
  }, []);

  const handleImport = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/xml', 'application/xml', 'application/zip', 'application/x-zip-compressed'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const run = await importMut.mutateAsync({
        file: { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' },
      });
      Alert.alert(
        'Importación completada',
        `Estado: ${run.status}. Nuevos: ${run.newRows} · Dup: ${run.dupRows} · Errores: ${run.errorRows}.`
      );
      void refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo importar el archivo';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
      logger.error('Error import GRE', e);
    }
  }, [importMut, refetch]);

  const renderRow = useCallback(
    ({ item }: { item: SunatGre }) => (
      <TouchableOpacity style={styles.row} onPress={() => setDetailId(item.id)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <RNText style={styles.rowTitle}>
            {item.serie}-{item.numero}
          </RNText>
          <RNText style={styles.rowMeta} numberOfLines={1}>
            {item.rucEmisor} · {item.razonSocial || 'Sin razón social'}
          </RNText>
          <RNText style={styles.rowMeta}>
            {item.fechaEmision || 's/f'} · {item.rol}
          </RNText>
        </View>
        <View style={[styles.rolPill, item.rol === 'emitida' ? styles.rolEmitida : styles.rolRecibida]}>
          <RNText
            style={[
              styles.rolPillText,
              {
                color:
                  item.rol === 'emitida'
                    ? theme.color.state.info.text
                    : theme.color.state.success.text,
              },
            ]}
          >
            {item.rol === 'emitida' ? 'Emitida' : 'Recibida'}
          </RNText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.color.icon.muted} />
      </TouchableOpacity>
    ),
    [styles, theme]
  );

  const renderChip = (id: RolFilter, label: string) => (
    <TouchableOpacity
      style={[styles.chip, rol === id && styles.chipActive]}
      onPress={() => selectRol(id)}
    >
      <RNText style={[styles.chipText, rol === id && styles.chipTextActive]}>{label}</RNText>
    </TouchableOpacity>
  );

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <Ionicons name="car-outline" size={22} color={theme.color.brand.onHeader} />
            <View style={{ flex: 1 }}>
              <RNText style={styles.headerTitle}>Guías de Remisión (GRE)</RNText>
              <RNText style={styles.headerSubtitle}>{total} guías</RNText>
            </View>
            <TouchableOpacity style={styles.importBtn} onPress={() => setSyncOpen(true)}>
              <Ionicons name="sync-outline" size={16} color={theme.color.brand.onHeader} />
              <RNText style={styles.importBtnText}>Sincronizar</RNText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.importBtn} onPress={handleImport} disabled={importMut.isPending}>
              {importMut.isPending ? (
                <ActivityIndicator size="small" color={theme.color.brand.onHeader} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={16} color={theme.color.brand.onHeader} />
              )}
              <RNText style={styles.importBtnText}>Importar</RNText>
            </TouchableOpacity>
          </View>
          <View style={styles.chipsRow}>
            {renderChip('all', 'Todas')}
            {renderChip('emitida', 'Emitidas')}
            {renderChip('recibida', 'Recibidas')}
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <RNText style={styles.errorText}>{(error as Error)?.message ?? 'No se pudo cargar'}</RNText>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <RNText style={styles.retryBtnText}>Reintentar</RNText>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="file-tray-outline" size={40} color={theme.color.icon.muted} />
            <RNText style={styles.emptyText}>Sin guías. Importa un XML/ZIP de GRE para empezar.</RNText>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={renderRow}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
            ListFooterComponent={
              total > PAGE_SIZE ? (
                <View style={styles.paginationWrap}>
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={total}
                    itemsPerPage={PAGE_SIZE}
                    onPageChange={setPage}
                    loading={isFetching}
                    variant="full"
                  />
                </View>
              ) : null
            }
          />
        )}

        <GreDetailModal id={detailId} onClose={() => setDetailId(null)} />
        <GreSyncModal
          visible={syncOpen}
          onClose={() => setSyncOpen(false)}
          onDone={() => {
            void refetch();
          }}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

// ============================================================================
// Sync modal (datos anteriores por rango de fecha, descarga headless SEE-SOL)
// ============================================================================

const todayIso = () => new Date().toISOString().slice(0, 10);

const summarizeRuns = (runs: SunatGreRun[]): string => {
  const nuevos = runs.reduce((a, r) => a + (r.newRows || 0), 0);
  const dup = runs.reduce((a, r) => a + (r.dupRows || 0), 0);
  const err = runs.reduce((a, r) => a + (r.errorRows || 0), 0);
  const conError = runs.filter((r) => r.status === 'error').length;
  let s = `Ventanas: ${runs.length}. Nuevos: ${nuevos} · Dup: ${dup} · Errores: ${err}.`;
  if (conError > 0) {
    const msg = runs.find((r) => r.status === 'error')?.errorMsg;
    s += `\n${conError} ventana(s) con error.${msg ? ` Ej: ${msg.slice(0, 160)}` : ''}`;
  }
  return s;
};

const GreSyncModal: React.FC<{ visible: boolean; onClose: () => void; onDone: () => void }> = ({
  visible,
  onClose,
  onDone,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const syncMut = useSyncRangeSunatGre();

  const year = new Date().getFullYear();
  const [desde, setDesde] = useState(`${year}-01-01`);
  const [hasta, setHasta] = useState(todayIso());
  const [rol, setRol] = useState<'all' | 'emitida' | 'recibida'>('all');

  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

  const handleSync = useCallback(async () => {
    if (!isValidDate(desde) || !isValidDate(hasta)) {
      Alert.alert('Fechas inválidas', 'Usa el formato AAAA-MM-DD en ambas fechas.');
      return;
    }
    if (desde.trim() > hasta.trim()) {
      Alert.alert('Rango inválido', 'La fecha desde no puede ser mayor que la fecha hasta.');
      return;
    }
    try {
      const res = await syncMut.mutateAsync({
        fechaDesde: desde.trim(),
        fechaHasta: hasta.trim(),
        rol: rol === 'all' ? undefined : rol,
      });
      Alert.alert('Sincronización completada', summarizeRuns(res.runs ?? []));
      onDone();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo sincronizar';
      const status = e?.response?.status;
      const stillRunning =
        status === 524 || status === 504 || e?.code === 'ECONNABORTED' || /timeout|524|504/i.test(String(msg));
      if (stillRunning) {
        Alert.alert(
          'Sincronización en progreso',
          'Un rango amplio tarda y sigue corriendo en el servidor. Revisa las guías y las corridas en unos minutos.'
        );
        onDone();
        onClose();
      } else {
        Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
      }
      logger.error('Error sync GRE', e);
    }
  }, [desde, hasta, rol, syncMut, onClose, onDone]);

  const renderRolChip = (id: 'all' | 'emitida' | 'recibida', label: string) => (
    <TouchableOpacity
      style={[styles.syncChip, rol === id && styles.syncChipActive]}
      onPress={() => setRol(id)}
    >
      <RNText style={[styles.syncChipText, rol === id && styles.syncChipTextActive]}>{label}</RNText>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.syncModal}>
          <View style={styles.modalHeader}>
            <RNText style={styles.modalTitle}>Sincronizar GRE (datos anteriores)</RNText>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }} disabled={syncMut.isPending}>
              <Ionicons name="close" size={22} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
            <RNText style={styles.syncHint}>
              Descarga desde SEE-SOL por rango de fecha (máx. 30 días por consulta; se trocea
              automáticamente). Rangos largos pueden tardar varios minutos.
            </RNText>
            <View>
              <RNText style={styles.syncLabel}>Fecha desde</RNText>
              <TextInput
                style={styles.syncInput}
                value={desde}
                onChangeText={setDesde}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={theme.color.text.muted}
                autoCapitalize="none"
              />
            </View>
            <View>
              <RNText style={styles.syncLabel}>Fecha hasta</RNText>
              <TextInput
                style={styles.syncInput}
                value={hasta}
                onChangeText={setHasta}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={theme.color.text.muted}
                autoCapitalize="none"
              />
            </View>
            <View>
              <RNText style={styles.syncLabel}>Rol</RNText>
              <View style={styles.syncChipsRow}>
                {renderRolChip('all', 'Ambas')}
                {renderRolChip('emitida', 'Emitidas')}
                {renderRolChip('recibida', 'Recibidas')}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.syncSubmit, syncMut.isPending && styles.syncSubmitDisabled]}
              onPress={handleSync}
              disabled={syncMut.isPending}
            >
              {syncMut.isPending ? (
                <>
                  <ActivityIndicator size="small" color={theme.color.action.primary.text} />
                  <RNText style={styles.syncSubmitText}>Sincronizando…</RNText>
                </>
              ) : (
                <>
                  <Ionicons name="sync-outline" size={18} color={theme.color.action.primary.text} />
                  <RNText style={styles.syncSubmitText}>Sincronizar</RNText>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const GreDetailModal: React.FC<{ id: string | null; onClose: () => void }> = ({ id, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, isLoading } = useSunatGreInvoice(id ?? undefined);

  return (
    <Modal visible={!!id} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <RNText style={styles.modalTitle} numberOfLines={1}>
              {data ? `${data.serie}-${data.numero}` : 'Guía de remisión'}
            </RNText>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          </View>

          {isLoading || !data ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={theme.color.brand.accent} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: theme.space[4], gap: theme.space[3] }}>
              <View style={styles.detailCard}>
                <DetailRow label="Rol" value={data.rol} />
                <DetailRow label="Emisor" value={`${data.rucEmisor} · ${data.razonSocial}`} />
                <DetailRow label="Fecha emisión" value={data.fechaEmision || '—'} />
                <DetailRow label="Motivo" value={data.motivo || '—'} />
                <DetailRow label="Partida" value={data.puntoPartida || '—'} />
                <DetailRow label="Llegada" value={data.puntoLlegada || '—'} />
                <DetailRow label="Estado" value={data.estado || '—'} />
              </View>

              <RNText style={styles.sectionLabel}>Bienes ({data.items.length})</RNText>
              {data.items.length === 0 ? (
                <RNText style={styles.rowMeta}>Sin bienes.</RNText>
              ) : (
                data.items.map((it) => (
                  <View key={it.id} style={styles.itemCard}>
                    <RNText style={styles.itemDesc}>
                      {it.linea}. {it.descripcion || 'Sin descripción'}
                    </RNText>
                    <RNText style={styles.rowMeta}>
                      {it.codigo ? `Cód. ${it.codigo} · ` : ''}
                      {it.cantidad} {it.unidad || ''}
                    </RNText>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailRow}>
      <RNText style={styles.detailLabel}>{label}</RNText>
      <RNText style={styles.detailValue} numberOfLines={2}>
        {value}
      </RNText>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.surface.subtle },
    header: { paddingHorizontal: theme.space[4], paddingTop: theme.space[4], paddingBottom: theme.space[4], gap: theme.space[3] },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
    headerTitle: { fontSize: 18, fontWeight: '800', color: theme.color.brand.onHeader },
    headerSubtitle: { fontSize: 12, color: theme.color.brand.onHeader, opacity: 0.85, marginTop: 2 },
    importBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: theme.space[3],
      paddingVertical: 8,
      borderRadius: theme.radii.lg,
    },
    importBtnText: { color: theme.color.brand.onHeader, fontSize: 12, fontWeight: '700' },
    chipsRow: { flexDirection: 'row', gap: theme.space[2] },
    chip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    chipActive: { backgroundColor: theme.color.brand.onHeader },
    chipText: { fontSize: 12, fontWeight: '600', color: theme.color.brand.onHeader },
    chipTextActive: { color: theme.color.brand.accent },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space[3], padding: theme.space[4] },
    emptyText: { fontSize: 13, color: theme.color.text.muted, textAlign: 'center' },
    errorText: { fontSize: 13, color: theme.color.state.danger.text, textAlign: 'center' },
    retryBtn: {
      backgroundColor: theme.color.action.primary.background,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
    },
    retryBtnText: { color: theme.color.action.primary.text, fontWeight: '700' },
    listContent: { padding: theme.space[3], gap: theme.space[2] },
    paginationWrap: { paddingTop: theme.space[3] },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: theme.space[3],
    },
    rowTitle: { fontSize: 14, fontWeight: '700', color: theme.color.text.heading },
    rowMeta: { fontSize: 11, color: theme.color.text.muted, marginTop: 1 },
    rolPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    rolEmitida: { backgroundColor: theme.color.state.info.background },
    rolRecibida: { backgroundColor: theme.color.state.success.background },
    rolPillText: { fontSize: 10, fontWeight: '700' },
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Platform.OS === 'web' ? 24 : 12,
    },
    modal: {
      width: '100%',
      maxWidth: 640,
      height: '85%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalTitle: { fontSize: 16, fontWeight: '700', color: theme.color.text.heading, flex: 1 },
    syncModal: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    syncHint: { fontSize: 12, color: theme.color.text.muted, lineHeight: 17 },
    syncLabel: { fontSize: 12, fontWeight: '700', color: theme.color.text.heading, marginBottom: 6 },
    syncInput: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      fontSize: 14,
      color: theme.color.text.heading,
    },
    syncChipsRow: { flexDirection: 'row', gap: theme.space[2] },
    syncChip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    syncChipActive: {
      backgroundColor: theme.color.action.primary.background,
      borderColor: theme.color.action.primary.background,
    },
    syncChipText: { fontSize: 12, fontWeight: '600', color: theme.color.text.body },
    syncChipTextActive: { color: theme.color.action.primary.text },
    syncSubmit: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.action.primary.background,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.space[3],
      marginTop: theme.space[2],
    },
    syncSubmitDisabled: { opacity: 0.6 },
    syncSubmitText: { color: theme.color.action.primary.text, fontWeight: '800', fontSize: 14 },
    detailCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      gap: theme.space[2],
    },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.space[3] },
    detailLabel: { fontSize: 12, color: theme.color.text.muted },
    detailValue: { fontSize: 12, color: theme.color.text.body, flexShrink: 1, textAlign: 'right' },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: theme.color.text.heading },
    itemCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      gap: 2,
    },
    itemDesc: { fontSize: 13, fontWeight: '600', color: theme.color.text.heading },
  });

export default SunatGreScreen;
