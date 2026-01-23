import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';

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
    if (!dateString) return placeholder;

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
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCancel}
        >
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
                      style={[
                        styles.pickerItem,
                        selectedDay === day && styles.pickerItemSelected,
                      ]}
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateButtonError: {
    borderColor: '#EF4444',
  },
  dateButtonDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  dateButtonText: {
    fontSize: 15,
    color: '#1E293B',
    flex: 1,
  },
  placeholderText: {
    color: '#94A3B8',
  },
  disabledText: {
    color: '#94A3B8',
  },
  calendarIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 20,
    gap: 8,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerColumnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerScroll: {
    maxHeight: 200,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#1E293B',
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FormDatePicker;
