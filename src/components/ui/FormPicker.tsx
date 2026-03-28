import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Platform } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface PickerOption {
  label: string;
  value: string;
}

interface FormPickerProps {
  label: string;
  placeholder?: string;
  value?: string;
  options: PickerOption[];
  onValueChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export const FormPicker: React.FC<FormPickerProps> = ({
  label,
  placeholder = 'Seleccionar...',
  value,
  options,
  onValueChange,
  error,
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.pickerButton,
          error && styles.pickerButtonError,
          disabled && styles.pickerButtonDisabled,
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.pickerButtonText,
            !selectedOption && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
        >
          {displayValue}
        </Text>
        <Text style={styles.pickerIcon}>▼</Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionItem, item.value === value && styles.selectedOption]}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text
                    style={[styles.optionText, item.value === value && styles.selectedOptionText]}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
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
  pickerButton: {
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
  pickerButtonError: {
    borderColor: colors.danger[500],
  },
  pickerButtonDisabled: {
    backgroundColor: colors.neutral[100],
    opacity: 0.6,
  },
  pickerButtonText: {
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
  pickerIcon: {
    fontSize: 12,
    color: colors.neutral[500],
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
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  selectedOption: {
    backgroundColor: colors.primary[50],
  },
  optionText: {
    fontSize: 16,
    color: colors.neutral[800],
    flex: 1,
  },
  selectedOptionText: {
    color: colors.primary[500],
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: colors.primary[500],
    fontWeight: '700',
  },
});

export default FormPicker;
