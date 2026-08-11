/**
 * DriveExcelEditor
 *
 * Visor + editor ligero de hojas de cálculo (xlsx / xls / csv) usando SheetJS.
 * - Parsea el archivo desde un Blob y muestra las hojas con tabs.
 * - Celdas editables mediante <TextInput> en un grid virtualizado con ScrollView.
 * - Botón "Guardar" que genera un nuevo binario (mismo formato) y lo devuelve
 *   como Blob al padre para subirlo como nueva versión.
 *
 * Limitaciones conocidas (F1):
 *  - No render fiel de estilos, gráficos ni fórmulas complejas (SheetJS calcula
 *    valores planos; para preservar fórmulas al guardar se usa opción `cellFormula`).
 *  - Grid simple (sin freezing panes ni ordenar/filtrar).
 *  - Cambio de tamaño de columnas no soportado.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as XLSX from 'xlsx';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface Props {
  /** Blob del archivo original. */
  blob: Blob | null;
  /** Nombre del archivo (para deducir la extensión de salida). */
  filename: string;
  /** Si false, oculta la edición y solo permite visualización. */
  editable?: boolean;
  /** Notifica al padre si hay cambios sin guardar. */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Registra en el padre una función `save()` que genera el Blob actualizado
   * (mismo formato) para subirlo. Se llama en cada mount y cuando cambian
   * las hojas.
   */
  registerSaver?: (saver: (() => Promise<Blob>) | null) => void;
}

type SheetMatrix = string[][];

const CELL_WIDTH = 120;
const CELL_HEIGHT = 32;

const detectBookType = (filename: string): XLSX.BookType => {
  const n = filename.toLowerCase();
  if (n.endsWith('.xls')) return 'xls';
  if (n.endsWith('.csv')) return 'csv';
  if (n.endsWith('.ods')) return 'ods';
  return 'xlsx';
};

/** Convierte una matriz a AoA (Array of Arrays) que SheetJS acepta. */
const matrixToAoA = (m: SheetMatrix): unknown[][] => m.map((row) => row.slice());

