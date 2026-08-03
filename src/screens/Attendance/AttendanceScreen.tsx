import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { useAuthStore } from '@/store/auth';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes/defaultLight';
import logger from '@/utils/logger';
import { sitesApi } from '@/services/api/sites';
import type { Site } from '@/types/sites';
import type { AttendanceWorker, AttendanceWorkerStatus } from '@/types/attendance';
import {
  useActiveAttendanceWorkers,
  useFinishedAttendanceWorkers,
  getTodayLimaDate,
} from '@/hooks/api/useAttendanceWorkers';

interface AttendanceScreenProps {
  navigation: any;
}

type TabKey = 'active' | 'finished';

const STATUS_LABEL: Record<AttendanceWorkerStatus, string> = {
  working: 'Trabajando',
  on_break: 'En refrigerio',
  exit: 'Salida',
  early_exit: 'Salida anticipada',
};

const STATUS_ICON: Record<AttendanceWorkerStatus, keyof typeof Ionicons.glyphMap> = {
  working: 'walk-outline',
  on_break: 'cafe-outline',
  exit: 'log-out-outline',
  early_exit: 'alert-circle-outline',
};

/** Formatea una fecha ISO (UTC) a "HH:mm" en hora de Lima. */
const formatLimaTime = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
};

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { currentCompany, currentSite } = useAuthStore();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayLimaDate());
  const [selectedSiteId, setSelectedSiteId] = useState<string>(currentSite?.id ?? '');
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Cargar sedes de la empresa
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  const loadSites = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      setSitesLoading(true);
      const activeSites = await sitesApi.getActiveSites(currentCompany.id);
      setSites(activeSites);
      // Si no había sede seleccionada aún, tomar la primera disponible
      setSelectedSiteId((prev) => prev || activeSites[0]?.id || '');
    } catch (err) {
      logger.error('Error cargando sedes:', err);
    } finally {
      setSitesLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  const activeQuery = useActiveAttendanceWorkers({
    siteId: selectedSiteId,
    date: selectedDate,
  });
  const finishedQuery = useFinishedAttendanceWorkers({
    siteId: selectedSiteId,
    date: selectedDate,
  });

  const currentQuery = activeTab === 'active' ? activeQuery : finishedQuery;
  const workers = currentQuery.data?.workers ?? [];

  const isToday = selectedDate === getTodayLimaDate();

  const totals = useMemo(() => {
    const active = activeQuery.data?.total ?? 0;
    const finished = finishedQuery.data?.total ?? 0;
    return { active, finished, all: active + finished };
  }, [activeQuery.data, finishedQuery.data]);

  const handleRefresh = () => {
    void activeQuery.refetch();
    void finishedQuery.refetch();
  };

  const getStatusColor = (status: AttendanceWorkerStatus): string => {
    switch (status) {
      case 'working':
        return theme.color.icon.success;
      case 'on_break':
        return theme.color.icon.warning;
      case 'exit':
        return theme.color.text.muted;
      case 'early_exit':
        return theme.color.icon.danger;
      default:
        return theme.color.text.muted;
    }
  };

  const renderWorkerCard = (worker: AttendanceWorker) => {
    const statusColor = getStatusColor(worker.status);
    return (
      <View key={worker.userId} style={[styles.card, isTablet && styles.cardTablet]}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-outline" size={22} color={theme.color.brand.accent} />
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.workerName} numberOfLines={1}>
              {worker.fullName}
            </Text>
            <Text style={styles.workerMeta} numberOfLines={1}>
              @{worker.username}
              {worker.documentNumber ? ` · DNI ${worker.documentNumber}` : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name={STATUS_ICON[worker.status]} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABEL[worker.status] ?? worker.status}
            </Text>
          </View>
        </View>

        <View style={styles.hoursRow}>
          <View style={styles.hoursBlock}>
            <Text style={styles.hoursLabel}>Trabajadas</Text>
            <Text style={styles.hoursValue}>{worker.workedHoursLabel}</Text>
            <Text style={styles.hoursSub}>{worker.workedHours.toFixed(2)} h</Text>
          </View>
          <View style={styles.hoursDivider} />
          <View style={styles.hoursBlock}>
            <Text style={styles.hoursLabel}>Refrigerio</Text>
            <Text style={[styles.hoursValue, { color: theme.color.icon.warning }]}>
              {worker.breakHoursLabel}
            </Text>
            <Text style={styles.hoursSub}>{worker.breakHours.toFixed(2)} h</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="log-in-outline" size={14} color={theme.color.text.muted} />
          <Text style={styles.infoText}>
            Entrada: <Text style={styles.infoStrong}>{formatLimaTime(worker.firstEntry)}</Text>
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color={theme.color.text.muted} />
          <Text style={styles.infoText}>
            Último evento: <Text style={styles.infoStrong}>{worker.lastEvent?.code ?? '—'}</Text>{' '}
            <Text style={styles.infoDim}>({formatLimaTime(worker.lastEvent?.time)})</Text>
          </Text>
        </View>
        {!!worker.siteName && (
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={14} color={theme.color.text.muted} />
            <Text style={styles.infoText}>{worker.siteName}</Text>
          </View>
        )}
      </View>
    );
  };

  const noCompany = !currentCompany?.id;
  const noSite = !selectedSiteId;
  const isLoading =
    (activeTab === 'active' ? activeQuery.isLoading : finishedQuery.isLoading) && !!selectedSiteId;
  const isRefetching = activeQuery.isRefetching || finishedQuery.isRefetching;

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View style={styles.headerFlex}>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Asistencia
            </Text>
            <Text style={styles.headerSubtitle}>
              Trabajadores activos y jornadas del día (hora de Lima)
            </Text>
          </View>
        </View>

        {/* Filtros */}
        <View style={styles.filtersCard}>
          <View style={styles.filtersRow}>
            <View style={{ flex: 1 }}>
              <DatePickerButton
                label="Fecha"
                value={selectedDate}
                onPress={() => setDatePickerVisible(true)}
                icon="calendar-outline"
              />
            </View>
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() => setSelectedDate(getTodayLimaDate())}
            >
              <Ionicons name="today-outline" size={16} color={theme.color.text.onAction} />
              <Text style={styles.todayButtonText}>Hoy</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Sede</Text>
          {sitesLoading ? (
            <ActivityIndicator color={theme.color.brand.accent} style={{ marginVertical: 8 }} />
          ) : sites.length === 0 ? (
            <Text style={styles.emptyInline}>No hay sedes activas en esta empresa.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {sites.map((site) => {
                const selected = selectedSiteId === site.id;
                return (
                  <TouchableOpacity
                    key={site.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSelectedSiteId(site.id)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {site.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => setActiveTab('active')}
          >
            <Ionicons
              name="walk-outline"
              size={16}
              color={activeTab === 'active' ? theme.color.brand.accent : theme.color.text.muted}
            />
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Activos
            </Text>
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{totals.active}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'finished' && styles.tabActive]}
            onPress={() => setActiveTab('finished')}
          >
            <Ionicons
              name="log-out-outline"
              size={16}
              color={activeTab === 'finished' ? theme.color.brand.accent : theme.color.text.muted}
            />
            <Text style={[styles.tabText, activeTab === 'finished' && styles.tabTextActive]}>
              {isToday ? 'Ya salieron' : 'Terminaron'}
            </Text>
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{totals.finished}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {noCompany ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={56} color={theme.color.text.muted} />
            <Text style={styles.emptyTitle}>Sin empresa seleccionada</Text>
            <Text style={styles.emptyText}>Selecciona una empresa para ver la asistencia.</Text>
          </View>
        ) : noSite ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={56} color={theme.color.text.muted} />
            <Text style={styles.emptyTitle}>Selecciona una sede</Text>
            <Text style={styles.emptyText}>
              La asistencia se consulta por sede. Escoge una arriba para empezar.
            </Text>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={styles.loadingText}>Cargando asistencia...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
          >
            {currentQuery.error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={56} color={theme.color.icon.danger} />
                <Text style={styles.emptyTitle}>Error al cargar</Text>
                <Text style={styles.emptyText}>No se pudo cargar la asistencia.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={handleRefresh}>
                  <Text style={styles.emptyButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : workers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name={activeTab === 'active' ? 'people-outline' : 'log-out-outline'}
                  size={56}
                  color={theme.color.text.muted}
                />
                <Text style={styles.emptyTitle}>
                  {activeTab === 'active'
                    ? 'Nadie está trabajando'
                    : isToday
                      ? 'Aún nadie ha salido'
                      : 'Sin registros'}
                </Text>
                <Text style={styles.emptyText}>
                  {activeTab === 'active'
                    ? 'No hay trabajadores dentro ni en refrigerio en esta sede.'
                    : 'No hay trabajadores que hayan cerrado jornada.'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardsContainer}>{workers.map(renderWorkerCard)}</View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <DatePicker
        visible={datePickerVisible}
        date={(() => {
          const [y, m, d] = selectedDate.split('-').map(Number);
          return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
        })()}
        onConfirm={(date) => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          setSelectedDate(`${yyyy}-${mm}-${dd}`);
          setDatePickerVisible(false);
        }}
        onCancel={() => setDatePickerVisible(false)}
        title="Seleccionar fecha"
      />
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.color.text.muted,
    },
    header: {
      padding: 16,
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerTablet: {
      padding: 24,
    },
    headerFlex: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    headerTitleTablet: {
      fontSize: 30,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: 4,
    },
    filtersCard: {
      backgroundColor: theme.color.surface.base,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    filtersRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    todayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      marginBottom: 2,
    },
    todayButtonText: {
      color: theme.color.text.onAction,
      fontSize: 13,
      fontWeight: '600',
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginTop: 8,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    chipsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 2,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.color.surface.elevated,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    chipSelected: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    chipText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    chipTextSelected: {
      color: theme.color.text.onAction,
      fontWeight: '600',
    },
    emptyInline: {
      fontSize: 13,
      color: theme.color.text.muted,
      fontStyle: 'italic',
    },
    tabsRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      gap: 8,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    tabActive: {
      borderColor: theme.color.brand.accent,
      backgroundColor: `${theme.color.brand.accent}12`,
    },
    tabText: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    tabTextActive: {
      color: theme.color.brand.accent,
      fontWeight: '700',
    },
    tabBadge: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: theme.color.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.body,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    cardsContainer: {
      gap: 12,
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 14,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: 8,
    },
    cardTablet: {
      padding: 18,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatarCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${theme.color.brand.accent}18`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTexts: {
      flex: 1,
      minWidth: 0,
    },
    workerName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    workerMeta: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    hoursRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.elevated,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 8,
      marginTop: 4,
    },
    hoursBlock: {
      flex: 1,
      alignItems: 'center',
    },
    hoursDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: theme.color.border.subtle,
      marginHorizontal: 6,
    },
    hoursLabel: {
      fontSize: 11,
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    hoursValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.color.icon.success,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    hoursSub: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    infoText: {
      fontSize: 13,
      color: theme.color.text.body,
      flex: 1,
    },
    infoStrong: {
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    infoDim: {
      color: theme.color.text.muted,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginTop: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    emptyButton: {
      marginTop: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: theme.color.brand.accent,
      borderRadius: 8,
    },
    emptyButtonText: {
      color: theme.color.text.onAction,
      fontWeight: '600',
    },
  });

export default AttendanceScreen;
