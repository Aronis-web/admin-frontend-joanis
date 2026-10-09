/**
 * Conciliacion de pagos: se suben estados de cuenta (Excel de BBVA o BCP, o
 * fotos de la lista de movimientos de la app del banco) y cada abono se cruza
 * con los vouchers de las clientas: con pedido, pago sin pedido o abono sin
 * voucher (plata que llego y el ERP no tiene).
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  Text,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import { pickFilesForUpload, type PickedFile } from '@/components/Drive/pickFileCrossPlatform';
import {
  chatbotReconciliationApi,
  type ReconcileHistoryItem,
  type ReconcileKind,
  type ReconcileResult,
} from '@/services/api/chatbot-reconciliation';
import { saveAndShareFile } from '@/utils/fileDownload';
import Alert from '@/utils/alert';

type Props = NativeStackScreenProps<any, 'ChatbotReconciliation'>;

const soles = (c: number) =>
  `S/ ${(c / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const KIND_LABEL: Record<ReconcileKind, string> = {
  SIN_VOUCHER: 'Sin voucher en el ERP',
  SIN_PEDIDO: 'Pago sin pedido',
  CON_PEDIDO: 'Con pedido',
};
const KIND_VARIANT: Record<ReconcileKind, 'danger' | 'warning' | 'success'> = {
  SIN_VOUCHER: 'danger',
  SIN_PEDIDO: 'warning',
  CON_PEDIDO: 'success',
};
const FILTERS = [
  { label: 'Por revisar', value: 'review' },
  { label: 'Sin voucher', value: 'SIN_VOUCHER' },
  { label: 'Sin pedido', value: 'SIN_PEDIDO' },
  { label: 'Con pedido', value: 'CON_PEDIDO' },
  { label: 'Todos', value: 'all' },
];

export const ChatbotReconciliationScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('review');
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [histPage, setHistPage] = useState(1);
  const [hist, setHist] = useState<{
    items: ReconcileHistoryItem[];
    page: number;
    pages: number;
    total: number;
  } | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  const loadHistory = async (page: number) => {
    setHistLoading(true);
    try {
      setHist(await chatbotReconciliationApi.history(page, 20));
      setHistPage(page);
    } catch (err: any) {
      Alert.alert('No se pudo cargar el historial', err?.message ?? 'Intenta de nuevo.');
    } finally {
      setHistLoading(false);
    }
  };

  const openHistory = async (id: string) => {
    setLoading(true);
    try {
      setResult(await chatbotReconciliationApi.get(id));
      setFiles([]);
      setFilter('review');
      setTab('new');
    } catch (err: any) {
      Alert.alert('No se pudo abrir', err?.message ?? 'Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const download = async (id: string, fileId: string, name: string) => {
    try {
      const blob = await chatbotReconciliationApi.downloadFile(id, fileId);
      await saveAndShareFile({
        blob,
        fileName: name,
        mimeType: blob.type || 'application/octet-stream',
        dialogTitle: name,
      });
    } catch (err: any) {
      Alert.alert('No se pudo descargar', err?.message ?? 'Intenta de nuevo.');
    }
  };

  const pick = async () => {
    const picked = await pickFilesForUpload({ multiple: true });
    if (!picked.length) return;
    setFiles((prev) => [...prev, ...picked]);
    setResult(null);
  };

  const run = async () => {
    if (!files.length) return;
    setLoading(true);
    try {
      setResult(await chatbotReconciliationApi.reconcile(files));
      setFilter('review');
    } catch (err: any) {
      Alert.alert('No se pudo cruzar', err?.message ?? 'Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const lines = useMemo(() => {
    const all = result?.lines ?? [];
    if (filter === 'all') return all;
    if (filter === 'review') return all.filter((l) => l.kind !== 'CON_PEDIDO');
    return all.filter((l) => l.kind === filter);
  }, [result, filter]);

  const t = result?.totals;

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="git-compare-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.headerTitle}>Conciliación de pagos</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Sube los estados de cuenta y cruza cada abono con los vouchers del chatbot
          </Text>
        </LinearGradient>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <ChipGroup
            options={[
              { label: 'Nueva conciliación', value: 'new' },
              { label: 'Historial', value: 'history' },
            ]}
            selected={[tab]}
            onChange={(sel) => {
              const next = sel[0] as 'new' | 'history' | undefined;
              if (!next) return;
              setTab(next);
              if (next === 'history') loadHistory(1);
            }}
            multiple={false}
          />
          {tab === 'history' ? (
            histLoading && !hist ? (
              <ActivityIndicator />
            ) : !hist?.items.length ? (
              <EmptyState
                icon="time-outline"
                title="Sin conciliaciones"
                description="Aquí aparecen las cargas que se crucen, con sus archivos."
              />
            ) : (
              <>
                {hist.items.map((h) => (
                  <Card key={h.id} style={styles.card}>
                    <View style={styles.lineHeader}>
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontWeight: '700' }}>
                          {new Date(h.createdAt).toLocaleString('es-PE')}
                        </Body>
                        <Caption color={theme.color.text.muted}>
                          {h.createdBy ?? 'Sin usuario'} · {h.fileCount} archivo
                          {h.fileCount === 1 ? '' : 's'} · {h.totals?.credits ?? 0} abonos ·{' '}
                          {soles(h.totals?.creditsCents ?? 0)}
                        </Caption>
                      </View>
                      {h.totals?.missing ? (
                        <Badge variant="danger" label={`${h.totals.missing} sin voucher`} />
                      ) : (
                        <Badge variant="success" label="Todo con voucher" />
                      )}
                    </View>
                    {h.files.map((sf) => (
                      <View key={sf.id} style={styles.fileRow}>
                        <Ionicons
                          name={
                            /\.(jpe?g|png|webp)$/i.test(sf.name)
                              ? 'image-outline'
                              : 'document-outline'
                          }
                          size={18}
                          color={theme.color.text.muted}
                        />
                        <Caption style={{ flex: 1 }} numberOfLines={1}>
                          {sf.name}
                          {sf.error ? ` · ${sf.error}` : ` · ${sf.credits} abonos`}
                        </Caption>
                        <Button
                          title="Descargar"
                          size="small"
                          variant="ghost"
                          leftIcon="download-outline"
                          onPress={() => download(h.id, sf.id, sf.name)}
                        />
                      </View>
                    ))}
                    <View style={styles.actionsRow}>
                      <Button
                        title="Ver resultado"
                        size="small"
                        variant="outline"
                        leftIcon="eye-outline"
                        onPress={() => openHistory(h.id)}
                      />
                    </View>
                  </Card>
                ))}
                <View style={styles.pagerRow}>
                  <Button
                    title="Anterior"
                    size="small"
                    variant="ghost"
                    leftIcon="chevron-back-outline"
                    disabled={histPage <= 1 || histLoading}
                    onPress={() => loadHistory(histPage - 1)}
                  />
                  <Caption color={theme.color.text.muted}>
                    Página {hist.page} de {hist.pages} · {hist.total} cargas
                  </Caption>
                  <Button
                    title="Siguiente"
                    size="small"
                    variant="ghost"
                    rightIcon="chevron-forward-outline"
                    disabled={histPage >= hist.pages || histLoading}
                    onPress={() => loadHistory(histPage + 1)}
                  />
                </View>
              </>
            )
          ) : (
            <>
              {result?.storedFiles?.length && result.id ? (
                <Card style={styles.card}>
                  <Body style={{ fontWeight: '700' }}>
                    Carga del{' '}
                    {result.createdAt ? new Date(result.createdAt).toLocaleString('es-PE') : ''}
                  </Body>
                  {result.storedFiles.map((sf) => (
                    <View key={sf.id} style={styles.fileRow}>
                      <Caption style={{ flex: 1 }} numberOfLines={1}>
                        {sf.name}
                      </Caption>
                      <Button
                        title="Descargar"
                        size="small"
                        variant="ghost"
                        leftIcon="download-outline"
                        onPress={() => download(result.id!, sf.id, sf.name)}
                      />
                    </View>
                  ))}
                </Card>
              ) : null}
              <Card style={styles.card}>
                <Body style={{ fontWeight: '700' }}>Estados de cuenta</Body>
                <Caption color={theme.color.text.muted}>
                  Excel de BBVA (Movimientos del día, .xls), Excel de BCP (.xlsx) o fotos de la
                  lista de movimientos de la app del banco. Puedes subir varios a la vez; si las
                  fotos se repiten, los movimientos se cuentan una sola vez.
                </Caption>
                {files.map((f, i) => (
                  <View key={`${f.name}-${i}`} style={styles.fileRow}>
                    <Ionicons
                      name={
                        /\.(jpe?g|png|webp)$/i.test(f.name) ? 'image-outline' : 'document-outline'
                      }
                      size={18}
                      color={theme.color.text.muted}
                    />
                    <Body style={{ flex: 1 }} numberOfLines={1}>
                      {f.name}
                    </Body>
                    <Button
                      title="Quitar"
                      size="small"
                      variant="ghost"
                      onPress={() => {
                        setFiles((prev) => prev.filter((_, j) => j !== i));
                        setResult(null);
                      }}
                    />
                  </View>
                ))}
                <View style={styles.actionsRow}>
                  <Button
                    title="Agregar archivos"
                    size="small"
                    variant="outline"
                    leftIcon="cloud-upload-outline"
                    onPress={pick}
                  />
                  <Button
                    title={loading ? 'Cruzando…' : 'Cruzar con el ERP'}
                    size="small"
                    leftIcon="git-compare-outline"
                    disabled={!files.length || loading}
                    onPress={run}
                  />
                </View>
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator />
                    <Caption color={theme.color.text.muted}>
                      Leyendo los archivos (las fotos tardan un poco más)…
                    </Caption>
                  </View>
                ) : null}
              </Card>

              {result?.files?.length ? (
                <Card style={styles.card}>
                  <Body style={{ fontWeight: '700' }}>Archivos leídos</Body>
                  {result.files.map((f) => (
                    <View key={f.name} style={styles.fileRow}>
                      <Ionicons
                        name={f.error ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                        size={18}
                        color={f.error ? theme.color.text.muted : theme.color.brand.accent}
                      />
                      <Caption style={{ flex: 1 }} numberOfLines={2}>
                        {f.name}:{' '}
                        {f.error ? f.error : `${f.credits} abonos de ${f.movements} movimientos`}
                      </Caption>
                    </View>
                  ))}
                </Card>
              ) : result?.errors.length ? (
                <Card style={styles.card}>
                  {result.errors.map((e) => (
                    <Caption key={e} color={theme.color.text.danger ?? theme.color.text.muted}>
                      ⚠️ {e}
                    </Caption>
                  ))}
                </Card>
              ) : null}

              {t ? (
                <Card style={styles.card}>
                  <Body style={{ fontWeight: '700' }}>
                    {t.credits} abonos · {soles(t.creditsCents)}
                  </Body>
                  <View style={styles.badgesRow}>
                    <Badge
                      variant="success"
                      label={`Con pedido: ${t.withOrder} · ${soles(t.withOrderCents)}`}
                    />
                    <Badge
                      variant="warning"
                      label={`Pago sin pedido: ${t.withoutOrder} · ${soles(t.withoutOrderCents)}`}
                    />
                    <Badge
                      variant="danger"
                      label={`Sin voucher: ${t.missing} · ${soles(t.missingCents)}`}
                    />
                  </View>
                  {t.debitsCents ? (
                    <Caption color={theme.color.text.muted}>
                      Cargos del periodo (no se cruzan): {soles(t.debitsCents)}
                    </Caption>
                  ) : null}
                </Card>
              ) : null}

              {result ? (
                <>
                  <ChipGroup
                    options={FILTERS}
                    selected={[filter]}
                    onChange={(sel) => sel[0] && setFilter(sel[0])}
                    multiple={false}
                  />
                  {lines.length === 0 ? (
                    <EmptyState
                      icon="checkmark-done-outline"
                      title="Nada por revisar"
                      description="Todos los abonos de este filtro están cubiertos."
                    />
                  ) : (
                    lines.map((l, i) => (
                      <Card key={`${l.source}-${l.operation ?? i}-${i}`} style={styles.card}>
                        <View style={styles.lineHeader}>
                          <View style={{ flex: 1 }}>
                            <Body style={{ fontWeight: '700' }}>{soles(l.amountCents)}</Body>
                            <Caption color={theme.color.text.muted}>
                              {l.date}
                              {l.time ? ` ${l.time}` : ''} · {l.description}
                              {l.operation ? ` · op. ${l.operation}` : ''}
                            </Caption>
                          </View>
                          <Badge variant={KIND_VARIANT[l.kind]} label={KIND_LABEL[l.kind]} />
                        </View>
                        {l.voucher ? (
                          <Caption>
                            {l.voucher.customer ?? 'Sin nombre'}
                            {l.voucher.orderNo
                              ? ` · pedido ${l.voucher.orderNo} (${l.voucher.orderStatus})`
                              : ` · voucher ${l.voucher.status}`}
                          </Caption>
                        ) : (
                          <Caption color={theme.color.text.muted}>
                            Nadie mandó un voucher por este monto: búscalo por el nombre del
                            pagador.
                          </Caption>
                        )}
                        {l.voucher && l.kind !== 'CON_PEDIDO' ? (
                          <View style={styles.actionsRow}>
                            <Button
                              title="Ver chat"
                              size="small"
                              variant="ghost"
                              leftIcon="chatbubbles-outline"
                              onPress={() =>
                                navigation.navigate('ChatbotChatDetail', {
                                  conversationId: l.voucher!.conversationId,
                                })
                              }
                            />
                            <Button
                              title="Ficha"
                              size="small"
                              variant="outline"
                              leftIcon="person-outline"
                              onPress={() =>
                                navigation.navigate('ChatbotSupportCustomer', {
                                  conversationId: l.voucher!.conversationId,
                                })
                              }
                            />
                          </View>
                        ) : null}
                        <Caption color={theme.color.text.muted}>{l.source}</Caption>
                      </Card>
                    ))
                  )}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.color.brand.headerFrom },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[1] },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    scrollView: { flex: 1, backgroundColor: theme.color.background.subtle },
    scrollContent: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },
    card: { padding: spacing[3], gap: spacing[2] },
    fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    lineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
    pagerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
  });
