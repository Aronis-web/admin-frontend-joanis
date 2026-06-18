/**
 * Tabla de participantes para el modal V2 de reparto.
 *
 * - Headers y celdas comparten una constante `COLUMNS` con ancho fijo por
 *   columna, garantizando alineación perfecta sin importar el contenido.
 * - Si la columna `Medias` está deshabilitada (factor impar o switch off)
 *   se oculta TANTO del header como de las filas, manteniendo coherencia.
 * - La tabla se envuelve en un ScrollView horizontal: en pantallas chicas
 *   el usuario puede desplazarse lateralmente sin perder las filas.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { ParticipantRowV2 } from './types';

type Styles = ReturnType<typeof createStyles>;
type BadgeColors = Record<CoverageBucket, { bg: string; fg: string }>;

// ============================================================
// Definición de columnas (única fuente de verdad para alineación)
// ============================================================
type ColumnKey =
  | 'name'
  | 'boxes'
  | 'halfBoxes'
  | 'loose'
  | 'total'
  | 'price'
  | 'coverage'
  | 'cost'
  | 'profit'
  | 'lock';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Participante', width: 180, align: 'left' },
  { key: 'boxes', label: 'Cajas', width: 70, align: 'center' },
  { key: 'halfBoxes', label: 'Medias', width: 70, align: 'center' },
  { key: 'loose', label: 'Sueltas', width: 70, align: 'center' },
  { key: 'total', label: 'Total', width: 70, align: 'center' },
  { key: 'price', label: 'Precio U.', width: 90, align: 'right' },
  { key: 'coverage', label: 'Cumplimiento campaña', width: 200, align: 'right' },
  { key: 'cost', label: 'Costo', width: 90, align: 'right' },
  { key: 'profit', label: 'Utilidad', width: 90, align: 'right' },
  { key: 'lock', label: '🔒', width: 40, align: 'center' },
];

const COLUMN_GAP = 4;

const formatMoney = (cents: number) => {
  const v = cents / 100;
  return v.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });
};

type CoverageBucket = 'complete' | 'inRange' | 'low' | 'over' | 'noExpected' | 'noPrice';

const makeCoverageBadgeColors = (theme: Theme): BadgeColors => ({
  complete: { bg: theme.color.state.success.background, fg: theme.color.state.success.text },
  inRange: { bg: theme.color.state.warning.background, fg: theme.color.state.warning.text },
  low: { bg: theme.color.state.danger.background, fg: theme.color.state.danger.text },
  over: { bg: theme.color.state.danger.background, fg: theme.color.state.danger.text },
  noExpected: { bg: theme.color.background.muted, fg: theme.color.text.subtle },
  noPrice: { bg: theme.color.surface.muted, fg: theme.color.text.muted },
});

const classifyCoverage = (
  expectedTotalCents: number,
  pct: number,
  hasPrice: boolean
): CoverageBucket => {
  if (!hasPrice) return 'noPrice';
  if (expectedTotalCents <= 0) return 'noExpected';
  if (pct > 102) return 'over';
  if (pct >= 98) return 'complete';
  if (pct >= 90) return 'inRange';
  return 'low';
};

const CoverageBadge: React.FC<{
  expectedTotalCents: number;
  totalSaleCents: number;
  pct: number;
  hasPrice: boolean;
  isPartial: boolean;
  styles: Styles;
  badgeColors: BadgeColors;
}> = ({ expectedTotalCents, totalSaleCents, pct, hasPrice, isPartial, styles, badgeColors }) => {
  const bucket = classifyCoverage(expectedTotalCents, pct, hasPrice);
  const cfg = badgeColors[bucket];
  let label: string;
  if (bucket === 'noPrice') label = 'Sin precio';
  else if (bucket === 'noExpected') label = 'Sin esperado';
  else label = `${isPartial ? '~' : ''}${pct.toFixed(1)}%`;
  const deltaCents = totalSaleCents - expectedTotalCents;
  return (
    <View style={styles.coverageWrap}>
      <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.badgeText, { color: cfg.fg }]}>{label}</Text>
      </View>
      {bucket !== 'noPrice' && bucket !== 'noExpected' && (
        <Text style={styles.coverageDelta}>
          {deltaCents >= 0 ? '+' : ''}
          {formatMoney(deltaCents)}
        </Text>
      )}
    </View>
  );
};

// ============================================================
// Cell wrapper (ancho/alineación derivados del ColumnDef)
// ============================================================
const Cell: React.FC<{ col: ColumnDef; children: React.ReactNode; styles: Styles }> = ({
  col,
  children,
  styles,
}) => {
  const alignItems =
    col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start';
  return <View style={[styles.cell, { width: col.width, alignItems }]}>{children}</View>;
};

// ============================================================
// Header
// ============================================================
const HeaderRow: React.FC<{ columns: ColumnDef[]; styles: Styles }> = ({ columns, styles }) => (
  <View style={[styles.row, styles.headerRow]}>
    {columns.map((col) => (
      <Cell key={col.key} col={col} styles={styles}>
        <Text style={[styles.headerText, { textAlign: col.align }]} numberOfLines={1}>
          {col.label}
        </Text>
      </Cell>
    ))}
  </View>
);

// ============================================================
// Row
// ============================================================
interface RowProps {
  row: ParticipantRowV2;
  columns: ColumnDef[];
  factor: number;
  allowHalfBox: boolean;
  showBoxes: boolean;
  /** Si true, la columna `loose` se renderiza como input editable; si false, read-only. */
  looseEditable: boolean;
  onChange: (id: string, next: { boxes?: number; halfBoxes?: number; loose?: number }) => void;
  onToggleLock: (id: string) => void;
  styles: Styles;
  badgeColors: BadgeColors;
}

