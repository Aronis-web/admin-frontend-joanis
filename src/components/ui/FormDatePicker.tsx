import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
  },
  dateButtonError: {
    borderColor: colors.danger[500],
  },
  dateButtonDisabled: {
    backgroundColor: colors.neutral[100],
    opacity: 0.6,
  },
  dateButtonText: {
    fontSize: 15,
    color: colors.neutral[800],
    flex: 1,
  },
  placeholderText: {
    color: colors.neutral[400],
  },
  disabledText: {
    color: colors.neutral[400],
  },
  calendarIcon: {
    fontSize: 18,
    marginLeft: spacing[2],
  },
  errorText: {
    fontSize: 12,
    color: colors.danger[500],
    marginTop: spacing[1],
    marginLeft: spacing[1],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '70%',
    paddingBottom: spacing[5],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[5],
    gap: spacing[2],
  },
  pickerColumn: {
    flex: 1,
  },
  pickerColumnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  pickerScroll: {
    maxHeight: 200,
  },
  pickerItem: {
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[1],
  },
  pickerItemSelected: {
    backgroundColor: colors.primary[50],
  },
  pickerItemText: {
    fontSize: 15,
    color: colors.neutral[800],
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: colors.primary[500],
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: spacing[3],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default FormDatePicker;
