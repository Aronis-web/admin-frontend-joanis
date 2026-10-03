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
  useSunatCpeInvoices,
  useSunatCpeInvoice,
  useImportSunatCpe,
  useSyncRangeSunatCpe,
} from '@/hooks/api/useSunatCpe';
import type { SunatCpeInvoice, SunatCpeRun } from '@/types/sunatCpe';

type Props = NativeStackScreenProps<any, 'SunatCpe'>;

const CPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'N. Crédito',
  '08': 'N. Débito',
};

const PAGE_SIZE = 50;

const fmtMoney = (amount?: string, currency = 'PEN') => {
  const n = Number(amount ?? 0);
  if (Number.isNaN(n)) return amount ?? '-';
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

export const SunatCpeScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [rucEmisor, setRucEmisor] = useState('');
  const [appliedRuc, setAppliedRuc] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ rucEmisor: appliedRuc || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    [appliedRuc, page]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useSunatCpeInvoices(params);
  const importMut = useImportSunatCpe();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applySearch = useCallback(() => {
    setAppliedRuc(rucEmisor.trim());
    setPage(1);
  }, [rucEmisor]);

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
      logger.error('Error import CPE', e);
    }
  }, [importMut, refetch]);

  const renderRow = useCallback(
    ({ item }: { item: SunatCpeInvoice }) => (
      <TouchableOpacity style={styles.row} onPress={() => setDetailId(item.id)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <RNText style={styles.rowTitle}>
            {(CPE_LABELS[item.tipoCpe] || `Tipo ${item.tipoCpe}`)} {item.serie}-{item.numero}
          </RNText>
          <RNText style={styles.rowMeta} numberOfLines={1}>
            {item.rucEmisor} · {item.razonSocialEmisor || 'Sin razón social'}
          </RNText>
          <RNText style={styles.rowMeta}>{item.fechaEmision}</RNText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <RNText style={styles.rowAmount}>{fmtMoney(item.importeTotal, item.moneda)}</RNText>
          <RNText style={styles.rowMeta}>IGV {fmtMoney(item.igv, item.moneda)}</RNText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.color.icon.muted} />
      </TouchableOpacity>
    ),
    [styles, theme]
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
            <Ionicons name="receipt-outline" size={22} color={theme.color.brand.onHeader} />
            <View style={{ flex: 1 }}>
              <RNText style={styles.headerTitle}>CPE recibidos</RNText>
              <RNText style={styles.headerSubtitle}>{total} comprobantes · con detalle de líneas</RNText>
            </View>
            <TouchableOpacity style={styles.importBtn} onPress={() => setSyncOpen(true)}>
              <Ionicons name="sync-outline" size={16} color={theme.color.brand.onHeader} />
              <RNText style={styles.importBtnText}>Sincronizar</RNText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.importBtn}
              onPress={handleImport}
              disabled={importMut.isPending}
            >
              {importMut.isPending ? (
                <ActivityIndicator size="small" color={theme.color.brand.onHeader} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={16} color={theme.color.brand.onHeader} />
              )}
              <RNText style={styles.importBtnText}>Importar</RNText>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.filters}>
          <TextInput
            style={styles.search}
            placeholder="Filtrar por RUC del emisor…"
            placeholderTextColor={theme.color.text.muted}
            value={rucEmisor}
            onChangeText={setRucEmisor}
            onSubmitEditing={applySearch}
            keyboardType="number-pad"
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={applySearch}>
            <Ionicons name="search" size={18} color={theme.color.action.primary.text} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <RNText style={styles.errorText}>
              {(error as Error)?.message ?? 'No se pudo cargar'}
            </RNText>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <RNText style={styles.retryBtnText}>Reintentar</RNText>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="file-tray-outline" size={40} color={theme.color.icon.muted} />
            <RNText style={styles.emptyText}>Sin CPE recibidos. Importa un XML/ZIP para empezar.</RNText>
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

        <CpeDetailModal id={detailId} onClose={() => setDetailId(null)} />
        <CpeSyncModal
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
// Sync modal (datos anteriores por rango de periodos AAAAMM, headless SEE-SOL)
// ============================================================================

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const summarizeCpeRuns = (runs: SunatCpeRun[]): string => {
  const nuevos = runs.reduce((a, r) => a + (r.newRows || 0), 0);
  const dup = runs.reduce((a, r) => a + (r.dupRows || 0), 0);
  const err = runs.reduce((a, r) => a + (r.errorRows || 0), 0);
  const conError = runs.filter((r) => r.status === 'error').length;
  let s = `Periodos: ${runs.length}. Nuevos: ${nuevos} · Dup: ${dup} · Errores: ${err}.`;
  if (runs.length === 0) {
    s = 'No había comprobantes pendientes de detalle en el rango indicado.';
  }
  if (conError > 0) {
    const msg = runs.find((r) => r.status === 'error')?.errorMsg;
    s += `\n${conError} periodo(s) con error.${msg ? ` Ej: ${msg.slice(0, 160)}` : ''}`;
  }
  return s;
};