const ParticipantRow: React.FC<RowProps> = ({
  row,
  columns,
  factor,
  allowHalfBox,
  showBoxes,
  looseEditable,
  onChange,
  onToggleLock,
  styles,
  badgeColors,
}) => {
  const evenFactor = factor > 1 && factor % 2 === 0;
  const showHalf = showBoxes && allowHalfBox && evenFactor;

  const renderCell = (col: ColumnDef) => {
    switch (col.key) {
      case 'name':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            <Text style={styles.participantName} numberOfLines={1}>
              {row.participantName}
            </Text>
            {row.hasPriceWarning && (
              <Text style={styles.priceWarning} numberOfLines={1}>
                ⚠️ Sin precio configurado
              </Text>
            )}
          </Cell>
        );
      case 'boxes':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            {showBoxes ? (
              <TextInput
                style={[styles.qtyInput, { width: col.width - 8 }]}
                keyboardType="numeric"
                value={String(row.boxes)}
                onChangeText={(t) => onChange(row.participantId, { boxes: parseInt(t, 10) || 0 })}
                placeholder="0"
              />
            ) : (
              <Text style={styles.qtyDisabledText}>—</Text>
            )}
          </Cell>
        );
      case 'halfBoxes':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            {showHalf ? (
              <TextInput
                style={[styles.qtyInput, { width: col.width - 8 }]}
                keyboardType="numeric"
                value={String(row.halfBoxes)}
                onChangeText={(t) =>
                  onChange(row.participantId, { halfBoxes: parseInt(t, 10) || 0 })
                }
                placeholder="0"
              />
            ) : (
              <Text style={styles.qtyDisabledText}>—</Text>
            )}
          </Cell>
        );
      case 'loose':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            {looseEditable ? (
              <TextInput
                style={[styles.qtyInput, { width: col.width - 8 }]}
                keyboardType="numeric"
                value={String(row.loose)}
                onChangeText={(t) => onChange(row.participantId, { loose: parseInt(t, 10) || 0 })}
                placeholder="0"
              />
            ) : row.loose > 0 ? (
              <Text style={styles.remainderBadgeText}>+{row.loose}</Text>
            ) : (
              <Text style={styles.qtyDisabledText}>—</Text>
            )}
          </Cell>
        );
      case 'total':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            <Text style={styles.totalText}>{row.quantityBase}</Text>
          </Cell>
        );
      case 'price':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            <Text style={styles.moneyText}>{formatMoney(row.unitPriceCents)}</Text>
          </Cell>
        );
      case 'coverage':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            <Text style={styles.moneyText}>
              {formatMoney(row.totalSaleCents)}
              <Text style={styles.coverageExpected}>
                {' / '}
                {formatMoney(row.expectedTotalCents)}
              </Text>
            </Text>
            <Text style={styles.coverageBreakdown}>
              Prev: {formatMoney(row.previousSaleCents)} · Este: {formatMoney(row.realSaleCents)}
            </Text>
            <CoverageBadge
              expectedTotalCents={row.expectedTotalCents}
              totalSaleCents={row.totalSaleCents}
              pct={row.campaignCoveragePercent}
              hasPrice={!row.hasPriceWarning}
              isPartial={row.previousSaleIsPartial}
              styles={styles}
              badgeColors={badgeColors}
            />
          </Cell>
        );
      case 'cost':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            <Text style={styles.moneyText}>{formatMoney(row.totalCostCents)}</Text>
          </Cell>
        );
      case 'profit':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            <Text style={[styles.moneyText, row.profitCents < 0 && styles.profitNegative]}>
              {formatMoney(row.profitCents)}
            </Text>
          </Cell>
        );
      case 'lock':
        return (
          <Cell key={col.key} col={col} styles={styles}>
            <TouchableOpacity onPress={() => onToggleLock(row.participantId)}>
              <Text style={styles.lockIcon}>{row.locked ? '🔒' : '🔓'}</Text>
            </TouchableOpacity>
          </Cell>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.row, row.locked && styles.rowLocked]}>{columns.map(renderCell)}</View>
  );
};

