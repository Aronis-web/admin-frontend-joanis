/**
 * AttendanceExportModal
 *
 * Modal para descargar el reporte de horas trabajadas (.xlsx) por sedes y rango de fechas.
 * Reutiliza:
 *   - `QuickDateRangeField` (selector estilo Dashboard) para el rango de fechas.
 *   - `scopesApi.getUserResolvedScopes` para listar sedes accesibles al usuario.
 *   - `attendanceReportsApi.exportWorkedHours` (GET /attendance/reports/worked-hours).
 *   - `saveAndShareExcel` para descarga cross-platform (web/Electron/Android).
 *
 * Permiso backend: attendance.reports.export
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { attendanceReportsApi } from '@/services/api';
import { scopesApi } from '@/services/api/scopes';
import { config } from '@/utils/config';
import {
  QuickDateRangeField,
  getDefaultQuickDateRange,
  type QuickDateRangeValue,
} from '@/components/common/QuickDateRangeField';
import { saveAndShareExcel } from '@/utils/fileDownload';
import { logger } from '@/utils/logger';

interface AccessibleSite {
  id: string;
  name: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Empresa activa. Se usa para filtrar sedes accesibles. */
  companyId: string | undefined;
  /** Usuario activo. Se usa para resolver scopes. */
  userId: string | undefined;
  /** Sede a preseleccionar al abrir (opcional). */
  defaultSiteId?: string;
}

export const AttendanceExportModal: React.FC<Props> = ({
  visible,
  onClose,
  companyId,
  userId,
  defaultSiteId,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [dateRange, setDateRange] = useState<QuickDateRangeValue>(getDefaultQuickDateRange);
  const [sites, setSites] = useState<AccessibleSite[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Cargar sedes accesibles cuando se abre el modal.
  const loadSites = useCallback(async () => {
    if (!companyId || !userId) return;
    try {
      setSitesLoading(true);
      const resolved = await scopesApi.getUserResolvedScopes(userId, config.APP_ID, {
        limit: 1000,
      });

      const siteMap = new Map<string, AccessibleSite>();
      for (const scope of resolved) {
        if (
          scope.level === 'SITE' &&
          scope.siteId &&
          scope.companyId === companyId &&
          scope.canRead
        ) {
          if (!siteMap.has(scope.siteId)) {
            const name = scope.site?.name || scope.site_name || 'Sede sin nombre';
            siteMap.set(scope.siteId, { id: scope.siteId, name });
          }
        }
      }

      const accessibleSites = Array.from(siteMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setSites(accessibleSites);

      // Preseleccionar: sede default si existe, si no todas.
      setSelectedSiteIds(() => {
        if (defaultSiteId && accessibleSites.some((s) => s.id === defaultSiteId)) {
          return [defaultSiteId];
        }
        return accessibleSites.map((s) => s.id);
      });
    } catch (err) {
      logger.error('Error cargando sedes accesibles (export horas):', err);
    } finally {
      setSitesLoading(false);
    }
  }, [companyId, userId, defaultSiteId]);

  useEffect(() => {
    if (visible) {
      setDateRange(getDefaultQuickDateRange());
      void loadSites();
    }
  }, [visible, loadSites]);

  const toggleSite = useCallback((siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedSiteIds((prev) => (prev.length === sites.length ? [] : sites.map((s) => s.id)));
  }, [sites]);

  const allSelected = useMemo(
    () => sites.length > 0 && selectedSiteIds.length === sites.length,
    [sites, selectedSiteIds]
  );

  const handleDownload = useCallback(async () => {
    if (downloading) return;

    if (selectedSiteIds.length === 0) {
      Alert.alert('Datos incompletos', 'Selecciona al menos una sede.');
      return;
    }
    if (!dateRange.fromDate || !dateRange.toDate) {
      Alert.alert('Datos incompletos', 'Selecciona un rango de fechas válido.');
      return;
    }

    setDownloading(true);
    try {
      const blob = await attendanceReportsApi.exportWorkedHours({
        siteIds: selectedSiteIds,
        startDate: dateRange.fromDate,
        endDate: dateRange.toDate,
      });

      const ts = new Date().getTime();
      const fileName = `horas-trabajadas-${ts}.xlsx`;
      await saveAndShareExcel(blob, fileName, 'Descargar horas trabajadas');

      if (Platform.OS === 'web') {
        Alert.alert('Éxito', 'El reporte se está descargando.');
      }
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo generar el reporte';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : String(msg));
      logger.error('Error al exportar horas trabajadas', e);
    } finally {
      setDownloading(false);
    }
  }, [downloading, selectedSiteIds, dateRange, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="download-outline" size={20} color={theme.color.brand.accent} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                Descargar horas trabajadas
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={theme.color.icon.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* Rango de fechas (estilo dashboard) */}
            <View style={styles.section}>
              <QuickDateRangeField
                label="Rango de fechas"
                value={dateRange}
                onChange={setDateRange}
                disabled={downloading}
                maximumDate={new Date()}
              />
            </View>

            {/* Sedes (multi-select) */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Sedes</Text>
                {sites.length > 0 && (
                  <TouchableOpacity onPress={toggleAll} disabled={downloading}>
                    <Text style={styles.toggleAllText}>
                      {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {sitesLoading ? (
                <View style={styles.sitesLoading}>
                  <ActivityIndicator color={theme.color.brand.accent} />
                  <Text style={styles.hintText}>Cargando sedes…</Text>
                </View>
              ) : sites.length === 0 ? (
                <Text style={styles.hintText}>No tienes sedes accesibles en esta empresa.</Text>
              ) : (
                <View style={styles.chipRow}>
                  {sites.map((site) => {
                    const selected = selectedSiteIds.includes(site.id);
                    return (
                      <TouchableOpacity
                        key={site.id}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => toggleSite(site.id)}
                        disabled={downloading}
                      >
                        <Ionicons
                          name={selected ? 'checkbox' : 'square-outline'}
                          size={16}
                          color={selected ? theme.color.brand.accent : theme.color.icon.muted}
                        />
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {site.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <Text style={styles.hintText}>
                Se incluirán todas las sedes seleccionadas en un solo archivo.
              </Text>
            </View>
          </ScrollView>

          {/* Botón descargar */}
          <TouchableOpacity
            style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
            onPress={handleDownload}
            disabled={downloading || sitesLoading}
          >
            {downloading ? (
              <ActivityIndicator color={theme.color.action.primary.text} />
            ) : (
              <>
                <Ionicons name="download" size={20} color={theme.color.action.primary.text} />
                <Text style={styles.downloadButtonText}>Descargar Excel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '88%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[3],
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    headerTitleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    content: {
      padding: theme.space[4],
      gap: theme.space[4],
    },
    section: {
      gap: theme.space[2],
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    toggleAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    sitesLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[2],
    },
    hintText: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    chipSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: `${theme.color.brand.accent}10`,
    },
    chipText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    chipTextSelected: {
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
    downloadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      margin: theme.space[4],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.action.primary.background,
    },
    downloadButtonDisabled: {
      opacity: 0.6,
    },
    downloadButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.action.primary.text,
    },
  });

export default AttendanceExportModal;