const CpeSyncModal: React.FC<{ visible: boolean; onClose: () => void; onDone: () => void }> = ({
  visible,
  onClose,
  onDone,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const syncMut = useSyncRangeSunatCpe();

  const year = new Date().getFullYear();
  const [desde, setDesde] = useState(`${year}01`);
  const [hasta, setHasta] = useState(currentPeriod());

  const isValidPer = (s: string) => /^\d{6}$/.test(s.trim());

  const handleSync = useCallback(async () => {
    if (!isValidPer(desde) || !isValidPer(hasta)) {
      Alert.alert('Periodos inválidos', 'Usa el formato AAAAMM (ej. 202401) en ambos campos.');
      return;
    }
    if (desde.trim() > hasta.trim()) {
      Alert.alert('Rango inválido', 'El periodo desde no puede ser mayor que el periodo hasta.');
      return;
    }
    try {
      const res = await syncMut.mutateAsync({ perDesde: desde.trim(), perHasta: hasta.trim() });
      Alert.alert('Sincronización completada', summarizeCpeRuns(res.runs ?? []));
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
          'El proceso tarda y sigue corriendo en el servidor. Revisa los comprobantes y las corridas en unos minutos.'
        );
        onDone();
        onClose();
      } else {
        Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
      }
      logger.error('Error sync CPE', e);
    }
  }, [desde, hasta, syncMut, onClose, onDone]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.syncModal}>
          <View style={styles.modalHeader}>
            <RNText style={styles.modalTitle}>Sincronizar CPE (datos anteriores)</RNText>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }} disabled={syncMut.isPending}>
              <Ionicons name="close" size={22} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
            <RNText style={styles.syncHint}>
              Trae el detalle de líneas desde SEE-SOL para los comprobantes que ya están en el
              registro de compras (RCE) y aún no tienen detalle, mes a mes. Rangos amplios pueden
              tardar varios minutos.
            </RNText>
            <View>
              <RNText style={styles.syncLabel}>Periodo desde (AAAAMM)</RNText>
              <TextInput
                style={styles.syncInput}
                value={desde}
                onChangeText={setDesde}
                placeholder="202401"
                placeholderTextColor={theme.color.text.muted}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <View>
              <RNText style={styles.syncLabel}>Periodo hasta (AAAAMM)</RNText>
              <TextInput
                style={styles.syncInput}
                value={hasta}
                onChangeText={setHasta}
                placeholder="202412"
                placeholderTextColor={theme.color.text.muted}
                keyboardType="number-pad"
                maxLength={6}
              />
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

// ============================================================================
// Detail modal (cabecera + lineas)
// ============================================================================

const CpeDetailModal: React.FC<{ id: string | null; onClose: () => void }> = ({ id, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, isLoading } = useSunatCpeInvoice(id ?? undefined);

  return (
    <Modal visible={!!id} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <RNText style={styles.modalTitle} numberOfLines={1}>
              {data ? `${data.serie}-${data.numero}` : 'Comprobante'}
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
                <DetailRow label="Emisor" value={`${data.rucEmisor} · ${data.razonSocialEmisor}`} />
                <DetailRow label="Fecha emisión" value={data.fechaEmision} />
                <DetailRow label="Moneda" value={data.moneda} />
                <DetailRow label="Gravado" value={fmtMoney(data.totalGravado, data.moneda)} />
                <DetailRow label="IGV" value={fmtMoney(data.igv, data.moneda)} />
                <DetailRow label="Exonerado" value={fmtMoney(data.exonerado, data.moneda)} />
                <DetailRow label="Inafecto" value={fmtMoney(data.inafecto, data.moneda)} />
                <DetailRow label="Total" value={fmtMoney(data.importeTotal, data.moneda)} strong />
              </View>

              <RNText style={styles.sectionLabel}>Detalle de líneas ({data.items.length})</RNText>
              {data.items.length === 0 ? (
                <RNText style={styles.rowMeta}>Sin líneas.</RNText>
              ) : (
                data.items.map((it) => (
                  <View key={it.id} style={styles.itemCard}>
                    <RNText style={styles.itemDesc}>
                      {it.linea}. {it.descripcion || 'Sin descripción'}
                    </RNText>
                    <RNText style={styles.rowMeta}>
                      {it.codigo ? `Cód. ${it.codigo} · ` : ''}
                      {it.cantidad} {it.unidad || ''} × {fmtMoney(it.valorUnitario, data.moneda)}
                    </RNText>
                    <View style={styles.itemAmounts}>
                      <RNText style={styles.rowMeta}>Valor {fmtMoney(it.valorVenta, data.moneda)}</RNText>
                      <RNText style={styles.rowMeta}>IGV {fmtMoney(it.igv, data.moneda)}</RNText>
                      <RNText style={styles.itemImporte}>{fmtMoney(it.importe, data.moneda)}</RNText>
                    </View>
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

const DetailRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailRow}>
      <RNText style={styles.detailLabel}>{label}</RNText>
      <RNText style={[styles.detailValue, strong && styles.detailValueStrong]} numberOfLines={2}>
        {value}
      </RNText>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.surface.subtle },
    header: { paddingHorizontal: theme.space[4], paddingTop: theme.space[4], paddingBottom: theme.space[4] },
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
    filters: { flexDirection: 'row', gap: theme.space[2], padding: theme.space[3] },
    search: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      fontSize: 14,
      color: theme.color.text.heading,
    },
    searchBtn: {
      backgroundColor: theme.color.action.primary.background,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.space[4],
      justifyContent: 'center',
    },
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
    rowAmount: { fontSize: 14, fontWeight: '700', color: theme.color.text.heading },
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
      height: '88%',
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
    detailValueStrong: { fontWeight: '800', color: theme.color.text.heading, fontSize: 14 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: theme.color.text.heading },
    itemCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      gap: 2,
    },
    itemDesc: { fontSize: 13, fontWeight: '600', color: theme.color.text.heading },
    itemAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, alignItems: 'center' },
    itemImporte: { fontSize: 13, fontWeight: '700', color: theme.color.text.heading },
  });

export default SunatCpeScreen;
