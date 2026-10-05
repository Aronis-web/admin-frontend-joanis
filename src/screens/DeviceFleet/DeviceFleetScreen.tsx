import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  compareVersions,
  deviceFleetApi,
  type DeviceFleetRow,
  type DeviceUpdateState,
} from '@/services/api/device-fleet';

const ONLINE_MS = 10 * 60_000;

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
 * Versiones de cajas (Configuracion > Otros).
 *
 * Cada CajaGrit de escritorio con acceso offline aprobado reporta su version,
 * su ultima conexion y sus ventas offline sin subir. Desde aqui se ordena
 * actualizar (se instala al cerrar CajaGrit) o forzar (se instala sola con
 * cuenta regresiva, nunca con una venta en curso ni con ventas sin subir).
 */
export const DeviceFleetScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const goBack = useGoBack();
  const [rows, setRows] = useState<DeviceFleetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await deviceFleetApi.list());
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar las cajas');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );
  useOnReload(() => load());

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Ultima version conocida: la mayor que reportan las cajas o su actualizador.
  const latestVersion = useMemo(() => {
    let latest: string | null = null;
    for (const row of rows) {
      for (const version of [row.device?.appVersion, row.device?.latestAvailableVersion]) {
        if (version && (!latest || compareVersions(version, latest) > 0)) latest = version;
      }
    }
    return latest;
  }, [rows]);

  const outdated = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.device &&
          latestVersion &&
          compareVersions(row.device.appVersion, latestVersion) < 0 &&
          !row.updateCommand
      ),
    [rows, latestVersion]
  );

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
          onPress: async () => {
            setBusy(true);
            try {
              const result = await deviceFleetApi.update(ids, force, minVersion);
              if (result.skipped.length) {
                Alert.alert(
                  'Listo',
                  `${result.queued.length} caja(s) recibirán la orden; ${result.skipped.length} ya estaban al día.`
                );
              }
              await load();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'No se pudo enviar la orden');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const cancel = async (row: DeviceFleetRow) => {
    setBusy(true);
    try {
      await deviceFleetApi.cancel(row.cashRegisterId);
      await load();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo cancelar la orden');
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (row: DeviceFleetRow) => {
    const device = row.device;
    const online = device ? Date.now() - new Date(device.lastSeenAt).getTime() < ONLINE_MS : false;
    const isOutdated =
      device && latestVersion ? compareVersions(device.appVersion, latestVersion) < 0 : false;
    const command = row.updateCommand;

    return (
      <View key={row.cashRegisterId} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.cardTitle}>
            {row.cashRegisterCode}
            {row.cashRegisterName ? ` · ${row.cashRegisterName}` : ''}
          </Text>
          {device ? (
            <Text style={[styles.version, isOutdated && styles.versionOutdated]}>
              v{device.appVersion}
            </Text>
          ) : null}
        </View>
        {row.siteName ? <Text style={styles.line}>Sede: {row.siteName}</Text> : null}

        {!row.hasDeviceToken ? (
          <Text style={styles.hint}>
            Sin acceso offline aprobado: no reporta. Apruébalo en Acceso offline de cajas.
          </Text>
        ) : !device ? (
          <Text style={styles.hint}>
            Todavía no reportó (necesita la nueva versión de CajaGrit).
          </Text>
        ) : (
          <>
            <Text style={styles.line}>
              {online ? 'En línea' : 'Sin conexión'} · visto {formatDate(device.lastSeenAt)}
            </Text>
            {device.pendingSales ? (
              <Text style={styles.warning}>{device.pendingSales} venta(s) offline sin subir</Text>
            ) : null}
          </>
        )}

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
            <TouchableOpacity disabled={busy} onPress={() => void cancel(row)}>
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
              <Text style={styles.forceText}>Forzar</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <GradientHeader
        onBack={goBack}
        title="Versiones de cajas"
        subtitle={latestVersion ? `Última versión: ${latestVersion}` : 'CajaGrit escritorio'}
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={contentWidthStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {outdated.length > 0 ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {outdated.length} caja(s) por debajo de {latestVersion}.
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.secondary]}
                disabled={busy}
                onPress={() =>
                  sendUpdate(
                    outdated.map((row) => row.cashRegisterId),
                    false,
                    `${outdated.length} caja(s)`
                  )
                }
              >
                <Text style={styles.secondaryText}>Actualizar todas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.force]}
                disabled={busy}
                onPress={() =>
                  sendUpdate(
                    outdated.map((row) => row.cashRegisterId),
                    true,
                    `${outdated.length} caja(s)`
                  )
                }
              >
                <Text style={styles.forceText}>Forzar todas</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.loading} color={theme.color.brand.primary} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>No hay cajas.</Text>
        ) : (
          rows.map(renderRow)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.background.subtle },
    content: { flex: 1, padding: 16 },
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
    line: { color: theme.color.text.body, marginTop: 2 },
    warning: { color: theme.color.state.warning.text, marginTop: 4, fontWeight: '600' },
    hint: { color: theme.color.text.muted, marginTop: 6, fontStyle: 'italic' },
    command: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    commandText: { flex: 1, color: theme.color.text.body },
    link: { color: theme.color.brand.primary, fontWeight: '700' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
    button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    secondary: { borderWidth: 1, borderColor: theme.color.border.default },
    secondaryText: { color: theme.color.text.body, fontWeight: '700' },
    force: { backgroundColor: theme.color.state.warning.border },
    forceText: { color: theme.color.text.inverse, fontWeight: '700' },
  });

export default DeviceFleetScreen;
