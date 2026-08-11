/**
 * Izipay Report Sync Modal
 *
 * UI para gestionar la sincronización mensual del reporte "Movi" de Izipay
 * (panel.izipay.pe) hacia cash_izipay_transactions.
 *
 * Backend docs: POST /izipay-report-sync/{sync,runs,runs/active,runs/:id}
 *
 * Flujo (todo dentro del modal):
 *   1) Se embebe panel.izipay.pe en un WebView (Electron: <webview>; Nativo:
 *      react-native-webview). El usuario se loguea con 2FA como siempre.
 *   2) Un interceptor inyectado captura automáticamente el Bearer del panel
 *      y lo entrega al modal (auto-fill).
 *   3) Se envía token + month/year al backend; polling cada 3s.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import { izipayReportSyncApi } from '@/services/api/izipay-report-sync';
import type { IzipayRun, IzipayRunStatus, IzipaySyncBody } from '@/services/api/izipay-report-sync';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { IzipayCaptureWebView } from './IzipayCaptureWebView';

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 3000;

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

// ============================================================================
// Utils
// ============================================================================

const currentLimaMonthYear = (): { month: string; year: string } => {
  // America/Lima = UTC-5 (sin DST). Aproximación estable sin librerías.
  const now = new Date();
  const limaMs = now.getTime() - 5 * 60 * 60 * 1000;
  const d = new Date(limaMs);
  return {
    month: String(d.getUTCMonth() + 1).padStart(2, '0'),
    year: String(d.getUTCFullYear()),
  };
};

const statusColor = (status: IzipayRunStatus, theme: Theme): string => {
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

const statusLabel = (status: IzipayRunStatus): string => {
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

const formatDateTime = (iso: string | null | undefined): string => {
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

// ============================================================================
// Component
// ============================================================================

type Tab = 'sync' | 'history';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const IzipaySyncModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();

  const canSync = hasPermission(PERMISSIONS.ADMIN.IZIPAY_SYNC.SYNC);
  const canReadRuns = hasPermission(PERMISSIONS.ADMIN.IZIPAY_SYNC.RUNS_READ);

  const [tab, setTab] = useState<Tab>('sync');

  // ---- Form state ----
  const initialMY = useMemo(currentLimaMonthYear, []);
  const [token, setToken] = useState('');
  const [tokenCapturedAt, setTokenCapturedAt] = useState<number | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [month, setMonth] = useState<string>(initialMY.month);
  const [year, setYear] = useState<string>(initialMY.year);
  const [commerceCode, setCommerceCode] = useState('');

  // ---- Data state ----
  const [history, setHistory] = useState<IzipayRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

  // ---- Run polling state ----
  const [currentRun, setCurrentRun] = useState<IzipayRun | null>(null);
  const [starting, setStarting] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRunIdRef = useRef<string | null>(null);

  // ==========================================================================
  // Data loaders
  // ==========================================================================

  const loadHistory = useCallback(
    async (pageArg?: number) => {
      if (!canReadRuns) return;
      const page = pageArg ?? 0;
      setLoadingHistory(true);
      try {
        const res = await izipayReportSyncApi.getRuns({
          limit: HISTORY_PAGE_SIZE,
          offset: page * HISTORY_PAGE_SIZE,
        });
        setHistory(res.items);
        setHistoryTotal(res.total);
        setHistoryPage(page);
      } catch (err) {
        logger.error('Error cargando historial izipay-sync', err);
      } finally {
        setLoadingHistory(false);
      }
    },
    [canReadRuns]
  );

  // ==========================================================================
  // Polling
  // ==========================================================================

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollingRunIdRef.current = null;
  }, []);

  const pollOnce = useCallback(
    async (runId: string) => {
      try {
        const run = await izipayReportSyncApi.getRun(runId);
        setCurrentRun(run);
        if (run.status === 'running') {
          pollTimerRef.current = setTimeout(() => {
            if (pollingRunIdRef.current === runId) pollOnce(runId);
          }, POLL_INTERVAL_MS);
        } else {
          pollingRunIdRef.current = null;
          loadHistory(0);
        }
      } catch (err) {
        logger.error('Error en poll de run izipay', err);
        pollingRunIdRef.current = null;
      }
    },
    [loadHistory]
  );

  const startPolling = useCallback(
    (runId: string) => {
      stopPolling();
      pollingRunIdRef.current = runId;
      pollOnce(runId);
    },
    [pollOnce, stopPolling]
  );

  const detectActiveRun = useCallback(async () => {
    if (!canReadRuns) return;
    try {
      const res = await izipayReportSyncApi.getActiveRun();
      if (res.active) {
        setCurrentRun(res.active);
        startPolling(res.active.id);
      }
    } catch (err) {
      logger.error('Error detectando run activo izipay', err);
    }
  }, [canReadRuns, startPolling]);

  // ==========================================================================
  // Effects
  // ==========================================================================

  useEffect(() => {
    if (visible) {
      loadHistory(0);
      detectActiveRun();
    } else {
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const isRunActive = !!currentRun && currentRun.status === 'running';

  const handleCapturedToken = useCallback((captured: string) => {
    setToken(captured);
    setTokenCapturedAt(Date.now());
  }, []);

  const validateForm = (): string | null => {
    const t = token.trim();
    if (t.length < 20) return 'El token es muy corto. Debe tener al menos 20 caracteres.';
    if (t.length > 4000) return 'El token es demasiado largo.';
    const mNum = Number(month);
    const yNum = Number(year);
    if (!Number.isInteger(mNum) || mNum < 1 || mNum > 12) return 'Mes inválido (1–12).';
    if (!Number.isInteger(yNum) || yNum < 2020 || yNum > 2100) return 'Año inválido.';
    return null;
  };

  const handleSync = async () => {
    if (!canSync) return;
    const err = validateForm();
    if (err) {
      Alert.alert('Datos inválidos', err);
      return;
    }
    setStarting(true);
    try {
      const body: IzipaySyncBody = {
        token: token.trim(),
        month: String(Number(month)).padStart(2, '0'),
        year: String(Number(year)),
      };
      const code = commerceCode.trim();
      if (code) body.commerceCode = code;

      const res = await izipayReportSyncApi.sync(body);
      // Limpiamos el token del state por seguridad (ya viajó al backend, no se guarda).
      setToken('');
      setTokenCapturedAt(null);
      startPolling(res.runId);
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      if (status === 409 && data?.activeRunId) {
        Alert.alert('Sincronización en curso', 'Ya hay un run activo. Se enganchará al polling.');
        startPolling(data.activeRunId);
      } else if (status === 400) {
        const msg = data?.message || 'Token o parámetros inválidos.';
        Alert.alert('Datos inválidos', Array.isArray(msg) ? msg.join('\n') : String(msg));
      } else {
        const msg = data?.message || e?.message || 'Error desconocido';
        Alert.alert('Error al sincronizar', String(msg));
        logger.error('Error izipay sync', e);
      }
    } finally {
      setStarting(false);
    }
  };

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

  const renderRunCard = (run: IzipayRun) => {
    const label = `${MONTH_LABELS[Math.max(0, Math.min(11, Number(run.syncDate.split('-')[1]) - 1))]} ${run.syncDate.split('-')[0]}`;
    return (
      <View style={styles.runCard}>
        <View style={styles.runCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.runCardTitle}>{label}</Text>
            <Text style={styles.runCardMeta}>
              {formatDateTime(run.startedAt)} ·{' '}
              {run.commerceCode === 'ALL' ? 'Todos los comercios' : `Comercio ${run.commerceCode}`}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: statusColor(run.status, theme) }]}>
            <Text style={[styles.statusPillText, { color: statusColor(run.status, theme) }]}>
              {statusLabel(run.status)}
            </Text>
          </View>
        </View>

        {run.status === 'running' && (
          <View style={styles.progressBarWrap}>
            <View
              style={[styles.progressBarFill, { backgroundColor: statusColor(run.status, theme) }]}
            />
          </View>
        )}

        <View style={styles.runCountsRow}>
          <Text style={styles.runCounts}>
            Total: <Text style={styles.runCountsStrong}>{run.totalRows}</Text>
          </Text>
          <Text style={[styles.runCounts, { color: theme.color.state.success.text }]}>
            Nuevas: <Text style={styles.runCountsStrong}>{run.newRows}</Text>
          </Text>
          <Text style={[styles.runCounts, { color: theme.color.text.muted }]}>
            Dup: <Text style={styles.runCountsStrong}>{run.dupRows}</Text>
          </Text>
          <Text style={[styles.runCounts, { color: theme.color.state.danger.text }]}>
            Err: <Text style={styles.runCountsStrong}>{run.errorRows}</Text>
          </Text>
        </View>

        {!!run.fileName && <Text style={styles.metaText}>{run.fileName}</Text>}
        {!!run.errorMsg && <Text style={styles.errorText}>{run.errorMsg}</Text>}
      </View>
    );
  };

  // ==========================================================================
  // Tabs
  // ==========================================================================

  const renderSyncTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Panel embebido con captura automática */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Panel Izipay · captura automática</Text>
          {tokenCapturedAt && (
            <View style={styles.tokenBadge}>
              <Ionicons name="checkmark-circle" size={14} color={theme.color.state.success.text} />
              <Text style={styles.tokenBadgeText}>Token capturado</Text>
            </View>
          )}
        </View>
        <Text style={styles.hintText}>
          Loguéate en el panel (2FA por correo). En cuanto navegues, capturamos el Bearer
          automáticamente. El backend no lo almacena: se usa durante el run y se descarta.
        </Text>

        <View style={styles.webviewWrap}>
          <IzipayCaptureWebView onToken={handleCapturedToken} height={420} />
        </View>

        {/* Toggle para pegar el token manualmente (fallback web puro / debug) */}
        <TouchableOpacity
          style={styles.manualToggle}
          onPress={() => setShowManualPaste((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showManualPaste ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.color.text.muted}
          />
          <Text style={styles.manualToggleText}>
            {showManualPaste
              ? 'Ocultar token'
              : token
                ? 'Ver / editar token capturado'
                : 'Pegar token manualmente'}
          </Text>
        </TouchableOpacity>

        {showManualPaste && (
          <>
            <View style={styles.tokenRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={token}
                onChangeText={(v) => {
                  setToken(v);
                  setTokenCapturedAt(v ? Date.now() : null);
                }}
                secureTextEntry={!showToken}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Bearer del panel (sin 'Bearer ')"
                placeholderTextColor={theme.color.text.placeholder}
                editable={!isRunActive}
                multiline={showToken}
              />
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setShowToken((v) => !v)}
                disabled={isRunActive}
              >
                <Ionicons
                  name={showToken ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={theme.color.icon.muted}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>{token.length} caracteres</Text>
          </>
        )}
      </View>

      {/* Mes / Año */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Mes a sincronizar</Text>
        <View style={styles.monthYearRow}>
          <View style={styles.monthYearField}>
            <Text style={styles.formFieldLabel}>Mes</Text>
            <View style={styles.chipRow}>
              {MONTH_LABELS.map((label, idx) => {
                const code = String(idx + 1).padStart(2, '0');
                const selected = month === code;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setMonth(code)}
                    disabled={isRunActive}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {label.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.monthYearField}>
            <Text style={styles.formFieldLabel}>Año</Text>
            <TextInput
              style={styles.textInput}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              placeholder="2026"
              placeholderTextColor={theme.color.text.placeholder}
              editable={!isRunActive}
              maxLength={4}
            />
          </View>
        </View>
      </View>

      {/* Código de comercio (opcional) */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Código de comercio (opcional)</Text>
        <TextInput
          style={styles.textInput}
          value={commerceCode}
          onChangeText={setCommerceCode}
          autoCapitalize="none"
          placeholder="Vacío = todos los comercios del token"
          placeholderTextColor={theme.color.text.placeholder}
          editable={!isRunActive}
          maxLength={40}
        />
      </View>

      {/* Botón sincronizar */}
      {canSync ? (
        <TouchableOpacity
          style={[styles.syncButton, (starting || isRunActive) && styles.syncButtonDisabled]}
          onPress={handleSync}
          disabled={starting || isRunActive}
        >
          {starting ? (
            <ActivityIndicator color={theme.color.text.onAction} />
          ) : (
            <>
              <Ionicons name="sync" size={20} color={theme.color.text.onAction} />
              <Text style={styles.syncButtonText}>
                {isRunActive ? 'Sincronizando…' : 'Iniciar sincronización'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.emptyHint}>
          No tienes permiso `admin.izipay_sync.sync` para disparar sincronizaciones.
        </Text>
      )}

      {/* Estado del run actual */}
      {currentRun && (
        <View style={styles.currentRunWrap}>
          <Text style={styles.sectionLabel}>Sincronización actual</Text>
          {renderRunCard(currentRun)}
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
            {historyTotal > 0 ? `Runs ${from}–${to} de ${historyTotal}` : `${history.length} runs`}
          </Text>
          <TouchableOpacity style={styles.refreshChip} onPress={() => loadHistory(historyPage)}>
            <Ionicons name="refresh" size={14} color={theme.color.text.body} />
            <Text style={styles.refreshChipText}>Refrescar</Text>
          </TouchableOpacity>
        </View>

        {loadingHistory && history.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={theme.color.brand.accent} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyHint}>Sin runs registrados aún.</Text>
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

  if (!canReadRuns) return null;

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
              <Ionicons name="card-outline" size={22} color={theme.color.brand.accent} />
              <Text style={styles.headerTitle}>Sincronización Izipay</Text>
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
          <View style={styles.body}>
            {tab === 'sync' && renderSyncTab()}
            {tab === 'history' && renderHistoryTab()}
          </View>
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
      maxWidth: 720,
      height: '92%',
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
    sectionLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[2],
    },
    webviewWrap: {
      marginTop: theme.space[2],
    },
    tokenBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.space[2],
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.color.state.success.background,
      borderWidth: 1,
      borderColor: theme.color.state.success.text,
    },
    tokenBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.state.success.text,
    },
    manualToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: theme.space[2],
    },
    manualToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    instructionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.accentSoft,
      borderWidth: 1,
      borderColor: theme.color.brand.accent,
    },
    instructionsHeaderText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    instructionsBody: {
      gap: theme.space[2],
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    stepText: {
      fontSize: 12,
      color: theme.color.text.body,
      lineHeight: 18,
    },
    stepStrong: {
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    stepCode: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontSize: 11,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    secondaryBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    warningText: {
      fontSize: 11,
      color: theme.color.state.warning.text,
      fontStyle: 'italic',
      marginTop: theme.space[1],
    },
    tokenRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[2],
    },
    iconBtn: {
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    hintText: {
      fontSize: 11,
      color: theme.color.text.muted,
    },
    monthYearRow: {
      gap: theme.space[3],
    },
    monthYearField: {
      gap: theme.space[2],
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    chip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      minWidth: 56,
      alignItems: 'center',
    },
    chipSelected: {
      backgroundColor: theme.color.brand.accentSoft,
      borderColor: theme.color.brand.accent,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    chipTextSelected: {
      color: theme.color.brand.accent,
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
    syncButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.action.primary.background,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      marginTop: theme.space[2],
    },
    syncButtonDisabled: {
      opacity: 0.5,
    },
    syncButtonText: {
      color: theme.color.action.primary.text,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyHint: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontStyle: 'italic',
    },
    currentRunWrap: {
      marginTop: theme.space[3],
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
    metaText: {
      fontSize: 11,
      color: theme.color.text.muted,
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

export default IzipaySyncModal;
