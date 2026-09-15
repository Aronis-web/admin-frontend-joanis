import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { Caption } from '@/design-system';
import { spacing } from '@/design-system/tokens';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { DateRangePicker } from '@/components/DateRangePicker';

/**
 * Convierte un string ISO (YYYY-MM-DD) a Date en horario local a mediodia
 * para evitar corrimientos por zona horaria. Devuelve null si el string es vacio.
 */
const parseIsoDate = (value: string | undefined | null): Date | null => {
  if (!value) return null;
  const clean = value.split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

/** Formatea un Date a `YYYY-MM-DD` (formato que espera el backend). */
const formatIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─────────────────────────────────────────────────────────────
// Single date field
// ─────────────────────────────────────────────────────────────
interface PayrollDateFieldProps {
  label: string;
  value: string; // YYYY-MM-DD (o vacio)
  onChange: (value: string) => void;
  error?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  title?: string;
  icon?: string;
}

/**
 * Wrapper del `DatePicker`/`DatePickerButton` del dashboard adaptado a payroll.
 * Trabaja con strings ISO (YYYY-MM-DD) que es lo que consumen los DTOs.
 */
export const PayrollDateField: React.FC<PayrollDateFieldProps> = ({
  label,
  value,
  onChange,
  error,
  minimumDate,
  maximumDate,
  placeholder,
  title,
  icon,
}) => {
  const [open, setOpen] = useState(false);
  const seed = parseIsoDate(value) ?? new Date();

  return (
    <View style={styles.wrapper}>
      <DatePickerButton
        label={label}
        value={value}
        onPress={() => setOpen(true)}
        placeholder={placeholder}
        icon={icon}
      />
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
      <DatePicker
        visible={open}
        date={seed}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        title={title ?? label}
        onCancel={() => setOpen(false)}
        onConfirm={(d) => {
          onChange(formatIsoDate(d));
          setOpen(false);
        }}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Date range field
// ─────────────────────────────────────────────────────────────
interface PayrollDateRangeFieldProps {
  label: string;
  startValue: string;
  endValue: string;
  onChange: (start: string, end: string) => void;
  startError?: string;
  endError?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
}

/**
 * Wrapper del `DateRangePicker` del dashboard para pares (desde/hasta).
 * Un unico boton abre el modal de rango y devuelve ambos strings ISO.
 */
export const PayrollDateRangeField: React.FC<PayrollDateRangeFieldProps> = ({
  label,
  startValue,
  endValue,
  onChange,
  startError,
  endError,
  minimumDate,
  maximumDate,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const start = parseIsoDate(startValue) ?? new Date();
  const end = parseIsoDate(endValue) ?? start;

  const formattedRange = startValue && endValue ? `${startValue}  →  ${endValue}` : '';

  return (
    <View style={styles.wrapper}>
      <DatePickerButton
        label={label}
        value={formattedRange}
        onPress={() => setOpen(true)}
        placeholder="Seleccionar rango"
        icon="calendar"
      />
      {(startError || endError) && <Caption style={styles.error}>{startError ?? endError}</Caption>}
      <DateRangePicker
        visible={open}
        startDate={start}
        endDate={end}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        title={title ?? label}
        onCancel={() => setOpen(false)}
        onConfirm={(s, e) => {
          onChange(formatIsoDate(s), formatIsoDate(e));
          setOpen(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { gap: spacing[1] },
  error: { color: '#c0392b' },
});

export default PayrollDateField;
