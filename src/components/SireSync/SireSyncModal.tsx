/**
 * SireSyncModal
 *
 * Modal reutilizable para disparar y monitorear la sincronización de la
 * propuesta SUNAT (SIRE Compras · RCE / Ventas · RVIE).
 *
 * Permite:
 *   - Sincronizar un rango de períodos (POST /sire-<mod>/sync-range, tanda por tanda).
 *   - Sincronizar un único período (POST /sire-<mod>/sync).
 *   - Ver el estado de la corrida activa mediante polling de `GET /runs/active`.
 *   - Revisar el historial de corridas con su estado ok/partial/error por período
 *     (`GET /runs`).
 *
 * Es agnóstico del módulo: recibe un adaptador `api` (sireComprasApi o
 * sireVentasApi) cuyas firmas son estructuralmente compatibles.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import {
  QuickDateRangeField,
  getDefaultQuickDateRange,
  type QuickDateRangeValue,
} from '@/components/common/QuickDateRangeField';

// ============================================================================
// Tipos (subset común entre SireRun y SireVentasRun)
// ============================================================================

export type SireSyncRunStatus = 'running' | 'ok' | 'partial' | 'error';

export interface SireSyncRun {
  id: string;
  status: SireSyncRunStatus;
  perTributario: string;
  totalRows?: number;
  newRows?: number;
  dupRows?: number;
  errorRows?: number;
  startedAt: string;
  finishedAt?: string | null;
  errorMsg?: string | null;
}

export interface SireSyncApi {
  syncPeriodo(body: { periodo?: string }): Promise<SireSyncRun>;
  syncRange(body: { perIni: string; perFin: string }): Promise<SireSyncRun>;
  getActiveRun(): Promise<{ active: SireSyncRun | null }>;
  getRuns(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: SireSyncRun[]; total: number; limit: number; offset: number }>;
  getRun(id: string): Promise<SireSyncRun>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  api: SireSyncApi;
  /** Título del modal, ej. "Sincronizar Ventas (RVIE)". */
  title: string;
  /** Se dispara cuando el estado de las corridas cambió (para invalidar queries). */
  onRunsChanged?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 3000;
const HISTORY_PAGE_SIZE = 12;

type Tab = 'sync' | 'history';

// ============================================================================
// Utils
// ============================================================================

/** Deriva el período AAAAMM a partir de una fecha ISO (YYYY-MM-DD). */
const periodoFromIso = (iso: string): string => iso.slice(0, 4) + iso.slice(5, 7);

const formatPeriodo = (per?: string): string => {
  if (!per || per.length !== 6) return per ?? '—';
  return `${per.slice(0, 4)}-${per.slice(4, 6)}`;
};

const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const statusColor = (status: SireSyncRunStatus, theme: Theme): string => {
  switch (status) {
    case 'ok':
      return theme.color.state.success.text;
    case 'partial':
      return theme.color.state.warning.text;
    case 'error':
      return theme.color.state.danger.text;
    case 'running':
    default:
      return theme.color.state.info.text;
  }
};

const statusLabel = (status: SireSyncRunStatus): string => {
  switch (status) {
    case 'ok':
      return 'Completado';
    case 'partial':
      return 'Parcial';
    case 'error':
      return 'Error';
    case 'running':
      return 'En curso';
    default:
      return status;
  }
};

// ============================================================================
// Component
// ============================================================================

