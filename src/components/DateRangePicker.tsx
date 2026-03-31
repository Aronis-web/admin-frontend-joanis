/**
 * DateRangePicker.tsx
 *
 * Componente para seleccionar un rango de fechas (fecha inicio y fecha fin)
 * en un solo modal con calendario visual.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface DateRangePickerProps {
  visible: boolean;
  startDate?: Date;
  endDate?: Date;
  onConfirm: (startDate: Date, endDate: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  visible,
  startDate = new Date(),
  endDate = new Date(),
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate,
  title = 'Seleccionar Rango de Fechas',
}) => {
  const { width } = useWindowDimensions();

  // Calcular el ancho de cada celda para que quepan exactamente 7 columnas
  const availableWidth = width - 16;
  const cellWidth = Math.floor(availableWidth / 7);

  // Helper function to safely create a Date from a string or use existing Date
  const safeDate = (d: Date | string): Date => {
    if (typeof d === 'string') {
      const [year, month, day] = d.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    return d;
  };

  // State for the selected range
  const [selectedStartDate, setSelectedStartDate] = useState<Date>(() => safeDate(startDate));
  const [selectedEndDate, setSelectedEndDate] = useState<Date>(() => safeDate(endDate));

  // Which date are we currently selecting? 'start' or 'end'
  const [selectingDate, setSelectingDate] = useState<'start' | 'end'>('start');

  // Current displayed month/year for navigation
  const [displayedMonth, setDisplayedMonth] = useState<number>(() => safeDate(startDate).getMonth());
  const [displayedYear, setDisplayedYear] = useState<number>(() => safeDate(startDate).getFullYear());

  // View mode: 'day', 'month', 'year'
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');

  // Reset state when modal becomes visible
  useEffect(() => {
    if (visible) {
      const start = safeDate(startDate);
      const end = safeDate(endDate);
      setSelectedStartDate(start);
      setSelectedEndDate(end);
      setDisplayedMonth(start.getMonth());
      setDisplayedYear(start.getFullYear());
      setSelectingDate('start');
      setViewMode('day');
    }
  }, [visible, startDate, endDate]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatShortDate = (date: Date) => {
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const isInRange = (date: Date) => {
    const time = date.getTime();
    const startTime = selectedStartDate.getTime();
    const endTime = selectedEndDate.getTime();
    return time > startTime && time < endTime;
  };

  const generateDays = () => {
    const daysInMonth = getDaysInMonth(displayedYear, displayedMonth);
    const days = [];

    // Obtener el día de la semana del primer día del mes
    const firstDayOfMonth = new Date(displayedYear, displayedMonth, 1).getDay();

    // Agregar días vacíos al inicio
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({
        day: null,
        date: null,
        isDisabled: true,
        isStartDate: false,
        isEndDate: false,
        isInRange: false,
        isEmpty: true,
      });
    }

    // Agregar los días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(displayedYear, displayedMonth, i, 12, 0, 0, 0);
      const isDisabled =
        (minimumDate && currentDate < minimumDate) || (maximumDate && currentDate > maximumDate);

      days.push({
        day: i,
        date: currentDate,
        isDisabled,
        isStartDate: isSameDay(currentDate, selectedStartDate),
        isEndDate: isSameDay(currentDate, selectedEndDate),
        isInRange: isInRange(currentDate),
        isEmpty: false,
      });
    }

    return days;
  };

  const generateMonths = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const currentDate = new Date(displayedYear, i, 1);
      const isDisabled =
        (minimumDate &&
          currentDate < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1)) ||
        (maximumDate &&
          currentDate > new Date(maximumDate.getFullYear(), maximumDate.getMonth(), 1));

      months.push({
        month: i,
        date: currentDate,
        isDisabled,
        isSelected: i === displayedMonth,
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
        isSelected: i === displayedYear,
      });
    }
    return years;
  };

  const handleDaySelect = (day: number) => {
    const newDate = new Date(displayedYear, displayedMonth, day, 12, 0, 0, 0);

    if (selectingDate === 'start') {
      setSelectedStartDate(newDate);
      // If new start date is after end date, adjust end date
      if (newDate > selectedEndDate) {
        setSelectedEndDate(newDate);
      }
      // Automatically switch to selecting end date
      setSelectingDate('end');
    } else {
      // If selected end date is before start date, swap them
      if (newDate < selectedStartDate) {
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(newDate);
      } else {
        setSelectedEndDate(newDate);
      }
      // After selecting end date, switch back to start for next selection
      setSelectingDate('start');
    }
  };

  const handleMonthSelect = (month: number) => {
    setDisplayedMonth(month);
    setViewMode('day');
  };

  const handleYearSelect = (year: number) => {
    setDisplayedYear(year);
    setViewMode('month');
  };

  const handleConfirm = () => {
    const confirmedStartDate = new Date(
      selectedStartDate.getFullYear(),
      selectedStartDate.getMonth(),
      selectedStartDate.getDate(),
      12, 0, 0, 0
    );
    const confirmedEndDate = new Date(
      selectedEndDate.getFullYear(),
      selectedEndDate.getMonth(),
      selectedEndDate.getDate(),
      12, 0, 0, 0
    );
    onConfirm(confirmedStartDate, confirmedEndDate);
  };

  const goToPreviousMonth = () => {
    if (displayedMonth === 0) {
      setDisplayedMonth(11);
      setDisplayedYear(displayedYear - 1);
    } else {
      setDisplayedMonth(displayedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (displayedMonth === 11) {
      setDisplayedMonth(0);
      setDisplayedYear(displayedYear + 1);
    } else {
      setDisplayedMonth(displayedMonth + 1);
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const dayNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{title}</Text>
              <TouchableOpacity onPress={handleConfirm} style={styles.headerButton}>
                <Text style={[styles.headerButtonText, styles.headerButtonConfirm]}>Confirmar</Text>
              </TouchableOpacity>
            </View>

            {/* Date Range Display */}
            <View style={styles.dateRangeDisplay}>
              <TouchableOpacity
                style={[
                  styles.dateBox,
                  selectingDate === 'start' && styles.dateBoxActive,
                ]}
                onPress={() => setSelectingDate('start')}
              >
                <Text style={styles.dateBoxLabel}>Desde</Text>
                <View style={styles.dateBoxContent}>
                  <Ionicons
                    name="calendar"
                    size={18}
                    color={selectingDate === 'start' ? colors.primary[600] : colors.neutral[500]}
                  />
                  <Text style={[
                    styles.dateBoxValue,
                    selectingDate === 'start' && styles.dateBoxValueActive,
                  ]}>
                    {formatShortDate(selectedStartDate)}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.dateRangeSeparator}>
                <Ionicons name="arrow-forward" size={20} color={colors.neutral[400]} />
              </View>

              <TouchableOpacity
                style={[
                  styles.dateBox,
                  selectingDate === 'end' && styles.dateBoxActive,
                ]}
                onPress={() => setSelectingDate('end')}
              >
                <Text style={styles.dateBoxLabel}>Hasta</Text>
                <View style={styles.dateBoxContent}>
                  <Ionicons
                    name="calendar"
                    size={18}
                    color={selectingDate === 'end' ? colors.primary[600] : colors.neutral[500]}
                  />
                  <Text style={[
                    styles.dateBoxValue,
                    selectingDate === 'end' && styles.dateBoxValueActive,
                  ]}>
                    {formatShortDate(selectedEndDate)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Picker Container */}
            <View style={styles.pickerContainer}>
              {/* Month/Year Navigation */}
              <View style={styles.monthYearNav}>
                <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
                  <Ionicons name="chevron-back" size={24} color={colors.neutral[700]} />
                </TouchableOpacity>

                <View style={styles.monthYearSelector}>
                  <TouchableOpacity
                    style={styles.monthYearButton}
                    onPress={() => setViewMode('month')}
                  >
                    <Text style={styles.monthYearText}>{monthNames[displayedMonth]}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.monthYearButton}
                    onPress={() => setViewMode('year')}
                  >
                    <Text style={styles.monthYearText}>{displayedYear}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
                  <Ionicons name="chevron-forward" size={24} color={colors.neutral[700]} />
                </TouchableOpacity>
              </View>

              {/* Day View */}
              {viewMode === 'day' && (
                <>
                  <View style={styles.weekDays}>
                    {dayNames.map((day) => (
                      <View key={day} style={{ width: cellWidth, alignItems: 'center' }}>
                        <Text style={styles.weekDayText}>{day}</Text>
                      </View>
                    ))}
                  </View>
                  <ScrollView
                    style={styles.daysContainer}
                    contentContainerStyle={styles.daysScrollContent}
                  >
                    <View style={styles.daysGrid}>
                      {generateDays().map(({ day, date, isDisabled, isStartDate, isEndDate, isInRange, isEmpty }, index) => (
                        <TouchableOpacity
                          key={`day-${index}`}
                          style={[
                            styles.dayButton,
                            { width: cellWidth },
                            isInRange && styles.dayButtonInRange,
                            isStartDate && styles.dayButtonStart,
                            isEndDate && styles.dayButtonEnd,
                            (isStartDate && isEndDate) && styles.dayButtonSingle,
                            isDisabled && styles.dayButtonDisabled,
                            isEmpty && styles.dayButtonEmpty,
                          ]}
                          onPress={() => {
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
                              isInRange && styles.dayButtonTextInRange,
                              (isStartDate || isEndDate) && styles.dayButtonTextSelected,
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
                    {generateMonths().map(({ month, isDisabled, isSelected }) => (
                      <TouchableOpacity
                        key={month}
                        style={[
                          styles.monthButton,
                          isSelected && styles.monthButtonSelected,
                          isDisabled && styles.monthButtonDisabled,
                        ]}
                        onPress={() => {
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
                    {generateYears().map(({ year, isDisabled, isSelected }) => (
                      <TouchableOpacity
                        key={year}
                        style={[
                          styles.yearButton,
                          isSelected && styles.yearButtonSelected,
                          isDisabled && styles.yearButtonDisabled,
                        ]}
                        onPress={() => {
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

            {/* Instructions */}
            <View style={styles.instructions}>
              <Ionicons name="information-circle-outline" size={16} color={colors.neutral[500]} />
              <Text style={styles.instructionsText}>
                {selectingDate === 'start'
                  ? 'Selecciona la fecha de inicio'
                  : 'Selecciona la fecha de fin'}
              </Text>
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '85%',
  },
  content: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerButton: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  headerButtonConfirm: {
    color: colors.primary[600],
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.background.secondary,
  },
  dateBox: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    alignItems: 'center',
  },
  dateBoxActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  dateBoxLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  dateBoxContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dateBoxValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  dateBoxValueActive: {
    color: colors.primary[700],
  },
  dateRangeSeparator: {
    paddingHorizontal: spacing[3],
  },
  pickerContainer: {
    minHeight: 320,
  },
  monthYearNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  navButton: {
    padding: spacing[2],
  },
  monthYearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthYearButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  weekDays: {
    flexDirection: 'row',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    textAlign: 'center',
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
  },
  dayButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonInRange: {
    backgroundColor: colors.primary[100],
  },
  dayButtonStart: {
    backgroundColor: colors.primary[500],
    borderTopLeftRadius: borderRadius.full,
    borderBottomLeftRadius: borderRadius.full,
  },
  dayButtonEnd: {
    backgroundColor: colors.primary[500],
    borderTopRightRadius: borderRadius.full,
    borderBottomRightRadius: borderRadius.full,
  },
  dayButtonSingle: {
    borderRadius: borderRadius.full,
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
    color: colors.neutral[800],
  },
  dayButtonTextInRange: {
    color: colors.primary[700],
  },
  dayButtonTextSelected: {
    color: colors.neutral[0],
  },
  dayButtonTextDisabled: {
    color: colors.neutral[400],
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
    padding: spacing[4],
    justifyContent: 'center',
  },
  monthButton: {
    width: 80,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    margin: spacing[2],
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  monthButtonSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  monthButtonDisabled: {
    opacity: 0.3,
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  monthButtonTextSelected: {
    color: colors.neutral[0],
  },
  monthButtonTextDisabled: {
    color: colors.neutral[400],
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
    padding: spacing[4],
    justifyContent: 'center',
  },
  yearButton: {
    width: 70,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    margin: spacing[1.5],
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  yearButtonSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  yearButtonDisabled: {
    opacity: 0.3,
  },
  yearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  yearButtonTextSelected: {
    color: colors.neutral[0],
  },
  yearButtonTextDisabled: {
    color: colors.neutral[400],
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.neutral[50],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing[2],
  },
  instructionsText: {
    fontSize: 13,
    color: colors.neutral[600],
  },
});

export default DateRangePicker;
