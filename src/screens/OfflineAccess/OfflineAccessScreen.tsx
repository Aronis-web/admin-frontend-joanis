import React, { useCallback, useState } from 'react';
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
  offlineAccessApi,
  type OfflineAccessRequest,
  type OfflineAccessStatus,
} from '@/services/api/offline-access';

const TABS: { status: OfflineAccessStatus; label: string }[] = [
  { status: 'PENDING', label: 'Pendientes' },
  { status: 'APPROVED', label: 'Aprobadas' },
  { status: 'DELIVERED', label: 'Entregadas' },
  { status: 'REJECTED', label: 'Rechazadas' },
];

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '';

/**
 * Acceso offline de cajas (Configuracion > Otros).
 *
 * La caja pide acceso offline desde CajaGrit; aqui se aprueba o rechaza.
 * Al aprobar, la caja retira su token directamente con un codigo que solo
 * ella conoce: el token nunca pasa por esta pantalla.
 */
export const OfflineAccessScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const goBack = useGoBack();
  const [status, setStatus] = useState<OfflineAccessStatus>('PENDING');
  const [requests, setRequests] = useState<OfflineAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await offlineAccessApi.list(status));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  }, [status]);

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

  const decide = (item: OfflineAccessRequest, decision: 'approve' | 'reject') => {
    const approve = decision === 'approve';
    Alert.alert(
      approve ? 'Aprobar acceso offline' : 'Rechazar solicitud',
      approve
        ? `La caja ${item.cashRegisterCode} podrá vender sin internet. El token se entrega directo a la caja.`
        : `La caja ${item.cashRegisterCode} no recibirá acceso offline.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: approve ? 'Aprobar' : 'Rechazar',
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(item.requestId);
            try {
              if (approve) {
                await offlineAccessApi.approve(item.cashRegisterId, item.requestId);
              } else {
                await offlineAccessApi.reject(item.cashRegisterId, item.requestId);
              }
              await load();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'No se pudo guardar la decisión');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = (item: OfflineAccessRequest) => (
    <View key={item.requestId} style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="desktop-outline" size={20} color={theme.color.brand.primary} />
        <Text style={styles.cardTitle}>
          {item.cashRegisterCode}
          {item.cashRegisterName ? ` · ${item.cashRegisterName}` : ''}
        </Text>
      </View>
      {item.siteName ? <Text style={styles.line}>Sede: {item.siteName}</Text> : null}
      <Text style={styles.line}>
        Solicitado por {item.requestedByName || 'usuario desconocido'} el{' '}
        {formatDate(item.requestedAt)}
      </Text>
      {item.deviceLabel ? <Text style={styles.line}>Equipo: {item.deviceLabel}</Text> : null}
      {item.decidedAt ? (
        <Text style={styles.line}>Resuelto el {formatDate(item.decidedAt)}</Text>
      ) : null}
      {item.deliveredAt ? (
        <Text style={styles.line}>Token entregado el {formatDate(item.deliveredAt)}</Text>
      ) : null}
      {item.status === 'PENDING' && item.hasDeviceToken ? (
        <Text style={styles.hint}>
          Esta caja ya tiene acceso offline en otro equipo; al aprobar, este equipo usará el mismo.
        </Text>
      ) : null}
      {item.status === 'APPROVED' ? (
        <Text style={styles.hint}>Esperando que la caja retire su acceso.</Text>
      ) : null}

      {item.status === 'PENDING' ? (
        <View style={styles.actions}>
          {busyId === item.requestId ? (
            <ActivityIndicator color={theme.color.brand.primary} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.reject]}
                onPress={() => decide(item, 'reject')}
              >
                <Text style={styles.rejectText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.approve]}
                onPress={() => decide(item, 'approve')}
              >
                <Text style={styles.approveText}>Aprobar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <GradientHeader
        onBack={goBack}
        title="Acceso offline de cajas"
        subtitle="Aprueba las cajas que pueden vender sin internet"
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={contentWidthStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.status}
              style={[styles.tab, status === tab.status && styles.tabActive]}
              onPress={() => setStatus(tab.status)}
            >
              <Text style={[styles.tabText, status === tab.status && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loading} color={theme.color.brand.primary} />
        ) : requests.length === 0 ? (
          <Text style={styles.empty}>No hay solicitudes en esta lista.</Text>
        ) : (
          requests.map(renderItem)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.background.subtle },
    content: { flex: 1, padding: 16 },
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    tab: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    tabActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    tabText: { color: theme.color.text.body, fontWeight: '600' },
    tabTextActive: { color: theme.color.text.inverse },
    loading: { marginTop: 40 },
    empty: { marginTop: 40, textAlign: 'center', color: theme.color.text.muted },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.color.text.heading },
    line: { color: theme.color.text.body, marginTop: 2 },
    hint: { color: theme.color.text.muted, marginTop: 8, fontStyle: 'italic' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
    button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    approve: { backgroundColor: theme.color.state.success.border },
    approveText: { color: theme.color.text.inverse, fontWeight: '700' },
    reject: { borderWidth: 1, borderColor: theme.color.state.danger.border },
    rejectText: { color: theme.color.state.danger.text, fontWeight: '700' },
  });

export default OfflineAccessScreen;
