import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { GradientHeader, contentWidthStyle } from '@/design-system/components';
import { useGoBack } from '@/hooks/useGoBack';
import { useOnReload } from '@/hooks/useOnReload';
import Alert from '@/utils/alert';
import {
  deviceFleetApi,
  type DeviceFilter,
  type DeviceFleetPage,
  type DeviceFleetRow,
  type DeviceUpdateState,
} from '@/services/api/device-fleet';
import { offlineAccessApi } from '@/services/api/offline-access';
import { CajaGritVersionsModal } from './CajaGritVersionsModal';

const PAGE_SIZE = 20;

const FILTERS: { key: DeviceFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'requests', label: 'Solicitudes' },
  { key: 'outdated', label: 'Desactualizadas' },
  { key: 'no_access', label: 'Sin acceso offline' },
  { key: 'online', label: 'En línea' },
  { key: 'offline', label: 'Sin conexión' },
  { key: 'pending_sales', label: 'Ventas sin subir' },
];

const STATE_LABEL: Record<DeviceUpdateState, string> = {
  received: 'Orden recibida',
  downloading: 'Descargando',
  downloaded: 'Descargada, se instala al cerrar CajaGrit',
  waiting: 'Esperando',
  installing: 'Instalando',
  'up-to-date': 'Al día',
  error: 'Error',
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '';

/**
 * Cajas: acceso offline y versiones (Configuracion > Otros).
 *
 * Una sola lista agrupada por sede: aprobar o rechazar las solicitudes de
 * acceso offline que hacen las cajas, ver version y conexion de cada PC, y
 * ordenar o forzar la actualizacion. Arriba, "Versiones" abre el modal para
 * revisar las versiones publicadas y subir un instalador nuevo.
 */
export const DeviceFleetScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const goBack = useGoBack();
  const [data, setData] = useState<DeviceFleetPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [versionsOpen, setVersionsOpen] = useState(false);

  // Buscar al dejar de escribir.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Cualquier cambio de filtro vuelve a la primera pagina.
  useEffect(() => {
    setPage(1);
  }, [filter, siteId, search]);

  const load = useCallback(async () => {
    try {
      setData(await deviceFleetApi.list({ page, limit: PAGE_SIZE, filter, siteId, search }));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar las cajas');
    } finally {
      setLoading(false);
    }
  }, [page, filter, siteId, search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  useOnReload(() => load());

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const latestVersion = data?.latestVersion ?? null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  // Agrupar la pagina actual por sede (el backend ya ordena por sede y codigo).
  const groups = useMemo(() => {
    const map = new Map<string, DeviceFleetRow[]>();
    for (const row of data?.items ?? []) {
      const key = row.siteName ?? 'Sin sede';
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [data]);

  const run = async (action: () => Promise<unknown>, failMessage: string) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (error: any) {
      Alert.alert('Error', error?.message || failMessage);
    } finally {
      setBusy(false);
    }
  };

  const decideAccess = (row: DeviceFleetRow, approve: boolean) => {
    const request = row.accessRequest;
    if (!request) return;
    Alert.alert(
      approve ? 'Aprobar acceso offline' : 'Rechazar solicitud',
      approve
        ? `La caja ${row.cashRegisterCode} podrá vender sin internet. El token se entrega directo a la caja.`
        : `La caja ${row.cashRegisterCode} no recibirá acceso offline.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: approve ? 'Aprobar' : 'Rechazar',
          style: approve ? 'default' : 'destructive',
          onPress: () =>
            void run(
              () =>
                approve
                  ? offlineAccessApi.approve(row.cashRegisterId, request.requestId)
                  : offlineAccessApi.reject(row.cashRegisterId, request.requestId),
              'No se pudo guardar la decisión'
            ),
        },
      ]
    );
  };

  const sendUpdate = (ids: string[], force: boolean, label: string) => {
    const minVersion = latestVersion ?? undefined;
    Alert.alert(
      force ? 'Forzar actualización' : 'Actualizar',
      force
        ? `${label} se actualizará${minVersion ? ` a ${minVersion}` : ''} apenas no haya una venta en curso ni ventas offline sin subir, con una cuenta regresiva de 60 s.`
        : `${label} descargará la actualización${minVersion ? ` a ${minVersion}` : ''} y la instalará al cerrar CajaGrit.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: force ? 'Forzar' : 'Actualizar',
          style: force ? 'destructive' : 'default',
          onPress: () =>
            void run(
              () => deviceFleetApi.update(ids, force, minVersion),
              'No se pudo enviar la orden'
            ),
        },
      ]
    );
  };

  // Todas las desactualizadas con los filtros de sede y busqueda (no solo esta pagina).
  const sendUpdateToOutdated = async (force: boolean) => {
    try {
      const outdated = await deviceFleetApi.list({
        filter: 'outdated',
        siteId,
        search,
        limit: 100,
      });
      const ids = outdated.items
        .filter((row) => row.hasDeviceToken && !row.updateCommand)
        .map((row) => row.cashRegisterId);
      if (!ids.length) {
        Alert.alert('Nada que actualizar', 'Las cajas desactualizadas ya tienen una orden.');
        return;
      }
      sendUpdate(ids, force, `${ids.length} caja(s)`);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar las cajas');
    }
  };

  const renderAccess = (row: DeviceFleetRow) => {
    const request = row.accessRequest;
    if (request?.status === 'PENDING') {
      return (
        <View style={styles.requestBox}>
          <Text style={styles.requestText}>
            Solicita acceso offline
            {request.requestedByName ? ` · ${request.requestedByName}` : ''} ·{' '}
            {formatDate(request.requestedAt)}
            {request.deviceLabel ? ` · ${request.deviceLabel}` : ''}
          </Text>
          {row.hasDeviceToken ? (
            <Text style={styles.hint}>
              Ya tiene acceso en otro equipo; al aprobar, este equipo usará el mismo.
            </Text>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.reject]}
              disabled={busy}
              onPress={() => decideAccess(row, false)}
            >
              <Text style={styles.rejectText}>Rechazar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.approve]}
              disabled={busy}
              onPress={() => decideAccess(row, true)}
            >
              <Text style={styles.approveText}>Aprobar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    if (request?.status === 'APPROVED') {
      return <Text style={styles.hint}>Aprobada: esperando que la caja retire su acceso.</Text>;
    }
    if (!row.hasDeviceToken) {
      return (
        <Text style={styles.hint}>
          Sin acceso offline
          {request?.status === 'REJECTED' ? ' (solicitud rechazada)' : ''}. Se pide desde CajaGrit,
          en Configuración &gt; Offline.
        </Text>
      );
    }
    return null;
  };

  const renderRow = (row: DeviceFleetRow) => {
    const device = row.device;
    const command = row.updateCommand;
    return (
      <View key={row.cashRegisterId} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.dot, row.online ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.cardTitle}>
            {row.cashRegisterCode}
            {row.cashRegisterName ? ` · ${row.cashRegisterName}` : ''}
          </Text>
          {device ? (
            <Text style={[styles.version, row.outdated && styles.versionOutdated]}>
              v{device.appVersion}
            </Text>
          ) : null}
        </View>

        {renderAccess(row)}

        {device ? (
          <>
            <Text style={styles.line}>
              {row.online ? 'En línea' : 'Sin conexión'} · visto {formatDate(device.lastSeenAt)}
            </Text>
            {device.pendingSales ? (
              <Text style={styles.warning}>{device.pendingSales} venta(s) offline sin subir</Text>
            ) : null}
          </>
        ) : row.hasDeviceToken ? (
          <Text style={styles.hint}>
            Todavía no reportó (necesita la nueva versión de CajaGrit).
          </Text>
        ) : null}

        {command ? (
          <View style={styles.command}>
            <Ionicons
              name={command.state === 'error' ? 'alert-circle' : 'cloud-download-outline'}
              size={16}
              color={
                command.state === 'error'
                  ? theme.color.state.danger.text
                  : theme.color.brand.primary
              }
            />
            <Text style={styles.commandText}>
              {command.force ? 'Forzar' : 'Actualizar'}
              {command.minVersion ? ` a ${command.minVersion}` : ''}:{' '}
              {command.state ? STATE_LABEL[command.state] : 'Pendiente de entregar'}
              {command.error ? ` (${command.error})` : ''}
            </Text>
            <TouchableOpacity
              disabled={busy}
              onPress={() =>
                void run(
                  () => deviceFleetApi.cancel(row.cashRegisterId),
                  'No se pudo cancelar la orden'
                )
              }
            >
              <Text style={styles.link}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : row.hasDeviceToken && device ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.secondary]}
              disabled={busy}
              onPress={() =>
                sendUpdate([row.cashRegisterId], false, `La caja ${row.cashRegisterCode}`)
              }
            >
              <Text style={styles.secondaryText}>Actualizar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.force]}
              disabled={busy}
              onPress={() =>
                sendUpdate([row.cashRegisterId], true, `La caja ${row.cashRegisterCode}`)
              }
            >
              <Text style={styles.forceText}>Forzar nueva versión</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const counts = data?.counts;

  return (
    <SafeAreaView style={styles.container}>
      <GradientHeader
        onBack={goBack}
        title="Cajas: acceso y versiones"
        subtitle={latestVersion ? `Última versión de CajaGrit: ${latestVersion}` : 'CajaGrit'}
        right={
          <TouchableOpacity style={styles.headerButton} onPress={() => setVersionsOpen(true)}>
            <Ionicons name="cloud-upload-outline" size={18} color={theme.color.brand.onHeader} />
            <Text style={styles.headerButtonText}>Versiones</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={contentWidthStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TextInput
          style={styles.search}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Buscar caja por código o nombre"
          placeholderTextColor={theme.color.text.placeholder}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, !siteId && styles.chipActive]}
            onPress={() => setSiteId(undefined)}
          >
            <Text style={[styles.chipText, !siteId && styles.chipTextActive]}>Todas las sedes</Text>
          </TouchableOpacity>
          {(data?.sites ?? []).map((site) => (
            <TouchableOpacity
              key={site.id}
              style={[styles.chip, siteId === site.id && styles.chipActive]}
              onPress={() => setSiteId(site.id)}
            >
              <Text style={[styles.chipText, siteId === site.id && styles.chipTextActive]}>
                {site.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.chipsWrap}>
          {FILTERS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.chip, filter === item.key && styles.chipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>
                {item.label}
                {counts ? ` (${counts[item.key]})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {counts && counts.outdated > 0 && latestVersion ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {counts.outdated} caja(s) por debajo de {latestVersion}.
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.secondary]}
                disabled={busy}
                onPress={() => void sendUpdateToOutdated(false)}
              >
                <Text style={styles.secondaryText}>Actualizar todas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.force]}
                disabled={busy}
                onPress={() => void sendUpdateToOutdated(true)}
              >
                <Text style={styles.forceText}>Forzar todas</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.loading} color={theme.color.brand.primary} />
        ) : groups.length === 0 ? (
          <Text style={styles.empty}>No hay cajas con estos filtros.</Text>
        ) : (
          groups.map(([siteName, rows]) => (
            <View key={siteName}>
              <Text style={styles.siteTitle}>{siteName}</Text>
              {rows.map(renderRow)}
            </View>
          ))
        )}

        {data && data.total > data.limit ? (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.button, styles.secondary, page <= 1 && styles.disabled]}
              disabled={page <= 1}
              onPress={() => setPage((value) => Math.max(1, value - 1))}
            >
              <Text style={styles.secondaryText}>Anterior</Text>
            </TouchableOpacity>
            <Text style={styles.pageText}>
              Página {page} de {totalPages} · {data.total} cajas
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.secondary, page >= totalPages && styles.disabled]}
              disabled={page >= totalPages}
              onPress={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              <Text style={styles.secondaryText}>Siguiente</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <CajaGritVersionsModal
        visible={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        onUploaded={() => void load()}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.background.subtle },
    content: { flex: 1, padding: 16 },
    headerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.color.brand.headerBadge,
    },
    headerButtonText: { color: theme.color.brand.onHeader, fontWeight: '700' },
    search: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: 8,
      padding: 10,
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
      marginBottom: 10,
    },
    chipsRow: { marginBottom: 8, flexGrow: 0 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
      marginRight: 8,
    },
    chipActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    chipText: { color: theme.color.text.body, fontWeight: '600' },
    chipTextActive: { color: theme.color.text.inverse },
    loading: { marginTop: 40 },
    empty: { marginTop: 40, textAlign: 'center', color: theme.color.text.muted },
    banner: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
      padding: 16,
      marginBottom: 16,
    },
    bannerText: { color: theme.color.text.heading, fontWeight: '600' },
    siteTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginTop: 8,
      marginBottom: 8,
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    dotOnline: { backgroundColor: theme.color.state.success.border },
    dotOffline: { backgroundColor: theme.color.border.default },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.color.text.heading },
    version: { fontWeight: '700', color: theme.color.text.body },
    versionOutdated: { color: theme.color.state.warning.text },
    requestBox: {
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
      borderRadius: 8,
      padding: 10,
      marginVertical: 6,
    },
    requestText: { color: theme.color.text.body, fontWeight: '600' },
    line: { color: theme.color.text.body, marginTop: 2 },
    warning: { color: theme.color.state.warning.text, marginTop: 4, fontWeight: '600' },
    hint: { color: theme.color.text.muted, marginTop: 6, fontStyle: 'italic' },
    command: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    commandText: { flex: 1, color: theme.color.text.body },
    link: { color: theme.color.brand.primary, fontWeight: '700' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
    button: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
    secondary: { borderWidth: 1, borderColor: theme.color.border.default },
    secondaryText: { color: theme.color.text.body, fontWeight: '700' },
    force: { backgroundColor: theme.color.state.warning.border },
    forceText: { color: theme.color.text.inverse, fontWeight: '700' },
    approve: { backgroundColor: theme.color.state.success.border },
    approveText: { color: theme.color.text.inverse, fontWeight: '700' },
    reject: { borderWidth: 1, borderColor: theme.color.state.danger.border },
    rejectText: { color: theme.color.state.danger.text, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 8,
      marginBottom: 24,
    },
    pageText: { color: theme.color.text.muted, flexShrink: 1, textAlign: 'center' },
  });

export default DeviceFleetScreen;
