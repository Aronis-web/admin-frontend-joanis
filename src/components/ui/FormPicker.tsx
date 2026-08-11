import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Platform } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  const styles = useThemedStyles(createStyles);
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
  pickerButton: {
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
  pickerButtonError: {
    borderColor: theme.color.border.error,
  },
  pickerButtonDisabled: {
    backgroundColor: theme.color.surface.disabled,
    opacity: 0.6,
  },
  pickerButtonText: {
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
  pickerIcon: {
    fontSize: 12,
    color: theme.color.text.muted,
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
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  selectedOption: {
    backgroundColor: theme.color.brand.accentSoft,
  },
  optionText: {
    fontSize: 16,
    color: theme.color.text.body,
    flex: 1,
  },
  selectedOptionText: {
    color: theme.color.brand.accent,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: theme.color.brand.accent,
    fontWeight: '700',
  },
});

export default FormPicker;
