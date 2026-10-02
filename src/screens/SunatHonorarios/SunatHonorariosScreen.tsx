import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import {
  useSunatHonorarios,
  useSunatHonorariosSummary,
  useImportSunatHonorarios,
} from '@/hooks/api/useSunatHonorarios';
import type { SunatHonorario } from '@/types/sunatHonorarios';

type Props = NativeStackScreenProps<any, 'SunatHonorarios'>;

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

const normPeriodo = (v: string): string | undefined => {
  const t = v.replace(/\D/g, '');
  return /^\d{6}$/.test(t) ? t : undefined;
};

export const SunatHonorariosScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [periodo, setPeriodo] = useState('');
  const [appliedPeriodo, setAppliedPeriodo] = useState<string | undefined>(undefined);

  const params = useMemo(
    () => ({ periodo: appliedPeriodo, limit: PAGE_SIZE, offset: 0 }),
    [appliedPeriodo]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useSunatHonorarios(params);
  const { data: summary } = useSunatHonorariosSummary(appliedPeriodo);
  const importMut = useImportSunatHonorarios();

  const items = data?.items ?? [];

  const apply = useCallback(() => setAppliedPeriodo(normPeriodo(periodo)), [periodo]);

  const handleImport = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
          'application/octet-stream',
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const run = await importMut.mutateAsync({
        file: { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' },
        periodo: normPeriodo(periodo),
      });
      Alert.alert(
        'Importación completada',
        `Estado: ${run.status}. Nuevos: ${run.newRows} · Dup: ${run.dupRows} · Errores: ${run.errorRows}.`
      );
      void refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo importar el archivo';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
      logger.error('Error import honorarios', e);
    }
  }, [importMut, periodo, refetch]);

  const renderRow = useCallback(
    ({ item }: { item: SunatHonorario }) => (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <RNText style={styles.rowTitle}>
            {item.serie}-{item.numero}
          </RNText>
          <RNText style={styles.rowMeta} numberOfLines={1}>
            {item.rucEmisor} · {item.nombreEmisor || 'Sin nombre'}
          </RNText>
          <RNText style={styles.rowMeta}>
            {item.fechaEmision} · periodo {item.perTributario}
          </RNText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <RNText style={styles.rowAmount}>{fmtMoney(item.montoNeto, item.moneda)}</RNText>
          <RNText style={styles.rowMeta}>
            Bruto {fmtMoney(item.montoBruto, item.moneda)}
          </RNText>
          <RNText style={[styles.rowMeta, { color: theme.color.state.danger.text }]}>
            Ret. {fmtMoney(item.retencionRenta, item.moneda)}
          </RNText>
        </View>
      </View>
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
            <Ionicons name="person-outline" size={22} color={theme.color.brand.onHeader} />
            <View style={{ flex: 1 }}>
              <RNText style={styles.headerTitle}>Honorarios 4ta (RxH)</RNText>
              <RNText style={styles.headerSubtitle}>
                {summary ? `${summary.count} recibos` : 'Recibos por honorarios'}
              </RNText>
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

          {summary ? (
            <View style={styles.summaryStrip}>
              <SummaryTile label="Bruto" value={fmtMoney(summary.totalBruto)} />
              <SummaryTile label="Retención" value={fmtMoney(summary.totalRetencion)} />
              <SummaryTile label="Neto" value={fmtMoney(summary.totalNeto)} />
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.filters}>
          <TextInput
            style={styles.search}
            placeholder="Periodo AAAAMM (opcional)…"
            placeholderTextColor={theme.color.text.muted}
            value={periodo}
            onChangeText={setPeriodo}
            onSubmitEditing={apply}
            keyboardType="number-pad"
            returnKeyType="search"
            maxLength={6}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={apply}>
            <Ionicons name="search" size={18} color={theme.color.action.primary.text} />
          </TouchableOpacity>
        </View>

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
            <RNText style={styles.emptyText}>
              Sin honorarios. Importa el Registro de Retenciones (.txt) o un Excel.
            </RNText>
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
      </SafeAreaView>
    </ScreenLayout>
  );
};

const SummaryTile: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.summaryTile}>
      <RNText style={styles.summaryLabel}>{label}</RNText>
      <RNText style={styles.summaryValue} numberOfLines={1}>
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
    summaryStrip: { flexDirection: 'row', gap: theme.space[2] },
    summaryTile: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
    },
    summaryLabel: { fontSize: 11, color: theme.color.brand.onHeader, opacity: 0.85 },
    summaryValue: { fontSize: 14, fontWeight: '800', color: theme.color.brand.onHeader, marginTop: 2 },
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
  });

export default SunatHonorariosScreen;
