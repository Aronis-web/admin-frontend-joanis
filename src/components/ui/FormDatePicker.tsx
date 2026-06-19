import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface FormDatePickerProps {
  label: string;
  placeholder?: string;
  value?: string; // ISO 8601 format (YYYY-MM-DD)
  onValueChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
}

export const FormDatePicker: React.FC<FormDatePickerProps> = ({
  label,
  placeholder = 'Seleccionar fecha...',
  value,
  onValueChange,
  error,
  disabled = false,
  maximumDate = new Date(),
  minimumDate = new Date(1900, 0, 1),
}) => {
  const styles = useThemedStyles(createStyles);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(
    value ? new Date(value).getFullYear() : new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    value ? new Date(value).getMonth() : new Date().getMonth()
  );
  const [selectedDay, setSelectedDay] = useState<number>(
    value ? new Date(value).getDate() : new Date().getDate()
  );

  const formatDate = (dateString?: string): string => {
    if (!dateString) {
      return placeholder;
    }

    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const generateYears = (): number[] => {
    const maxYear = maximumDate.getFullYear();
    const minYear = minimumDate.getFullYear();
    const years: number[] = [];
    for (let year = maxYear; year >= minYear; year--) {
      years.push(year);
    }
    return years;
  };

  const generateMonths = (): { value: number; label: string }[] => {
    const months = [
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
    return months.map((month, index) => ({ value: index, label: month }));
  };

  const generateDays = (): number[] => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const handleConfirm = () => {
    const year = selectedYear;
    const month = String(selectedMonth + 1).padStart(2, '0');
    const day = String(selectedDay).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;
    onValueChange(isoDate);
    setShowPicker(false);
  };

  const handleCancel = () => {
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.dateButton,
          error && styles.dateButtonError,
          disabled && styles.dateButtonDisabled,
        ]}
        onPress={() => !disabled && setShowPicker(true)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.dateButtonText,
            !value && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
        >
          {formatDate(value)}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={showPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCancel}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerContainer}>
              {/* Year Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerColumnTitle}>Año</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {generateYears().map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.pickerItem,
                        selectedYear === year && styles.pickerItemSelected,
                      ]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          selectedYear === year && styles.pickerItemTextSelected,
                        ]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Month Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerColumnTitle}>Mes</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {generateMonths().map((month) => (
                    <TouchableOpacity
                      key={month.value}
                      style={[
                        styles.pickerItem,
                        selectedMonth === month.value && styles.pickerItemSelected,
                      ]}
                      onPress={() => setSelectedMonth(month.value)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          selectedMonth === month.value && styles.pickerItemTextSelected,
                        ]}
                      >
                        {month.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Day Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerColumnTitle}>Día</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {generateDays().map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.pickerItem, selectedDay === day && styles.pickerItemSelected]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          selectedDay === day && styles.pickerItemTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    marginBottom: theme.space[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[2],
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.surface.base,
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.xl,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3.5],
  },
  dateButtonError: {
    borderColor: theme.color.border.error,
  },
  dateButtonDisabled: {
    backgroundColor: theme.color.surface.disabled,
    opacity: 0.6,
  },
  dateButtonText: {
    fontSize: 15,
    color: theme.color.text.body,
    flex: 1,
  },
  placeholderText: {
    color: theme.color.text.placeholder,
  },
  disabledText: {
    color: theme.color.text.disabled,
  },
  calendarIcon: {
    fontSize: 18,
    marginLeft: theme.space[2],
  },
  errorText: {
    fontSize: 12,
    color: theme.color.text.danger,
    marginTop: theme.space[1],
    marginLeft: theme.space[1],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderTopLeftRadius: theme.radii['2xl'],
    borderTopRightRadius: theme.radii['2xl'],
    maxHeight: '70%',
    paddingBottom: theme.space[5],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.default,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.action.secondary.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.color.text.muted,
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[5],
    gap: theme.space[2],
  },
  pickerColumn: {
    flex: 1,
  },
  pickerColumnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.muted,
    textAlign: 'center',
    marginBottom: theme.space[2],
  },
  pickerScroll: {
    maxHeight: 200,
  },
  pickerItem: {
    paddingVertical: theme.space[2.5],
    paddingHorizontal: theme.space[2],
    borderRadius: theme.radii.lg,
    marginBottom: theme.space[1],
  },
  pickerItemSelected: {
    backgroundColor: theme.color.brand.accentSoft,
  },
  pickerItemText: {
    fontSize: 15,
    color: theme.color.text.body,
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: theme.color.brand.accent,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    gap: theme.space[3],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.space[3.5],
    borderRadius: theme.radii.xl,
    backgroundColor: theme.color.action.secondary.background,
    borderWidth: 1,
    borderColor: theme.color.border.default,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: theme.space[3.5],
    borderRadius: theme.radii.xl,
    backgroundColor: theme.color.brand.accent,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
});

export default FormDatePicker;
