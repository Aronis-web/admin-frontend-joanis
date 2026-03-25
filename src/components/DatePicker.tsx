import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface DatePickerProps {
  visible: boolean;
  date?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  visible,
  date = new Date(),
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate,
  title = 'Seleccionar Fecha',
}) => {
  // Helper function to safely create a Date from a string or use existing Date
  const safeDate = (d: Date | string): Date => {
    if (typeof d === 'string') {
      // Parse ISO date string (YYYY-MM-DD) to avoid timezone issues
      const [year, month, day] = d.split('-').map(Number);
      // Create date at noon to avoid timezone issues
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    return d;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(() => safeDate(date));

  // Reset selectedDate when the date prop changes or modal becomes visible
  useEffect(() => {
    console.log('📅 DatePicker useEffect:', { visible, date, safeDate: safeDate(date) });
    if (visible) {
      setSelectedDate(safeDate(date));
    }
  }, [date, visible]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const generateDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const days = [];

    // Obtener el día de la semana del primer día del mes (0 = Domingo, 1 = Lunes, etc.)
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    // Ajustar para que Lunes sea 0 (en lugar de Domingo)
    // Si es Domingo (0), debe ser 6, si es Lunes (1) debe ser 0, etc.
    const firstDayAdjusted = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    // Agregar días vacíos al inicio para alinear con el día de la semana correcto
    for (let i = 0; i < firstDayAdjusted; i++) {
      days.push({
        day: null,
        date: null,
        isDisabled: true,
        isSelected: false,
        isEmpty: true,
      });
    }

    // Agregar los días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i);
      const isDisabled =
        (minimumDate && currentDate < minimumDate) || (maximumDate && currentDate > maximumDate);

      days.push({
        day: i,
        date: currentDate,
        isDisabled,
        isSelected: i === selectedDate.getDate(),
        isEmpty: false,
      });
    }

    return days;
  };

  const generateMonths = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const currentDate = new Date(selectedDate.getFullYear(), i, 1);
      const isDisabled =
        (minimumDate &&
          currentDate < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1)) ||
        (maximumDate &&
          currentDate > new Date(maximumDate.getFullYear(), maximumDate.getMonth(), 1));

      months.push({
        month: i,
        date: currentDate,
        isDisabled,
        isSelected: i === selectedDate.getMonth(),
      });
    }
    return months;
  };

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 10; i <= currentYear + 10; i++) {
      const currentDate = new Date(i, 0, 1);
      const isDisabled =
        (minimumDate && i < minimumDate.getFullYear()) ||
        (maximumDate && i > maximumDate.getFullYear());

      years.push({
        year: i,
        date: currentDate,
        isDisabled,
        isSelected: i === selectedDate.getFullYear(),
      });
    }
    return years;
  };

  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');

  // Reset viewMode when modal becomes visible
  useEffect(() => {
    if (visible) {
      setViewMode('day');
    }
  }, [visible]);

  const handleDaySelect = (day: number) => {
    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    console.log('📅 handleDaySelect:', { day, newDate });
    setSelectedDate(newDate);
  };

  const handleMonthSelect = (month: number) => {
    const newDate = new Date(selectedDate.getFullYear(), month, 1);
    console.log('📅 handleMonthSelect:', { month, newDate });
    setSelectedDate(newDate);
    setViewMode('day');
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, selectedDate.getMonth(), 1);
    console.log('📅 handleYearSelect:', { year, newDate });
    setSelectedDate(newDate);
    setViewMode('month');
  };

  const handleConfirm = () => {
    // Create a new date at noon to avoid timezone issues
    const confirmedDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      12, // Set to noon to avoid timezone issues
      0,
      0,
      0
    );
    console.log('📅 DatePicker confirm:', { selectedDate, confirmedDate });
    onConfirm(confirmedDate);
  };

  const monthNames = [
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

  const dayNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{title}</Text>
              <TouchableOpacity onPress={handleConfirm} style={styles.headerButton}>
                <Text style={[styles.headerButtonText, styles.headerButtonConfirm]}>Confirmar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateDisplay}>
              <Ionicons name="calendar" size={32} color="#6366F1" />
              <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            </View>

            <View style={styles.pickerContainer}>
              {/* Month/Year Selector */}
              <View style={styles.monthYearSelector}>
                <TouchableOpacity
                  style={styles.monthYearButton}
                  onPress={() => {
                    console.log('📅 Month selector pressed');
                    setViewMode('month');
                  }}
                >
                  <Text style={styles.monthYearText}>{monthNames[selectedDate.getMonth()]}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.monthYearButton}
                  onPress={() => {
                    console.log('📅 Year selector pressed');
                    setViewMode('year');
                  }}
                >
                  <Text style={styles.monthYearText}>{selectedDate.getFullYear()}</Text>
                </TouchableOpacity>
              </View>

              {/* Day View */}
              {viewMode === 'day' && (
                <>
                  <View style={styles.weekDays}>
                    {dayNames.map((day) => (
                      <Text key={day} style={styles.weekDayText}>
                        {day}
                      </Text>
                    ))}
                  </View>
                  <ScrollView
                    style={styles.daysContainer}
                    contentContainerStyle={styles.daysScrollContent}
                  >
                    <View style={styles.daysGrid}>
                      {generateDays().map(({ day, date, isDisabled, isSelected, isEmpty }, index) => (
                        <TouchableOpacity
                          key={`day-${index}`}
                          style={[
                            styles.dayButton,
                            isSelected && styles.dayButtonSelected,
                            isDisabled && styles.dayButtonDisabled,
                            isEmpty && styles.dayButtonEmpty,
                          ]}
                          onPress={() => {
                            console.log('📅 Day button pressed:', { day, isDisabled, isEmpty });
                            if (!isDisabled && !isEmpty && day !== null) {
                              handleDaySelect(day);
                            }
                          }}
                          disabled={isDisabled || isEmpty}
                          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dayButtonText,
                              isSelected && styles.dayButtonTextSelected,
                              isDisabled && styles.dayButtonTextDisabled,
                              isEmpty && styles.dayButtonTextEmpty,
                            ]}
                          >
                            {isEmpty ? '' : day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {/* Month View */}
              {viewMode === 'month' && (
                <ScrollView
                  style={styles.monthsContainer}
                  contentContainerStyle={styles.monthsScrollContent}
                >
                  <View style={styles.monthsGrid}>
                    {generateMonths().map(({ month, date, isDisabled, isSelected }) => (
                      <TouchableOpacity
                        key={month}
                        style={[
                          styles.monthButton,
                          isSelected && styles.monthButtonSelected,
                          isDisabled && styles.monthButtonDisabled,
                        ]}
                        onPress={() => {
                          console.log('📅 Month button pressed:', { month, isDisabled });
                          if (!isDisabled) {
                            handleMonthSelect(month);
                          }
                        }}
                        disabled={isDisabled}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.monthButtonText,
                            isSelected && styles.monthButtonTextSelected,
                            isDisabled && styles.monthButtonTextDisabled,
                          ]}
                        >
                          {monthNames[month].substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Year View */}
              {viewMode === 'year' && (
                <ScrollView
                  style={styles.yearsContainer}
                  contentContainerStyle={styles.yearsScrollContent}
                >
                  <View style={styles.yearsGrid}>
                    {generateYears().map(({ year, date, isDisabled, isSelected }) => (
                      <TouchableOpacity
                        key={year}
                        style={[
                          styles.yearButton,
                          isSelected && styles.yearButtonSelected,
                          isDisabled && styles.yearButtonDisabled,
                        ]}
                        onPress={() => {
                          console.log('📅 Year button pressed:', { year, isDisabled });
                          if (!isDisabled) {
                            handleYearSelect(year);
                          }
                        }}
                        disabled={isDisabled}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.yearButtonText,
                            isSelected && styles.yearButtonTextSelected,
                            isDisabled && styles.yearButtonTextDisabled,
                          ]}
                        >
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
};

interface DatePickerButtonProps {
  label: string;
  value?: string;
  onPress: () => void;
  placeholder?: string;
  icon?: string;
}

export const DatePickerButton: React.FC<DatePickerButtonProps> = ({
  label,
  value,
  onPress,
  placeholder = 'Seleccionar fecha',
  icon = 'calendar',
}) => {
  const formatDate = (dateString: string) => {
    if (!dateString) {
      return placeholder;
    }
    // Parse YYYY-MM-DD format to avoid timezone issues
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const handlePress = () => {
    console.log('📅 DatePickerButton pressed:', { label, value });
    onPress();
  };

  return (
    <View style={styles.buttonContainer}>
      <Text style={styles.buttonLabel}>{label}</Text>
      <TouchableOpacity style={styles.button} onPress={handlePress}>
        <Ionicons name={icon as any} size={20} color="#64748B" style={styles.buttonIcon} />
        <Text style={[styles.buttonText, !value && styles.buttonTextPlaceholder]}>
          {formatDate(value || '')}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  headerButtonConfirm: {
    color: '#6366F1',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 12,
  },
  pickerContainer: {
    flex: 1,
  },
  monthYearSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  monthYearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  weekDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    width: 40,
    height: 40,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 40,
    margin: 4,
  },
  daysContainer: {
    flex: 1,
  },
  daysScrollContent: {
    flexGrow: 1,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  dayButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    margin: 4,
  },
  dayButtonSelected: {
    backgroundColor: '#6366F1',
  },
  dayButtonDisabled: {
    opacity: 0.3,
  },
  dayButtonEmpty: {
    opacity: 0,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  dayButtonTextDisabled: {
    color: '#94A3B8',
  },
  dayButtonTextEmpty: {
    color: 'transparent',
  },
  monthsContainer: {
    flex: 1,
  },
  monthsScrollContent: {
    flexGrow: 1,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  monthButton: {
    width: 80,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthButtonSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  monthButtonDisabled: {
    opacity: 0.3,
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  monthButtonTextSelected: {
    color: '#FFFFFF',
  },
  monthButtonTextDisabled: {
    color: '#94A3B8',
  },
  yearsContainer: {
    flex: 1,
  },
  yearsScrollContent: {
    flexGrow: 1,
  },
  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  yearButton: {
    width: 80,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yearButtonSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  yearButtonDisabled: {
    opacity: 0.3,
  },
  yearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  yearButtonTextSelected: {
    color: '#FFFFFF',
  },
  yearButtonTextDisabled: {
    color: '#94A3B8',
  },
  buttonContainer: {
    marginBottom: 16,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  buttonTextPlaceholder: {
    color: '#94A3B8',
  },
});
