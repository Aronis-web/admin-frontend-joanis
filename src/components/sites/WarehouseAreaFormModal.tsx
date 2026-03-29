import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { WarehouseAreaType, WarehouseAreaTypeLabels, WarehouseAreaTypeDescriptions } from '@/types/enums';
import { warehouseAreasApi } from '@/services/api';

interface WarehouseAreaFormModalProps {
  visible: boolean;
  warehouse: Warehouse | null;
  area?: WarehouseArea | null;
  onClose: () => void;
  onAreaCreated?: () => void;
  onAreaUpdated?: () => void;
}

export const WarehouseAreaFormModal: React.FC<WarehouseAreaFormModalProps> = ({
  visible,
  warehouse,
  area,
  onClose,
  onAreaCreated,
  onAreaUpdated,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [areaType, setAreaType] = useState<WarehouseAreaType>(WarehouseAreaType.GENERAL);
  const [loading, setLoading] = useState(false);

  const isEditMode = !!area;

  useEffect(() => {
    if (visible) {
      if (area) {
        // Edit mode
        setCode(area.code);
        setName(area.name || '');
        setAreaType(area.areaType || WarehouseAreaType.GENERAL);
      } else {
        // Create mode
        setCode('');
        setName('');
        setAreaType(WarehouseAreaType.GENERAL);
      }
    }
  }, [visible, area]);

  const handleSubmit = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'El código del área es requerido');
      return;
    }

    if (!warehouse && !area) {
      Alert.alert('Error', 'No se ha especificado el almacén');
      return;
    }

    try {
      setLoading(true);

      if (isEditMode && area) {
        // Update area
        await warehouseAreasApi.updateWarehouseArea(area.id, {
          code: code.trim(),
          name: name.trim() || undefined,
          areaType: areaType,
        });
        Alert.alert('Éxito', 'Área actualizada correctamente');
        if (onAreaUpdated) {
          onAreaUpdated();
        }
      } else if (warehouse) {
        // Create area
        await warehouseAreasApi.createWarehouseArea(warehouse.id, {
          code: code.trim(),
          name: name.trim() || undefined,
          areaType: areaType,
        });
        Alert.alert('Éxito', 'Área creada correctamente');
        if (onAreaCreated) {
          onAreaCreated();
        }
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving area:', error);
      const errorMessage =
        error.response?.data?.message || `Error al ${isEditMode ? 'actualizar' : 'crear'} el área`;
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setName('');
    setAreaType(WarehouseAreaType.GENERAL);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.areaIcon}>
                <Text style={styles.iconText}>📍</Text>
              </View>
              <Text style={styles.modalTitle}>{isEditMode ? 'Editar Área' : 'Crear Área'}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Código del Área <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: A1, B2, C3"
                value={code}
                onChangeText={setCode}
                maxLength={50}
                editable={!loading}
              />
              <Text style={styles.hint}>
                Máximo 50 caracteres. Debe ser único dentro del almacén.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre del Área (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Zona A - Productos Perecederos"
                value={name}
                onChangeText={setName}
                maxLength={200}
                editable={!loading}
              />
              <Text style={styles.hint}>Máximo 200 caracteres</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Tipo de Área <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={areaType}
                  onValueChange={(value) => setAreaType(value as WarehouseAreaType)}
                  enabled={!loading}
                  style={styles.picker}
                >
                  {Object.values(WarehouseAreaType).map((type) => (
                    <Picker.Item
                      key={type}
                      label={WarehouseAreaTypeLabels[type]}
                      value={type}
                    />
                  ))}
                </Picker>
              </View>
              <Text style={styles.hint}>
                {WarehouseAreaTypeDescriptions[areaType]}
              </Text>
            </View>

            {warehouse && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>ℹ️ Información</Text>
                <Text style={styles.infoBoxText}>
                  Esta área pertenecerá al almacén:{' '}
                  <Text style={styles.bold}>{warehouse.name}</Text>
                </Text>
              </View>
            )}

            {area && (
              <View style={styles.warningBox}>
                <Text style={styles.warningBoxTitle}>⚠️ Advertencia</Text>
                <Text style={styles.warningBoxText}>
                  Al eliminar un área, los items de stock asociados tendrán su área establecida a
                  NULL.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Guardando...' : isEditMode ? 'Actualizar' : 'Crear'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '80%',
    paddingBottom: spacing[5],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  areaIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  iconText: {
    fontSize: 24,
  },
  modalTitle: {
    fontSize: 20,
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
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
  },
  formGroup: {
    marginBottom: spacing[5],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  required: {
    color: colors.danger[500],
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
  },
  hint: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  pickerContainer: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: colors.neutral[800],
  },
  infoBox: {
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginTop: spacing[2],
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[500],
    marginBottom: spacing[2],
  },
  infoBoxText: {
    fontSize: 14,
    color: colors.neutral[800],
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: colors.warning[100],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginTop: spacing[2],
  },
  warningBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning[600],
    marginBottom: spacing[2],
  },
  warningBoxText: {
    fontSize: 14,
    color: colors.neutral[800],
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    gap: spacing[3],
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  submitButton: {
    backgroundColor: colors.primary[500],
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default WarehouseAreaFormModal;
