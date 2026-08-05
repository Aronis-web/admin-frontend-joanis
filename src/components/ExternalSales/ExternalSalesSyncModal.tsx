/**
 * External Sales Sync Modal
 *
 * UI para gestionar la sincronización de ventas externas (simplefact.pe).
 * Backend docs: POST /external-sales/*
 *
 * Tabs:
 *   - Sincronizar: dispara run + polling + progreso per-site
 *   - Sedes:       lista de sources configuradas (soft-delete / editar)
 *   - Historial:   últimos runs con resumen
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
import { externalSalesApi } from '@/services/api/external-sales';
import type {
  ExternalSalesRun,
  ExternalSalesSource,
  ExternalSalesInvoiceType,
  ExternalSalesPerSiteResult,
  ExternalSalesRunStatus,
  UpsertExternalSalesSourceDto,
} from '@/services/api/external-sales';
import { DateRangePicker } from '@/components/DateRangePicker';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

// ============================================================================
// Utils
// ============================================================================

const POLL_INTERVAL_MS = 3000;

const INVOICE_TYPES: { code: ExternalSalesInvoiceType; label: string }[] = [
  { code: '01', label: 'Factura (01)' },
  { code: '03', label: 'Boleta (03)' },
  { code: '07', label: 'Nota crédito (07)' },
  { code: 'nv', label: 'Nota venta (nv)' },
];

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const yesterday = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
};

const today = (): Date => new Date();

const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

const statusColor = (status: ExternalSalesRunStatus, theme: Theme): string => {
  switch (status) {
    case 'ok':
      return theme.color.state.success.text;
    case 'partial':
      return theme.color.state.warning.text;
    case 'error':
      return theme.color.state.danger.text;
    case 'running':
    case 'queued':
    default:
      return theme.color.state.info.text;
  }
};

const statusLabel = (status: ExternalSalesRunStatus): string => {
  switch (status) {
    case 'ok':
      return 'Completado';
    case 'partial':
      return 'Parcial';
    case 'error':
      return 'Error';
    case 'running':
      return 'En curso';
    case 'queued':
      return 'En cola';
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

type Tab = 'sync' | 'sources' | 'history';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const ExternalSalesSyncModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();

  const canSync = hasPermission(PERMISSIONS.ADMIN.EXTERNAL_SALES.SYNC);
  const canWriteSources = hasPermission(PERMISSIONS.ADMIN.EXTERNAL_SALES.SOURCES_WRITE);
  const canReadRuns = hasPermission(PERMISSIONS.ADMIN.EXTERNAL_SALES.RUNS_READ);

  const [tab, setTab] = useState<Tab>('sync');

  // ---- Form state (sync tab) ----
  const [dateFrom, setDateFrom] = useState<Date>(today());
  const [dateTo, setDateTo] = useState<Date>(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [invoiceTypes, setInvoiceTypes] = useState<ExternalSalesInvoiceType[]>([
    '01',
    '03',
    '07',
    'nv',
  ]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [selectAllSites, setSelectAllSites] = useState<boolean>(true);
  const [sitesExpanded, setSitesExpanded] = useState<boolean>(false);

  // ---- Data state ----
  const [sources, setSources] = useState<ExternalSalesSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [history, setHistory] = useState<ExternalSalesRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

  // ---- Run polling state ----
  const [currentRun, setCurrentRun] = useState<ExternalSalesRun | null>(null);
  const [starting, setStarting] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRunIdRef = useRef<string | null>(null);

  // ---- Source form modal state ----
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<ExternalSalesSource | null>(null);

  // ==========================================================================
  // Data loaders
  // ==========================================================================

  const loadSources = useCallback(async () => {
    if (!canReadRuns) return;
    setLoadingSources(true);
    try {
      const list = await externalSalesApi.getSources();
      setSources(list);
    } catch (err) {
      logger.error('Error cargando sources external-sales', err);
    } finally {
      setLoadingSources(false);
    }
  }, [canReadRuns]);

  const loadHistory = useCallback(
    async (pageArg?: number) => {
      if (!canReadRuns) return;
      const page = pageArg ?? 0;
      setLoadingHistory(true);
      try {
        const res = await externalSalesApi.getRuns({
          limit: HISTORY_PAGE_SIZE,
          offset: page * HISTORY_PAGE_SIZE,
        });
        setHistory(res.items);
        setHistoryTotal(res.total);
        setHistoryPage(page);
      } catch (err) {
        logger.error('Error cargando historial external-sales', err);
      } finally {
        setLoadingHistory(false);
      }
    },
    [canReadRuns]
  );

  const detectActiveRun = useCallback(async () => {
    if (!canReadRuns) return;
    try {
      const res = await externalSalesApi.getActiveRun();
      if (res.active) {
        setCurrentRun(res.active);
        startPolling(res.active.id);
      }
    } catch (err) {
      logger.error('Error detectando run activo', err);
    }
  }, [canReadRuns]);

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
        const run = await externalSalesApi.getRun(runId);
        setCurrentRun(run);
        if (run.status === 'running' || run.status === 'queued') {
          pollTimerRef.current = setTimeout(() => {
            if (pollingRunIdRef.current === runId) pollOnce(runId);
          }, POLL_INTERVAL_MS);
        } else {
          pollingRunIdRef.current = null;
          // Refresca historial y sources (para lastSyncAt).
          loadHistory();
          loadSources();
        }
      } catch (err) {
        logger.error('Error en poll de run', err);
        pollingRunIdRef.current = null;
      }
    },
    [loadHistory, loadSources]
  );

  const startPolling = useCallback(
    (runId: string) => {
      stopPolling();
      pollingRunIdRef.current = runId;
      pollOnce(runId);
    },
    [pollOnce, stopPolling]
  );

  // ==========================================================================
  // Effects
  // ==========================================================================

  useEffect(() => {
    if (visible) {
      loadSources();
      loadHistory();
      detectActiveRun();
    } else {
      // Al cerrar el modal, dejamos de pollear (el run sigue en el backend).
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const activeSources = useMemo(() => sources.filter((s) => s.active), [sources]);

  const toggleInvoiceType = (code: ExternalSalesInvoiceType) => {
    setInvoiceTypes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleSite = (siteId: string) => {
    // Al tocar sedes individuales, desactivamos "seleccionar todas".
    setSelectAllSites(false);
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((s) => s !== siteId) : [...prev, siteId]
    );
  };

  const handleToggleSelectAll = () => {
    setSelectAllSites((prev) => {
      const next = !prev;
      if (next) {
        // Al activar "todas", limpiamos selección manual (sync usará todas las sources).
        setSelectedSiteIds([]);
      }
      return next;
    });
  };

  const isRunActive =
    !!currentRun && (currentRun.status === 'running' || currentRun.status === 'queued');

  const handleSync = async () => {
    if (!canSync) return;
    if (invoiceTypes.length === 0) {
      Alert.alert('Faltan tipos', 'Selecciona al menos un tipo de comprobante.');
      return;
    }
    if (dateFrom.getTime() > dateTo.getTime()) {
      Alert.alert('Rango inválido', 'La fecha inicial debe ser <= fecha final.');
      return;
    }
    const rangeDays = daysBetween(dateFrom, dateTo);
    if (rangeDays > 92) {
      Alert.alert('Rango demasiado grande', `Máximo 92 días. Seleccionaste ${rangeDays} días.`);
      return;
    }

    setStarting(true);
    try {
      const body: Parameters<typeof externalSalesApi.sync>[0] = {
        dateFrom: toIsoDate(dateFrom),
        dateTo: toIsoDate(dateTo),
        invoiceTypes,
      };
      // Sólo enviamos siteIds si NO está "todas" seleccionado y hay al menos una elegida.
      if (!selectAllSites && selectedSiteIds.length > 0) {
        body.siteIds = selectedSiteIds;
      }
      if (!selectAllSites && selectedSiteIds.length === 0) {
        Alert.alert('Sin sedes', 'Selecciona al menos una sede o activa "Todas".');
        setStarting(false);
        return;
      }
      const res = await externalSalesApi.sync(body);
      startPolling(res.runId);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && data?.activeRunId) {
        Alert.alert(
          'Sincronización en curso',
          `Ya hay un run activo (${data.processedSites ?? 0}/${data.totalSites ?? '?'} sedes). Se enganchará al polling.`
        );
        startPolling(data.activeRunId);
      } else {
        const msg = data?.message || err?.message || 'Error desconocido';
        Alert.alert('Error al sincronizar', msg);
        logger.error('Error external-sales sync', err);
      }
    } finally {
      setStarting(false);
    }
  };

  const handleDeleteSource = (source: ExternalSalesSource) => {
    if (!canWriteSources) return;
    Alert.alert(
      'Desactivar source',
      `¿Desactivar "${source.siteName}"? Se hará soft-delete y no se sincronizará más.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await externalSalesApi.deleteSource(source.id);
              loadSources();
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Error';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleOpenSourceForm = (source: ExternalSalesSource | null) => {
    setEditingSource(source);
    setSourceFormOpen(true);
  };

  const handleSourceSaved = () => {
    setSourceFormOpen(false);
    setEditingSource(null);
    loadSources();
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

  const renderPerSiteRow = (r: ExternalSalesPerSiteResult) => (
    <View key={r.sourceId} style={styles.perSiteRow}>
      <View style={styles.perSiteHeader}>
        <Ionicons
          name={r.ok ? 'checkmark-circle' : 'close-circle'}
          size={18}
          color={r.ok ? theme.color.state.success.text : theme.color.state.danger.text}
        />
        <Text style={styles.perSiteName} numberOfLines={1}>
          {r.siteName}
        </Text>
        <Text style={styles.perSiteCounts}>
          {r.newRows}n · {r.dupRows}d · {r.errorRows}e
        </Text>
      </View>
      {!!r.message && (
        <Text style={styles.perSiteMessage} numberOfLines={2}>
          {r.message}
        </Text>
      )}
    </View>
  );

  const renderRunCard = (run: ExternalSalesRun) => {
    const pct = run.totalSites > 0 ? (run.processedSites / run.totalSites) * 100 : 0;
    return (
      <View style={styles.runCard}>
        <View style={styles.runCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.runCardTitle}>{run.syncDate}</Text>
            <Text style={styles.runCardMeta}>
              {formatDateTime(run.startedAt)} · {run.processedSites}/{run.totalSites} sedes
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: statusColor(run.status, theme) }]}>
            <Text style={[styles.statusPillText, { color: statusColor(run.status, theme) }]}>
              {statusLabel(run.status)}
            </Text>
          </View>
        </View>

        <View style={styles.progressBarWrap}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${pct}%`, backgroundColor: statusColor(run.status, theme) },
            ]}
          />
        </View>

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

        {!!run.errorMsg && <Text style={styles.errorText}>{run.errorMsg}</Text>}

        {run.perSiteResult && run.perSiteResult.length > 0 && (
          <View style={styles.perSiteList}>{run.perSiteResult.map(renderPerSiteRow)}</View>
        )}
      </View>
    );
  };

  // ==========================================================================
  // Tabs
  // ==========================================================================

  const renderSyncTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Rango de fechas */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Rango de fechas</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
          disabled={isRunActive}
        >
          <Ionicons name="calendar-outline" size={18} color={theme.color.icon.muted} />
          <Text style={styles.dateInputText}>
            {toIsoDate(dateFrom)} → {toIsoDate(dateTo)}
          </Text>
          <Text style={styles.dateInputHint}>{daysBetween(dateFrom, dateTo)} días</Text>
        </TouchableOpacity>
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => {
              const y = yesterday();
              setDateFrom(y);
              setDateTo(y);
            }}
            disabled={isRunActive}
          >
            <Text style={styles.quickChipText}>Ayer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => {
              const to = yesterday();
              const from = new Date(to);
              from.setDate(from.getDate() - 6);
              setDateFrom(from);
              setDateTo(to);
            }}
            disabled={isRunActive}
          >
            <Text style={styles.quickChipText}>Últimos 7 días</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => {
              const to = yesterday();
              const from = new Date(to);
              from.setDate(from.getDate() - 29);
              setDateFrom(from);
              setDateTo(to);
            }}
            disabled={isRunActive}
          >
            <Text style={styles.quickChipText}>Últimos 30 días</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tipos de comprobante */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Tipos de comprobante</Text>
        <View style={styles.chipRow}>
          {INVOICE_TYPES.map((t) => {
            const selected = invoiceTypes.includes(t.code);
            return (
              <TouchableOpacity
                key={t.code}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleInvoiceType(t.code)}
                disabled={isRunActive}
              >
                <Ionicons
                  name={selected ? 'checkbox' : 'square-outline'}
                  size={16}
                  color={selected ? theme.color.brand.accent : theme.color.icon.muted}
                />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Sedes */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Sedes</Text>
          <Text style={styles.sectionLabelHint}>
            {selectAllSites
              ? `Todas (${activeSources.length})`
              : selectedSiteIds.length === 0
                ? 'Ninguna'
                : `${selectedSiteIds.length} seleccionadas`}
          </Text>
        </View>

        {activeSources.length === 0 ? (
          <Text style={styles.emptyHint}>No hay sources activas configuradas.</Text>
        ) : (
          <>
            {/* Checkbox "Seleccionar todas" (default ON) */}
            <TouchableOpacity
              style={[styles.siteRow, selectAllSites && styles.siteRowSelected]}
              onPress={handleToggleSelectAll}
              disabled={isRunActive}
            >
              <Ionicons
                name={selectAllSites ? 'checkbox' : 'square-outline'}
                size={18}
                color={selectAllSites ? theme.color.brand.accent : theme.color.icon.muted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.siteRowName}>Seleccionar todas las sedes</Text>
                <Text style={styles.siteRowSub}>
                  {selectAllSites
                    ? `Se sincronizarán las ${activeSources.length} sources activas`
                    : 'Elige sedes específicas abajo'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Toggle plegable (default plegado) */}
            <TouchableOpacity
              style={styles.sitesExpandToggle}
              onPress={() => setSitesExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={sitesExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.color.text.muted}
              />
              <Text style={styles.sitesExpandToggleText}>
                {sitesExpanded
                  ? `Ocultar lista de sedes (${activeSources.length})`
                  : `Ver lista de sedes (${activeSources.length})`}
              </Text>
            </TouchableOpacity>

            {sitesExpanded && (
              <View style={styles.siteList}>
                {activeSources.map((s) => {
                  const selected = !selectAllSites && selectedSiteIds.includes(s.siteId);
                  const dimmed = selectAllSites;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.siteRow,
                        selected && styles.siteRowSelected,
                        dimmed && styles.siteRowDimmed,
                      ]}
                      onPress={() => toggleSite(s.siteId)}
                      disabled={isRunActive}
                    >
                      <Ionicons
                        name={dimmed ? 'checkbox' : selected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={
                          dimmed
                            ? theme.color.icon.muted
                            : selected
                              ? theme.color.brand.accent
                              : theme.color.icon.muted
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.siteRowName}>{s.siteName}</Text>
                        <Text style={styles.siteRowSub}>
                          {s.provider} · {s.tenantSubdomain}
                          {s.lastSyncAt ? ` · última: ${formatDateTime(s.lastSyncAt)}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>

      {/* Botón sincronizar */}
      {canSync && (
        <TouchableOpacity
          style={[styles.syncButton, (starting || isRunActive) && styles.syncButtonDisabled]}
          onPress={handleSync}
          disabled={starting || isRunActive || activeSources.length === 0}
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
      )}

      {!canSync && (
        <Text style={styles.emptyHint}>
          No tienes permiso `admin.external_sales.sync` para disparar sincronizaciones.
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

  const renderSourcesTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.sourcesHeader}>
        <Text style={styles.sectionLabel}>
          {sources.length} sources · {activeSources.length} activas
        </Text>
        {canWriteSources && (
          <TouchableOpacity
            style={styles.addSourceButton}
            onPress={() => handleOpenSourceForm(null)}
          >
            <Ionicons name="add" size={16} color={theme.color.text.onAction} />
            <Text style={styles.addSourceButtonText}>Nueva</Text>
          </TouchableOpacity>
        )}
      </View>

      {loadingSources && sources.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={theme.color.brand.accent} />
      ) : sources.length === 0 ? (
        <Text style={styles.emptyHint}>Sin sources configuradas.</Text>
      ) : (
        sources.map((s) => (
          <View key={s.id} style={styles.sourceCard}>
            <View style={styles.sourceCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceCardTitle}>{s.siteName}</Text>
                <Text style={styles.sourceCardSub}>
                  {s.provider} · {s.tenantSubdomain}.simplefact.pe · wh {s.warehouseId}
                </Text>
                <Text style={styles.sourceCardSub}>
                  {s.apiEmail} · {s.credentialsConfigured ? '🔒 credenciales OK' : '⚠ sin password'}
                </Text>
                {!!s.lastSyncAt && (
                  <Text style={styles.sourceCardSub}>
                    Última sync: {formatDateTime(s.lastSyncAt)}
                  </Text>
                )}
              </View>
              <View style={[styles.statusPill, !s.active && styles.statusPillInactive]}>
                <Text
                  style={[
                    styles.statusPillText,
                    { color: s.active ? theme.color.state.success.text : theme.color.text.muted },
                  ]}
                >
                  {s.active ? 'Activa' : 'Inactiva'}
                </Text>
              </View>
            </View>

            {canWriteSources && (
              <View style={styles.sourceActions}>
                <TouchableOpacity
                  style={styles.sourceActionBtn}
                  onPress={() => handleOpenSourceForm(s)}
                >
                  <Ionicons name="create-outline" size={16} color={theme.color.text.body} />
                  <Text style={styles.sourceActionText}>Editar</Text>
                </TouchableOpacity>
                {s.active && (
                  <TouchableOpacity
                    style={styles.sourceActionBtn}
                    onPress={() => handleDeleteSource(s)}
                  >
                    <Ionicons
                      name="power-outline"
                      size={16}
                      color={theme.color.state.danger.text}
                    />
                    <Text
                      style={[styles.sourceActionText, { color: theme.color.state.danger.text }]}
                    >
                      Desactivar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderHistoryTab = () => {
    const totalPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE));
    const currentPage = historyPage + 1; // 1-indexado para UI
    const from = historyPage * HISTORY_PAGE_SIZE + (history.length > 0 ? 1 : 0);
    const to = historyPage * HISTORY_PAGE_SIZE + history.length;
    const canPrev = historyPage > 0 && !loadingHistory;
    const canNext = to < historyTotal && !loadingHistory;

    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <View style={styles.sourcesHeader}>
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
    <>
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
                <Ionicons
                  name="cloud-download-outline"
                  size={22}
                  color={theme.color.brand.accent}
                />
                <Text style={styles.headerTitle}>Sincronización ventas externas</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn}>
                <Ionicons name="close" size={22} color={theme.color.icon.subtle} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
              {renderTabButton('sync', 'Sincronizar', 'sync-outline')}
              {renderTabButton('sources', 'Sedes', 'business-outline')}
              {renderTabButton('history', 'Historial', 'time-outline')}
            </View>

            {/* Body */}
            <View style={styles.body}>
              {tab === 'sync' && renderSyncTab()}
              {tab === 'sources' && renderSourcesTab()}
              {tab === 'history' && renderHistoryTab()}
            </View>
          </View>
        </View>
      </Modal>

      <DateRangePicker
        visible={showDatePicker}
        startDate={dateFrom}
        endDate={dateTo}
        onConfirm={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
        title="Rango de sincronización"
        maximumDate={new Date()}
      />

      {sourceFormOpen && (
        <SourceFormModal
          visible={sourceFormOpen}
          source={editingSource}
          onClose={() => {
            setSourceFormOpen(false);
            setEditingSource(null);
          }}
          onSaved={handleSourceSaved}
        />
      )}
    </>
  );
};

// ============================================================================
// SourceFormModal (interno)
// ============================================================================

interface SourceFormModalProps {
  visible: boolean;
  source: ExternalSalesSource | null;
  onClose: () => void;
  onSaved: () => void;
}

const SourceFormModal: React.FC<SourceFormModalProps> = ({ visible, source, onClose, onSaved }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [siteId, setSiteId] = useState(source?.siteId ?? '');
  const [provider, setProvider] = useState(source?.provider ?? 'simplefact');
  const [tenantSubdomain, setTenantSubdomain] = useState(source?.tenantSubdomain ?? '');
  const [warehouseId, setWarehouseId] = useState(String(source?.warehouseId ?? '1'));
  const [apiEmail, setApiEmail] = useState(source?.apiEmail ?? '');
  const [apiPassword, setApiPassword] = useState('');
  const [active, setActive] = useState(source?.active ?? true);
  const [notes, setNotes] = useState(source?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const isEdit = !!source;

  const handleSave = async () => {
    if (!siteId.trim() || !provider.trim() || !tenantSubdomain.trim() || !apiEmail.trim()) {
      Alert.alert('Faltan campos', 'siteId, provider, subdomain y email son obligatorios.');
      return;
    }
    const whNum = Number(warehouseId);
    if (!Number.isFinite(whNum) || whNum <= 0) {
      Alert.alert('warehouseId inválido', 'Debe ser un número > 0.');
      return;
    }
    if (!isEdit && !apiPassword.trim()) {
      Alert.alert('Falta password', 'apiPassword es obligatorio al crear una source.');
      return;
    }

    setSaving(true);
    try {
      const body: UpsertExternalSalesSourceDto = {
        siteId: siteId.trim(),
        provider: provider.trim(),
        tenantSubdomain: tenantSubdomain.trim(),
        warehouseId: whNum,
        apiEmail: apiEmail.trim(),
        active,
        notes: notes.trim() || null,
      };
      if (apiPassword.trim()) body.apiPassword = apiPassword;
      await externalSalesApi.upsertSource(body);
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error';
      Alert.alert('Error guardando source', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { maxWidth: 520 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isEdit ? 'Editar source' : 'Nueva source'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn}>
              <Ionicons name="close" size={22} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.tabContent}>
            <FormField label="siteId (UUID de la sede)">
              <TextInput
                style={styles.textInput}
                value={siteId}
                onChangeText={setSiteId}
                autoCapitalize="none"
                placeholder="86e1051a-…"
                placeholderTextColor={theme.color.text.placeholder}
                editable={!isEdit}
              />
            </FormField>

            <FormField label="Provider">
              <TextInput
                style={styles.textInput}
                value={provider}
                onChangeText={setProvider}
                autoCapitalize="none"
                placeholder="simplefact"
                placeholderTextColor={theme.color.text.placeholder}
                editable={!isEdit}
              />
            </FormField>

            <FormField label="Tenant subdomain (sin .simplefact.pe)">
              <TextInput
                style={styles.textInput}
                value={tenantSubdomain}
                onChangeText={setTenantSubdomain}
                autoCapitalize="none"
                placeholder="arvaz"
                placeholderTextColor={theme.color.text.placeholder}
              />
            </FormField>

            <FormField label="warehouseId (en simplefact)">
              <TextInput
                style={styles.textInput}
                value={warehouseId}
                onChangeText={setWarehouseId}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={theme.color.text.placeholder}
              />
            </FormField>

            <FormField label="Email API">
              <TextInput
                style={styles.textInput}
                value={apiEmail}
                onChangeText={setApiEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="fvargas@corporaciongrit.com"
                placeholderTextColor={theme.color.text.placeholder}
              />
            </FormField>

            <FormField
              label={isEdit ? 'Password API (dejar vacío para no cambiar)' : 'Password API'}
            >
              <TextInput
                style={styles.textInput}
                value={apiPassword}
                onChangeText={setApiPassword}
                autoCapitalize="none"
                secureTextEntry
                placeholder={isEdit ? '••••••••' : 'simple123'}
                placeholderTextColor={theme.color.text.placeholder}
              />
            </FormField>

            <FormField label="Notas (opcional)">
              <TextInput
                style={[styles.textInput, { minHeight: 60 }]}
                value={notes ?? ''}
                onChangeText={setNotes}
                multiline
                placeholder="—"
                placeholderTextColor={theme.color.text.placeholder}
              />
            </FormField>

            <TouchableOpacity style={styles.toggleRow} onPress={() => setActive((v) => !v)}>
              <Ionicons
                name={active ? 'toggle' : 'toggle-outline'}
                size={26}
                color={active ? theme.color.state.success.text : theme.color.icon.muted}
              />
              <Text style={styles.toggleLabel}>{active ? 'Activa' : 'Inactiva'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncButton, saving && styles.syncButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={theme.color.text.onAction} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color={theme.color.text.onAction} />
                  <Text style={styles.syncButtonText}>Guardar</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.formFieldLabel}>{label}</Text>
      {children}
    </View>
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
    },
    sectionLabelHint: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    dateInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
    },
    dateInputText: {
      flex: 1,
      fontSize: 14,
      color: theme.color.text.heading,
      fontWeight: '600',
    },
    dateInputHint: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    quickRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    quickChip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    quickChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
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
    siteList: {
      gap: theme.space[2],
    },
    siteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    siteRowSelected: {
      backgroundColor: theme.color.brand.accentSoft,
      borderColor: theme.color.brand.accent,
    },
    siteRowName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    siteRowSub: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: 2,
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
    statusPillInactive: {
      backgroundColor: theme.color.surface.muted,
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
    perSiteList: {
      marginTop: theme.space[2],
      gap: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingTop: theme.space[2],
    },
    perSiteRow: {
      gap: 2,
    },
    perSiteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    perSiteName: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    perSiteCounts: {
      fontSize: 11,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    perSiteMessage: {
      fontSize: 11,
      color: theme.color.text.muted,
      paddingLeft: 24,
    },
    sourcesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
    },
    addSourceButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.color.action.primary.background,
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.lg,
    },
    addSourceButtonText: {
      color: theme.color.action.primary.text,
      fontSize: 12,
      fontWeight: '700',
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
    sourceCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      marginBottom: theme.space[3],
      gap: theme.space[2],
    },
    sourceCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[2],
    },
    sourceCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    sourceCardSub: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    sourceActions: {
      flexDirection: 'row',
      gap: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingTop: theme.space[2],
    },
    sourceActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
    },
    sourceActionText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    formFieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: 4,
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[2],
    },
    toggleLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    siteRowDimmed: {
      opacity: 0.5,
    },
    sitesExpandToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: theme.space[2],
    },
    sitesExpandToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
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

export default ExternalSalesSyncModal;