// ============================================================
// Table
// ============================================================
interface TableProps {
  internalRows: ParticipantRowV2[];
  externalRows: ParticipantRowV2[];
  factor: number;
  allowHalfBox: boolean;
  allowLoose: boolean;
  mode: 'units' | 'presentation';
  onChange: RowProps['onChange'];
  onToggleLock: RowProps['onToggleLock'];
}

export const ParticipantDistributionTable: React.FC<TableProps> = ({
  internalRows,
  externalRows,
  factor,
  allowHalfBox,
  allowLoose,
  mode,
  onChange,
  onToggleLock,
}) => {
  const styles = useThemedStyles(createStyles);
  const badgeColors = useThemedStyles(makeCoverageBadgeColors);
  const showBoxes = mode === 'presentation' && factor > 1;
  const evenFactor = factor > 1 && factor % 2 === 0;
  const showHalf = showBoxes && allowHalfBox && evenFactor;
  // Cuando allowLoose=OFF, normalmente ocultamos la columna Sueltas. PERO si
  // alguna fila tiene loose > 0 (porque absorbió el resto que no completa
  // una caja) la mostramos en modo read-only para que el usuario vea el
  // ajuste de esa sede.
  const anyHasLoose = useMemo(
    () => [...internalRows, ...externalRows].some((r) => r.loose > 0),
    [internalRows, externalRows]
  );
  const looseEditable = allowLoose || !showBoxes;
  const showLoose = looseEditable || anyHasLoose;

  // Calculamos las columnas a mostrar UNA sola vez para header y filas.
  const columns = useMemo<ColumnDef[]>(() => {
    return ALL_COLUMNS.filter((c) => {
      if (c.key === 'boxes' && !showBoxes) return false;
      if (c.key === 'halfBoxes' && !showHalf) return false;
      if (c.key === 'loose' && !showLoose) return false;
      return true;
    });
  }, [showBoxes, showHalf, showLoose]);

  const totalWidth = useMemo(
    () => columns.reduce((sum, c) => sum + c.width + COLUMN_GAP, 0),
    [columns]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ minWidth: totalWidth }}
      >
        <View style={{ width: totalWidth }}>
          <View style={styles.groupTitleBox}>
            <Text style={styles.groupTitle}>Sedes internas</Text>
            <Text style={styles.groupHint}>
              Participan del auto-reparto según el tipo seleccionado.
            </Text>
          </View>
          <HeaderRow columns={columns} styles={styles} />
          {internalRows.length === 0 ? (
            <Text style={styles.emptyText}>No hay sedes internas elegibles.</Text>
          ) : (
            internalRows.map((r) => (
              <ParticipantRow
                key={r.participantId}
                row={r}
                columns={columns}
                factor={factor}
                allowHalfBox={allowHalfBox}
                showBoxes={showBoxes}
                looseEditable={looseEditable}
                onChange={onChange}
                onToggleLock={onToggleLock}
                styles={styles}
                badgeColors={badgeColors}
              />
            ))
          )}

          {externalRows.length > 0 && (
            <>
              <View style={styles.groupTitleBox}>
                <Text style={styles.groupTitle}>Empresas externas</Text>
                <Text style={styles.groupHint}>
                  También participan del auto-reparto cuando el tipo es "Todos" o "Solo Externas".
                </Text>
              </View>
              <HeaderRow columns={columns} styles={styles} />
              {externalRows.map((r) => (
                <ParticipantRow
                  key={r.participantId}
                  row={r}
                  columns={columns}
                  factor={factor}
                  allowHalfBox={allowHalfBox}
                  showBoxes={showBoxes}
                  looseEditable={looseEditable}
                  onChange={onChange}
                  onToggleLock={onToggleLock}
                  styles={styles}
                  badgeColors={badgeColors}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    groupTitleBox: {
      marginTop: theme.space[2],
      marginBottom: theme.space[1],
      gap: 2,
    },
    groupTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    groupHint: {
      fontSize: 11,
      color: theme.color.text.subtle,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[1],
      gap: COLUMN_GAP,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerRow: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.sm,
      paddingHorizontal: theme.space[1],
    },
    rowLocked: {
      backgroundColor: theme.color.brand.primarySoft,
    },
    headerText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.muted,
      width: '100%',
    },
    cell: {
      justifyContent: 'center',
    },
    participantName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
      width: '100%',
    },
    priceWarning: {
      fontSize: 10,
      color: theme.color.text.warning,
      width: '100%',
    },
    qtyInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.sm,
      paddingVertical: 4,
      paddingHorizontal: 6,
      textAlign: 'center',
      color: theme.color.text.heading,
      backgroundColor: theme.color.surface.base,
    },
    qtyDisabledText: {
      color: theme.color.text.disabled,
    },
    remainderBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.color.brand.primarySoft,
      borderRadius: theme.radii.sm,
    },
    totalText: {
      fontWeight: '700',
      color: theme.color.text.heading,
      fontSize: 13,
    },
    moneyText: {
      fontSize: 12,
      color: theme.color.text.muted,
      textAlign: 'right',
      width: '100%',
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.radii.full,
      marginTop: 2,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    coverageWrap: {
      alignItems: 'flex-end',
      gap: 2,
      marginTop: 2,
    },
    coverageBreakdown: {
      fontSize: 10,
      color: theme.color.text.subtle,
      textAlign: 'right',
      width: '100%',
    },
    coverageExpected: {
      color: theme.color.text.subtle,
      fontSize: 11,
    },
    coverageDelta: {
      fontSize: 10,
      color: theme.color.text.subtle,
    },
    profitNegative: {
      color: theme.color.text.danger,
    },
    lockIcon: {
      fontSize: 16,
    },
    emptyText: {
      color: theme.color.text.subtle,
      fontStyle: 'italic',
      paddingVertical: theme.space[2],
      textAlign: 'center',
      width: '100%',
    },
  });