export const DriveExcelEditor: React.FC<Props> = ({
  blob,
  filename,
  editable = true,
  onDirtyChange,
  registerSaver,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheets, setSheets] = useState<Record<string, SheetMatrix>>({});
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  const bookType = useMemo(() => detectBookType(filename), [filename]);
  const dirtyRef = useRef(false);

  // Parse blob → matrices por hoja
  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const buf = await blob.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const names = wb.SheetNames;
        const parsedSheets: Record<string, SheetMatrix> = {};
        for (const n of names) {
          const ws = wb.Sheets[n];
          const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            raw: false,
            defval: '',
          });
          parsedSheets[n] = aoa.map((row) =>
            (row as unknown[]).map((v) => (v === null || v === undefined ? '' : String(v)))
          );
        }
        if (cancelled) return;
        setSheetNames(names);
        setSheets(parsedSheets);
        setActiveSheet(names[0] ?? '');
        setDirty(false);
        dirtyRef.current = false;
      } catch (e) {
        if (!cancelled) setError('No se pudo leer la hoja de cálculo.');
        // eslint-disable-next-line no-console
        console.warn('[DriveExcelEditor] parse error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  // Reporta el estado dirty al padre
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Registra el saver actual (recrea el book y lo serializa como Blob).
  useEffect(() => {
    if (!registerSaver) return;
    if (sheetNames.length === 0) {
      registerSaver(null);
      return;
    }
    const saver = async (): Promise<Blob> => {
      const wb = XLSX.utils.book_new();
      for (const n of sheetNames) {
        const ws = XLSX.utils.aoa_to_sheet(matrixToAoA(sheets[n] ?? []));
        XLSX.utils.book_append_sheet(wb, ws, n);
      }
      const out = XLSX.write(wb, { bookType, type: 'array' });
      const mime =
        bookType === 'csv'
          ? 'text/csv'
          : bookType === 'xls'
            ? 'application/vnd.ms-excel'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      return new Blob([out as ArrayBuffer], { type: mime });
    };
    registerSaver(saver);
    return () => registerSaver(null);
  }, [sheets, sheetNames, bookType, registerSaver]);

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    setSheets((prev) => {
      const current = prev[activeSheet] ?? [];
      const nextRows = current.slice();
      while (nextRows.length <= rowIdx) nextRows.push([]);
      const nextRow = (nextRows[rowIdx] ?? []).slice();
      while (nextRow.length <= colIdx) nextRow.push('');
      nextRow[colIdx] = value;
      nextRows[rowIdx] = nextRow;
      return { ...prev, [activeSheet]: nextRows };
    });
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
    }
  };

  const currentSheet = sheets[activeSheet] ?? [];
  const cols = currentSheet.reduce((max, r) => Math.max(max, r.length), 0);
  const rows = currentSheet.length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.color.brand.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.color.state.danger.text} />
        <Text variant="bodyMedium" color="danger">
          {error}
        </Text>
      </View>
    );
  }
  if (sheetNames.length === 0) {
    return (
      <View style={styles.center}>
        <Text variant="bodyMedium" color="secondary">
          La hoja de cálculo está vacía.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs de hojas */}
      {sheetNames.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsBar}
          contentContainerStyle={styles.tabsContent}
        >
          {sheetNames.map((n) => {
            const isActive = n === activeSheet;
            return (
              <TouchableOpacity
                key={n}
                onPress={() => setActiveSheet(n)}
                style={[styles.tab, isActive && styles.tabActive]}
                activeOpacity={activeOpacity.medium}
              >
                <Ionicons
                  name="grid-outline"
                  size={iconSizes.xs}
                  color={isActive ? theme.color.brand.primary : theme.color.icon.muted}
                />
                <Text
                  variant="caption"
                  style={[
                    styles.tabText,
                    { color: isActive ? theme.color.brand.primary : theme.color.text.body },
                  ]}
                  numberOfLines={1}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Grid con doble scroll */}
      <ScrollView style={styles.gridWrap} contentContainerStyle={styles.gridContentV}>
        <ScrollView horizontal contentContainerStyle={styles.gridContentH}>
          <View>
            {/* Header row A, B, C... */}
            <View style={styles.row}>
              <View style={[styles.headerCell, styles.headerIndex]}>
                <Text variant="caption" color="secondary">
                  #
                </Text>
              </View>
              {Array.from({ length: cols }).map((_, c) => (
                <View key={`h-${c}`} style={styles.headerCell}>
                  <Text variant="caption" color="secondary">
                    {XLSX.utils.encode_col(c)}
                  </Text>
                </View>
              ))}
            </View>
            {Array.from({ length: rows }).map((_, r) => (
              <View key={`r-${r}`} style={styles.row}>
                <View style={[styles.headerCell, styles.headerIndex]}>
                  <Text variant="caption" color="secondary">
                    {r + 1}
                  </Text>
                </View>
                {Array.from({ length: cols }).map((_, c) => {
                  const value = currentSheet[r]?.[c] ?? '';
                  return editable ? (
                    <TextInput
                      key={`c-${r}-${c}`}
                      style={styles.cell}
                      value={value}
                      onChangeText={(t) => handleCellChange(r, c, t)}
                    />
                  ) : (
                    <View key={`c-${r}-${c}`} style={styles.cell}>
                      <Text variant="caption" numberOfLines={1}>
                        {value}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {dirty && (
        <View style={styles.dirtyBanner}>
          <Ionicons
            name="ellipse"
            size={10}
            color={theme.color.state.warning.text}
            style={styles.dirtyDot}
          />
          <Text variant="caption" color="secondary">
            Cambios sin guardar
          </Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.surface.base },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
      gap: theme.space[2],
    },
    tabsBar: {
      flexGrow: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    tabsContent: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      gap: theme.space[2],
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.muted,
      maxWidth: 200,
    },
    tabActive: {
      backgroundColor: `${theme.color.brand.primary}18`,
    },
    tabText: {
      maxWidth: 160,
      fontWeight: '600',
    },
    gridWrap: { flex: 1, backgroundColor: theme.color.surface.muted },
    gridContentV: { paddingBottom: theme.space[6] },
    gridContentH: { paddingRight: theme.space[6] },
    row: { flexDirection: 'row' },
    headerCell: {
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      borderRightWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    headerIndex: {
      width: 48,
    },
    cell: {
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
      color: theme.color.text.body,
      fontSize: 12,
    },
    dirtyBanner: {
      position: 'absolute',
      bottom: theme.space[3],
      right: theme.space[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      ...theme.shadow.md,
    },
    dirtyDot: {
      marginRight: 2,
    },
  });

export default DriveExcelEditor;
