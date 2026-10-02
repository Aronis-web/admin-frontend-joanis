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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { useSunatGre, useSunatGreInvoice, useImportSunatGre } from '@/hooks/api/useSunatGre';
import type { SunatGre } from '@/types/sunatGre';

type Props = NativeStackScreenProps<any, 'SunatGre'>;
type RolFilter = 'all' | 'emitida' | 'recibida';

const PAGE_SIZE = 50;

export const SunatGreScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [rol, setRol] = useState<RolFilter>('all');
  const [detailId, setDetailId] = useState<string | null>(null);

  const params = useMemo(
    () => ({ rol: rol === 'all' ? undefined : rol, limit: PAGE_SIZE, offset: 0 }),
    [rol]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useSunatGre(params);
  const importMut = useImportSunatGre();
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

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
      onPress={() => setRol(id)}
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
          />
        )}

        <GreDetailModal id={detailId} onClose={() => setDetailId(null)} />
      </SafeAreaView>
    </ScreenLayout>
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