export const SireSyncModal: React.FC<Props> = ({ visible, onClose, api, title, onRunsChanged }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [tab, setTab] = useState<Tab>('sync');

  // ---- Form state ----
  const [dateRange, setDateRange] = useState<QuickDateRangeValue>(getDefaultQuickDateRange);

  // ---- Data state ----
  const [activeRun, setActiveRun] = useState<SireSyncRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [history, setHistory] = useState<SireSyncRun[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  // ==========================================================================
  // Loaders
  // ==========================================================================

  const loadHistory = useCallback(
    async (pageArg?: number) => {
      const page = pageArg ?? 0;
      setLoadingHistory(true);
      try {
        const res = await api.getRuns({
          limit: HISTORY_PAGE_SIZE,
          offset: page * HISTORY_PAGE_SIZE,
        });
        setHistory(res.items);
        setHistoryTotal(res.total);
        setHistoryPage(page);
      } catch (err) {
        logger.error('Error cargando historial de corridas SIRE', err);
      } finally {
        setLoadingHistory(false);
      }
    },
    [api]
  );

  // ==========================================================================
  // Polling del run activo
  // ==========================================================================

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollingRef.current = false;
  }, []);

  const pollActive = useCallback(async () => {
    if (!pollingRef.current) return;
    try {
      const res = await api.getActiveRun();
      setActiveRun(res.active);
      if (res.active) {
        pollTimerRef.current = setTimeout(pollActive, POLL_INTERVAL_MS);
      } else {
        // Terminó: refrescamos historial e invalidamos queries externas.
        pollingRef.current = false;
        void loadHistory(0);
        onRunsChanged?.();
      }
    } catch (err) {
      logger.error('Error en poll de run activo SIRE', err);
      pollingRef.current = false;
    }
  }, [api, loadHistory, onRunsChanged]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = true;
    void pollActive();
  }, [pollActive, stopPolling]);

  // ==========================================================================
  // Effects
  // ==========================================================================

  useEffect(() => {
    if (visible) {
      setDateRange(getDefaultQuickDateRange());
      void loadHistory(0);
      startPolling();
    } else {
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const isBusy = starting || !!activeRun;

  const handleSync = useCallback(async () => {
    if (isBusy) return;

    const perIni = periodoFromIso(dateRange.fromDate);
    const perFin = periodoFromIso(dateRange.toDate);

    setStarting(true);
    try {
      if (perIni === perFin) {
        await api.syncPeriodo({ periodo: perIni });
      } else {
        await api.syncRange({ perIni, perFin });
      }
      onRunsChanged?.();
      startPolling();
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      if (status === 409) {
        Alert.alert(
          'Sincronización en curso',
          'Ya hay una corrida activa. Espera a que termine antes de disparar otra.'
        );
        startPolling();
      } else {
        const msg = data?.message || e?.message || 'No se pudo iniciar la sincronización';
        Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
        logger.error('Error al iniciar sync SIRE', e);
      }
    } finally {
      setStarting(false);
    }
  }, [api, isBusy, dateRange, onRunsChanged, startPolling]);

  // ==========================================================================
  // Render helpers
  // ==========================================================================

  const renderTabButton = (id: Tab, label: string, iconName: keyof typeof Ionicons.glyphMap) => {
    const active = tab === id;
    return (
      <TouchableOpacity
        key={id}
        style={[styles.tabButton, active && styles.tabButtonActive]}
        onPress={() => setTab(id)}
      >
        <Ionicons
          name={iconName}
          size={16}
          color={active ? theme.color.brand.accent : theme.color.icon.muted}
        />
        <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderRunCard = (run: SireSyncRun) => {
    const color = statusColor(run.status, theme);
    return (
      <View style={styles.runCard}>
        <View style={styles.runCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.runCardTitle}>Período {formatPeriodo(run.perTributario)}</Text>
            <Text style={styles.runCardMeta}>
              {formatDateTime(run.startedAt)}
              {run.finishedAt ? ` · fin ${formatDateTime(run.finishedAt)}` : ''}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: color }]}>
            <Text style={[styles.statusPillText, { color }]}>{statusLabel(run.status)}</Text>
          </View>
        </View>

        {run.status === 'running' && (
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarFill, { backgroundColor: color }]} />
          </View>
        )}

        <View style={styles.runCountsRow}>
          <Text style={styles.runCounts}>
            Total: <Text style={styles.runCountsStrong}>{run.totalRows ?? 0}</Text>
          </Text>
          <Text style={[styles.runCounts, { color: theme.color.state.success.text }]}>
            Nuevas: <Text style={styles.runCountsStrong}>{run.newRows ?? 0}</Text>
          </Text>
          <Text style={[styles.runCounts, { color: theme.color.text.muted }]}>
            Dup: <Text style={styles.runCountsStrong}>{run.dupRows ?? 0}</Text>
          </Text>
          <Text style={[styles.runCounts, { color: theme.color.state.danger.text }]}>
            Err: <Text style={styles.runCountsStrong}>{run.errorRows ?? 0}</Text>
          </Text>
        </View>

        {!!run.errorMsg && <Text style={styles.errorText}>{run.errorMsg}</Text>}
      </View>
    );
  };

  // ==========================================================================
  // Tabs
  // ==========================================================================

  const renderSyncTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Selector de rango (estilo dashboard, por defecto "Este mes") */}
      <View style={styles.section}>
        <QuickDateRangeField
          label="Períodos a sincronizar"
          value={dateRange}
          onChange={setDateRange}
          disabled={isBusy}
          maximumDate={new Date()}
        />
        <Text style={styles.hintText}>
          Se sincronizarán los períodos (AAAAMM) que abarque el rango elegido. Espera a que la
          corrida activa termine antes de lanzar otra tanda.
        </Text>
      </View>

      {/* Botón */}
      <TouchableOpacity
        style={[styles.syncButton, isBusy && styles.syncButtonDisabled]}
        onPress={handleSync}
        disabled={isBusy}
      >
        {starting ? (
          <ActivityIndicator color={theme.color.action.primary.text} />
        ) : (
          <>
            <Ionicons name="sync" size={20} color={theme.color.action.primary.text} />
            <Text style={styles.syncButtonText}>
              {activeRun ? 'Sincronizando…' : 'Iniciar sincronización'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Estado de la corrida activa */}
      {activeRun ? (
        <View style={styles.currentRunWrap}>
          <View style={styles.currentRunHeader}>
            <ActivityIndicator size="small" color={theme.color.brand.accent} />
            <Text style={styles.sectionLabel}>Corrida en curso</Text>
          </View>
          {renderRunCard(activeRun)}
        </View>
      ) : (
        <View style={styles.idleWrap}>
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={theme.color.state.success.text}
          />
          <Text style={styles.idleText}>
            Sin corridas activas. Puedes lanzar una sincronización.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderHistoryTab = () => {
    const totalPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE));
    const currentPage = historyPage + 1;
    const from = historyPage * HISTORY_PAGE_SIZE + (history.length > 0 ? 1 : 0);
    const to = historyPage * HISTORY_PAGE_SIZE + history.length;
    const canPrev = historyPage > 0 && !loadingHistory;
    const canNext = to < historyTotal && !loadingHistory;

    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionLabel}>
            {historyTotal > 0
              ? `Corridas ${from}–${to} de ${historyTotal}`
              : `${history.length} corridas`}
          </Text>
          <TouchableOpacity style={styles.refreshChip} onPress={() => loadHistory(historyPage)}>
            <Ionicons name="refresh" size={14} color={theme.color.text.body} />
            <Text style={styles.refreshChipText}>Refrescar</Text>
          </TouchableOpacity>
        </View>

        {loadingHistory && history.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={theme.color.brand.accent} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyHint}>Sin corridas registradas aún.</Text>
        ) : (
          history.map((r) => <View key={r.id}>{renderRunCard(r)}</View>)
        )}

        {historyTotal > HISTORY_PAGE_SIZE && (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.paginationBtn, !canPrev && styles.paginationBtnDisabled]}
              disabled={!canPrev}
              onPress={() => loadHistory(historyPage - 1)}
            >
              <Ionicons
                name="chevron-back"
                size={16}
                color={canPrev ? theme.color.text.body : theme.color.text.disabled}
              />
              <Text
                style={[styles.paginationBtnText, !canPrev && { color: theme.color.text.disabled }]}
              >
                Anterior
              </Text>
            </TouchableOpacity>

            <Text style={styles.paginationInfo}>
              Página {currentPage} / {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.paginationBtn, !canNext && styles.paginationBtnDisabled]}
              disabled={!canNext}
              onPress={() => loadHistory(historyPage + 1)}
            >
              <Text
                style={[styles.paginationBtnText, !canNext && { color: theme.color.text.disabled }]}
              >
                Siguiente
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={canNext ? theme.color.text.body : theme.color.text.disabled}
              />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="sync-outline" size={22} color={theme.color.brand.accent} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn}>
              <Ionicons name="close" size={22} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {renderTabButton('sync', 'Sincronizar', 'sync-outline')}
            {renderTabButton('history', 'Historial', 'time-outline')}
          </View>

          {/* Body */}
          <View style={styles.body}>{tab === 'sync' ? renderSyncTab() : renderHistoryTab()}</View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Platform.OS === 'web' ? 24 : 12,
    },
    container: {
      width: '100%',
      maxWidth: 640,
      height: '88%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      flex: 1,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      flex: 1,
    },
    headerCloseBtn: {
      padding: 6,
    },
    tabsRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingVertical: theme.space[3],
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabButtonActive: {
      borderBottomColor: theme.color.brand.accent,
      backgroundColor: theme.color.surface.base,
    },
    tabButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    tabButtonTextActive: {
      color: theme.color.brand.accent,
    },
    body: {
      flex: 1,
    },
    tabContent: {
      padding: theme.space[4],
      gap: theme.space[4],
    },
    section: {
      gap: theme.space[2],
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    modeRow: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    modeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    modeChipSelected: {
      backgroundColor: theme.color.brand.accentSoft,
      borderColor: theme.color.brand.accent,
    },
    modeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    modeChipTextSelected: {
      color: theme.color.brand.accent,
    },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.space[2],
    },
    rangeArrow: {
      paddingBottom: theme.space[3],
    },
    periodoField: {
      flex: 1,
      gap: theme.space[2],
    },
    formFieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    textInput: {
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      fontSize: 14,
      color: theme.color.text.heading,
    },
    hintText: {
      fontSize: 11,
      color: theme.color.text.muted,
    },
    syncButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.action.primary.background,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
    },
    syncButtonDisabled: {
      opacity: 0.5,
    },
    syncButtonText: {
      color: theme.color.action.primary.text,
      fontSize: 14,
      fontWeight: '700',
    },
    idleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    idleText: {
      flex: 1,
      fontSize: 12,
      color: theme.color.text.muted,
    },
    currentRunWrap: {
      gap: theme.space[2],
    },
    currentRunHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    runCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      marginBottom: theme.space[3],
      gap: theme.space[2],
    },
    runCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    runCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    runCardMeta: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    progressBarWrap: {
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.color.surface.muted,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      width: '40%',
      borderRadius: 999,
    },
    runCountsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
    },
    runCounts: {
      fontSize: 12,
      color: theme.color.text.body,
    },
    runCountsStrong: {
      fontWeight: '700',
    },
    errorText: {
      fontSize: 12,
      color: theme.color.state.danger.text,
      fontStyle: 'italic',
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
    },
    refreshChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    refreshChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    emptyHint: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontStyle: 'italic',
    },
    paginationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.space[3],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    paginationBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.space[3],
      paddingVertical: 8,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    paginationBtnDisabled: {
      opacity: 0.5,
    },
    paginationBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    paginationInfo: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
  });

export default SireSyncModal;
