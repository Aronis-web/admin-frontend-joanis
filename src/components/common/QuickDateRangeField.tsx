/**
 * QuickDateRangeField
 *
 * Selector de rango de fechas estilo "dashboard": chips de filtros rápidos
 * (Ayer, Hoy, 7/15/30 días, Este mes, Mes ant.) + un chip "Personalizar" que
 * abre el `DateRangePicker`. Por defecto arranca en "Este mes".
 *
 * Es controlado: expone `{ fromDate, toDate, filter }` (fechas ISO YYYY-MM-DD)
 * y notifica cambios vía `onChange`. Reutilizable en modales y pantallas.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChipGroup } from '@/design-system';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { DateRangePicker } from '@/components/DateRangePicker';
import { formatDateToString } from '@/utils/dateHelpers';
import {
  AVAILABLE_QUICK_FILTERS,
  getDateRangeByFilter,
  getThisMonthRange,
  QUICK_DATE_FILTERS,
  type QuickDateFilter,
} from '@/utils/dateFilters';

export interface QuickDateRangeValue {
  /** Fecha inicial ISO (YYYY-MM-DD). */
  fromDate: string;
  /** Fecha final ISO (YYYY-MM-DD). */
  toDate: string;
  /** Filtro rápido activo. */
  filter: QuickDateFilter;
}

/**
 * Genera un valor por defecto para el selector. Por defecto: "Este mes".
 */
export const getDefaultQuickDateRange = (
  filter: QuickDateFilter = QUICK_DATE_FILTERS.THIS_MONTH
): QuickDateRangeValue => {
  const range = getDateRangeByFilter(filter) ?? getThisMonthRange();
  return { fromDate: range.fromDate, toDate: range.toDate, filter };
};

const OPTIONS: Array<{ label: string; value: QuickDateFilter }> = [
  ...AVAILABLE_QUICK_FILTERS.map((f) => ({ label: `${f.icon} ${f.label}`, value: f.key })),
  { label: '🎯 Personalizar', value: QUICK_DATE_FILTERS.CUSTOM },
];

const displayDate = (iso: string): string => {
  if (!iso || iso.length < 10) return iso || '—';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
};

interface Props {
  value: QuickDateRangeValue;
  onChange: (value: QuickDateRangeValue) => void;
  label?: string;
  disabled?: boolean;
  /** Fecha máxima seleccionable en el picker personalizado. */
  maximumDate?: Date;
}

export const QuickDateRangeField: React.FC<Props> = ({
  value,
  onChange,
  label = 'Rango de fechas',
  disabled = false,
  maximumDate,
}) => {
  const styles = useThemedStyles(createStyles);
  const [showPicker, setShowPicker] = useState(false);

  const handleChip = (key?: QuickDateFilter) => {
    if (disabled || !key) return;
    if (key === QUICK_DATE_FILTERS.CUSTOM) {
      setShowPicker(true);
      return;
    }
    const range = getDateRangeByFilter(key);
    if (range) {
      onChange({ fromDate: range.fromDate, toDate: range.toDate, filter: key });
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <ChipGroup
        options={OPTIONS}
        selected={[value.filter]}
        onChange={(sel) => handleChip(sel[0] as QuickDateFilter | undefined)}
        variant="filled"
        size="small"
      />
      <Text style={styles.rangeText}>
        {displayDate(value.fromDate)} → {displayDate(value.toDate)}
      </Text>

      <DateRangePicker
        visible={showPicker}
        startDate={value.fromDate ? new Date(`${value.fromDate}T12:00:00`) : new Date()}
        endDate={value.toDate ? new Date(`${value.toDate}T12:00:00`) : new Date()}
        maximumDate={maximumDate}
        onConfirm={(start, end) => {
          onChange({
            fromDate: formatDateToString(start),
            toDate: formatDateToString(end),
            filter: QUICK_DATE_FILTERS.CUSTOM,
          });
          setShowPicker(false);
        }}
        onCancel={() => setShowPicker(false)}
        title={label}
      />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: theme.space[2],
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    rangeText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.body,
    },
  });

export default QuickDateRangeField;
